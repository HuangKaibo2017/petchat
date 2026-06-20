// /functions/chat/index.ts
// AI pet chat via Coze agent — SSE streaming support

import { okResponse, failResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { cozeChatStream, checkRateLimit, type AIMessage } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

interface ChatSendRequest {
  sessionId: number;
  message: string;
}

interface SessionRequest {
  petId: number;
}

/**
 * Extract route suffix from Supabase Function URL.
 * Handles both:
 *   /chat/sessions          → "sessions"
 *   /functions/v1/chat/xxx  → "xxx"
 *   /chat                   → ""
 */
function getChatRoute(url: URL): string {
  const path = url.pathname;
  const idx = path.indexOf("/chat");
  if (idx === -1) return "";
  return path.slice(idx + 5).replace(/^\/+/, "");
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
    const path = getChatRoute(url);

    if (req.method === "GET" && (path === "" || path === "sessions")) {
      return handleListSessions(req);
    }
    if (req.method === "GET" && path === "messages") {
      const sessionId = url.searchParams.get("sessionId");
      return handleGetMessages(req, sessionId);
    }
    if (req.method === "POST" && path === "sessions") {
      return handleCreateSession(req);
    }
    if (req.method === "POST" && (path === "send" || path === "stream")) {
      return handleSendMessageStream(req);
    }
    if (req.method === "POST" && path === "send-json") {
      return handleSendMessageJson(req);
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

// ─── GET /sessions ───────────────────────────────────────

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
    return okResponse({
      sessions: sessions.map((s) => ({ ...s, petName: petMap.get(s.f_pet_id) ?? null })),
    });
  }

  return okResponse({ sessions: [] });
}

// ─── GET /messages?sessionId= ─────────────────────────────

async function handleGetMessages(req: Request, sessionId: string | null): Promise<Response> {
  const user = await verifyJWT(req);
  if (!sessionId) return errorResponse("INVALID_PARAMS", "缺少 sessionId", 400);

  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("t_chat_history")
    .select("f_id, f_chat_history, f_pet_id")
    .eq("f_id", parseInt(sessionId) || -1)
    .eq("f_user_id", user.id)
    .single();

  if (!session) return errorResponse(ERR.NOT_FOUND.code, "会话不存在", 404);

  return okResponse({
    sessionId: session.f_id,
    petId: session.f_pet_id,
    messages: session.f_chat_history ?? [],
  });
}

// ─── POST /sessions ──────────────────────────────────────

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

  if (existing) return okResponse({ sessionId: existing.f_id, isNew: false });

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

  return okResponse({ sessionId: session?.f_id, isNew: true, greeting });
}

// ─── POST /stream (SSE) ──────────────────────────────────

async function handleSendMessageStream(req: Request): Promise<Response> {
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

  const projectId = Deno.env.get("COZE_CHAT_PROJECT_ID")!;

  // Rate limit: 30 requests per minute per user
  if (!checkRateLimit(`chat:${user.id}`, 30, 60000)) {
    return errorResponse("RATE_LIMITED", "消息发送太频繁，请稍后再试", 429);
  }

  const history = (session.f_chat_history as AIMessage[]) ?? [];
  const userMsg = {
    id: Date.now(),
    role: "user" as const,
    content: body.message,
    at: new Date().toISOString(),
  };
  history.push(userMsg);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (type: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`));
      };

      if (!projectId) {
        const fallbacks = ["主人主人，我在这儿呢！", "能不能摸摸我的头呀？", "汪汪！你今天心情好吗？"];
        const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        const petMsg = { id: Date.now() + 1, role: "pet" as const, content: reply, at: new Date().toISOString() };
        history.push(petMsg);

        // Truncate history to last 200 messages to prevent unbounded growth
      const truncated = history.length > 200 ? history.slice(-200) : history;
      await supabase.from("t_chat_history")
          .update({ f_chat_history: truncated })
          .eq("f_id", session.f_id);

        enqueue("done", { petMessage: petMsg, sessionId: session.f_id });
        controller.close();
        return;
      }

      try {
        const recentMessages = history.slice(-10)
          .map((m) => `${m.role === "user" ? "主人" : (pet?.f_name ?? "宠物")}: ${m.content}`)
          .join("\n");

        const aiReply = await cozeChatStream(
          projectId,
          String(user.id),
          {
            petName: pet?.f_name ?? "宠物",
            conversation: recentMessages,
            latestMessage: body.message,
            personalityTags: pet?.f_personality_tags ?? [],
          },
          {
            onToken: (token: string) => {
              enqueue("token", { token });
            },
          },
        );

        const petMsg = {
          id: Date.now() + 1,
          role: "pet" as const,
          content: aiReply,
          at: new Date().toISOString(),
        };
        history.push(petMsg);

        // Truncate history to last 200 messages to prevent unbounded growth
      const truncated = history.length > 200 ? history.slice(-200) : history;
      await supabase.from("t_chat_history")
          .update({ f_chat_history: truncated })
          .eq("f_id", session.f_id);

        enqueue("done", { petMessage: petMsg, sessionId: session.f_id });
        controller.close();
      } catch (aiErr) {
        console.error("Coze chat error:", aiErr);
        const fallbacks = ["主人主人，我在这儿呢！", "能不能摸摸我的头呀？", "汪汪！你今天心情好吗？"];
        const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        const petMsg = { id: Date.now() + 1, role: "pet" as const, content: reply, at: new Date().toISOString() };
        history.push(petMsg);

        // Truncate history to last 200 messages to prevent unbounded growth
      const truncated = history.length > 200 ? history.slice(-200) : history;
      await supabase.from("t_chat_history")
          .update({ f_chat_history: truncated })
          .eq("f_id", session.f_id);

        enqueue("done", { petMessage: petMsg, sessionId: session.f_id });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── POST /send-json (JSON fallback) ─────────────────────

async function handleSendMessageJson(req: Request): Promise<Response> {
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

  const history = (session.f_chat_history as AIMessage[]) ?? [];
  const userMsg = {
    id: Date.now(),
    role: "user" as const,
    content: body.message,
    at: new Date().toISOString(),
  };
  history.push(userMsg);

  const projectId = Deno.env.get("COZE_CHAT_PROJECT_ID")!;

  if (!checkRateLimit(`chat:${user.id}`, 30, 60000)) {
    return errorResponse("RATE_LIMITED", "消息发送太频繁，请稍后再试", 429);
  }

  if (!projectId) {
    const fallbacks = ["主人主人！", "汪！我在呢~", "摸摸头~", "今天也很想你哦！"];
    const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    const petMsg = { id: Date.now() + 1, role: "pet" as const, content: reply, at: new Date().toISOString() };
    history.push(petMsg);
    await supabase.from("t_chat_history").update({ f_chat_history: history }).eq("f_id", session.f_id);
    return okResponse({ sessionId: session.f_id, userMessage: userMsg, petMessage: petMsg });
  }

  let aiReply: string;
  try {
    aiReply = await cozeChatStream(
      projectId,
      String(user.id),
      {
        petName: pet?.f_name ?? "宠物",
        conversation: history.slice(-10).map((m) =>
          `${m.role === "user" ? "主人" : pet?.f_name ?? "宠物"}: ${m.content}`
        ).join("\n"),
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

  return okResponse({ sessionId: session.f_id, userMessage: userMsg, petMessage: petMsg });
}
