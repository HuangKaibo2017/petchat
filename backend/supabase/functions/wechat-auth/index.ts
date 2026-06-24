// /functions/wechat-auth/index.ts
// POST: exchange wx.login() code for Supabase JWT
// Returns user profile with frontend-friendly camelCase fields

import { okResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/ai.ts";
import { exchangeWechatCode } from "../_shared/auth.ts";
import { AppError, errorResponse } from "../_shared/errors.ts";

interface WechatAuthBody {
  code: string;
  nickName?: string;
  avatarUrl?: string;
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
    if (req.method !== "POST") {
      return errorResponse("NOT_FOUND", "Not found", 404);
    }

    // Rate limit: 10 login attempts per minute per IP-like key
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    if (!checkRateLimit(`auth:${clientIp}`, 10, 60000)) {
      return errorResponse("RATE_LIMITED", "登录太频繁，请稍后再试", 429);
    }

    const body: WechatAuthBody = await req.json();

    if (!body.code) {
      return errorResponse("INVALID_PARAMS", "缺少微信登录 code", 400);
    }

    const result = await exchangeWechatCode(body.code, {
      nickName: body.nickName,
      avatarUrl: body.avatarUrl,
    });

    return okResponse({
      token: result.token,
      expiresIn: 3600,
      user: result.user,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("wechat-auth error:", err);
    return errorResponse("INTERNAL", "服务器内部错误", 500);
  }
});
