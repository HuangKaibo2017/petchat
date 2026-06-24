// /functions/health-report/index.ts
// POST: Generate pet health assessment via DeepSeek LLM

import { okResponse, failResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { checkQuota, recordUsage } from "../_shared/db.ts";
import { aiChat, checkRateLimit, parseAIJson, type AIMessage } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

interface HealthRequest {
  petId: number;
  symptom: string;
  duration: string;
  abnormal?: string;
  numbers?: string[];
  imageUrl?: string;
}

interface HealthReport {
  currentSymptoms: string;
  symptomMapping: Array<{ area: string; symptoms: string }>;
  potentialDeficiencies: string;
  deficiencyDetails: Array<{ type: string; manifestations: string }>;
  emergency: string;
  futureRisk: string;
  healthScore: string;
  carePlan: Array<{ title: string; desc: string }>;
}

const HEALTH_SYSTEM_PROMPT = `你是宠物健康顾问，为宠物提供健康监测分析。

职责：
1. 解读主人提供的症状描述
2. 判断是否需要立即就医
3. 给出居家护理建议
4. 提醒定期体检和疫苗接种

重要原则：
- 你不能替代兽医诊断，始终建议「如有疑虑请咨询兽医」
- 遇到紧急症状（如呼吸困难、持续呕吐、抽搐）应立即建议就医
- 回复结构清晰，分点说明

紧急症状参考：呼吸困难、严重出血、意识丧失、持续呕吐/腹泻超过24小时、无法站立、抽搐。

【输出要求】
严格输出一个 JSON 对象，不要包含任何 markdown 标记或额外文字。
JSON 字段：

{
  "currentSymptoms": "当前症状总结，40-80字",
  "symptomMapping": [
    {"area": "身体部位/系统", "symptoms": "对应症状描述"}
  ],
  "potentialDeficiencies": "潜在营养或健康缺失总结，30-60字",
  "deficiencyDetails": [
    {"type": "缺失类型", "manifestations": "具体表现"}
  ],
  "emergency": "是否需要立即就医的判断，20-40字",
  "futureRisk": "未来发展风险评估，30-60字",
  "healthScore": "★★☆☆☆ 到 ★★★★★",
  "carePlan": [
    {"title": "方案标题1", "desc": "具体建议40-60字"},
    {"title": "方案标题2", "desc": "具体建议40-60字"},
    {"title": "方案标题3", "desc": "具体建议40-60字"}
  ]
}`;

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
    if (!checkRateLimit('health-report:'+user.id, 10, 60000)) {
      return errorResponse("RATE_LIMITED", "请求太频繁，请稍后再试", 429);
    }
    const remaining = await checkQuota(user.id, "health_report");

    const body: HealthRequest = await req.json();
    if (!body.petId || !body.symptom || !body.duration) {
      return errorResponse(ERR.INVALID_PARAMS.code, "请提供宠物ID、症状和持续时间", 400);
    }

    const supabase = getServiceClient();
    const { data: pet } = await supabase
      .from("t_pet")
      .select("f_id, f_name, f_pet_type_id, f_gender_id, f_birth_date, f_weight, f_sterilized, f_vaccinated")
      .eq("f_id", body.petId)
      .eq("f_user_id", user.id)
      .single();

    if (!pet) return errorResponse(ERR.NOT_FOUND.code, "宠物不存在", 404);

    const contextParts = [
      `宠物：${pet.f_name}`,
      `体重：${pet.f_weight ?? "未知"}kg`,
      `绝育：${pet.f_sterilized ? "是" : "否"}`,
      `疫苗：${pet.f_vaccinated ? "已完成" : "未完成"}`,
      `症状：${body.symptom}`,
      `持续时间：${body.duration}`,
    ];
    if (body.abnormal) contextParts.push(`异常情况：${body.abnormal}`);
    if (body.numbers?.length) contextParts.push(`测评数字：${body.numbers.join(",")}`);
    if (body.imageUrl) contextParts.push(`参考图片：${body.imageUrl}`);

    const messages: AIMessage[] = [
      { role: "system", content: HEALTH_SYSTEM_PROMPT },
      { role: "user", content: contextParts.join("\n") },
    ];

    let reportJson: HealthReport;
    try {
      const raw = await aiChat(messages, {
        temperature: 0.3,
        maxTokens: 3072,
        responseFormat: "json",
      });
      reportJson = parseAIJson<HealthReport>(raw);
    } catch (aiErr) {
      console.error("LLM error:", aiErr);
      return errorResponse(ERR.AI_FAILED.code, ERR.AI_FAILED.message, 503);
    }

    const healthStars = (reportJson.healthScore?.match(/★/g) ?? []).length;
    let healthLevel: string;
    if (healthStars >= 4) healthLevel = "健康良好";
    else if (healthStars >= 3) healthLevel = "亚健康";
    else if (healthStars >= 2) healthLevel = "需要关注";
    else healthLevel = "建议就医";

    const { data: savedReport } = await supabase
      .from("t_report_health")
      .insert({
        f_user_id: user.id,
        f_pet_id: body.petId,
        f_lang: "zh-CN",
        f_report_type_id: 2,
        f_health_score: healthStars,
        f_health_level: healthLevel,
        f_check_mode: "symptom_input",
        f_input_symptoms: {
          symptom: body.symptom,
          duration: body.duration,
          abnormal: body.abnormal ?? "",
          numbers: body.numbers ?? [],
          imageUrl: body.imageUrl ?? "",
        },
        f_meta_info: {
          symptomMapping: reportJson.symptomMapping,
          potentialDeficiencies: reportJson.potentialDeficiencies,
          deficiencyDetails: reportJson.deficiencyDetails,
          emergency: reportJson.emergency,
          futureRisk: reportJson.futureRisk,
          carePlan: reportJson.carePlan,
        },
      })
      .select("f_id")
      .single();

    await recordUsage(user.id, "health_report", savedReport?.f_id);

    return okResponse({
      reportId: savedReport?.f_id,
      petName: pet.f_name,
      time: new Date().toLocaleString("zh-CN"),
      ...reportJson,
      remaining,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("health-report error:", err);
    return errorResponse("INTERNAL", "报告生成失败", 500);
  }
});
