// /functions/wechat-auth/index.ts
// POST: exchange wx.login() code for Supabase JWT
// GET:  verify current token

import { corsResponse } from "../_shared/cors.ts";
import { exchangeWechatCode } from "../_shared/auth.ts";
import { AppError, errorResponse } from "../_shared/errors.ts";

interface WechatAuthBody {
  code: string; // wx.login() code
  nickName?: string;
  avatarUrl?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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
    const path = url.pathname.split("/").pop();

    if (req.method === "POST" && path === "wechat-auth") {
      const body: WechatAuthBody = await req.json();

      if (!body.code) {
        return errorResponse("INVALID_PARAMS", "缺少微信登录 code", 400);
      }

      const result = await exchangeWechatCode(body.code, {
        nickName: body.nickName,
        avatarUrl: body.avatarUrl,
      });

      return corsResponse({
        token: result.token,
        expiresIn: 3600,
        user: result.user,
      });
    }

    return errorResponse("NOT_FOUND", "Not found", 404);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("wechat-auth error:", err);
    return errorResponse("INTERNAL", "服务器内部错误", 500);
  }
});
