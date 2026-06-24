import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AppError } from "./errors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
)!;

export function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export interface AuthUser {
  id: number;
  supabaseUserId: string;
  isAnonymous: boolean;
}

/**
 * Verify JWT from Authorization header.
 */
export async function verifyJWT(req: Request): Promise<AuthUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "请先登录", 401);
  }

  const token = authHeader.slice(7);
  const supabase = getServiceClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new AppError("UNAUTHORIZED", "登录已过期，请重新登录", 401);
  }

  const supabaseUserId = user.id.toLowerCase();

  const { data: tUser, error: dbErr } = await supabase
    .from("t_user")
    .select("f_id, f_meta_info")
    .eq("f_public_uid", supabaseUserId)
    .single();

  if (dbErr || !tUser) {
    throw new AppError("UNAUTHORIZED", "用户未注册", 401);
  }

  return {
    id: tUser.f_id as number,
    supabaseUserId,
    isAnonymous: ((tUser.f_meta_info as Record<string,unknown>)?.role === "anonymous"),
  };
}

/**
 * Derive a stable password from openid using SHA-256.
 * Uses a server-side secret so the same openid always maps to the same password,
 * unlike session_key which rotates on every wx.login().
 */
async function derivePassword(openid: string): Promise<string> {
  const secret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${openid}:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/** Frontend-friendly user profile shape */
interface UserProfile {
  id: number;
  name: string;
  nickname: string;
  avatarUrl: string;
  phone: string;
  openid: string;
  supabaseUserId: string;
}

/**
 * Exchange WeChat login code for Supabase JWT.
 *
 * Flow:
 *  1. wx.login() → code
 *  2. Call WeChat API: code → openid + session_key
 *  3. Derive stable password from openid (NOT session_key — it rotates)
 *  4. Sign in / sign up to Supabase Auth
 *  5. Return JWT + user profile with frontend-friendly field names
 */
export async function exchangeWechatCode(
  wxCode: string,
  userInfo?: { nickName?: string; avatarUrl?: string },
): Promise<{ token: string; user: UserProfile }> {
  const supabase = getServiceClient();
  const appId = Deno.env.get("WECHAT_APPID")!;
  const appSecret = Deno.env.get("WECHAT_SECRET")!;

  // Step 1: Exchange code for openid
  const wxRes = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${wxCode}&grant_type=authorization_code`,
  );
  const wxData = await wxRes.json();

  if (wxData.errcode) {
    throw new AppError(
      "WECHAT_AUTH_FAILED",
      `微信授权失败: ${wxData.errmsg}`,
      401,
    );
  }

  const openid = wxData.openid;
  if (!openid) {
    throw new AppError("WECHAT_AUTH_FAILED", "微信未返回 openid", 401);
  }

  // Step 2: Derive stable password (NOT session_key — it rotates every login)
  const email = `${openid}@wechat.gengdongta.local`;
  const password = await derivePassword(openid);

  // Step 3: Sign in, or create the account on first login.
  let authRes = await supabase.auth.signInWithPassword({ email, password });

  if (authRes.error) {
    // First-time user (or stale password): create/repair via admin API
    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      const msg = createErr.message ?? "";
      if (msg.includes("already been registered") || msg.includes("already registered")) {
        // Account exists but with a stale password. Reset it.
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === email);
        if (existing) {
          await supabase.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
          });
        }
      } else {
        throw new AppError("AUTH_FAILED", `账号创建失败: ${msg}`, 500);
      }
    }

    authRes = await supabase.auth.signInWithPassword({ email, password });
    if (authRes.error || !authRes.data.session) {
      throw new AppError(
        "AUTH_FAILED",
        `登录失败: ${authRes.error?.message ?? "未获取到会话"}`,
        500,
      );
    }
  }

  const supabaseUserId = authRes.data.user!.id.toLowerCase();
  const token = authRes.data.session!.access_token;

  // Step 4: Upsert into our t_user table and get the full profile
  const { data: existing } = await supabase
    .from("t_user")
    .select("f_id, f_nickname, f_avatar_url, f_phone")
    .eq("f_public_uid", supabaseUserId)
    .single();

  let tUserId: number;
  let nickname: string;
  let avatarUrl: string;
  let phone: string;

  if (!existing) {
    nickname = (userInfo?.nickName && userInfo.nickName.trim())
      ? userInfo.nickName.trim().slice(0, 64)
      : "微信用户";
    avatarUrl = userInfo?.avatarUrl ?? "";
    phone = "";

    const { data: inserted } = await supabase.from("t_user").insert({
      f_public_uid: supabaseUserId,
      f_nickname: nickname,
      f_avatar_url: avatarUrl,
      f_phone: phone,
      f_meta_info: { wechat_openid: openid },
    }).select("f_id").single();

    if (!inserted) {
      throw new AppError("AUTH_FAILED", "用户写入失败", 500);
    }
    tUserId = inserted.f_id as number;
  } else {
    tUserId = existing.f_id as number;
    // Update nickname/avatar on each login if provided
    if (userInfo?.nickName || userInfo?.avatarUrl) {
      const upd: Record<string, string> = {};
      if (userInfo?.nickName) upd.f_nickname = userInfo.nickName.trim().slice(0, 64);
      if (userInfo?.avatarUrl) upd.f_avatar_url = userInfo.avatarUrl;
      await supabase.from("t_user").update(upd).eq("f_id", tUserId);
    }
    nickname = (userInfo?.nickName && userInfo.nickName.trim())
      ? userInfo.nickName.trim().slice(0, 64)
      : (existing.f_nickname as string);
    avatarUrl = userInfo?.avatarUrl ?? (existing.f_avatar_url as string) ?? "";
    phone = (existing.f_phone as string) ?? "";
  }

  // Return frontend-friendly field names
  return {
    token,
    user: {
      id: tUserId,
      name: nickname,
      nickname: nickname,
      avatarUrl: avatarUrl,
      phone: phone,
      openid,
      supabaseUserId,
    },
  };
}
