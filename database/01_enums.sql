-- ============================================================
-- PetChat (更懂它) / 1. 基础枚举层 / Foundation Enums
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud (pgroonga 可用)
--
-- 本文件用途:
--   集中定义 20 张基础/枚举表, 这些表被几乎所有业务模块 FK 引用
--   加载顺序: 必须在所有业务模块之前执行
--
-- 依赖:
--   00_extensions.sql (pgroonga / pgcrypto)
--
-- 被本文件引用的脚本 (下游):
--   02_rbac_users.sql            -> t_lang / t_status
--   03_pet_profile.sql           -> t_pet_type / t_pet_breed / t_gender / t_photo_type / t_status / t_lang
--   04_ai_reports.sql            -> t_report_type / t_risk_level / t_health_level / t_status / t_lang
--   05_chat_comments.sql         -> t_status / t_lang
--   06_share_interpretation.sql  -> t_share_type / t_share_channel / t_status / t_lang
--   07_cms.sql                   -> t_activity_type / t_banner_type / t_status / t_lang
--   08_subscription.sql          -> t_plan_type / t_payment_status / t_subscription_type / t_usage_type / t_status
--   09_ecommerce.sql             -> t_inventory_status / t_payment_status / t_shipping_status / t_status / t_lang
--   10_iot.sql                   -> t_sync_status / t_status
--   11_agent.sql                 -> t_status
--   12_healthcare.sql            -> t_status / t_lang
--   13_welfare.sql               -> t_pet_type / t_adoption_type / t_volunteer_type / t_payment_status / t_status / t_lang
--
-- 设计原则 (Foundation Enums Principles):
--   1. 所有 JSONB i18n 枚举统一为: INTEGER PK, f_name/f_desc JSONB
--      (无 tsvector 列; 详见 jsonb-i18n-pattern.md Section 0.1 Rule 1)
--   2. 业务状态/类型枚举统一为: INTEGER PK + 业务语义 f_code (UNIQUE)
--   3. 哨兵记录: 业务状态枚举 f_id = -1 = NOT-SET; t_lang 不使用哨兵
--   4. 通用用户态: 1=pending 10=active 20=archived 30=disabled 40=deleted (在 t_status 内统一)
--   5. 搜索策略 (枚举表 < 1000 行, 不建 pgroonga 也不建 tsvector):
--      - 业务查询均走 f_id; 偶发 LIKE 全表扫可忽略 (Rule 1)
--      - 等值查询: WHERE (f_name->>'en-US') = 'Active'  (走 B-tree idx_..._name_en, 99.1)
--                WHERE (f_name->>'zh-CN') = '激活'      (走 B-tree idx_..._name_zh, 99.1)
--      - 字符模糊: WHERE (f_name->>'zh-CN') LIKE '%激活%'  (全表扫, 枚举表可接受)
--      - pgroonga 仅用于 i18n 长文本业务表 (商品/活动/内容等), 详见 99_indexes_views.sql 99.2b
-- ============================================================


-- ============================================================
-- 1.1 语言表 / Language  (i18n 的源头, 静态参照表, 不使用 JSONB i18n)
-- ============================================================
CREATE TABLE public.t_lang (
    f_code      VARCHAR(8)  PRIMARY KEY,
    f_name      VARCHAR(64) NOT NULL,
    f_desc      VARCHAR(256) NOT NULL DEFAULT '',
    f_order     INTEGER     NOT NULL DEFAULT 0
);
COMMENT ON TABLE  public.t_lang IS '系统支持的语言代码列表 (i18n 源头, 不使用 JSONB i18n 自身)';
COMMENT ON COLUMN public.t_lang.f_code    IS 'IETF 语言标签, e.g. zh-CN, en-US, ja-JP | 引用方: t_user.f_lang / t_pet.f_lang / t_report_*.f_lang / t_prompt.f_lang / t_banner.f_lang / t_activity.f_lang / t_landing_page.f_lang / t_chat_history.f_lang / t_appointment.f_lang / t_hospital.f_lang / t_record_lost_pet.f_lang / t_rescue_request.f_lang / t_interpretation_voice.f_lang';
COMMENT ON COLUMN public.t_lang.f_name    IS '语言显示名 (单一语言, 不参与 i18n 翻译)';
COMMENT ON COLUMN public.t_lang.f_desc    IS '语言说明 / 备注';
COMMENT ON COLUMN public.t_lang.f_order   IS '排序权重 (小→前), 客户端可选语言时按此排序';


-- ============================================================
-- 1.2 JSONB i18n 概念枚举表 (被业务表的"对象类型"字段引用)
-- ============================================================
-- 通用模板:
--   f_id    INTEGER PK (business keys, no auto-increment)
--   f_name  JSONB NOT NULL DEFAULT '{}'  -- {"zh-CN":"..","en-US":"..","ja-JP":".."}
--   f_desc  JSONB NOT NULL DEFAULT '{}'
--   f_order INT, f_deleted       INT2         NOT NULL DEFAULT 0,
--   (无 tsvector 列: Rule 1 枚举表 < 1000 行不建 tsvector 也不建 pgroonga)
--   等值查询走 B-tree idx_..._name_en / idx_..._name_zh (99.1); 模糊 LIKE 全表扫可接受
--   业务字段: 按需, 一切引用 f_id
--   CHECK: jsonb_typeof(f_name) = 'object' 等


-- 1.2.1 宠物类型 / Pet Type
CREATE TABLE public.t_pet_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_pet_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_pet_type_desc_is_object CHECK (jsonb_typeof(f_desc) = 'object')
);
COMMENT ON TABLE  public.t_pet_type IS '宠物类型 (犬/猫/兔/...), JSONB i18n';
COMMENT ON COLUMN public.t_pet_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_pet_type.f_name      IS '多语言名称, 结构: {"zh-CN":"..","en-US":"..",...} | 引用方: t_pet_breed.f_pet_type_id, t_pet.f_pet_type_id, t_rescue_request.f_pet_type_id, t_adoption.f_pet_type_id';
COMMENT ON COLUMN public.t_pet_type.f_desc      IS '多语言描述, 结构同 f_name';
COMMENT ON COLUMN public.t_pet_type.f_order     IS '排序权重, 小→前';
COMMENT ON COLUMN public.t_pet_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.2 宠物品种 / Pet Breed
CREATE TABLE public.t_pet_breed (
    f_id          INTEGER PRIMARY KEY,
    f_pet_type_id INTEGER NOT NULL DEFAULT -1,
    f_ver         INT4    NOT NULL DEFAULT 100,
    f_name        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order       INTEGER NOT NULL DEFAULT 0,
    f_deleted     INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_pet_breed_name_is_object CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_pet_breed_desc_is_object CHECK (jsonb_typeof(f_desc) = 'object'),
    CONSTRAINT fk_t_pet_breed_pet_type FOREIGN KEY (f_pet_type_id)
        REFERENCES public.t_pet_type(f_id) ON DELETE NO ACTION
);
COMMENT ON TABLE  public.t_pet_breed IS '宠物品种, 必须属于某个 f_pet_type';
COMMENT ON COLUMN public.t_pet_breed.f_id          IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_pet_breed.f_pet_type_id IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 引用方: t_pet.f_breed_id';
COMMENT ON COLUMN public.t_pet_breed.f_name        IS '多语言品种名 | 引用方: t_pet.f_breed_id (反查品种)';
COMMENT ON COLUMN public.t_pet_breed.f_desc        IS '多语言描述, 结构同 f_name';
COMMENT ON COLUMN public.t_pet_breed.f_order       IS '排序权重';
COMMENT ON COLUMN public.t_pet_breed.f_deleted   IS '启用开关';
COMMENT ON COLUMN public.t_pet_breed.f_ver         IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.3 性别 / Gender
CREATE TABLE public.t_gender (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_gender_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_gender IS '宠物/用户性别 (公/母/未知)';
COMMENT ON COLUMN public.t_gender.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_gender.f_name      IS '多语言性别名 | 引用方: t_pet.f_gender_id';
COMMENT ON COLUMN public.t_gender.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_gender.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_gender.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_gender.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.4 照片类型 / Photo Type
CREATE TABLE public.t_photo_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_photo_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_photo_type IS '照片类型 (头像/相册/报告配图/...)';
COMMENT ON COLUMN public.t_photo_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_photo_type.f_name      IS '多语言名称 | 引用方: t_pet_photo.f_photo_type_id';
COMMENT ON COLUMN public.t_photo_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_photo_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_photo_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_photo_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.5 报告类型 / Report Type
CREATE TABLE public.t_report_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_report_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_report_type IS 'AI 报告类型 (emotion/health/human_pet_risk/personality/...)';
COMMENT ON COLUMN public.t_report_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_report_type.f_name      IS '多语言名称 | 引用方: t_report_emotion.f_report_type_id, t_report_health.f_report_type_id, t_report_human_pet_risk.f_report_type_id, t_report_personality.f_report_type_id';
COMMENT ON COLUMN public.t_report_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_report_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_report_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_report_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.6 风险等级 / Risk Level
CREATE TABLE public.t_risk_level (
    f_id        INTEGER PRIMARY KEY,
    f_ver         INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_risk_level_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_risk_level IS '人宠风险等级 (低/中/高/...)';
COMMENT ON COLUMN public.t_risk_level.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_risk_level.f_name      IS '多语言名称 | 引用方: t_report_human_pet_risk.f_risk_level_id';
COMMENT ON COLUMN public.t_risk_level.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_risk_level.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_risk_level.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_risk_level.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.7 个性标签 / Personality Tag
CREATE TABLE public.t_personality_tag (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_personality_tag_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_personality_tag IS '可选枚举; t_pet.f_personality_tags JSONB 用于用户自定义集合 (in 03_pet_profile.sql)';
COMMENT ON COLUMN public.t_personality_tag.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_personality_tag.f_name      IS '多语言名称 | 引用方: t_pet.f_personality_tags (JSONB 数组, 不强 FK)';
COMMENT ON COLUMN public.t_personality_tag.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_personality_tag.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_personality_tag.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_personality_tag.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.8 通用状态 / Status (用户状态等通用, 软删统一入口)
CREATE TABLE public.t_status (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_status IS '通用用户态: 1=pending 10=active 20=archived 30=disabled 40=deleted; 几乎所有业务表的 f_status_user 都引用此表';
COMMENT ON COLUMN public.t_status.f_id        IS '主键; 哨兵: -1 = NOT-SET; 业务约定值: 1=pending 10=active 20=archived 30=disabled 40=deleted';
COMMENT ON COLUMN public.t_status.f_name      IS '多语言名称 | 引用方: 全部业务表的 f_status_user / t_pet.f_status_pet';
COMMENT ON COLUMN public.t_status.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_status.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_status.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.2.9 套餐类型 / Plan Type
CREATE TABLE public.t_plan_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver         INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_plan_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_plan_type IS '订阅套餐类型 (免费/基础/专业/家庭/...)';
COMMENT ON COLUMN public.t_plan_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_plan_type.f_name      IS '多语言名称 | 引用方: t_plan.f_plan_type_id (in 08_subscription.sql)';
COMMENT ON COLUMN public.t_plan_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_plan_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_plan_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_plan_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- ============================================================
-- 1.3 业务域状态/类型枚举表 (10 张, 全部含 -1 = NOT-SET; 业务表 f_status_xxx INT4 引用)
-- ============================================================
-- 结构相同: INTEGER PK (business keys, no auto-increment), f_code 业务语义代码 (UNIQUE), JSONB i18n
-- 通用模式: -1 占位 (NOT-SET, 1..N 业务值)


-- 1.3.1 支付状态 / Payment Status
CREATE TABLE public.t_payment_status (
    f_id        INTEGER PRIMARY KEY,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_payment_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_payment_status IS '支付状态 (pending/paid/refunded/failed/cancelled/...)';
COMMENT ON COLUMN public.t_payment_status.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_payment_status.f_code      IS '业务语义代码, e.g. pending, paid, refunded, failed, cancelled | UNIQUE';
COMMENT ON COLUMN public.t_payment_status.f_name      IS '多语言名称 | 引用方: t_order.f_status_payment, t_user_subscription.f_status_payment, t_donation.f_status_payment (in 09_ecommerce.sql / 08_subscription.sql / 13_welfare.sql)';
COMMENT ON COLUMN public.t_payment_status.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_payment_status.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_payment_status.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_payment_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.2 物流状态 / Shipping Status
CREATE TABLE public.t_shipping_status (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_shipping_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_shipping_status IS '物流状态 (unshipped/shipped/in_transit/delivered/...)';
COMMENT ON COLUMN public.t_shipping_status.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_shipping_status.f_code      IS '业务语义代码, e.g. unshipped, shipped, in_transit, delivered | UNIQUE';
COMMENT ON COLUMN public.t_shipping_status.f_name      IS '多语言名称 | 引用方: t_order.f_status_shipping, t_shipment.f_status_shipment (in 09_ecommerce.sql)';
COMMENT ON COLUMN public.t_shipping_status.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_shipping_status.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_shipping_status.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_shipping_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.3 设备同步状态 / Sync Status
CREATE TABLE public.t_sync_status (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_sync_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_sync_status IS '设备同步状态 (pending/syncing/success/failed/...)';
COMMENT ON COLUMN public.t_sync_status.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_sync_status.f_code      IS '业务语义代码, e.g. pending, syncing, success, failed | UNIQUE';
COMMENT ON COLUMN public.t_sync_status.f_name      IS '多语言名称 | 引用方: t_device_sync.f_status_sync (in 10_iot.sql)';
COMMENT ON COLUMN public.t_sync_status.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_sync_status.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_sync_status.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_sync_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.5 库存状态 / Inventory Status
CREATE TABLE public.t_inventory_status (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_inventory_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_inventory_status IS '库存状态 (in_stock/low_stock/out_of_stock/discontinued/...)';
COMMENT ON COLUMN public.t_inventory_status.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_inventory_status.f_code      IS '业务语义代码, e.g. in_stock, low_stock, out_of_stock, discontinued | UNIQUE';
COMMENT ON COLUMN public.t_inventory_status.f_name      IS '多语言名称 | 引用方: t_product_spu.f_status_inventory, t_product_sku.f_status_inventory, t_inventory_balance.f_status_inventory (in 09_ecommerce.sql)';
COMMENT ON COLUMN public.t_inventory_status.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_inventory_status.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_inventory_status.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_inventory_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.6 库存序列号状态 / Inventory Serial Status
CREATE TABLE public.t_inventory_serial_status (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_inventory_serial_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_inventory_serial_status IS '库存单品序列号状态 (in_stock/sold/returned/damaged/...)';
COMMENT ON COLUMN public.t_inventory_serial_status.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_inventory_serial_status.f_code      IS '业务语义代码, e.g. in_stock, sold, returned, damaged | UNIQUE';
COMMENT ON COLUMN public.t_inventory_serial_status.f_name      IS '多语言名称 | 引用方: t_inventory_serial.f_status_serial (in 09_ecommerce.sql)';
COMMENT ON COLUMN public.t_inventory_serial_status.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_inventory_serial_status.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_inventory_serial_status.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_inventory_serial_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.7 领养类型 / Adoption Type
CREATE TABLE public.t_adoption_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_adoption_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_adoption_type IS '领养类型 (送养/领养申请)';
COMMENT ON COLUMN public.t_adoption_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_adoption_type.f_code      IS '业务语义代码: 1=送养(give) 2=领养申请(apply) | UNIQUE';
COMMENT ON COLUMN public.t_adoption_type.f_name      IS '多语言名称 | 引用方: t_adoption.f_adoption_type_id (in 13_welfare.sql)';
COMMENT ON COLUMN public.t_adoption_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_adoption_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_adoption_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_adoption_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.8 志愿者类型 / Volunteer Type
CREATE TABLE public.t_volunteer_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_volunteer_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_volunteer_type IS '志愿者类型 (救助/送养/翻译/拍照/...)';
COMMENT ON COLUMN public.t_volunteer_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_volunteer_type.f_code      IS '业务语义代码, e.g. rescue, adoption, translate, photo | UNIQUE';
COMMENT ON COLUMN public.t_volunteer_type.f_name      IS '多语言名称 | 引用方: t_volunteer.f_volunteer_type_id (in 13_welfare.sql)';
COMMENT ON COLUMN public.t_volunteer_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_volunteer_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_volunteer_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_volunteer_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.9 分享类型 / Share Type
CREATE TABLE public.t_share_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_share_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_share_type IS '分享类型 (report_emotion/report_health/...)';
COMMENT ON COLUMN public.t_share_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_share_type.f_code      IS '业务语义代码, e.g. report_emotion, report_health, report_hpr, report_personality, post | UNIQUE';
COMMENT ON COLUMN public.t_share_type.f_name      IS '多语言名称 | 引用方: t_share_record.f_share_type_id (in 06_share_interpretation.sql)';
COMMENT ON COLUMN public.t_share_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_share_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_share_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_share_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.10 分享渠道 / Share Channel
CREATE TABLE public.t_share_channel (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_share_channel_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_share_channel IS '分享渠道 (wechat/moments/qq/link/in_app/...)';
COMMENT ON COLUMN public.t_share_channel.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_share_channel.f_code      IS '业务语义代码, e.g. wechat, moments, qq, link, in_app | UNIQUE';
COMMENT ON COLUMN public.t_share_channel.f_name      IS '多语言名称 | 引用方: t_share_record.f_share_channel_id (in 06_share_interpretation.sql)';
COMMENT ON COLUMN public.t_share_channel.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_share_channel.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_share_channel.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_share_channel.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.11 健康等级 / Health Level
CREATE TABLE public.t_health_level (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_health_level_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_health_level IS '健康等级 (优秀/良好/一般/较差/严重)';
COMMENT ON COLUMN public.t_health_level.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_health_level.f_code      IS '业务语义代码, e.g. excellent, good, fair, poor, severe | UNIQUE';
COMMENT ON COLUMN public.t_health_level.f_name      IS '多语言名称 | 引用方: t_report_health.f_health_level_id (in 04_ai_reports.sql)';
COMMENT ON COLUMN public.t_health_level.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_health_level.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_health_level.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_health_level.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.12 活动类型 / Activity Type
CREATE TABLE public.t_activity_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_activity_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_activity_type IS '活动类型 (adoption/lecture/volunteer/exhibition/offline/online)';
COMMENT ON COLUMN public.t_activity_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_activity_type.f_code      IS '业务语义代码, e.g. adoption, lecture, volunteer, exhibition, offline, online | UNIQUE';
COMMENT ON COLUMN public.t_activity_type.f_name      IS '多语言名称 | 引用方: t_activity.f_activity_type_id (in 07_cms.sql)';
COMMENT ON COLUMN public.t_activity_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_activity_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_activity_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_activity_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- 1.3.13 订阅类型 / Subscription Type
CREATE TABLE public.t_subscription_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_subscription_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_subscription_type IS '订阅类型 (trial/paid/gift/promo/family)';
COMMENT ON COLUMN public.t_subscription_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_subscription_type.f_code      IS '业务语义代码, e.g. trial, paid, gift, promo, family | UNIQUE';
COMMENT ON COLUMN public.t_subscription_type.f_name      IS '多语言名称 | 引用方: t_user_subscription.f_subscription_type_id (in 08_subscription.sql)';
COMMENT ON COLUMN public.t_subscription_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_subscription_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_subscription_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_subscription_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';


-- ============================================================
-- 1.3.14 Banner 跳转类型 / Banner Type
-- ============================================================
CREATE TABLE public.t_banner_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_banner_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_banner_type IS 'Banner 跳转目标类型 (product/activity/subscription/external/page/none/...)';
COMMENT ON COLUMN public.t_banner_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_banner_type.f_code      IS '业务语义代码, e.g. product, activity, subscription, external, page, none | UNIQUE';
COMMENT ON COLUMN public.t_banner_type.f_name      IS '多语言名称 | 引用方: t_banner.f_link_type_id (in 07_cms.sql)';
COMMENT ON COLUMN public.t_banner_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_banner_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_banner_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_banner_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';

-- 预设数据见 init/db_init.sql (t_banner_type)


-- ============================================================
-- 1.3.15 用量记录类型 / Usage Type
-- ============================================================
CREATE TABLE public.t_usage_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_usage_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);
COMMENT ON TABLE  public.t_usage_type IS 'AI 用量记录类型 (report/chat/analysis/voice/export/api/share/other/...)';
COMMENT ON COLUMN public.t_usage_type.f_id        IS '主键; 哨兵: -1 = NOT-SET';
COMMENT ON COLUMN public.t_usage_type.f_code      IS '业务语义代码, e.g. report, chat, analysis, voice, export, api, share, other | UNIQUE';
COMMENT ON COLUMN public.t_usage_type.f_name      IS '多语言名称 | 引用方: t_usage_record.f_usage_type_id (in 08_subscription.sql)';
COMMENT ON COLUMN public.t_usage_type.f_desc      IS '多语言描述';
COMMENT ON COLUMN public.t_usage_type.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_usage_type.f_deleted IS '启用开关';
COMMENT ON COLUMN public.t_usage_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';

-- 预设数据见 init/db_init.sql (t_usage_type)
