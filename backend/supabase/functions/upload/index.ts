// /functions/upload/index.ts
// POST: generate signed upload URL for Supabase Storage
// The mini program uploads directly to Storage using the signed URL,
// bypassing the Edge Function for the actual file transfer.

import { okResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/ai.ts";
import { verifyJWT } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AppError, errorResponse } from "../_shared/errors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = Deno.env.get("STORAGE_BUCKET") || "gengdongta-assets";

interface UploadBody {
  fileName: string;
  fileType: string;
  category: string;
  petId?: number;
}

interface UploadResponse {
  signedUrl: string;
  publicUrl: string;
  token: string;
  filePath: string;
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
    const user = await verifyJWT(req);

    if (!checkRateLimit(`upload:${user.id}`, 20, 60000)) {
      return errorResponse("RATE_LIMITED", "上传太频繁，请稍后再试", 429);
    }

    const body: UploadBody = await req.json();

    if (!body.fileName || !body.fileType) {
      return errorResponse("INVALID_PARAMS", "缺少文件名或文件类型", 400);
    }

    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
    ];
    if (!allowedTypes.includes(body.fileType)) {
      return errorResponse("INVALID_FILE", "仅支持 JPEG/PNG/WebP/GIF 格式", 400);
    }

    const ext = body.fileName.split(".").pop() ?? "jpg";
    const timestamp = Date.now();
    const random = crypto.randomUUID().slice(0, 8);
    const category = body.category || "general";
    const safePath = `${category}/${user.id}_${timestamp}_${random}.${ext}`;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: signedData, error: signedErr } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(safePath);

    if (signedErr) {
      console.error("Signed URL error:", signedErr);
      return errorResponse("UPLOAD_FAILED", "生成上传链接失败", 500);
    }

    const { data: publicData } = supabase
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(safePath);

    const result: UploadResponse = {
      signedUrl: signedData.signedUrl,
      publicUrl: publicData.publicUrl,
      token: signedData.token,
      filePath: safePath,
    };

    return okResponse(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("upload error:", err);
    return errorResponse("INTERNAL", "上传服务异常", 500);
  }
});
