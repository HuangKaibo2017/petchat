/**
 * AI service abstraction.
 * Supports:
 *   1. Coze (扣子) agents — primary, project-ID based
 *   2. OpenAI-compatible APIs — fallback via LLM_API_URL
 */

// Coze configs from environment
const COZE_API_KEY = Deno.env.get("COZE_API_KEY")!;
const COZE_AGENT_URL = Deno.env.get("COZE_AGENT_URL") ||
  "https://7fwvpgbyhs.coze.site/stream_run";

// LLM fallback
const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const LLM_API_URL = Deno.env.get("LLM_API_URL") ||
  "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIStreamCallbacks {
  onToken?: (token: string) => void;
}

// ============================================================
// Coze Agent API
// ============================================================

interface CozeRequest {
  project_id: string;
  user_id: string;
  parameters: Record<string, unknown>;
  stream?: boolean;
}

/**
 * Call a Coze agent (non-streaming).
 */
export async function cozeChat(
  projectId: string,
  userId: string,
  parameters: Record<string, unknown>,
): Promise<string> {
  const body: CozeRequest = {
    project_id: projectId,
    user_id: userId,
    parameters,
    stream: false,
  };

  const res = await fetch(COZE_AGENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${COZE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Coze API error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  if (data.code !== 0) {
    throw new Error(`Coze error: ${data.msg || JSON.stringify(data)}`);
  }

  return data.data?.content ?? data.data?.answer ?? JSON.stringify(data);
}

/**
 * Call Coze with streaming (for chat).
 * Uses a buffer to handle SSE lines that span chunk boundaries.
 */
export async function cozeChatStream(
  projectId: string,
  userId: string,
  parameters: Record<string, unknown>,
  callbacks: AIStreamCallbacks,
): Promise<string> {
  const body: CozeRequest = {
    project_id: projectId,
    user_id: userId,
    parameters,
    stream: true,
  };

  const res = await fetch(COZE_AGENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${COZE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Coze API error ${res.status}: ${errText}`);
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
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const token =
            parsed.data?.content ??
            parsed.choices?.[0]?.delta?.content ??
            parsed.content ??
            "";

          if (token && typeof token === "string") {
            fullContent += token;
            if (callbacks.onToken) callbacks.onToken(token);
          }
        } catch {
          // skip parse errors on malformed lines
        }
      }
    }
  } finally {
    // Ensure reader is released
    try { reader.releaseLock(); } catch { /* already released */ }
  }

  return fullContent;
}

// ============================================================
// OpenAI-compatible API (LLM fallback)
// ============================================================

export async function aiChat(
  messages: AIMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: string;
  },
): Promise<string> {
  if (!LLM_API_KEY && !LLM_API_URL) {
    throw new Error("No LLM API configured");
  }

  const res = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(LLM_API_KEY ? { "Authorization": `Bearer ${LLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") || "deepseek-v3",
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      ...(options?.responseFormat === "json"
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function aiChatStream(
  messages: AIMessage[],
  callbacks: AIStreamCallbacks,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  if (!LLM_API_KEY && !LLM_API_URL) {
    throw new Error("No LLM API configured");
  }

  const res = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(LLM_API_KEY ? { "Authorization": `Bearer ${LLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") || "deepseek-v3",
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
// Simple in-memory rate limiter
// NOTE: Works correctly for single-isolate deployments (Supabase/Deno Deploy).
// For multi-region deployments, migrate to a database-backed counter or Redis.
// ============================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a user has exceeded the rate limit for an action.
 * Returns true if allowed, false if rate limited.
 */
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
