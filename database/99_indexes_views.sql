-- ============================================================
-- PetChat (灵犀宠语) / 99. 跨模块索引与视图 / Cross-Module Indexes & Views
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   1. 跨模块的 JSONB i18n 表达式索引 (常用 locale 加速)
--   2. GIN 全文搜索索引 (跨 enum 表)
--   3. 跨模块视图 (主图/匿名/订单汇总/SKU 库存汇总)
--
-- 依赖:
--   全部 00-13 文件
--
-- 设计原则 (Cross-Module Principles):
--   1. 单表高频查询索引已内联在各自文件中 (e.g. idx_t_order_user_created in 09_ecommerce.sql)
--   2. 本文件只放"跨表/跨模块"或"对所有 enum 表统一"的索引
--   3. 视图统一放这里, 避免循环依赖
-- ============================================================


-- ============================================================
-- 99.1 JSONB i18n 枚举表: B-tree 表达式索引 (常用 locale, 加速等值查询)
-- ============================================================
-- (Supabase Cloud 部署 pgroonga 后, 建议同步加 pgroonga 索引用于 CJK)
-- 这里为简洁仅示例 en-US; 实际部署时按需扩展

CREATE INDEX IF NOT EXISTS idx_t_pet_type_name_en       ON public.t_pet_type        ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_pet_breed_name_en      ON public.t_pet_breed       ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_gender_name_en         ON public.t_gender          ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_photo_type_name_en     ON public.t_photo_type      ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_report_type_name_en    ON public.t_report_type     ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_risk_level_name_en     ON public.t_risk_level      ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_personality_tag_name_en ON public.t_personality_tag ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_status_name_en         ON public.t_status          ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_plan_type_name_en      ON public.t_plan_type       ((f_name->>'en-US'));


-- ============================================================
-- 99.2 GIN 全文搜索 (英语) 跨 enum 表
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_t_pet_type_search_en        ON public.t_pet_type        USING GIN (f_search_en);
CREATE INDEX IF NOT EXISTS idx_t_pet_breed_search_en       ON public.t_pet_breed       USING GIN (f_search_en);
CREATE INDEX IF NOT EXISTS idx_t_status_search_en          ON public.t_status          USING GIN (f_search_en);
CREATE INDEX IF NOT EXISTS idx_t_report_type_search_en     ON public.t_report_type     USING GIN (f_search_en);
CREATE INDEX IF NOT EXISTS idx_t_personality_tag_search_en ON public.t_personality_tag USING GIN (f_search_en);


-- ============================================================
-- 99.3 跨模块高频查询索引 (跨表)
-- ============================================================

-- 宠物: 按用户/类型/状态
CREATE INDEX IF NOT EXISTS idx_t_pet_user     ON public.t_pet(f_user_id);
CREATE INDEX IF NOT EXISTS idx_t_pet_type     ON public.t_pet(f_pet_type_id);
CREATE INDEX IF NOT EXISTS idx_t_pet_status   ON public.t_pet(f_status_pet, f_status_user);
CREATE INDEX IF NOT EXISTS idx_t_pet_photo_pet        ON public.t_pet_photo(f_pet_id);
CREATE INDEX IF NOT EXISTS idx_t_pet_photo_primary    ON public.t_pet_photo(f_pet_id) WHERE f_is_primary;

-- 聊天: 按用户时间/按宠物
CREATE INDEX IF NOT EXISTS idx_t_chat_session_user ON public.t_chat_session(f_user_id, f_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_chat_session_pet  ON public.t_chat_session(f_pet_id);
ALTER TABLE public.t_chat_session ADD COLUMN IF NOT EXISTS f_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 捐款: 按用户/按目标
CREATE INDEX IF NOT EXISTS idx_t_donation_user_created ON public.t_donation(f_user_id, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_donation_target       ON public.t_donation(f_target_type, f_target_id, f_created_at DESC);

-- 领养: 按用户/类型
CREATE INDEX IF NOT EXISTS idx_t_adoption_user ON public.t_adoption(f_user_id);
CREATE INDEX IF NOT EXISTS idx_t_adoption_type ON public.t_adoption(f_adoption_type_id);

-- 志愿者/救助
CREATE INDEX IF NOT EXISTS idx_t_volunteer_user     ON public.t_volunteer(f_user_id);
CREATE INDEX IF NOT EXISTS idx_t_rescue_created     ON public.t_rescue_request(f_created_at DESC);

-- 报告: 按 (user, pet, time)
CREATE INDEX IF NOT EXISTS idx_t_report_emotion_user_pet ON public.t_report_emotion(f_user_id, f_pet_id, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_report_health_user_pet  ON public.t_report_health(f_user_id, f_pet_id, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_report_hpr_user_pet     ON public.t_report_human_pet_risk(f_user_id, f_pet_id, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_report_pers_user_pet    ON public.t_report_personality(f_user_id, f_pet_id, f_created_at DESC);

-- 活动/Banner/提示词
CREATE INDEX IF NOT EXISTS idx_t_activity_time ON public.t_activity(f_start_time);
CREATE INDEX IF NOT EXISTS idx_t_banner_lang   ON public.t_banner(f_lang, f_order);
CREATE INDEX IF NOT EXISTS idx_t_prompt_code   ON public.t_prompt(f_code, f_lang) WHERE f_is_active;


-- ============================================================
-- 99.4 视图 / Views
-- ============================================================

-- 99.4.1 宠物主图视图
CREATE OR REPLACE VIEW public.v_pet_with_primary_photo AS
SELECT
    p.*,
    (SELECT f_photo_url FROM public.t_pet_photo pp
       WHERE pp.f_pet_id = p.f_id AND pp.f_is_primary = true
       ORDER BY pp.f_id LIMIT 1) AS f_primary_photo_url
FROM public.t_pet p;

-- 99.4.2 用户是否系统匿名
CREATE OR REPLACE VIEW public.v_user_is_anonymous AS
SELECT f_id, f_nickname,
       (f_meta_info->>'role' = 'anonymous') AS f_is_anonymous
FROM public.t_user;

-- 99.4.3 订单汇总视图
CREATE OR REPLACE VIEW public.v_order_summary AS
SELECT
    o.f_id           AS f_order_id,
    o.f_order_no,
    o.f_user_id,
    u.f_nickname,
    o.f_total_amount,
    o.f_discount_amount,
    o.f_final_amount,
    o.f_currency,
    o.f_status_payment,
    o.f_status_shipping,
    o.f_payment_time,
    (SELECT count(*) FROM public.t_order_item oi WHERE oi.f_order_id = o.f_id) AS f_item_count
FROM public.t_order o
LEFT JOIN public.t_user u ON u.f_id = o.f_user_id;

-- 99.4.4 SKU 库存汇总视图
CREATE OR REPLACE VIEW public.v_sku_stock AS
SELECT
    s.f_id          AS f_sku_id,
    s.f_sku_code,
    s.f_price,
    coalesce(sum(b.f_quantity), 0)         AS f_total_qty,
    coalesce(sum(b.f_reserved_quantity), 0) AS f_reserved_qty
FROM public.t_product_sku s
LEFT JOIN public.t_inventory_balance b ON b.f_sku_id = s.f_id
GROUP BY s.f_id, s.f_sku_code, s.f_price;


-- ============================================================
-- 99 文件结束
-- ============================================================
-- 至此 00-99 全部 DDL 部署完成; 接下来执行:
--   - petchat_db_init.sql  (初始化 enum 数据/系统用户/匿名哨兵/...)
--   - 应用层 API 接入
-- ============================================================
