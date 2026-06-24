// /functions/api/index.ts
// Unified API proxy — handles pets, products, hospitals, favorites, orders, reports, newpet, medical

import { okResponse, failResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { aiChat, type AIMessage } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

function getRoute(path: string): string {
  let route = path;
  if (route.startsWith("/api/")) route = route.slice(4);
  if (route.startsWith("/")) route = route.slice(1);
  return route;
}

// ─── Field Transformation Helpers ─────────────────────

/** Transform a raw t_pet DB row into frontend-friendly camelCase */
function transformPet(row: Record<string, unknown>): Record<string, unknown> {
  const petTypeName = (row.t_pet_type as Record<string,unknown>)?.f_name as Record<string,string> | undefined;
  const breedName = (row.t_pet_breed as Record<string,unknown>)?.f_name as Record<string,string> | undefined;
  const genderName = (row.t_gender as Record<string,unknown>)?.f_name as Record<string,string> | undefined;
  return {
    id: row.f_id,
    name: row.f_name,
    avatar: row.f_avatar_url || "",
    petTypeId: row.f_pet_type_id,
    petType: petTypeName?.["zh-CN"] || petTypeName?.["en-US"] || "",
    breedId: row.f_breed_id,
    breed: breedName?.["zh-CN"] || breedName?.["en-US"] || "",
    genderId: row.f_gender_id,
    gender: genderName?.["zh-CN"] || genderName?.["en-US"] || "",
    birthDate: row.f_birth_date,
    birthYear: row.f_birth_year,
    birthMonth: row.f_birth_month,
    weight: row.f_weight,
    sterilized: row.f_sterilized,
    vaccinated: row.f_vaccinated,
    tags: row.f_personality_tags,
    statusPet: row.f_status_pet,
    createdAt: row.f_created_at,
    updatedAt: row.f_updated_at,
  };
}

/** Transform a raw t_product_spu DB row into frontend-friendly camelCase */
function transformProduct(row: Record<string, unknown>): Record<string, unknown> {
  const catName = (row.t_product_category as Record<string,unknown>)?.f_name as Record<string,string> | undefined;
  const sku = (row.t_product_sku as unknown[]) || [];
  const firstSku = (sku.length > 0 ? sku[0] : null) as Record<string,unknown> | null;
  return {
    id: row.f_id,
    name: row.f_name,
    desc: row.f_description || "",
    categoryId: row.f_category_id,
    category: catName?.["zh-CN"] || catName?.["en-US"] || "",
    price: firstSku ? (firstSku.f_price ?? 0) : 0,
    currency: firstSku ? (firstSku.f_currency ?? "CNY") : "CNY",
    image: ((row.f_meta_info as Record<string,unknown>)?.image as string) || "",
    brand: row.f_brand || "",
  };
}

/** Transform a raw t_hospital DB row into frontend-friendly camelCase */
function transformHospital(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.f_id,
    name: row.f_name,
    address: row.f_address || "",
    phone: row.f_phone || "",
    businessHours: row.f_business_hours || "",
    tags: row.f_service_tags || [],
    rating: row.f_rating || 0,
    lat: ((row.f_meta_info as Record<string,unknown>)?.lat as number) || null,
    lng: ((row.f_meta_info as Record<string,unknown>)?.lng as number) || null,
    image: ((row.f_meta_info as Record<string,unknown>)?.image as string) || "",
  };
}

// ─── Main Router ──────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const route = getRoute(url.pathname);
    const [resource, id, action] = route.split("/");

    let userId = 0;
    try {
      const user = await verifyJWT(req);
      userId = user.id;
    } catch {
      if (!["products", "hospitals"].includes(resource) || req.method !== "GET") {
        throw new AppError("UNAUTHORIZED", "请先登录", 401);
      }
    }

    switch (resource) {
      case "pets": return handlePets(req, userId, id, action);
      case "products": return handleProducts(req, userId, id);
      case "hospitals": return handleHospitals(req, userId, id);
      case "orders": return handleOrders(req, userId);
      case "favorites": return handleFavorites(req, userId);
      case "reports": return handleReports(req, userId, id);
      case "upload": return handleUpload(req, userId);
      case "newpet": return handleNewpetGuide(req, userId);
      case "medical": return handleMedicalGuide(req, userId);
      default:
        return errorResponse("NOT_FOUND", `未知接口: ${resource}`, 404);
    }
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("api error:", err);
    return errorResponse("INTERNAL", "服务异常", 500);
  }
});

// ─── Pets ──────────────────────────────────────────────

/** Build insert/update payload from frontend body, handling all field name variants */
function buildPetPayload(body: Record<string, unknown>, userId: number, isInsert: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // name
  if (body.name !== undefined) payload.f_name = body.name;

  // avatar: multiple field name variants
  const avatar = body.avatar ?? body.avatarUrl ?? body.f_avatar_url;
  if (avatar !== undefined) payload.f_avatar_url = avatar;

  // petTypeId
  if (body.petTypeId !== undefined) payload.f_pet_type_id = body.petTypeId;

  // breedId OR breed string → try numeric, fallback to meta
  if (body.breedId !== undefined) {
    payload.f_breed_id = body.breedId;
  } else if (typeof body.breed === 'string' && body.breed.trim()) {
    const breedStr = body.breed.trim();
    const breedNum = parseInt(breedStr);
    if (!isNaN(breedNum) && breedNum > 0) {
      payload.f_breed_id = breedNum;
    }
    payload.f_meta_info = { ...((body.metaInfo ?? body.f_meta_info ?? {}) as Record<string,unknown>), breedName: breedStr };
  }

  // genderId OR gender string
  if (body.genderId !== undefined) {
    payload.f_gender_id = body.genderId;
  } else if (typeof body.gender === 'string') {
    const g = body.gender.toLowerCase();
    if (g === 'male' || g === '公') payload.f_gender_id = 1;
    else if (g === 'female' || g === '母') payload.f_gender_id = 2;
    else payload.f_gender_id = -1;
  }

  // birth date fields
  if (body.birthDate !== undefined) payload.f_birth_date = body.birthDate;
  if (body.birthYear !== undefined) payload.f_birth_year = body.birthYear;
  if (body.birthMonth !== undefined) payload.f_birth_month = body.birthMonth;

  // age → compute birthYear
  if (body.age !== undefined && body.birthDate === undefined && body.birthYear === undefined) {
    const age = typeof body.age === 'string' ? parseInt(body.age) : (body.age as number);
    if (!isNaN(age) && age > 0) {
      const now = new Date();
      payload.f_birth_year = now.getFullYear() - Math.floor(age);
      payload.f_birth_month = 1;
    }
  }

  // weight
  if (body.weight !== undefined) payload.f_weight = body.weight;

  // sterilized OR neutered
  if (body.sterilized !== undefined) {
    payload.f_sterilized = body.sterilized;
  } else if (body.neutered !== undefined) {
    payload.f_sterilized = body.neutered;
  }

  // vaccinated OR vaccine (string → boolean)
  if (body.vaccinated !== undefined) {
    payload.f_vaccinated = body.vaccinated;
  } else if (body.vaccine !== undefined) {
    const v = typeof body.vaccine === 'string' ? body.vaccine.trim() : '';
    payload.f_vaccinated = !!v && v !== 'false' && v !== '0' && v !== '否' && v !== '未';
  }

  // tags
  if (body.tags !== undefined) payload.f_personality_tags = body.tags;

  // meta_info: merge existing with extra fields
  const existingMeta = ((body.f_meta_info ?? body.metaInfo ?? {}) as Record<string,unknown>);
  const extraMeta: Record<string,unknown> = { ...existingMeta };
  if (body.history !== undefined) extraMeta.history = body.history;
  payload.f_meta_info = extraMeta;

  // insert-only fields
  if (isInsert) {
    payload.f_user_id = userId;
    payload.f_lang = "zh-CN";
    payload.f_public_uid = crypto.randomUUID();
    if (payload.f_name === undefined) payload.f_name = "未命名";
    if (payload.f_pet_type_id === undefined) payload.f_pet_type_id = 1;
  }

  return payload;
}

async function handlePets(req: Request, userId: number, id?: string, action?: string): Promise<Response> {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    const { data: pets } = await supabase
      .from("t_pet")
      .select("*, t_pet_type:f_pet_type_id(f_name), t_pet_breed:f_breed_id(f_name), t_gender:f_gender_id(f_name)")
      .eq("f_user_id", userId)
      .eq("f_deleted", 0)
      .order("f_id", { ascending: true });
    const transformed = (pets || []).map(transformPet);
    return okResponse(transformed);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const insert = buildPetPayload(body, userId, true);
    const { data: pet } = await supabase.from("t_pet").insert(insert).select("*, t_pet_type:f_pet_type_id(f_name), t_pet_breed:f_breed_id(f_name), t_gender:f_gender_id(f_name)").single();
    return okResponse(pet ? transformPet(pet) : null);
  }

  if (req.method === "PUT" && id) {
    const body = await req.json();
    const update = buildPetPayload(body, userId, false);
    update.f_updated_at = new Date().toISOString();

    const { data: pet } = await supabase.from("t_pet").update(update).eq("f_id", parseInt(id!)).eq("f_user_id", userId).select("*, t_pet_type:f_pet_type_id(f_name), t_pet_breed:f_breed_id(f_name), t_gender:f_gender_id(f_name)").single();
    return okResponse(pet ? transformPet(pet) : null);
  }

  if (req.method === "DELETE" && id) {
    await supabase.from("t_pet").update({ f_deleted: 1 }).eq("f_id", parseInt(id!)).eq("f_user_id", userId);
    return okResponse({ deleted: true });
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Products ──────────────────────────────────────────

async function handleProducts(req: Request, _userId: number, id?: string): Promise<Response> {
  const supabase = getServiceClient();
  const url = new URL(req.url);

  if (req.method === "GET" && id) {
    const { data: product } = await supabase
      .from("t_product_spu")
      .select("*, t_product_category:f_category_id(f_name), t_product_sku:f_id(f_price, f_currency)")
      .eq("f_id", parseInt(id))
      .eq("f_deleted", 0)
      .single();
    return okResponse(product ? transformProduct(product) : null);
  }

  if (req.method === "GET") {
    const category = url.searchParams.get("category");
    let query = supabase
      .from("t_product_spu")
      .select("*, t_product_category:f_category_id(f_name), t_product_sku:f_id(f_price, f_currency)")
      .eq("f_deleted", 0)
      .limit(50);
    if (category) query = query.eq("f_category_id", parseInt(category));
    const { data: products } = await query;
    const transformed = (products || []).map(transformProduct);
    return okResponse(transformed);
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Hospitals ─────────────────────────────────────────

async function handleHospitals(req: Request, _userId: number, id?: string): Promise<Response> {
  const supabase = getServiceClient();
  const url = new URL(req.url);

  if (req.method === "GET" && id) {
    const { data: hospital } = await supabase
      .from("t_hospital")
      .select("*")
      .eq("f_id", parseInt(id))
      .eq("f_deleted", 0)
      .single();
    return okResponse(hospital ? transformHospital(hospital) : null);
  }

  if (req.method === "GET") {
    const keyword = url.searchParams.get("keyword");
    let query = supabase.from("t_hospital").select("*").eq("f_deleted", 0).limit(50);
    if (keyword) query = query.ilike("f_name", `%${keyword}%`);
    const { data: hospitals } = await query;
    const transformed = (hospitals || []).map(transformHospital);
    return okResponse(transformed);
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Orders ────────────────────────────────────────────

async function handleOrders(req: Request, userId: number): Promise<Response> {
  const supabase = getServiceClient();

  if (req.method === "POST") {
    const body = await req.json();
    const { data: order } = await supabase.from("t_order").insert({
      f_user_id: userId,
      f_total_amount: body.totalAmount || 0,
      f_shipping_address: body.address || "",
      f_contact_phone: body.phone || "",
      f_contact_name: body.contactName || "",
      f_lang: "zh-CN",
    }).select("*").single();

    if (body.items && order) {
      const items = body.items.map((item: any) => ({
        f_order_id: order.f_id,
        f_product_sku_id: item.skuId || item.productId,
        f_quantity: item.quantity || 1,
        f_unit_price: item.price || 0,
      }));
      await supabase.from("t_order_item").insert(items);
    }

    return okResponse(order);
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Favorites ─────────────────────────────────────────

async function handleFavorites(req: Request, userId: number): Promise<Response> {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    const { data: favs } = await supabase
      .from("t_user_tag")
      .select("*")
      .eq("f_user_id", userId);
    return okResponse(favs || []);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { reportId, type } = body;

    const { data: existing } = await supabase
      .from("t_user_tag")
      .select("f_id")
      .eq("f_user_id", userId)
      .eq("f_tag_value", String(reportId))
      .single();

    if (existing) {
      await supabase.from("t_user_tag").delete().eq("f_id", existing.f_id);
      return okResponse({ favorited: false });
    } else {
      await supabase.from("t_user_tag").insert({
        f_user_id: userId,
        f_tag_type: "favorite",
        f_tag_value: String(reportId),
        f_meta_info: { type: type || "report" },
      });
      return okResponse({ favorited: true });
    }
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Reports ───────────────────────────────────────────

async function handleReports(req: Request, userId: number, id?: string): Promise<Response> {
  const supabase = getServiceClient();
  const url = new URL(req.url);

  if (req.method === "GET" && id) {
    const tables = ["t_report_emotion", "t_report_health", "t_report_human_pet_risk", "t_report_personality"];
    for (const table of tables) {
      try {
        const { data } = await supabase.from(table).select("*").eq("f_id", parseInt(id!)).eq("f_user_id", userId).single();
        if (data) return okResponse(data);
      } catch { continue; }
    }
    return errorResponse("NOT_FOUND", "报告不存在", 404);
  }

  if (req.method === "GET") {
    const type = url.searchParams.get("type");
    const tables = type
      ? [({ emotion: "t_report_emotion", health: "t_report_health", risk: "t_report_human_pet_risk", personality: "t_report_personality" } as Record<string,string>)[type]].filter(Boolean)
      : ["t_report_emotion", "t_report_health", "t_report_human_pet_risk", "t_report_personality"];

    const results: unknown[] = [];
    for (const table of tables) {
      const { data } = await supabase.from(table).select("*").eq("f_user_id", userId).order("f_created_at", { ascending: false }).limit(20);
      if (data) results.push(...data);
    }
    return okResponse(results);
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Upload ────────────────────────────────────────────

async function handleUpload(req: Request, userId: number): Promise<Response> {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return errorResponse("INVALID_PARAMS", "需要multipart/form-data", 400);
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const category = (form.get("category") as string) || "reports";

    if (!file) return errorResponse("INVALID_PARAMS", "缺少文件", 400);

    const supabase = getServiceClient();
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${category}/${userId}_${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("gengdongta-assets")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return errorResponse("UPLOAD_FAILED", "上传失败", 500);
    }

    const { data: urlData } = supabase.storage.from("gengdongta-assets").getPublicUrl(fileName);

    return okResponse({ publicUrl: urlData.publicUrl, fileName });
  } catch (err) {
    console.error("Upload error:", err);
    return errorResponse("UPLOAD_FAILED", "上传失败", 500);
  }
}

// ─── New Pet Guide (AI) ────────────────────────────────

async function handleNewpetGuide(req: Request, userId: number): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("INVALID_PARAMS", "仅支持 POST", 400);
  }
  const body = await req.json();

  const context = [
    body.lifestyle ? `生活习惯：${body.lifestyle}` : '',
    body.space ? `居住空间：${body.space}` : '',
    body.family ? `家庭成员：${body.family}` : '',
    body.budget ? `预算：${body.budget}` : '',
    body.activity ? `活动量：${body.activity}` : '',
    body.allergy ? `过敏：${body.allergy}` : '',
    body.experience ? `经验：${body.experience}` : '',
    body.preference ? `偏好：${body.preference}` : '',
  ].filter(Boolean).join('\n');

  const SYSTEM_PROMPT = `你是宠物购买顾问，根据用户情况推荐最适合的宠物品种。输出JSON：{"recommendations":[{"petType":"类型","breed":"品种","matchScore":95,"reasons":["理由1","理由2"],"careLevel":"低/中/高","monthlyCost":"月均花费","tips":"提醒"}],"summary":"50字总结","disclaimer":"领养代替购买，建议优先考虑救助机构。"}。必须3-5个推荐，matchScore 60-98。`;

  try {
    const messages: AIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: context || "请根据一般情况推荐适合新手的宠物" },
    ];
    const raw = await aiChat(messages, { temperature: 0.5, maxTokens: 3072, responseFormat: "json" });
    const cleaned = raw.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const guide = JSON.parse(cleaned);
    return okResponse({ guide, sessionId: `newpet_${Date.now()}` });
  } catch (err) {
    console.error("newpet error:", err);
    return okResponse({
      guide: { summary: "暂时无法生成建议，请稍后重试。", recommendations: [], disclaimer: "领养代替购买。" },
      sessionId: `newpet_${Date.now()}`,
    });
  }
}

// ─── Medical Guide (AI) ────────────────────────────────

async function handleMedicalGuide(req: Request, userId: number): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("INVALID_PARAMS", "仅支持 POST", 400);
  }
  const body = await req.json();

  const context = [
    body.symptom ? `症状：${body.symptom}` : '',
    body.duration ? `持续时间：${body.duration}` : '',
    body.petType ? `宠物类型：${body.petType}` : '',
    body.petAge ? `年龄：${body.petAge}` : '',
    body.petWeight ? `体重：${body.petWeight}kg` : '',
    body.sterilized !== undefined ? `绝育：${body.sterilized ? '是' : '否'}` : '',
  ].filter(Boolean).join('\n');

  const SYSTEM_PROMPT = `你是宠物临床健康科普助手。只做常识科普，不做确诊不开处方。使用"高度疑似、大概率是"等温和表述。禁止推荐布洛芬、对乙酰氨基酚等对宠物有毒的人用药。输出JSON：{"judgment":"综合判断","symptomExplain":"问题说明","oralMedicine":{"name":"药名","brand":"品牌","dosage":"剂量","example":"举例"},"homeCare":["建议1","建议2","建议3"],"warningSign":["警示1","警示2"],"hospitalCheck":["检查1","检查2"],"disclaimer":"以上内容为科普，不替代执业兽医面诊。"}`;

  try {
    const messages: AIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: context || "宠物出现不适需要建议" },
    ];
    const raw = await aiChat(messages, { temperature: 0.3, maxTokens: 3072, responseFormat: "json" });
    const cleaned = raw.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const guide = JSON.parse(cleaned);
    return okResponse({ guide, sessionId: `medical_${Date.now()}` });
  } catch (err) {
    console.error("medical error:", err);
    return okResponse({
      guide: { judgment: "暂时无法回答，建议咨询专业兽医。", disclaimer: "以上内容为科普，不替代执业兽医面诊。" },
      sessionId: `medical_${Date.now()}`,
    });
  }
}
