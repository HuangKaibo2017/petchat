import { corsResponse } from "./cors.ts";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
): Response {
  return corsResponse({ error: { code, message } }, status);
}

export const ERR = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", message: "请先登录", status: 401 },
  FORBIDDEN: { code: "FORBIDDEN", message: "没有权限", status: 403 },
  NOT_FOUND: { code: "NOT_FOUND", message: "资源不存在", status: 404 },
  QUOTA_EXCEEDED: {
    code: "QUOTA_EXCEEDED",
    message: "今日次数已用完，请明天再来",
    status: 402,
  },
  INVALID_PARAMS: {
    code: "INVALID_PARAMS",
    message: "参数不完整",
    status: 400,
  },
  AI_FAILED: {
    code: "AI_FAILED",
    message: "AI 服务暂时不可用，请稍后重试",
    status: 503,
  },
  UPLOAD_FAILED: {
    code: "UPLOAD_FAILED",
    message: "上传失败，请重试",
    status: 500,
  },
} as const;
