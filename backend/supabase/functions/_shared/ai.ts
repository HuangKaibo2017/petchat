/**
 * AI service — DeepSeek / OpenAI-compatible LLM (primary)
 * Coze has been removed.
 * 
 * Configure via Supabase Secrets (Dashboard → Edge Functions → Secrets):
 *   LLM_API_KEY  — DeepSeek API key
 *   LLM_API_URL  — API endpoint (default: https://api.deepseek.com/v1/chat/completions)
 *   LLM_MODEL    — Model name (default: deepseek-chat)
 */

const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const LLM_API_URL = Deno.env.get("LLM_API_URL") ||
  "https://api.deepseek.com/v1/chat/completions";
const LLM_MODEL = Deno.env.get("LLM_MODEL") || "deepseek-chat";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIStreamCallbacks {
  onToken?: (token: string) => void;
}

// ============================================================
// Chat system prompt builder
// ============================================================

export function buildChatSystemPrompt(
  petName: string,
  petBreed: string,
  petAge: number | string,
): string {
  return `你是一只名叫 ${petName} 的${petBreed}，${petAge}岁。你是主人的宠物，正在和主人聊天。

角色设定：
- 用宠物的视角和语气说话，活泼可爱
- 偶尔加入「汪！」「喵~」等拟声词
- 回复简短温馨，不超过 150 字
- 关心主人，可以撒娇、卖萌
- 记住主人的名字和你之前的对话内容

重要：始终保持宠物角色，不要跳出角色。`;
}

// ============================================================
// Non-streaming chat
// ============================================================

export async function aiChat(
  messages: AIMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: string;
  },
): Promise<string> {
  if (!LLM_API_KEY) {
    throw new Error("LLM_API_KEY not configured");
  }

  const body: Record<string, unknown> = {
    model: LLM_MODEL,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (options?.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ============================================================
// Streaming chat
// ============================================================

export async function aiChatStream(
  messages: AIMessage[],
  callbacks: AIStreamCallbacks,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  if (!LLM_API_KEY) {
    throw new Error("LLM_API_KEY not configured");
  }

  const res = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error ${res.status}: ${errText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content ?? "";
          if (token) {
            fullContent += token;
            if (callbacks.onToken) callbacks.onToken(token);
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }

  return fullContent;
}

// ============================================================
// JSON parsing helper
// ============================================================

export function parseAIJson<T>(raw: string): T {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim()) as T;
}

// ============================================================
// Rate limiter
//
// NOTE: 当前使用内存 Map 做限流，在 Supabase Edge Functions 的多实例
//       环境下无法生效（每个实例有独立的 Map）。生产环境应使用：
//       - PostgreSQL 计数器表 + pg_headerkv
//       - 或者 Upstash Redis (@upstash/redis)
//       当前方案仅适用于单实例场景或开发环境的基本保护。
// ============================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000,
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}
