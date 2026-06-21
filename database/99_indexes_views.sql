-- ============================================================
-- PetChat (更懂它) / 99. 跨模块索引与视图 / Cross-Module Indexes & Views
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   1. 跨模块的 JSONB i18n 表达式索引 (常用 locale 加速)
--   2. GIN 全文搜索索引 (跨 enum 表)
--   3. 跨模块视图 (主图/匿名/订单汇总/SKU 库存汇总/AB 平台)
--   4. AB 实验平台 (50_ab.sql) 跨模块高频查询索引
--
-- 依赖:
--   全部 00-13 + 50_ab 文件
--
-- ============================================================


-- ============================================================
-- 99.1 JSONB i18n 枚举表: B-tree 表达式索引 (常用 locale, 加速等值/排序查询)
-- ============================================================
-- 适用原则 (Rule 1): 枚举表 < 1000 行, 不建 tsvector 也不建 pgroonga
--   业务查询走 f_id; 偶发 LIKE 全表扫可忽略
--
-- 查询示例:
--   WHERE (f_name->>'en-US') = 'Active'           -- 英文等值 (走 idx_..._name_en)
--   WHERE (f_name->>'zh-CN') = '激活'              -- 中文等值 (走 idx_..._name_zh)
--   ORDER BY (f_name->>'en-US')                   -- 英文排序 (走 idx_..._name_en)
--   WHERE (f_name->>'zh-CN') LIKE '%激活%'         -- 模糊 (全表扫, 枚举表可接受)

-- ============================================================
-- 99.2 pgroonga 索引: i18n 长文本搜索 (非枚举表)
-- ============================================================
-- 适用原则 (Rule 0/2/3):
--   - 长文本列 (TEXT / VARCHAR(>128) / JSONB i18n) 才需要 pgroonga
--   - 默认 Form A (语言无关): 一个索引自动覆盖 en/zh/ja/ko 及未来新增 locale
--   - Form B (按 locale 精准): 仅在需要 per-locale 相关性打分时使用, 本项目暂不需要
--   - TEXT[] / VARCHAR[] 用 GIN + @> (Rule 4), 本项目暂无该场景
--
-- pgroonga 特性说明:
--   - bigram 分词, 与语言无关, 一个索引自动支持 en/zh/ja/ko 及未来新增语言
--   - 不需要指定语言, 不需要因新增 locale 重建索引
--   - 查询语法 (Form A, 对应 USING pgroonga (f_col)):
--       WHERE f_col &@~ '关键词'                  -- 直接对整列搜索, 任意语言通用
--       WHERE f_title &@~ '智能手机'              -- 示例 (对应 idx_t_banner_pgroonga)
--       WHERE f_description &@~ 'smart phone'    -- 示例 (英文同等适用)
--
-- 前提: CREATE EXTENSION pgroonga WITH SCHEMA extensions; (见 00_extensions.sql)
--
-- 注意: 仅对 i18n 长文本业务表建立 pgroonga; 枚举表 (<1000 行) 走 B-tree 等值 (Rule 1)

-- 99.2.1 产品 SPU (f_name JSONB, f_description JSONB — JSONB i18n 内联方案)
-- pgroonga 索引已内联在 09_ecommerce.sql: idx_t_product_spu_pgroonga (Form A, language-agnostic)
-- B-tree 表达式索引已内联在 09_ecommerce.sql: idx_t_product_spu_name_en / idx_t_product_spu_name_zh
-- (此处不重复建立)

-- 99.2.2 Banner (CMS, per-language row, f_title VARCHAR(128), f_description TEXT)
-- 表结构见 07_cms.sql: t_banner (FK -> t_lang)
CREATE INDEX IF NOT EXISTS idx_t_banner_pgroonga
    ON public.t_banner
    USING pgroonga (f_title, f_description);

-- 99.2.3 活动 Activity (CMS, per-language row, f_title VARCHAR(128), f_description TEXT)
-- 表结构见 07_cms.sql: t_activity (FK -> t_lang)
CREATE INDEX IF NOT EXISTS idx_t_activity_pgroonga
    ON public.t_activity
    USING pgroonga (f_title, f_description);

-- 99.2.4 落地页 Landing Page (CMS, per-language row, f_title VARCHAR(128), f_subtitle VARCHAR(256))
-- 表结构见 07_cms.sql: t_landing_page (FK -> t_lang)
CREATE INDEX IF NOT EXISTS idx_t_landing_page_pgroonga
    ON public.t_landing_page
    USING pgroonga (f_title, f_subtitle);

-- 99.2.5 AI 性格报告分析 (per-pet 报告, f_personality_analysis TEXT)
-- 表结构见 04_ai_reports.sql: t_report_personality
CREATE INDEX IF NOT EXISTS idx_t_report_pers_pgroonga
    ON public.t_report_personality
    USING pgroonga (f_personality_analysis);

-- 99.2.6 救助申请描述 (f_description TEXT)
-- 表结构见 13_welfare.sql: t_rescue_request
CREATE INDEX IF NOT EXISTS idx_t_rescue_request_pgroonga
    ON public.t_rescue_request
    USING pgroonga (f_description);

-- 99.2.7 领养描述/要求 (f_description TEXT, f_requirements TEXT)
-- 表结构见 13_welfare.sql: t_adoption
CREATE INDEX IF NOT EXISTS idx_t_adoption_pgroonga
    ON public.t_adoption
    USING pgroonga (f_description, f_requirements);

-- 99.2.8 志愿者经验 (f_experience TEXT)
-- 表结构见 13_welfare.sql: t_volunteer
CREATE INDEX IF NOT EXISTS idx_t_volunteer_pgroonga
    ON public.t_volunteer
    USING pgroonga (f_experience);

-- 99.2.9 捐款留言 (f_message TEXT)
-- 表结构见 13_welfare.sql: t_donation
CREATE INDEX IF NOT EXISTS idx_t_donation_pgroonga
    ON public.t_donation
    USING pgroonga (f_message);

-- 99.2.10 寻宠描述 (f_description TEXT)
-- 表结构见 13_welfare.sql: t_record_lost_pet
CREATE INDEX IF NOT EXISTS idx_t_record_lost_pet_pgroonga
    ON public.t_record_lost_pet
    USING pgroonga (f_description);

-- 99.2.11 医生个人简介 (f_intro TEXT)
-- 表结构见 12_healthcare.sql: t_doctor
CREATE INDEX IF NOT EXISTS idx_t_doctor_pgroonga
    ON public.t_doctor
    USING pgroonga (f_intro);

-- 99.2.12 预约症状描述 (f_symptoms TEXT)
-- 表结构见 12_healthcare.sql: t_appointment
CREATE INDEX IF NOT EXISTS idx_t_appointment_pgroonga
    ON public.t_appointment
    USING pgroonga (f_symptoms);

-- 99.2.13 AI 提示词正文 (f_content TEXT, 按 code+lang+ver 隔离)
-- 表结构见 04_ai_reports.sql: t_prompt
CREATE INDEX IF NOT EXISTS idx_t_prompt_pgroonga
    ON public.t_prompt
    USING pgroonga (f_content);

-- 99.2.14 代理商申请审核意见 (f_review_comment TEXT, pgroonga 全文搜索)
-- 表结构见 11_agent.sql: t_agent_application
CREATE INDEX IF NOT EXISTS idx_t_agent_application_pgroonga
    ON public.t_agent_application
    USING pgroonga (f_review_comment);

-- 99.2.15 评论内容 (f_content TEXT, 多态目标: hospital/doctor/product/...)
-- 表结构见 05_chat_comments.sql: t_comment
CREATE INDEX IF NOT EXISTS idx_t_comment_pgroonga
    ON public.t_comment
    USING pgroonga (f_content);


-- ============================================================
-- 99.2.5 各模块内联索引汇总 (从 0x_*.sql 抽出, 集中维护)
-- ============================================================
-- 原则: 模块文件 (0x_*.sql) 只声明表结构 + 注释, 索引统一在 99_indexes_views.sql
--       维护. 便于一次评估/重建全套索引.
-- 注: 此段是单表内联索引的"集中地", 跨模块/跨表的索引继续放在 99.3 段.

-- 99.2.5.1 用户表 (02_rbac_users.sql: t_user)
-- partial unique: 排除空字符串
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_user_phone
    ON public.t_user(f_phone) WHERE f_phone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_user_email
    ON public.t_user(f_email) WHERE f_email <> '';
-- active 状态过滤 (status_id = 10 表示 active)
CREATE INDEX IF NOT EXISTS idx_t_user_phone_active
    ON public.t_user(f_phone) WHERE f_status_id = 10;
CREATE INDEX IF NOT EXISTS idx_t_user_email_active
    ON public.t_user(f_email) WHERE f_status_id = 10;

-- 99.2.5.2 评论表 (05_chat_comments.sql: t_comment)
CREATE INDEX IF NOT EXISTS idx_t_comment_target
    ON public.t_comment(f_target_type, f_target_id);
CREATE INDEX IF NOT EXISTS idx_t_comment_user
    ON public.t_comment(f_user_id);

-- 99.2.5.3 订阅表 (08_subscription.sql: t_user_subscription / t_user_quota / t_usage_record)
CREATE INDEX IF NOT EXISTS idx_t_us_user
    ON public.t_user_subscription(f_user_id);
CREATE INDEX IF NOT EXISTS idx_t_us_expire
    ON public.t_user_subscription(f_expire_at);
CREATE INDEX IF NOT EXISTS idx_t_us_user_active
    ON public.t_user_subscription(f_user_id, f_expire_at DESC) WHERE f_status_payment > 0;
CREATE INDEX IF NOT EXISTS idx_t_uq_user_feature
    ON public.t_user_quota(f_user_id, f_feature_id, f_period_start DESC);
CREATE INDEX IF NOT EXISTS idx_t_usage_record_user_time
    ON public.t_usage_record(f_user_id, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_usage_record_feature
    ON public.t_usage_record(f_feature_id, f_created_at DESC);

-- 99.2.5.4 电商表 (09_ecommerce.sql: t_product_category / t_order / t_order_item / t_product_spu / t_product_sku / t_inventory_* / t_cart / t_shipment)
CREATE INDEX IF NOT EXISTS idx_t_product_category_parent
    ON public.t_product_category(f_parent_id);
CREATE INDEX IF NOT EXISTS idx_t_product_category_active
    ON public.t_product_category(f_deleted) WHERE f_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_t_order_user_created
    ON public.t_order(f_user_id, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_order_pay_status
    ON public.t_order(f_status_payment, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_order_ship_status
    ON public.t_order(f_status_shipping, f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_order_item_order
    ON public.t_order_item(f_order_id);
CREATE INDEX IF NOT EXISTS idx_t_order_item_sku
    ON public.t_order_item(f_sku_id);
CREATE INDEX IF NOT EXISTS idx_t_product_spu_name_en
    ON public.t_product_spu ((f_name->>'en-US'));
CREATE INDEX IF NOT EXISTS idx_t_product_spu_name_zh
    ON public.t_product_spu ((f_name->>'zh-CN'));
-- pgroonga 索引: idx_t_product_spu_pgroonga 已在 09_ecommerce.sql: 见该文件
CREATE INDEX IF NOT EXISTS idx_t_product_spu_brand
    ON public.t_product_spu(f_brand);
CREATE INDEX IF NOT EXISTS idx_t_product_sku_spu
    ON public.t_product_sku(f_spu_id);
CREATE INDEX IF NOT EXISTS idx_t_inventory_lot_supplier
    ON public.t_inventory_lot(f_supplier);
CREATE INDEX IF NOT EXISTS idx_t_inventory_balance_sku
    ON public.t_inventory_balance(f_sku_id);
CREATE INDEX IF NOT EXISTS idx_t_inventory_movement_created
    ON public.t_inventory_movement(f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_inventory_serial_sku
    ON public.t_inventory_serial(f_sku_id);
CREATE INDEX IF NOT EXISTS idx_t_cart_user
    ON public.t_cart(f_user_id);
CREATE INDEX IF NOT EXISTS idx_t_shipment_order
    ON public.t_shipment(f_order_id);
CREATE INDEX IF NOT EXISTS idx_t_shipment_tracking
    ON public.t_shipment(f_tracking_number) WHERE f_tracking_number <> '';

-- 99.2.5.5 IoT 设备同步 (10_iot.sql: t_device_sync)
CREATE INDEX IF NOT EXISTS idx_t_device_sync_device
    ON public.t_device_sync(f_device_id, f_created_at DESC);

-- 99.2.5.6 代理商 (11_agent.sql: t_agent / t_agent_application / t_agent_withdrawal / t_agent_revenue)
CREATE INDEX IF NOT EXISTS idx_t_agent_user
    ON public.t_agent(f_user_id) WHERE f_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_t_agent_active
    ON public.t_agent(f_agent_type) WHERE f_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_t_agent_app_agent
    ON public.t_agent_application(f_agent_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_app_user
    ON public.t_agent_application(f_user_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_app_status
    ON public.t_agent_application(f_status_apply) WHERE f_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_t_agent_wd_agent
    ON public.t_agent_withdrawal(f_agent_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_rev_agent
    ON public.t_agent_revenue(f_agent_id, f_revenue_month);

-- 99.2.5.7 医院 (12_healthcare.sql: t_hospital)
CREATE INDEX IF NOT EXISTS idx_t_hospital_rating
    ON public.t_hospital(f_rating DESC);

-- 99.2.5.8 捐款 (13_welfare.sql: t_donation)
-- 注: idx_t_donation_user / idx_t_donation_target 已在 99.3 段 (跨模块)
-- 此处省略

-- 99.2.5.9 AB 实验 (50_ab.sql: t_ab_assignment / t_user_tag)
-- 跨表高频索引 (按 user/anon 复合) — 已在 99.3 段
-- 此处补: t_user_tag 按 tag 过滤
CREATE INDEX IF NOT EXISTS idx_t_user_tag_tag
    ON public.t_user_tag(f_tag);


-- ============================================================
-- 99.3 跨模块高频查询索引 (跨表)
-- ============================================================

-- 宠物: 按用户/类型/状态
CREATE INDEX IF NOT EXISTS idx_t_pet_user     ON public.t_pet(f_user_id);
CREATE INDEX IF NOT EXISTS idx_t_pet_type     ON public.t_pet(f_pet_type_id);
CREATE INDEX IF NOT EXISTS idx_t_pet_status   ON public.t_pet(f_status_pet, f_deleted);
CREATE INDEX IF NOT EXISTS idx_t_pet_photo_pet        ON public.t_pet_photo(f_pet_id);
CREATE INDEX IF NOT EXISTS idx_t_pet_photo_primary    ON public.t_pet_photo(f_pet_id) WHERE f_is_primary;

-- 聊天: 按用户时间/按宠物
CREATE INDEX IF NOT EXISTS idx_t_chat_history_user ON public.t_chat_history(f_user_id, f_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_chat_history_pet  ON public.t_chat_history(f_pet_id);

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
CREATE INDEX IF NOT EXISTS idx_t_prompt_code   ON public.t_prompt(f_code, f_lang) WHERE f_deleted = 0;

-- AB 平台 (50_ab.sql): 按 (domain, status) / 时间窗 / owner
-- 解析 API 主路径: WHERE f_status_ab_id = 10 AND f_domain_id = $1
CREATE INDEX IF NOT EXISTS idx_t_ab_domain_status
    ON public.t_ab(f_domain_id, f_status_ab_id);
-- 时间窗过滤: WHERE f_starts_at < now() AND f_ends_at > now() AND f_status_ab_id = 10
CREATE INDEX IF NOT EXISTS idx_t_ab_running_time
    ON public.t_ab(f_starts_at, f_ends_at) WHERE f_status_ab_id = 10;
-- 按 owner_team 过滤
CREATE INDEX IF NOT EXISTS idx_t_ab_owner ON public.t_ab(f_owner_team) WHERE f_status_ab_id <> 20;
-- 按 (f_domain_id, f_status_ab_id, f_created_at DESC) 列表分页
CREATE INDEX IF NOT EXISTS idx_t_ab_domain_created
    ON public.t_ab(f_domain_id, f_status_ab_id, f_created_at DESC);

-- AB 变体: 按 (f_ab_id, f_status_id) 列表 (已 UNIQUE f_ab_id + f_code, 此处补 f_status_id)
CREATE INDEX IF NOT EXISTS idx_t_ab_variant_status ON public.t_ab_variant(f_status_id);

-- AB 分组: 按 variant 查所有分配 (用于按 variant 聚合统计)
CREATE INDEX IF NOT EXISTS idx_t_ab_assignment_variant
    ON public.t_ab_assignment(f_variant_id);
-- 按 f_ab_id + f_status_id 过滤 (同实验有效分配)
CREATE INDEX IF NOT EXISTS idx_t_ab_assignment_ab_status
    ON public.t_ab_assignment(f_ab_id, f_status_id);
-- 按 f_assigned_at DESC 时间范围 (最近分配)
CREATE INDEX IF NOT EXISTS idx_t_ab_assignment_assigned
    ON public.t_ab_assignment(f_assigned_at DESC);

-- AB 足迹 (append-only, 大表): 核心分析路径
-- 按 f_event_id 分析: BI 按事件类型统计
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_event
    ON public.t_ab_footprint(f_event_id) WHERE f_event_id IS NOT NULL;
-- 按 f_assignment_id 归因: 实验效果分析
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_assignment
    ON public.t_ab_footprint(f_assignment_id) WHERE f_assignment_id IS NOT NULL;
-- 按用户时间链: f_user_id + f_occurred_at DESC
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_user_occurred
    ON public.t_ab_footprint(f_user_id, f_occurred_at DESC) WHERE f_user_id IS NOT NULL;
-- 按匿名设备时间链
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_anon_occurred
    ON public.t_ab_footprint(f_anonymous_id, f_occurred_at DESC) WHERE f_anonymous_id IS NOT NULL;
-- 按 f_occurred_at 范围扫描 (全局)
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_occurred
    ON public.t_ab_footprint(f_occurred_at DESC);
-- 按会话 ID 漏斗分析
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_session
    ON public.t_ab_footprint(f_session_id) WHERE f_session_id <> '';
-- 按 URL 分析 (页面流量)
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_url
    ON public.t_ab_footprint(f_url) WHERE f_url <> '';
-- 按 (f_os, f_app_version) 客户端分布
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_os_version
    ON public.t_ab_footprint(f_os, f_app_version);

-- AB 用户标签: 按 f_source 过滤 (AB_TEST 标签可独立清理)
CREATE INDEX IF NOT EXISTS idx_t_user_tag_source
    ON public.t_user_tag(f_source) WHERE f_status_id = 1;
-- 过期标签清理: WHERE f_expires_at < now() AND f_status_id = 1
CREATE INDEX IF NOT EXISTS idx_t_user_tag_expires
    ON public.t_user_tag(f_expires_at) WHERE f_expires_at IS NOT NULL AND f_status_id = 1;

-- AB 用户皮肤 override: 按 f_source 过滤 (SYSTEM/ADMIN/USER_TRIAL_ACCEPT/...)
CREATE INDEX IF NOT EXISTS idx_t_ab_user_skin_source
    ON public.t_ab_user_skin(f_source) WHERE f_status_id = 1;
-- 过期清理
CREATE INDEX IF NOT EXISTS idx_t_ab_user_skin_expires
    ON public.t_ab_user_skin(f_expires_at) WHERE f_expires_at IS NOT NULL AND f_status_id = 1;
-- 按 f_pref_code 查偏好项
CREATE INDEX IF NOT EXISTS idx_t_ab_user_skin_pref
    ON public.t_ab_user_skin(f_pref_code) WHERE f_status_id = 1;

-- AB 事件 enum: 按 f_type 过滤 (无业务含义 vs 有业务含义)
CREATE INDEX IF NOT EXISTS idx_t_ab_event_type
    ON public.t_ab_event(f_type) WHERE f_status_id = 1;
-- 按 f_ver 过滤 (多版本兼容)
CREATE INDEX IF NOT EXISTS idx_t_ab_event_ver
    ON public.t_ab_event(f_ver) WHERE f_status_id = 1;


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


-- 99.4.5 AB 实验汇总视图 (含域/状态名)
CREATE OR REPLACE VIEW public.v_ab_summary AS
SELECT
    a.f_id              AS f_ab_id,
    a.f_publish_uid     AS f_ab_publish_uid,
    a.f_code            AS f_ab_code,
    a.f_name            AS f_ab_name,
    a.f_domain_id,
    d.f_code            AS f_domain_code,
    d.f_name            AS f_domain_name,
    a.f_status_ab_id,
    s.f_code            AS f_status_code,
    s.f_name->>'zh-CN'  AS f_status_name_zh,
    a.f_traffic_pct,
    a.f_starts_at,
    a.f_ends_at,
    a.f_owner_team,
    a.f_created_at,
    (SELECT count(*) FROM public.t_ab_variant v
       WHERE v.f_ab_id = a.f_id AND v.f_status_id = 1)        AS f_variant_count,
    (SELECT count(*) FROM public.t_ab_assignment g
       WHERE g.f_ab_id = a.f_id AND g.f_status_id = 1)        AS f_assignment_count
FROM public.t_ab a
LEFT JOIN public.t_ab_domain  d ON d.f_id = a.f_domain_id
LEFT JOIN public.t_ab_status  s ON s.f_id = a.f_status_ab_id;


-- 99.4.6 AB 用户当前分配视图 (含实验/变体/域信息)
-- 用于解析 API 命中检查后的快速组装
CREATE OR REPLACE VIEW public.v_ab_assignment_detail AS
SELECT
    g.f_id              AS f_assignment_id,
    g.f_publish_uid     AS f_assignment_publish_uid,
    g.f_user_id,
    g.f_anonymous_id,
    g.f_assigned_at,
    a.f_id              AS f_ab_id,
    a.f_publish_uid     AS f_ab_publish_uid,
    a.f_code            AS f_ab_code,
    a.f_status_ab_id,
    d.f_code            AS f_domain_code,
    v.f_id              AS f_variant_id,
    v.f_code            AS f_variant_code,
    v.f_config
FROM public.t_ab_assignment g
JOIN public.t_ab          a ON a.f_id = g.f_ab_id
JOIN public.t_ab_domain  d ON d.f_id = a.f_domain_id
JOIN public.t_ab_variant v ON v.f_id = g.f_variant_id
WHERE g.f_status_id = 1;


-- 99.4.7 AB 域实验互斥统计视图
-- 同 t_ab_domain 内 RUNNING 实验数 vs f_max_concurrent
CREATE OR REPLACE VIEW public.v_ab_domain_load AS
SELECT
    d.f_id              AS f_domain_id,
    d.f_code            AS f_domain_code,
    d.f_name            AS f_domain_name,
    d.f_max_concurrent,
    (SELECT count(*) FROM public.t_ab a
       WHERE a.f_domain_id = d.f_id AND a.f_status_ab_id = 10) AS f_running_count,
    (SELECT count(*) FROM public.t_ab a
       WHERE a.f_domain_id = d.f_id AND a.f_status_ab_id <> 20) AS f_active_count
FROM public.t_ab_domain d
WHERE d.f_status_id = 1;


-- ============================================================
-- 99 文件结束
-- ============================================================
-- 至此 00-13 + 50 + 99 全部 DDL 部署完成; 接下来执行:
--   - database/init/db_init.sql  (初始化 enum 数据: t_banner_type / t_usage_type
--                                            / t_ab_domain / t_ab_status / t_ab_event)
--   - 应用层 API 接入
-- ============================================================
