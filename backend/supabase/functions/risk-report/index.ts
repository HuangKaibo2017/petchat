// /functions/risk-report/index.ts
// POST: Human-pet risk assessment via DeepSeek LLM

import { okResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { checkQuota, recordUsage } from "../_shared/db.ts";
import { aiChat, checkRateLimit, parseAIJson, type AIMessage } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

interface RiskRequest {
  petId: number;
  reportId?: number;
  ownerBirthday: string;
  tongueImage?: string;
}

interface RiskReport {
  petImbalance: string;
  qiRisk: string;
  microbiomeRisk: string;
  lifestyleRisk: string;
  jointCarePlan: string;
  medicalAdvice: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  riskFactors: Array<{ factor: string; level: string }>;
  recommendations: string[];
}

const RISK_SYSTEM_PROMPT = `你是宠物体质综合分析专家，采用中医体质学视角为宠物做人宠风险评估。

你需要结合宠物的五行体质、主人的生辰信息、以及宠物的健康数据，分析人宠之间的气场匹配度和潜在健康风险。

【输出要求】
严格输出一个 JSON 对象，不要包含任何 markdown 标记或额外文字。

{
  "petImbalance": "宠物体质偏颇分析，40-80字",
  "qiRisk": "气场不和风险评估，30-60字",
  "microbiomeRisk": "微生物群风险评估，30-60字",
  "lifestyleRisk": "生活方式风险评估，30-60字",
  "jointCarePlan": "关节养护方案，40-80字",
  "medicalAdvice": "医疗建议，30-60字",
  "riskLevel": "low / medium / high",
  "riskScore": 0-100的数字,
  "riskFactors": [
    {"factor": "风险因素", "level": "low / medium / high"}
  ],
  "recommendations": [
    "建议1",
    "建议2",
    "建议3"
  ]
}

注意：
- riskScore: low为0-33，medium为34-66，high为67-100
- riskFactors 至少2个
- recommendations 至少3个
- 免责声明：本报告为体质倾向评估，不作为临床诊断依据`;

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
    if (!checkRateLimit('risk-report:'+user.id, 10, 60000)) {
      return errorResponse("RATE_LIMITED", "请求太频繁，请稍后再试", 429);
    }
    const remaining = await checkQuota(user.id, "risk_report");

    const body: RiskRequest = await req.json();
    if (!body.petId || !body.ownerBirthday) {
      return errorResponse(ERR.INVALID_PARAMS.code, "请提供宠物ID和主人生日", 400);
    }

    const supabase = getServiceClient();
    const { data: pet } = await supabase
      .from("t_pet")
      .select("f_id, f_name, f_pet_type_id, f_birth_date, f_weight")
      .eq("f_id", body.petId)
      .eq("f_user_id", user.id)
      .single();

    if (!pet) return errorResponse(ERR.NOT_FOUND.code, "宠物不存在", 404);

    // Get health report context if provided
    let healthContext = "";
    if (body.reportId) {
      const { data: hr } = await supabase
        .from("t_report_health")
        .select("f_health_score, f_health_level, f_input_symptoms")
        .eq("f_id", body.reportId)
        .eq("f_user_id", user.id)
        .single();
      if (hr) healthContext = JSON.stringify(hr.f_input_symptoms);
    }

    const contextParts = [
      `宠物：${pet.f_name}`,
      `宠物生日：${pet.f_birth_date ?? "未知"}`,
      `宠物体重：${pet.f_weight ?? "未知"}kg`,
      `主人生日：${body.ownerBirthday}`,
    ];
    if (healthContext) contextParts.push(`健康报告数据：${healthContext}`);
    if (body.tongueImage) contextParts.push(`舌象图片：${body.tongueImage}`);

    const messages: AIMessage[] = [
      { role: "system", content: RISK_SYSTEM_PROMPT },
      { role: "user", content: contextParts.join("\n") },
    ];

    let reportJson: RiskReport;
    try {
      const raw = await aiChat(messages, {
        temperature: 0.4,
        maxTokens: 4096,
        responseFormat: "json",
      });
      reportJson = parseAIJson<RiskReport>(raw);
    } catch (aiErr) {
      console.error("LLM error:", aiErr);
      return errorResponse(ERR.AI_FAILED.code, ERR.AI_FAILED.message, 503);
    }

    const riskLevelMap: Record<string, number> = { low: 1, medium: 2, high: 3 };

    const { data: savedReport } = await supabase
      .from("t_report_human_pet_risk")
      .insert({
        f_user_id: user.id,
        f_pet_id: body.petId,
        f_lang: "zh-CN",
        f_report_type_id: 3,
        f_owner_info: { birthDate: body.ownerBirthday },
        f_risk_level_id: riskLevelMap[reportJson.riskLevel] ?? 2,
        f_risk_score: reportJson.riskScore,
        f_risk_factors: reportJson.riskFactors,
        f_risk_recommendations: reportJson.recommendations,
        f_meta_info: {
          petImbalance: reportJson.petImbalance,
          qiRisk: reportJson.qiRisk,
          microbiomeRisk: reportJson.microbiomeRisk,
          lifestyleRisk: reportJson.lifestyleRisk,
          jointCarePlan: reportJson.jointCarePlan,
          medicalAdvice: reportJson.medicalAdvice,
        },
      })
      .select("f_id")
      .single();

    await recordUsage(user.id, "risk_report", savedReport?.f_id);

    return okResponse({
      reportId: savedReport?.f_id,
      petName: pet.f_name,
      time: new Date().toLocaleString("zh-CN"),
      riskLevel: {
        level: reportJson.riskLevel,
        label:
          reportJson.riskLevel === "high" ? "高风险"
          : reportJson.riskLevel === "medium" ? "中等风险"
          : "低风险",
      },
      ...reportJson,
      remaining,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("risk-report error:", err);
    return errorResponse("INTERNAL", "报告生成失败", 500);
  }
});
