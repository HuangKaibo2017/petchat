// /functions/chat/index.ts
// AI pet chat via Coze agent

import { corsResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { cozeChatStream, type AIMessage } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

interface ChatSendRequest {
  sessionId: number;
  message: string;
}

interface SessionRequest {
  petId: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/chat\/?/, "");

    if (req.method === "GET" && (path === "" || path === "sessions")) {
      return handleListSessions(req);
    }
    if (req.method === "GET" && path.startsWith("messages")) {
      const sessionId = url.searchParams.get("sessionId");
      return handleGetMessages(req, sessionId);
    }
    if (req.method === "POST" && path === "sessions") {
      return handleCreateSession(req);
    }
    if (req.method === "POST" && (path === "send" || path === "")) {
      return handleSendMessage(req);
    }

    return errorResponse("NOT_FOUND", "Not found", 404);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("chat error:", err);
    return errorResponse("INTERNAL", "聊天服务异常", 500);
  }
});

async function handleListSessions(req: Request): Promise<Response> {
  const user = await verifyJWT(req);
  const supabase = getServiceClient();

  const { data: sessions } = await supabase
    .from("t_chat_history")
    .select("f_id, f_pet_id, f_lang, f_status_session, f_started_at, f_ended_at")
    .eq("f_user_id", user.id)
    .eq("f_status_user", 1)
    .order("f_started_at", { ascending: false })
    .limit(50);

  if (sessions) {
    const petIds = sessions.map((s) => s.f_pet_id).filter(Boolean) as number[];
    const { data: pets } = petIds.length > 0
      ? await supabase.from("t_pet").select("f_id, f_name").in("f_id", petIds)
      : { data: [] };

    const petMap = new Map((pets ?? []).map((p) => [p.f_id, p.f_name]));
    return corsResponse({
      sessions: sessions.map((s) => ({ ...s, petName: petMap.get(s.f_pet_id) ?? null })),
    });
  }

  return corsResponse({ sessions: [] });
}

async function handleGetMessages(req: Request, sessionId: string | null): Promise<Response> {
  const user = await verifyJWT(req);
  if (!sessionId) return errorResponse("INVALID_PARAMS", "缺少 sessionId", 400);

  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("t_chat_history")
    .select("f_id, f_chat_history, f_pet_id")
    .eq("f_id", parseInt(sessionId))
    .eq("f_user_id", user.id)
    .single();

  if (!session) return errorResponse(ERR.NOT_FOUND.code, "会话不存在", 404);

  return corsResponse({
    sessionId: session.f_id,
    petId: session.f_pet_id,
    messages: session.f_chat_history ?? [],
  });
}

async function handleCreateSession(req: Request): Promise<Response> {
  const user = await verifyJWT(req);
  const body: SessionRequest = await req.json();
  if (!body.petId) return errorResponse("INVALID_PARAMS", "缺少 petId", 400);

  const supabase = getServiceClient();
  const { data: pet } = await supabase
    .from("t_pet")
    .select("f_id, f_name")
    .eq("f_id", body.petId)
    .eq("f_user_id", user.id)
    .single();

  if (!pet) return errorResponse(ERR.NOT_FOUND.code, "宠物不存在", 404);

  // Check existing active session
  const { data: existing } = await supabase
    .from("t_chat_history")
    .select("f_id")
    .eq("f_user_id", user.id)
    .eq("f_pet_id", body.petId)
    .eq("f_status_session", 1)
    .eq("f_status_user", 1)
    .limit(1)
    .single();

  if (existing) return corsResponse({ sessionId: existing.f_id, isNew: false });

  const greeting = `汪汪！我是${pet.f_name}，今天想跟你聊聊天~ 你想跟我说什么呀？`;

  const { data: session } = await supabase
    .from("t_chat_history")
    .insert({
      f_user_id: user.id,
      f_pet_id: body.petId,
      f_lang: "zh-CN",
      f_status_session: 1,
      f_chat_history: [
        { id: Date.now(), role: "pet", content: greeting, at: new Date().toISOString() },
      ],
    })
    .select("f_id")
    .single();

  return corsResponse({ sessionId: session?.f_id, isNew: true, greeting });
}

async function handleSendMessage(req: Request): Promise<Response> {
  const user = await verifyJWT(req);
  const body: ChatSendRequest = await req.json();
  if (!body.message || !body.sessionId) {
    return errorResponse("INVALID_PARAMS", "缺少 sessionId 或消息内容", 400);
  }

  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("t_chat_history")
    .select("f_id, f_chat_history, f_pet_id")
    .eq("f_id", body.sessionId)
    .eq("f_user_id", user.id)
    .single();

  if (!session) return errorResponse(ERR.NOT_FOUND.code, "会话不存在", 404);

  const { data: pet } = await supabase
    .from("t_pet")
    .select("f_id, f_name, f_pet_type_id, f_personality_tags")
    .eq("f_id", session.f_pet_id)
    .single();

  // Build messages
  const history = (session.f_chat_history as AIMessage[]) ?? [];
  const userMsg = {
    id: Date.now(),
    role: "user" as const,
    content: body.message,
    at: new Date().toISOString(),
  };
  history.push(userMsg);

  // Build conversation context for Coze
  const recentMessages = history.slice(-10).map((m) => `${m.role === "user" ? "主人" : pet?.f_name ?? "宠物"}: ${m.content}`).join("\n");

  const projectId = Deno.env.get("COZE_CHAT_PROJECT_ID")!;
  if (!projectId) {
    // Fallback: simple echo
    const fallbacks = ["主人主人！", "汪！我在呢~", "摸摸头~", "今天也很想你哦！"];
    const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    const petMsg = { id: Date.now() + 1, role: "pet" as const, content: reply, at: new Date().toISOString() };
    history.push(petMsg);

    await supabase.from("t_chat_history").update({ f_chat_history: history }).eq("f_id", session.f_id);
    return corsResponse({ sessionId: session.f_id, userMessage: userMsg, petMessage: petMsg });
  }

  // Call Coze chat agent
  let aiReply: string;
  try {
    aiReply = await cozeChatStream(
      projectId,
      String(user.id),
      {
        petName: pet?.f_name ?? "宠物",
        conversation: recentMessages,
        latestMessage: body.message,
        personalityTags: pet?.f_personality_tags ?? [],
      },
      {},
    );
  } catch (aiErr) {
    console.error("Coze chat error:", aiErr);
    const fallbacks = ["主人主人，我在这儿呢！", "能不能摸摸我的头呀？", "汪汪！你今天心情好吗？"];
    aiReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  const petMsg = {
    id: Date.now() + 1,
    role: "pet" as const,
    content: aiReply,
    at: new Date().toISOString(),
  };
  history.push(petMsg);

  await supabase.from("t_chat_history").update({ f_chat_history: history }).eq("f_id", session.f_id);

  return corsResponse({ sessionId: session.f_id, userMessage: userMsg, petMessage: petMsg });
}
