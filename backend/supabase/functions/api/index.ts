// /functions/api/index.ts
// Unified API proxy — handles pets, products, hospitals, favorites, orders, reports

import { okResponse, failResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

function getRoute(path: string): string {
  // Strip /api prefix if present
  let route = path;
  if (route.startsWith("/api/")) route = route.slice(4);
  if (route.startsWith("/")) route = route.slice(1);
  return route;
}

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

    // Auth required for most endpoints
    let userId = 0;
    try {
      const user = await verifyJWT(req);
      userId = user.id;
    } catch {
      // Some endpoints may be public (products, hospitals)
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

async function handlePets(req: Request, userId: number, id?: string, action?: string): Promise<Response> {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    const { data: pets } = await supabase
      .from("t_pet")
      .select("*, t_pet_type:f_pet_type_id(f_name)")
      .eq("f_user_id", userId)
      .order("f_id", { ascending: true });
    return okResponse(pets || []);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const insert = {
      f_user_id: userId,
      f_name: body.name || "未命名",
      f_pet_type_id: body.petTypeId || 1,
      f_breed_id: body.breedId || null,
      f_gender_id: body.genderId || 1,
      f_birth_date: body.birthDate || null,
      f_birth_year: body.birthYear || null,
      f_birth_month: body.birthMonth || null,
      f_weight: body.weight || null,
      f_sterilized: body.sterilized || false,
      f_vaccinated: body.vaccinated || false,
      f_lang: "zh-CN",
      f_public_uid: crypto.randomUUID(),
    };
    const { data: pet } = await supabase.from("t_pet").insert(insert).select("*").single();
    return okResponse(pet);
  }

  if (req.method === "PUT" && id) {
    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.f_name = body.name;
    if (body.petTypeId !== undefined) update.f_pet_type_id = body.petTypeId;
    if (body.breedId !== undefined) update.f_breed_id = body.breedId;
    if (body.genderId !== undefined) update.f_gender_id = body.genderId;
    if (body.birthDate !== undefined) update.f_birth_date = body.birthDate;
    if (body.weight !== undefined) update.f_weight = body.weight;
    if (body.sterilized !== undefined) update.f_sterilized = body.sterilized;
    if (body.vaccinated !== undefined) update.f_vaccinated = body.vaccinated;
    update.f_updated_at = new Date().toISOString();

    const { data: pet } = await supabase.from("t_pet").update(update).eq("f_id", parseInt(id!)).eq("f_user_id", userId).select("*").single();
    return okResponse(pet);
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
    const { data: product } = await supabase.from("t_product_spu").select("*").eq("f_id", parseInt(id)).single();
    return okResponse(product);
  }

  if (req.method === "GET") {
    const category = url.searchParams.get("category");
    let query = supabase.from("t_product_spu").select("*").limit(50);
    if (category) query = query.eq("f_category_id", parseInt(category));
    const { data: products } = await query;
    return okResponse(products || []);
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Hospitals ─────────────────────────────────────────

async function handleHospitals(req: Request, _userId: number, id?: string): Promise<Response> {
  const supabase = getServiceClient();
  const url = new URL(req.url);

  if (req.method === "GET" && id) {
    const { data: hospital } = await supabase.from("t_hospital").select("*").eq("f_id", parseInt(id)).single();
    return okResponse(hospital);
  }

  if (req.method === "GET") {
    const keyword = url.searchParams.get("keyword");
    let query = supabase.from("t_hospital").select("*").limit(50);
    if (keyword) query = query.ilike("f_name", `%${keyword}%`);
    const { data: hospitals } = await query;
    return okResponse(hospitals || []);
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

    // Insert order items if provided
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

    // Check if already favorited
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
    // Try each report table
    const tables = ["t_report_emotion", "t_report_health", "t_report_human_pet_risk", "t_report_personality"];
    for (const table of tables) {
      const { data: report } = await supabase.from(table).select("*").eq("f_id", parseInt(id)).eq("f_user_id", userId).single();
      if (report) return okResponse(report);
    }
    return errorResponse(ERR.NOT_FOUND.code, "报告不存在", 404);
  }

  if (req.method === "GET") {
    const type = url.searchParams.get("type");
    const results: any[] = [];

    const queryMap: Record<string, string> = {
      emotion: "t_report_emotion",
      health: "t_report_health",
      risk: "t_report_human_pet_risk",
      personality: "t_report_personality",
    };

    if (type && queryMap[type]) {
      const { data } = await supabase.from(queryMap[type]).select("*").eq("f_user_id", userId).order("f_created_at", { ascending: false }).limit(50);
      if (data) results.push(...data);
    } else {
      for (const table of Object.values(queryMap)) {
        const { data } = await supabase.from(table).select("*").eq("f_user_id", userId).order("f_created_at", { ascending: false }).limit(20);
        if (data) results.push(...data);
      }
    }

    return okResponse(results);
  }

  return errorResponse("INVALID_PARAMS", "不支持的请求", 400);
}

// ─── Upload ────────────────────────────────────────────

async function handleUpload(req: Request, userId: number): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("INVALID_PARAMS", "仅支持 POST", 400);
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const category = form.get("category")?.toString() || "general";
    const petId = form.get("petId")?.toString() || "";

    if (!file) return errorResponse("INVALID_PARAMS", "未找到文件", 400);

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
