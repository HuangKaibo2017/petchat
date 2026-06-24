// /functions/migrate-schema/index.ts
// ONE-TIME: Schema initialization. SQL is hardcoded — no external input.

import { okResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";

const MIGRATIONS: Record<number, string> = {
  0: `-- ============================================================
-- PetChat (更懂它) / 0. 扩展 / Extensions
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   启用数据库所需扩展, 必须在所有建表脚本之前执行
--
-- 依赖:
--   无 (第 0 层)
--
-- 依赖本文件的脚本 (按加载顺序):
--   01_enums.sql
--   02_rbac_users.sql
--   03_pet_profile.sql
--   04_ai_reports.sql
--   05_chat_comments.sql
--   06_share_interpretation.sql
--   07_cms.sql
--   08_subscription.sql
--   09_ecommerce.sql
--   10_iot.sql
--   11_agent.sql
--   12_healthcare.sql
--   13_welfare.sql
--   99_indexes_views.sql
-- ============================================================


-- ============================================================
-- 0. 扩展 / Extensions
-- ============================================================
--
-- pgroonga: 全文检索引擎 (Groonga 的 PG 集成)
--   支持中日韩 (CJK) 语言的全文搜索, 比内置 tsvector 对中文分词更友好。
--   典型用途: 宠物百科/帖子的中文搜索、用户昵称模糊搜索、商品搜索等。
--   Supabase Cloud: 已在 Dashboard 启用;;
自建需先在 OS 安装 Groonga。
--
-- pgcrypto: 加密工具库
--   提供密码哈希 (crypt + gen_salt, 支持 bcrypt)、安全随机数
--   (gen_random_bytes)、PGP 加解密等。用于密码存储、Token 生成、
--   敏感数据 (如医疗健康数据) 加密。
--   附带提供 gen_random_uuid() 函数 —— 生成符合 RFC 9562 的 UUIDv4,
--   随机质量优于 uuid-ossp 的 uuid_generate_v4(), 推荐在新项目使用。
--   (PostgreSQL 13+ 中 gen_random_uuid() 已内置为核心函数, 无需扩展)
--
-- 注意: 不使用 uuid-ossp 扩展。uuid_generate_v4() 是遗留方案,
--   pgcrypto 内置的 gen_random_uuid() 质量更好且无需额外扩展。
--   PG 15+ 建表时直接 DEFAULT gen_random_uuid() 即可。
--
CREATE EXTENSION IF NOT EXISTS pgroonga   WITH SCHEMA extensions;;
CREATE EXTENSION IF NOT EXISTS pgcrypto;;
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
--      (无 tsvector 列;;
详见 jsonb-i18n-pattern.md Section 0.1 Rule 1)
--   2. 业务状态/类型枚举统一为: INTEGER PK + 业务语义 f_code (UNIQUE)
--   3. 哨兵记录: 业务状态枚举 f_id = -1 = NOT-SET;;
t_lang 不使用哨兵
--   4. 通用用户态: 1=pending 10=active 20=archived 30=disabled 40=deleted (在 t_status 内统一)
--   5. 搜索策略 (枚举表 < 1000 行, 不建 pgroonga 也不建 tsvector):
--      - 业务查询均走 f_id;;
偶发 LIKE 全表扫可忽略 (Rule 1)
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
);;
COMMENT ON TABLE  public.t_lang IS '系统支持的语言代码列表 (i18n 源头, 不使用 JSONB i18n 自身)';;
COMMENT ON COLUMN public.t_lang.f_code    IS 'IETF 语言标签, e.g. zh-CN, en-US, ja-JP | 引用方: t_user.f_lang / t_pet.f_lang / t_report_*.f_lang / t_prompt.f_lang / t_banner.f_lang / t_activity.f_lang / t_landing_page.f_lang / t_chat_history.f_lang / t_appointment.f_lang / t_hospital.f_lang / t_record_lost_pet.f_lang / t_rescue_request.f_lang / t_interpretation_voice.f_lang';;
COMMENT ON COLUMN public.t_lang.f_name    IS '语言显示名 (单一语言, 不参与 i18n 翻译)';;
COMMENT ON COLUMN public.t_lang.f_desc    IS '语言说明 / 备注';;
COMMENT ON COLUMN public.t_lang.f_order   IS '排序权重 (小→前), 客户端可选语言时按此排序';;
-- ============================================================
-- 1.2 JSONB i18n 概念枚举表 (被业务表的"对象类型"字段引用)
-- ============================================================
-- 通用模板:
--   f_id    INTEGER PK (business keys, no auto-increment)
--   f_name  JSONB NOT NULL DEFAULT '{}'  -- {"zh-CN":"..","en-US":"..","ja-JP":".."}
--   f_desc  JSONB NOT NULL DEFAULT '{}'
--   f_order INT, f_deleted       INT2         NOT NULL DEFAULT 0,
--   (无 tsvector 列: Rule 1 枚举表 < 1000 行不建 tsvector 也不建 pgroonga)
--   等值查询走 B-tree idx_..._name_en / idx_..._name_zh (99.1);;
模糊 LIKE 全表扫可接受
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
);;
COMMENT ON TABLE  public.t_pet_type IS '宠物类型 (犬/猫/兔/...), JSONB i18n';;
COMMENT ON COLUMN public.t_pet_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_pet_type.f_name      IS '多语言名称, 结构: {"zh-CN":"..","en-US":"..",...} | 引用方: t_pet_breed.f_pet_type_id, t_pet.f_pet_type_id, t_rescue_request.f_pet_type_id, t_adoption.f_pet_type_id';;
COMMENT ON COLUMN public.t_pet_type.f_desc      IS '多语言描述, 结构同 f_name';;
COMMENT ON COLUMN public.t_pet_type.f_order     IS '排序权重, 小→前';;
COMMENT ON COLUMN public.t_pet_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_pet_breed IS '宠物品种, 必须属于某个 f_pet_type';;
COMMENT ON COLUMN public.t_pet_breed.f_id          IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_pet_breed.f_pet_type_id IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 引用方: t_pet.f_breed_id';;
COMMENT ON COLUMN public.t_pet_breed.f_name        IS '多语言品种名 | 引用方: t_pet.f_breed_id (反查品种)';;
COMMENT ON COLUMN public.t_pet_breed.f_desc        IS '多语言描述, 结构同 f_name';;
COMMENT ON COLUMN public.t_pet_breed.f_order       IS '排序权重';;
COMMENT ON COLUMN public.t_pet_breed.f_deleted   IS '启用开关';;
COMMENT ON COLUMN public.t_pet_breed.f_ver         IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 1.2.3 性别 / Gender
CREATE TABLE public.t_gender (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_gender_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_gender IS '宠物/用户性别 (公/母/未知)';;
COMMENT ON COLUMN public.t_gender.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_gender.f_name      IS '多语言性别名 | 引用方: t_pet.f_gender_id';;
COMMENT ON COLUMN public.t_gender.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_gender.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_gender.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_gender.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 1.2.4 照片类型 / Photo Type
CREATE TABLE public.t_photo_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_photo_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_photo_type IS '照片类型 (头像/相册/报告配图/...)';;
COMMENT ON COLUMN public.t_photo_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_photo_type.f_name      IS '多语言名称 | 引用方: t_pet_photo.f_photo_type_id';;
COMMENT ON COLUMN public.t_photo_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_photo_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_photo_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_photo_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 1.2.5 报告类型 / Report Type
CREATE TABLE public.t_report_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_report_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_report_type IS 'AI 报告类型 (emotion/health/human_pet_risk/personality/...)';;
COMMENT ON COLUMN public.t_report_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_report_type.f_name      IS '多语言名称 | 引用方: t_report_emotion.f_report_type_id, t_report_health.f_report_type_id, t_report_human_pet_risk.f_report_type_id, t_report_personality.f_report_type_id';;
COMMENT ON COLUMN public.t_report_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_report_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_report_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_report_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 1.2.6 风险等级 / Risk Level
CREATE TABLE public.t_risk_level (
    f_id        INTEGER PRIMARY KEY,
    f_ver         INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_risk_level_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_risk_level IS '人宠风险等级 (低/中/高/...)';;
COMMENT ON COLUMN public.t_risk_level.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_risk_level.f_name      IS '多语言名称 | 引用方: t_report_human_pet_risk.f_risk_level_id';;
COMMENT ON COLUMN public.t_risk_level.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_risk_level.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_risk_level.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_risk_level.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 1.2.7 个性标签 / Personality Tag
CREATE TABLE public.t_personality_tag (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_personality_tag_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_personality_tag IS '可选枚举;;
t_pet.f_personality_tags JSONB 用于用户自定义集合 (in 03_pet_profile.sql)';;
COMMENT ON COLUMN public.t_personality_tag.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_personality_tag.f_name      IS '多语言名称 | 引用方: t_pet.f_personality_tags (JSONB 数组, 不强 FK)';;
COMMENT ON COLUMN public.t_personality_tag.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_personality_tag.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_personality_tag.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_personality_tag.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 1.2.8 通用状态 / Status (用户状态等通用, 软删统一入口)
CREATE TABLE public.t_status (
    f_id        INTEGER PRIMARY KEY,
    f_ver       INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_status IS '通用用户态: 1=pending 10=active 20=archived 30=disabled 40=deleted;;
几乎所有业务表的 f_status_user 都引用此表';;
COMMENT ON COLUMN public.t_status.f_id        IS '主键;;
哨兵: -1 = NOT-SET;;
业务约定值: 1=pending 10=active 20=archived 30=disabled 40=deleted';;
COMMENT ON COLUMN public.t_status.f_name      IS '多语言名称 | 引用方: 全部业务表的 f_status_user / t_pet.f_status_pet';;
COMMENT ON COLUMN public.t_status.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_status.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_status.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 1.2.9 套餐类型 / Plan Type
CREATE TABLE public.t_plan_type (
    f_id        INTEGER PRIMARY KEY,
    f_ver         INT4    NOT NULL DEFAULT 100,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_plan_type_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_plan_type IS '订阅套餐类型 (免费/基础/专业/家庭/...)';;
COMMENT ON COLUMN public.t_plan_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_plan_type.f_name      IS '多语言名称 | 引用方: t_plan.f_plan_type_id (in 08_subscription.sql)';;`,
  1: `COMMENT ON COLUMN public.t_plan_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_plan_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_plan_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_plan_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- ============================================================
-- 1.3 业务域状态/类型枚举表 (10 张, 全部含 -1 = NOT-SET;;
业务表 f_status_xxx INT4 引用)
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
);;
COMMENT ON TABLE  public.t_payment_status IS '支付状态 (pending/paid/refunded/failed/cancelled/...)';;
COMMENT ON COLUMN public.t_payment_status.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_payment_status.f_code      IS '业务语义代码, e.g. pending, paid, refunded, failed, cancelled | UNIQUE';;
COMMENT ON COLUMN public.t_payment_status.f_name      IS '多语言名称 | 引用方: t_order.f_status_payment, t_user_subscription.f_status_payment, t_donation.f_status_payment (in 09_ecommerce.sql / 08_subscription.sql / 13_welfare.sql)';;
COMMENT ON COLUMN public.t_payment_status.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_payment_status.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_payment_status.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_payment_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_shipping_status IS '物流状态 (unshipped/shipped/in_transit/delivered/...)';;
COMMENT ON COLUMN public.t_shipping_status.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_shipping_status.f_code      IS '业务语义代码, e.g. unshipped, shipped, in_transit, delivered | UNIQUE';;
COMMENT ON COLUMN public.t_shipping_status.f_name      IS '多语言名称 | 引用方: t_order.f_status_shipping, t_shipment.f_status_shipment (in 09_ecommerce.sql)';;
COMMENT ON COLUMN public.t_shipping_status.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_shipping_status.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_shipping_status.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_shipping_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_sync_status IS '设备同步状态 (pending/syncing/success/failed/...)';;
COMMENT ON COLUMN public.t_sync_status.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_sync_status.f_code      IS '业务语义代码, e.g. pending, syncing, success, failed | UNIQUE';;
COMMENT ON COLUMN public.t_sync_status.f_name      IS '多语言名称 | 引用方: t_device_sync.f_status_sync (in 10_iot.sql)';;
COMMENT ON COLUMN public.t_sync_status.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_sync_status.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_sync_status.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_sync_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_inventory_status IS '库存状态 (in_stock/low_stock/out_of_stock/discontinued/...)';;
COMMENT ON COLUMN public.t_inventory_status.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_inventory_status.f_code      IS '业务语义代码, e.g. in_stock, low_stock, out_of_stock, discontinued | UNIQUE';;
COMMENT ON COLUMN public.t_inventory_status.f_name      IS '多语言名称 | 引用方: t_product_spu.f_status_inventory, t_product_sku.f_status_inventory, t_inventory_balance.f_status_inventory (in 09_ecommerce.sql)';;
COMMENT ON COLUMN public.t_inventory_status.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_inventory_status.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_inventory_status.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_inventory_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_inventory_serial_status IS '库存单品序列号状态 (in_stock/sold/returned/damaged/...)';;
COMMENT ON COLUMN public.t_inventory_serial_status.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_inventory_serial_status.f_code      IS '业务语义代码, e.g. in_stock, sold, returned, damaged | UNIQUE';;
COMMENT ON COLUMN public.t_inventory_serial_status.f_name      IS '多语言名称 | 引用方: t_inventory_serial.f_status_serial (in 09_ecommerce.sql)';;
COMMENT ON COLUMN public.t_inventory_serial_status.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_inventory_serial_status.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_inventory_serial_status.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_inventory_serial_status.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_adoption_type IS '领养类型 (送养/领养申请)';;
COMMENT ON COLUMN public.t_adoption_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_adoption_type.f_code      IS '业务语义代码: 1=送养(give) 2=领养申请(apply) | UNIQUE';;
COMMENT ON COLUMN public.t_adoption_type.f_name      IS '多语言名称 | 引用方: t_adoption.f_adoption_type_id (in 13_welfare.sql)';;
COMMENT ON COLUMN public.t_adoption_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_adoption_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_adoption_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_adoption_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_volunteer_type IS '志愿者类型 (救助/送养/翻译/拍照/...)';;
COMMENT ON COLUMN public.t_volunteer_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_volunteer_type.f_code      IS '业务语义代码, e.g. rescue, adoption, translate, photo | UNIQUE';;
COMMENT ON COLUMN public.t_volunteer_type.f_name      IS '多语言名称 | 引用方: t_volunteer.f_volunteer_type_id (in 13_welfare.sql)';;
COMMENT ON COLUMN public.t_volunteer_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_volunteer_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_volunteer_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_volunteer_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_share_type IS '分享类型 (report_emotion/report_health/...)';;
COMMENT ON COLUMN public.t_share_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_share_type.f_code      IS '业务语义代码, e.g. report_emotion, report_health, report_hpr, report_personality, post | UNIQUE';;
COMMENT ON COLUMN public.t_share_type.f_name      IS '多语言名称 | 引用方: t_share_record.f_share_type_id (in 06_share_interpretation.sql)';;
COMMENT ON COLUMN public.t_share_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_share_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_share_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_share_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_share_channel IS '分享渠道 (wechat/moments/qq/link/in_app/...)';;
COMMENT ON COLUMN public.t_share_channel.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_share_channel.f_code      IS '业务语义代码, e.g. wechat, moments, qq, link, in_app | UNIQUE';;
COMMENT ON COLUMN public.t_share_channel.f_name      IS '多语言名称 | 引用方: t_share_record.f_share_channel_id (in 06_share_interpretation.sql)';;
COMMENT ON COLUMN public.t_share_channel.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_share_channel.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_share_channel.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_share_channel.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_health_level IS '健康等级 (优秀/良好/一般/较差/严重)';;
COMMENT ON COLUMN public.t_health_level.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_health_level.f_code      IS '业务语义代码, e.g. excellent, good, fair, poor, severe | UNIQUE';;
COMMENT ON COLUMN public.t_health_level.f_name      IS '多语言名称 | 引用方: t_report_health.f_health_level_id (in 04_ai_reports.sql)';;
COMMENT ON COLUMN public.t_health_level.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_health_level.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_health_level.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_health_level.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_activity_type IS '活动类型 (adoption/lecture/volunteer/exhibition/offline/online)';;
COMMENT ON COLUMN public.t_activity_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_activity_type.f_code      IS '业务语义代码, e.g. adoption, lecture, volunteer, exhibition, offline, online | UNIQUE';;
COMMENT ON COLUMN public.t_activity_type.f_name      IS '多语言名称 | 引用方: t_activity.f_activity_type_id (in 07_cms.sql)';;
COMMENT ON COLUMN public.t_activity_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_activity_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_activity_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_activity_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_subscription_type IS '订阅类型 (trial/paid/gift/promo/family)';;
COMMENT ON COLUMN public.t_subscription_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;`,
  2: `COMMENT ON COLUMN public.t_subscription_type.f_code      IS '业务语义代码, e.g. trial, paid, gift, promo, family | UNIQUE';;
COMMENT ON COLUMN public.t_subscription_type.f_name      IS '多语言名称 | 引用方: t_user_subscription.f_subscription_type_id (in 08_subscription.sql)';;
COMMENT ON COLUMN public.t_subscription_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_subscription_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_subscription_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_subscription_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_banner_type IS 'Banner 跳转目标类型 (product/activity/subscription/external/page/none/...)';;
COMMENT ON COLUMN public.t_banner_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_banner_type.f_code      IS '业务语义代码, e.g. product, activity, subscription, external, page, none | UNIQUE';;
COMMENT ON COLUMN public.t_banner_type.f_name      IS '多语言名称 | 引用方: t_banner.f_link_type_id (in 07_cms.sql)';;
COMMENT ON COLUMN public.t_banner_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_banner_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_banner_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_banner_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
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
);;
COMMENT ON TABLE  public.t_usage_type IS 'AI 用量记录类型 (report/chat/analysis/voice/export/api/share/other/...)';;
COMMENT ON COLUMN public.t_usage_type.f_id        IS '主键;;
哨兵: -1 = NOT-SET';;
COMMENT ON COLUMN public.t_usage_type.f_code      IS '业务语义代码, e.g. report, chat, analysis, voice, export, api, share, other | UNIQUE';;
COMMENT ON COLUMN public.t_usage_type.f_name      IS '多语言名称 | 引用方: t_usage_record.f_usage_type_id (in 08_subscription.sql)';;
COMMENT ON COLUMN public.t_usage_type.f_desc      IS '多语言描述';;
COMMENT ON COLUMN public.t_usage_type.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_usage_type.f_deleted IS '启用开关';;
COMMENT ON COLUMN public.t_usage_type.f_ver       IS '版本号: x00=主版本 + xx=小版本, 例: 100=v1.00, 101=v1.01, 200=v2.00';;
-- 预设数据见 init/db_init.sql (t_usage_type)

-- ============================================================
-- PetChat (更懂它) / 2. 身份与权限 / RBAC & Users
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   定义系统角色 / API 端点 / 角色-API 授权 / 用户 / 用户-角色绑定
--   加载顺序: 在 01_enums 之后, 在所有业务表之前
--
-- 依赖:
--   00_extensions.sql  (pgcrypto)
--   01_enums.sql       (t_lang, t_status)
--
-- 被本文件引用的脚本 (下游, 均通过 t_user.f_id 关联):
--   03_pet_profile.sql, 04_ai_reports.sql, 05_chat_comments.sql,
--   06_share_interpretation.sql, 07_cms.sql, 08_subscription.sql,
--   09_ecommerce.sql, 10_iot.sql, 11_agent.sql, 12_healthcare.sql, 13_welfare.sql
--
-- 设计原则 (Users Principles):
--   1. f_public_id UUID 对外暴露, 替代 BIGINT
--   2. 软删除统一通过 f_status_user = 3 表达 (引用 t_status)
--   3. 唯一约束用部分索引 (排除空字符串), 允许"未填写"
--   4. 重复手机/邮箱: 应用层清理, 数据库层用部分唯一索引兜底
-- ============================================================


-- ============================================================
-- 2.1 系统角色 / Sys Role  (平台角色, 非 i18n, 系统内部用)
-- ============================================================
CREATE TABLE public.t_sys_role (
    f_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_name      VARCHAR(64) NOT NULL,
    f_desc      VARCHAR(256) NOT NULL DEFAULT '',
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT uk_t_sys_role_name UNIQUE (f_name)
);;
COMMENT ON TABLE  public.t_sys_role IS '平台角色 (非 i18n, 系统内部用, e.g. user/agent/admin/ops/super_admin)';;
COMMENT ON COLUMN public.t_sys_role.f_id        IS '主键 | 引用方: t_user_role.f_role_id, t_role_api.f_role_id (本文件内)';;
COMMENT ON COLUMN public.t_sys_role.f_name      IS '角色名, e.g. user / agent / admin / super_admin | UNIQUE';;
COMMENT ON COLUMN public.t_sys_role.f_desc      IS '角色说明';;
COMMENT ON COLUMN public.t_sys_role.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_sys_role.f_deleted IS '启用开关';;
-- ============================================================
-- 2.2 API 端点 / API
-- ============================================================
CREATE TABLE public.t_api (
    f_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_name      VARCHAR(128) NOT NULL,
    f_method    VARCHAR(8)   NOT NULL,
    f_endpoint  VARCHAR(256) NOT NULL,
    f_desc      VARCHAR(256) NOT NULL DEFAULT '',
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT uk_t_api_method_endpoint UNIQUE (f_method, f_endpoint),
    CONSTRAINT ck_t_api_method CHECK (f_method IN ('GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'))
);;
COMMENT ON TABLE  public.t_api IS '平台 API 端点注册表 (用于 RBAC 授权)';;
COMMENT ON COLUMN public.t_api.f_id        IS '主键 | 引用方: t_role_api.f_api_id (本文件内)';;
COMMENT ON COLUMN public.t_api.f_name      IS '端点名称, e.g. 用户登录 / 创建订单';;
COMMENT ON COLUMN public.t_api.f_method    IS 'HTTP 方法, e.g. GET / POST';;
COMMENT ON COLUMN public.t_api.f_endpoint  IS '端点路径, e.g. /api/v1/auth/login';;
COMMENT ON COLUMN public.t_api.f_desc      IS '端点说明';;
COMMENT ON COLUMN public.t_api.f_order     IS '排序权重';;
COMMENT ON COLUMN public.t_api.f_deleted IS '启用开关';;
-- ============================================================
-- 2.3 角色-API 授权 / Role API
-- ============================================================
CREATE TABLE public.t_role_api (
    f_role_id    BIGINT  NOT NULL,
    f_api_id     BIGINT  NOT NULL,
    f_is_enabled BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (f_role_id, f_api_id),
    CONSTRAINT fk_t_role_api_role FOREIGN KEY (f_role_id)
        REFERENCES public.t_sys_role(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_role_api_api  FOREIGN KEY (f_api_id)
        REFERENCES public.t_api(f_id)     ON DELETE CASCADE
);;
COMMENT ON TABLE  public.t_role_api IS '角色-API 授权关联表 (复合 PK)';;
COMMENT ON COLUMN public.t_role_api.f_role_id    IS 'FK -> public.t_sys_role(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_role_api.f_api_id     IS 'FK -> public.t_api(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_role_api.f_is_enabled IS '是否启用该授权 (false 即禁用, 保留历史)';;
-- ============================================================
-- 2.4 用户 / User
-- ============================================================
CREATE TABLE public.t_user (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid      UUID        NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_lang            VARCHAR(8)  NOT NULL DEFAULT 'zh-CN',
    f_nickname        VARCHAR(64) NOT NULL,
    f_avatar_url      VARCHAR(512) NOT NULL DEFAULT '',
    f_phone           VARCHAR(32)  NOT NULL DEFAULT '',
    f_email           VARCHAR(128) NOT NULL DEFAULT '',
    f_password_hash   VARCHAR(256) NOT NULL DEFAULT '',
    f_status_id     INTEGER     NOT NULL DEFAULT 1,
    f_meta_info       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_created_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_user_lang       FOREIGN KEY (f_lang)        REFERENCES public.t_lang(f_code)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_user_status     FOREIGN KEY (f_status_id) REFERENCES public.t_status(f_id)          ON DELETE NO ACTION,
    CONSTRAINT ck_t_user_nickname   CHECK (length(f_nickname) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_user_phone      CHECK (f_phone = '' OR f_phone ~ '^[0-9+\\-\\s()]{5,32}$'),
    CONSTRAINT ck_t_user_email      CHECK (f_email = '' OR f_email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
    CONSTRAINT ck_t_user_meta_object CHECK (jsonb_typeof(f_meta_info) = 'object'),
    CONSTRAINT uk_t_user_public_uid UNIQUE (f_public_uid)
);;
-- 确保 f_public_id DEFAULT 已设置 (修复旧表无 DEFAULT 问题)

COMMENT ON TABLE  public.t_user IS '平台用户主表 (f_public_uid 对外暴露, BIGINT 仅内部)';;
COMMENT ON COLUMN public.t_user.f_id            IS '主键 (内部使用) | 引用方: 几乎所有业务表 f_user_id';;
COMMENT ON COLUMN public.t_user.f_public_uid    IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_user.f_lang          IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 用户界面默认语言';;
COMMENT ON COLUMN public.t_user.f_nickname      IS '昵称, 1-64 字符';;
COMMENT ON COLUMN public.t_user.f_avatar_url    IS '头像 URL (空 = 默认头像)';;
COMMENT ON COLUMN public.t_user.f_phone         IS '手机号 (空字符串表示未填, 部分唯一索引见 99_indexes_views.sql)';;
COMMENT ON COLUMN public.t_user.f_email         IS '邮箱 (空字符串表示未填, 部分唯一索引见 99_indexes_views.sql)';;
COMMENT ON COLUMN public.t_user.f_password_hash IS '密码哈希 (argon2id / bcrypt, 不存明文)';;
COMMENT ON COLUMN public.t_user.f_status_id   IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_user.f_meta_info     IS '扩展元数据, 存 is_anonymous / role / 偏好设置等;;
匿名捐款哨兵 f_id=-1 通过 f_meta_info.role=anonymous 标识';;
COMMENT ON COLUMN public.t_user.f_created_at    IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_user.f_updated_at    IS '更新时间 (UTC), 由 trigger 维护';;
-- 注: uk_t_user_phone / uk_t_user_email (partial unique) 与
--      idx_t_user_phone_active / idx_t_user_email_active (active 状态) 已统一
--      移至 99_indexes_views.sql


-- ============================================================
-- 2.5 用户-角色绑定 / User Role
-- ============================================================
CREATE TABLE public.t_user_role (
    f_user_id BIGINT NOT NULL,
    f_role_id BIGINT NOT NULL,
    f_assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (f_user_id, f_role_id),
    CONSTRAINT fk_t_user_role_user FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id)      ON DELETE CASCADE,
    CONSTRAINT fk_t_user_role_role FOREIGN KEY (f_role_id) REFERENCES public.t_sys_role(f_id)  ON DELETE CASCADE
);;
COMMENT ON TABLE  public.t_user_role IS '用户-角色 多对多绑定 (复合 PK)';;
COMMENT ON COLUMN public.t_user_role.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_user_role.f_role_id     IS 'FK -> public.t_sys_role(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_user_role.f_assigned_at IS '授权时间 (UTC)';;
-- ============================================================
-- PetChat (更懂它) / 3. 宠物档案 / Pet Profile
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   宠物主表 + 宠物照片 (替代原 t_pet.f_photo_url / f_photo_urls 字段)
--
-- 依赖:
--   01_enums.sql   (t_pet_type, t_pet_breed, t_gender, t_photo_type, t_status, t_lang)
--   02_rbac_users.sql (t_user)
--
-- 被本文件引用的脚本 (下游):
--   04_ai_reports.sql            -> t_pet
--   05_chat_comments.sql         -> t_pet
--   09_ecommerce.sql             -> (设备关联, 暂未引用)
--   10_iot.sql                   -> (设备绑定到用户, 不直接绑宠物)
--   12_healthcare.sql            -> t_appointment.f_pet_id
--   13_welfare.sql               -> t_rescue_request (无 FK) / t_adoption.f_pet_id / t_record_lost_pet.f_pet_id
--
-- 设计原则 (Pet Profile Principles):
--   1. 三种出生精度: 精确日 (f_birth_date) 优先;;
否则仅年 (f_birth_year);;`,
  3: `可选月 (f_birth_month)
--   2. 软删除通过 f_status_user = 3 (引用 t_status)
--   3. 业务态 f_status_pet: 1=在册 2=走失 3=已送养 4=已故 5=已归档 (引用 t_status 复用, 业务值由应用层约定)
--   4. 个性标签 f_personality_tags 用 JSONB 数组 (太多无法穷举), 枚举表 t_personality_tag 仅作参考
-- ============================================================


-- ============================================================
-- 3.1 宠物主表 / Pet
-- ============================================================
CREATE TABLE public.t_pet (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid    UUID        NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id       BIGINT      NOT NULL,
    f_lang          VARCHAR(8)  NOT NULL DEFAULT 'zh-CN',
    f_pet_type_id   INTEGER     NOT NULL,
    f_breed_id      INTEGER,
    f_name          VARCHAR(64) NOT NULL,
    f_avatar_url    VARCHAR(512) NOT NULL DEFAULT '',
    f_gender_id     INTEGER NOT NULL DEFAULT -1,
    f_birth_date    DATE,
    f_birth_year    INTEGER,
    f_birth_month   INTEGER,
    f_weight        NUMERIC(6,2),
    f_sterilized    BOOLEAN     NOT NULL DEFAULT false,
    f_vaccinated    BOOLEAN     NOT NULL DEFAULT false,
    f_status_pet    INTEGER     NOT NULL DEFAULT 1,
    f_status_id     INTEGER     NOT NULL DEFAULT 1,
    f_personality_tags JSONB    NOT NULL DEFAULT '[]'::jsonb,
    f_meta_info     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_deleted       INT2        NOT NULL DEFAULT 0,
    f_created_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_pet_user        FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_lang        FOREIGN KEY (f_lang)         REFERENCES public.t_lang(f_code)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_type        FOREIGN KEY (f_pet_type_id)  REFERENCES public.t_pet_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_breed       FOREIGN KEY (f_breed_id)     REFERENCES public.t_pet_breed(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_gender      FOREIGN KEY (f_gender_id)    REFERENCES public.t_gender(f_id)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_status_pet  FOREIGN KEY (f_status_pet)   REFERENCES public.t_status(f_id)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_status_id   FOREIGN KEY (f_status_id)    REFERENCES public.t_status(f_id)    ON DELETE NO ACTION,
    CONSTRAINT ck_t_pet_del         CHECK (f_deleted IN (0, 1)),
    CONSTRAINT ck_t_pet_name        CHECK (length(f_name) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_pet_birth_info  CHECK (f_birth_date IS NOT NULL OR f_birth_year IS NOT NULL),
    CONSTRAINT ck_t_pet_birth_year  CHECK (f_birth_year  IS NULL OR (f_birth_year  BETWEEN 1980 AND 2100)),
    CONSTRAINT ck_t_pet_birth_month CHECK (f_birth_month IS NULL OR (f_birth_month BETWEEN 1 AND 12)),
    CONSTRAINT ck_t_pet_weight      CHECK (f_weight IS NULL OR (f_weight > 0 AND f_weight < 1000)),
    CONSTRAINT ck_t_pet_personality_array CHECK (jsonb_typeof(f_personality_tags) = 'array'),
    CONSTRAINT uk_t_pet_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_pet IS '宠物主表';;
COMMENT ON COLUMN public.t_pet.f_id               IS '主键 | 引用方: t_pet_photo.f_pet_id (本文件) / t_chat_history.f_pet_id (in 05_chat_comments.sql) / t_report_emotion.f_pet_id, t_report_health.f_pet_id, t_report_hpr.f_pet_id, t_report_pers.f_pet_id (in 04_ai_reports.sql) / t_appointment.f_pet_id (in 12_healthcare.sql) / t_adoption.f_pet_id, t_record_lost_pet.f_pet_id (in 13_welfare.sql)';;
COMMENT ON COLUMN public.t_pet.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_pet.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 宠物主人';;
COMMENT ON COLUMN public.t_pet.f_lang             IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 宠物档案主语言';;
COMMENT ON COLUMN public.t_pet.f_pet_type_id      IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 必填, 不可空';;
COMMENT ON COLUMN public.t_pet.f_breed_id         IS 'FK -> public.t_pet_breed(f_id) | defined in 01_enums.sql | 可空 (用户可能不知道品种)';;
COMMENT ON COLUMN public.t_pet.f_name             IS '宠物昵称, 1-64 字符';;
COMMENT ON COLUMN public.t_pet.f_avatar_url       IS '宠物头像 URL (主图, 与 t_pet_photo 表联动)';;
COMMENT ON COLUMN public.t_pet.f_gender_id        IS 'FK -> public.t_gender(f_id) | defined in 01_enums.sql | 可空 (哨兵 -1 = 未知)';;
COMMENT ON COLUMN public.t_pet.f_birth_date       IS '精确生日 (优先);;
与 f_birth_year / f_birth_month 互斥 (CHECK: f_birth_date IS NOT NULL OR f_birth_year IS NOT NULL)';;
COMMENT ON COLUMN public.t_pet.f_birth_year       IS '出生年份 (f_birth_date 为空时使用), 1980-2100 | 互斥: t_pet.f_birth_date / t_pet.f_birth_month';;
COMMENT ON COLUMN public.t_pet.f_birth_month      IS '出生月份 (可选, 1-12) | 互斥: t_pet.f_birth_date / t_pet.f_birth_year';;
COMMENT ON COLUMN public.t_pet.f_weight           IS '体重 (kg), 0 < weight < 1000';;
COMMENT ON COLUMN public.t_pet.f_sterilized       IS '是否已绝育';;
COMMENT ON COLUMN public.t_pet.f_vaccinated       IS '是否已接种疫苗';;
COMMENT ON COLUMN public.t_pet.f_status_pet       IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 业务态: 1=在册 2=走失 3=已送养 4=已故 5=已归档';;
COMMENT ON COLUMN public.t_pet.f_deleted          IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_pet.f_personality_tags IS '用户自定义性格标签 JSONB 数组 (引用参考 t_personality_tag, defined in 01_enums.sql, 太多无法穷举)';;
COMMENT ON COLUMN public.t_pet.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_pet.f_created_at       IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_pet.f_updated_at       IS '更新时间 (UTC), 由 trigger 维护';;
-- ============================================================
-- 3.2 宠物照片 / Pet Photo
-- ============================================================
CREATE TABLE public.t_pet_photo (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_pet_id        BIGINT       NOT NULL,
    f_photo_type_id INTEGER      NOT NULL,
    f_photo_url     VARCHAR(512) NOT NULL,
    f_thumbnail_url VARCHAR(512) NOT NULL DEFAULT '',
    f_is_primary    BOOLEAN      NOT NULL DEFAULT false,
    f_deleted       INT2         NOT NULL DEFAULT 0,
    f_meta_info     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at    BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_pet_photo_pet   FOREIGN KEY (f_pet_id)        REFERENCES public.t_pet(f_id)        ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_photo_type  FOREIGN KEY (f_photo_type_id) REFERENCES public.t_photo_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_pet_photo_url   CHECK (length(f_photo_url) > 0),
    CONSTRAINT ck_t_pet_photo_del   CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_pet_photo IS '宠物照片 (主表, 替代原 t_pet.f_photo_url/f_photo_urls)';;
COMMENT ON COLUMN public.t_pet_photo.f_id            IS '主键';;
COMMENT ON COLUMN public.t_pet_photo.f_pet_id        IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';;
COMMENT ON COLUMN public.t_pet_photo.f_photo_type_id IS 'FK -> public.t_photo_type(f_id) | defined in 01_enums.sql | 头像/相册/报告配图/...';;
COMMENT ON COLUMN public.t_pet_photo.f_photo_url     IS '原图 URL (CDN)';;
COMMENT ON COLUMN public.t_pet_photo.f_thumbnail_url IS '缩略图 URL (空 = 客户端按需生成)';;
COMMENT ON COLUMN public.t_pet_photo.f_is_primary    IS '是否主图;;
主图唯一性约束见 99_indexes_views.sql: idx_t_pet_photo_primary';;
COMMENT ON COLUMN public.t_pet_photo.f_deleted       IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_pet_photo.f_meta_info     IS '扩展元数据 (宽高/EXIF/...)';;
COMMENT ON COLUMN public.t_pet_photo.f_created_at    IS '上传时间 (UTC)';;
-- ============================================================
-- PetChat (更懂它) / 4. AI 报告 / AI Reports & Prompts
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   4 张 AI 报告表 (情绪/健康/人宠风险/性格) + 提示词版本管理
--
-- 依赖:
--   01_enums.sql       (t_report_type, t_risk_level, t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--   03_pet_profile.sql (t_pet)
--
-- 被本文件引用的脚本 (下游, 弱引用 f_report_id):
--   06_share_interpretation.sql  -> t_share_record.f_report_id, t_interpretation_voice.f_report_id (f_report_type 区分)
--   08_subscription.sql          -> t_usage_record.f_related_report_id (弱引用)
--
-- 设计原则 (AI Reports Principles):
--   1. 报告是只写历史, 不修改 (append-only)
--   2. f_report_type 字段保留为弱引用, 实际表由 f_report_type 决定:
--      emotion -> t_report_emotion
--      health  -> t_report_health
--      human_pet_risk -> t_report_human_pet_risk
--      personality  -> t_report_personality
--   3. 提示词按 (f_code, f_lang, f_ver) 版本化, f_ver 在 (code, lang) 内单调递增
--   4. CHECK 约束用业务枚举值列表 (白名单), 新增情绪/健康等级需先迁移 CHECK
-- ============================================================


-- ============================================================
-- 4.1 提示词 / Prompts (按 code + lang 隔离, f_ver 逻辑版本)
-- ============================================================
CREATE TABLE public.t_prompt (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_code        VARCHAR(64)  NOT NULL,
    f_lang        VARCHAR(8)   NOT NULL,
    f_ver         INTEGER      NOT NULL,
    f_content     TEXT         NOT NULL,
    f_deleted     INT2         NOT NULL DEFAULT 0,
    f_created_at  BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at  BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_prompt_lang   FOREIGN KEY (f_lang) REFERENCES public.t_lang(f_code) ON DELETE NO ACTION,
    CONSTRAINT uk_t_prompt_code_lang_ver UNIQUE (f_code, f_lang, f_ver),
    CONSTRAINT ck_t_prompt_content CHECK (length(f_content) > 0),
    CONSTRAINT ck_t_prompt_del     CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_prompt IS 'AI 提示词, (f_code, f_lang, f_ver) 唯一';;
COMMENT ON COLUMN public.t_prompt.f_id          IS '主键 (内部使用, 业务查询用 f_code+f_lang+f_ver)';;
COMMENT ON COLUMN public.t_prompt.f_code        IS '提示词业务代码, e.g. emotion_analyze / health_assess / chat_persona';;
COMMENT ON COLUMN public.t_prompt.f_lang        IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 提示词语言';;
COMMENT ON COLUMN public.t_prompt.f_ver         IS '逻辑版本号, 同 (code, lang) 内单调递增 | 引用: 应用层通过 (code, lang, max_ver) 取最新';;
COMMENT ON COLUMN public.t_prompt.f_content     IS '提示词正文 (模板, 支持 {{pet_name}} 等占位符)';;
COMMENT ON COLUMN public.t_prompt.f_deleted     IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_prompt.f_created_at  IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_prompt.f_updated_at  IS '更新时间 (UTC)';;
-- ============================================================
-- 4.2 情绪报告 / Emotion Report
-- ============================================================
CREATE TABLE public.t_report_emotion (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid    UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id       BIGINT       NOT NULL,
    f_pet_id        BIGINT       NOT NULL,
    f_lang          VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id INTEGER     NOT NULL,
    f_emotion_score NUMERIC(5,2) NOT NULL,
    f_emotion_state VARCHAR(32)  NOT NULL,
    f_emotion_tags  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_emotion_trend VARCHAR(16)  NOT NULL DEFAULT '',
    f_deleted       INT2         NOT NULL DEFAULT 0,
    f_created_at    BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_emotion_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_emotion_score   CHECK (f_emotion_score BETWEEN 0 AND 100),
    CONSTRAINT ck_t_report_emotion_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT ck_t_report_emotion_state   CHECK (f_emotion_state IN ('开心','平静','焦虑','恐惧','愤怒','悲伤','兴奋','紧张','满足','不安')),
    CONSTRAINT ck_t_report_emotion_trend   CHECK (f_emotion_trend IN ('','上升','下降','稳定','波动')),
    CONSTRAINT uk_t_report_emotion_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_report_emotion IS '宠物情绪分析报告';;
COMMENT ON COLUMN public.t_report_emotion.f_id             IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=emotion)';;
COMMENT ON COLUMN public.t_report_emotion.f_public_uid     IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_report_emotion.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 报告创建者';;
COMMENT ON COLUMN public.t_report_emotion.f_pet_id         IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 被分析的宠物';;
COMMENT ON COLUMN public.t_report_emotion.f_lang           IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 报告内容语言';;
COMMENT ON COLUMN public.t_report_emotion.f_report_type_id IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: emotion';;
COMMENT ON COLUMN public.t_report_emotion.f_emotion_score  IS '情绪分 0-100 (高分=积极)';;
COMMENT ON COLUMN public.t_report_emotion.f_emotion_state  IS '情绪状态 (白名单): 开心/平静/焦虑/恐惧/愤怒/悲伤/兴奋/紧张/满足/不安';;
COMMENT ON COLUMN public.t_report_emotion.f_emotion_tags   IS '情绪标签 JSONB 数组, e.g. ["尾巴摇动","耳朵竖起"]';;
COMMENT ON COLUMN public.t_report_emotion.f_emotion_trend  IS '趋势: 空(单次) / 上升 / 下降 / 稳定 / 波动';;
COMMENT ON COLUMN public.t_report_emotion.f_deleted        IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_report_emotion.f_created_at     IS '生成时间 (UTC)';;`,
  4: `-- ============================================================
-- 4.3 健康报告 / Health Report
-- ============================================================
CREATE TABLE public.t_report_health (
    f_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid          UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id             BIGINT       NOT NULL,
    f_pet_id              BIGINT       NOT NULL,
    f_lang                VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id      INTEGER      NOT NULL,
    f_health_score        NUMERIC(5,2) NOT NULL,
    f_health_level_id     INTEGER      NOT NULL,
    f_health_issues       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_health_suggestions  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_deleted             INT2         NOT NULL DEFAULT 0,
    f_created_at          BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_health_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_health_score   CHECK (f_health_score BETWEEN 0 AND 100),
    CONSTRAINT fk_t_report_health_health  FOREIGN KEY (f_health_level_id) REFERENCES public.t_health_level(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_health_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_health_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_report_health IS '宠物健康评估报告';;
COMMENT ON COLUMN public.t_report_health.f_id                 IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=health)';;
COMMENT ON COLUMN public.t_report_health.f_public_uid         IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_report_health.f_user_id            IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_report_health.f_pet_id             IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';;
COMMENT ON COLUMN public.t_report_health.f_lang               IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_report_health.f_report_type_id     IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: health';;
COMMENT ON COLUMN public.t_report_health.f_health_score       IS '健康分 0-100';;
COMMENT ON COLUMN public.t_report_health.f_health_level_id    IS 'FK -> public.t_health_level(f_id) | defined in 01_enums.sql | 健康等级';;
COMMENT ON COLUMN public.t_report_health.f_health_issues      IS '健康问题 JSONB 数组, e.g. [{"code":"obesity","severity":"low"}]';;
COMMENT ON COLUMN public.t_report_health.f_health_suggestions IS '健康建议 JSONB 数组';;
COMMENT ON COLUMN public.t_report_health.f_deleted            IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_report_health.f_created_at         IS '生成时间 (UTC)';;
-- ============================================================
-- 4.4 人宠风险报告 / Human-Pet Risk Report
-- ============================================================
CREATE TABLE public.t_report_human_pet_risk (
    f_id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid             UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id                BIGINT       NOT NULL,
    f_pet_id                 BIGINT       NOT NULL,
    f_lang                   VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id         INTEGER      NOT NULL,
    f_risk_level_id          INTEGER      NOT NULL,
    f_risk_score             NUMERIC(5,2) NOT NULL,
    f_risk_factors           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_risk_recommendations   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_deleted                INT2         NOT NULL DEFAULT 0,
    f_created_at             BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_hpr_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_level   FOREIGN KEY (f_risk_level_id)  REFERENCES public.t_risk_level(f_id)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_hpr_score   CHECK (f_risk_score BETWEEN 0 AND 100),
    CONSTRAINT ck_t_report_hpr_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_hpr_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_report_human_pet_risk IS '人宠相处风险评估报告';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_id                    IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=human_pet_risk)';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_public_uid            IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_user_id               IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_pet_id                IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_lang                  IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_report_type_id        IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: human_pet_risk';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_level_id         IS 'FK -> public.t_risk_level(f_id) | defined in 01_enums.sql | 低/中/高';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_score            IS '风险分 0-100 (高分=高风险)';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_factors          IS '风险因子 JSONB 数组, e.g. [{"factor":"小孩","level":"medium"}]';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_recommendations  IS '风险建议 JSONB 数组';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_deleted               IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_report_human_pet_risk.f_created_at            IS '生成时间 (UTC)';;
-- ============================================================
-- 4.5 性格报告 / Personality Report
-- ============================================================
CREATE TABLE public.t_report_personality (
    f_id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid           UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id              BIGINT       NOT NULL,
    f_pet_id               BIGINT       NOT NULL,
    f_lang                 VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id       INTEGER      NOT NULL,
    f_personality_tags     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_personality_traits   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_personality_analysis TEXT         NOT NULL DEFAULT '',
    f_deleted              INT2         NOT NULL DEFAULT 0,
    f_created_at           BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_pers_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_pers_traits  CHECK (jsonb_typeof(f_personality_traits) = 'object'),
    CONSTRAINT ck_t_report_pers_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_pers_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_report_personality IS '宠物性格画像报告';;
COMMENT ON COLUMN public.t_report_personality.f_id                   IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=personality)';;
COMMENT ON COLUMN public.t_report_personality.f_public_uid           IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_report_personality.f_user_id              IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_report_personality.f_pet_id               IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';;
COMMENT ON COLUMN public.t_report_personality.f_lang                 IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_report_personality.f_report_type_id       IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: personality';;
COMMENT ON COLUMN public.t_report_personality.f_personality_tags     IS '性格标签 JSONB 数组 (引用参考 t_personality_tag, defined in 01_enums.sql)';;
COMMENT ON COLUMN public.t_report_personality.f_personality_traits   IS '性格维度分 JSONB 对象, e.g. {"sociability":0.8,"aggression":0.2}';;
COMMENT ON COLUMN public.t_report_personality.f_personality_analysis IS 'AI 生成的文字解读';;
COMMENT ON COLUMN public.t_report_personality.f_deleted              IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_report_personality.f_created_at           IS '生成时间 (UTC)';;
-- ============================================================
-- PetChat (更懂它) / 5. 聊天与评论 / Chat & Comments
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   聊天会话 + 通用评论/评分
--
-- 依赖:
--   01_enums.sql       (t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--   03_pet_profile.sql (t_pet)
--
-- 被本文件引用的脚本: 无 (本文件为叶子模块)
--
-- 设计原则 (Chat & Comments Principles):
--   1. 聊天会话与宠物是弱关联: 删宠物时由应用层关闭会话 (依赖 f_session_uid 追踪) 而非 ON DELETE SET NULL
--   2. 评论通用化: f_target_type + f_target_id 组合, 配合 CHECK 白名单支持多目标
--   3. 评分: -1 = 未评分, 1-5 = 整数评分
-- ============================================================


-- ============================================================
-- 5.1 聊天历史 / Chat History
-- ============================================================
CREATE TABLE public.t_chat_history (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id       BIGINT      NOT NULL,
    f_pet_id        BIGINT,
    f_lang          VARCHAR(8)  NOT NULL DEFAULT 'zh-CN',
    f_session_uid   UUID        NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_chat_history  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    f_meta_info     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_started_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_ended_at      TIMESTAMPTZ,
    CONSTRAINT fk_t_chat_history_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)            ON DELETE NO ACTION,
    CONSTRAINT fk_t_chat_history_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)             ON DELETE NO ACTION,
    CONSTRAINT fk_t_chat_history_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)          ON DELETE NO ACTION,
    CONSTRAINT uq_t_chat_history_session_uid UNIQUE (f_session_uid),
    CONSTRAINT ck_t_chat_history_history CHECK (jsonb_typeof(f_chat_history) = 'array'),
    CONSTRAINT ck_t_chat_history_ended   CHECK (f_ended_at IS NULL OR f_ended_at >= f_started_at)
);;
COMMENT ON TABLE  public.t_chat_history IS '聊天历史 (用户与 AI 的对话上下文)';;
COMMENT ON COLUMN public.t_chat_history.f_id             IS '主键';;
COMMENT ON COLUMN public.t_chat_history.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 会话创建者';;
COMMENT ON COLUMN public.t_chat_history.f_pet_id         IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 弱关联 (可空);;
宠物删除时应用层通过 f_session_uid 关闭会话, 而非 FK SET NULL';;
COMMENT ON COLUMN public.t_chat_history.f_lang           IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 会话语言';;
COMMENT ON COLUMN public.t_chat_history.f_session_uid    IS '会话唯一标识 (UUID, public.rpc_gen_uuid()) | UNIQUE | 用于跨系统/前端追踪会话';;
COMMENT ON COLUMN public.t_chat_history.f_chat_history   IS '聊天历史 JSONB 数组, e.g. [{"role":"user","content":"...","at":"2026-06-17T..."}]';;
COMMENT ON COLUMN public.t_chat_history.f_meta_info      IS '扩展元数据 (模型/token消耗/...)';;
COMMENT ON COLUMN public.t_chat_history.f_started_at     IS '会话开始时间 (UTC)';;
COMMENT ON COLUMN public.t_chat_history.f_ended_at       IS '会话结束时间 (UTC, 可空) | 约束: >= f_started_at';;
-- t_chat_history 为 append-only 日志表, 不设软删字段


-- ============================================================
-- 5.2 评论 / 评分 / Comment
-- ============================================================
CREATE TABLE public.t_comment (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id     BIGINT       NOT NULL,
    f_target_type VARCHAR(32)  NOT NULL,
    f_target_id   BIGINT       NOT NULL,
    f_rating      INTEGER      NOT NULL DEFAULT -1,
    f_content     TEXT         NOT NULL DEFAULT '',
    f_meta_info   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_deleted     INT2         NOT NULL DEFAULT 0,
    f_created_at  BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_comment_user   FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_comment_rating CHECK (f_rating = -1 OR f_rating BETWEEN 1 AND 5),
    CONSTRAINT ck_t_comment_target CHECK (f_target_type IN ('hospital','doctor','product','order','agent','service','activity','pet','user')),
    CONSTRAINT ck_t_comment_del    CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_comment IS '通用评论/评分 (多态目标, 通过 f_target_type + f_target_id 定位)';;
COMMENT ON COLUMN public.t_comment.f_id          IS '主键';;
COMMENT ON COLUMN public.t_comment.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 评论者';;
COMMENT ON COLUMN public.t_comment.f_target_type IS '目标类型 (白名单): hospital / doctor / product / order / agent / service / activity / pet / user';;
COMMENT ON COLUMN public.t_comment.f_target_id   IS '目标 ID (弱引用, 实际表由 f_target_type 决定)';;
COMMENT ON COLUMN public.t_comment.f_rating      IS '评分: -1=未评分 1-5 整数 | 业务表只对支持评分的 target_type 校验';;`,
  5: `COMMENT ON COLUMN public.t_comment.f_content     IS '评论内容 (可空字符串)';;
COMMENT ON COLUMN public.t_comment.f_meta_info   IS '扩展元数据 (图片/回复/匿名标记)';;
COMMENT ON COLUMN public.t_comment.f_deleted     IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_comment.f_created_at  IS '创建时间 (UTC)';;
-- 注: idx_t_comment_target / idx_t_comment_user 已统一移至 99_indexes_views.sql

-- ============================================================
-- PetChat (更懂它) / 6. 分享与解读 / Share & Interpretation
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   报告分享记录 + AI 语音解读
--
-- 依赖:
--   01_enums.sql       (t_share_type, t_share_channel, t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--   04_ai_reports.sql  (报告源, 弱引用 f_report_id)
--
-- 被本文件引用的脚本: 无
--
-- 设计原则 (Share Principles):
--   1. f_report_id 是弱引用, 无 FK 约束, 实际表由 f_report_type 决定:
--      emotion -> t_report_emotion
--      health  -> t_report_health
--      human_pet_risk -> t_report_human_pet_risk
--      personality  -> t_report_personality
--   2. 报告被删除时, 分享记录保留, 由应用层显示"原报告已删除"
--   3. 语音解读: 每次报告可生成多个语种版本, f_lang 区分
-- ============================================================


-- ============================================================
-- 6.1 分享记录 / Share Record
-- ============================================================
CREATE TABLE public.t_share_record (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id         BIGINT  NOT NULL,
    f_report_id       BIGINT  NOT NULL,
    f_report_type_id  INTEGER NOT NULL,
    f_share_type_id   INTEGER NOT NULL,
    f_share_channel_id INTEGER NOT NULL,
    f_share_url       TEXT NOT NULL DEFAULT '',
    f_view_count      INTEGER NOT NULL DEFAULT 0,
    f_meta_info       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_deleted         INT2    NOT NULL DEFAULT 0,
    f_created_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_share_user    FOREIGN KEY (f_user_id)         REFERENCES public.t_user(f_id)        ON DELETE NO ACTION,
    CONSTRAINT fk_t_share_type    FOREIGN KEY (f_share_type_id)   REFERENCES public.t_share_type(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_share_channel FOREIGN KEY (f_share_channel_id) REFERENCES public.t_share_channel(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_share_report  FOREIGN KEY (f_report_type_id)  REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_share_view    CHECK (f_view_count >= 0),
    CONSTRAINT ck_t_share_del     CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_share_record IS '报告分享记录 (f_report_id 为弱引用, 实际表由 f_report_type 决定)';;
COMMENT ON COLUMN public.t_share_record.f_id              IS '主键';;
COMMENT ON COLUMN public.t_share_record.f_user_id         IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 分享者';;
COMMENT ON COLUMN public.t_share_record.f_report_id       IS '弱引用: 报告 ID | 实际表由 f_report_type 决定 | defined in 04_ai_reports.sql (emotion|health|human_pet_risk|personality)';;
COMMENT ON COLUMN public.t_share_record.f_report_type_id  IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 报告类型';;
COMMENT ON COLUMN public.t_share_record.f_share_type_id   IS 'FK -> public.t_share_type(f_id) | defined in 01_enums.sql | 分享内容类型';;
COMMENT ON COLUMN public.t_share_record.f_share_channel_id IS 'FK -> public.t_share_channel(f_id) | defined in 01_enums.sql | 分享渠道 (微信/朋友圈/...)';;
COMMENT ON COLUMN public.t_share_record.f_share_url       IS '生成的分享 URL (空 = 仅内部)';;
COMMENT ON COLUMN public.t_share_record.f_view_count      IS '查看次数 (>= 0)';;
COMMENT ON COLUMN public.t_share_record.f_meta_info       IS '扩展元数据 (渠道回执/分享缩略图)';;
COMMENT ON COLUMN public.t_share_record.f_deleted         IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_share_record.f_created_at      IS '分享时间 (UTC)';;
-- ============================================================
-- 6.2 AI 语音解读 / Interpretation Voice
-- ============================================================
CREATE TABLE public.t_interpretation_voice (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id         BIGINT  NOT NULL,
    f_report_id       BIGINT  NOT NULL,
    f_report_type_id  INTEGER NOT NULL,
    f_lang            VARCHAR(8) NOT NULL,
    f_voice_url       TEXT NOT NULL DEFAULT '',
    f_duration_seconds INTEGER NOT NULL DEFAULT 0,
    f_meta_info       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_deleted         INT2    NOT NULL DEFAULT 0,
    f_created_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_voice_user FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id)   ON DELETE NO ACTION,
    CONSTRAINT fk_t_voice_lang FOREIGN KEY (f_lang)    REFERENCES public.t_lang(f_code)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_voice_dur  CHECK (f_duration_seconds >= 0),
    CONSTRAINT ck_t_voice_del  CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_interpretation_voice IS 'AI 报告语音解读 (TTS 生成的语音文件)';;
COMMENT ON COLUMN public.t_interpretation_voice.f_id              IS '主键';;
COMMENT ON COLUMN public.t_interpretation_voice.f_user_id         IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 发起生成的用户';;
COMMENT ON COLUMN public.t_interpretation_voice.f_report_id       IS '弱引用: 报告 ID | 实际表由 f_report_type 决定 | defined in 04_ai_reports.sql';;
COMMENT ON COLUMN public.t_interpretation_voice.f_report_type_id  IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 报告类型';;
COMMENT ON COLUMN public.t_interpretation_voice.f_lang            IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 朗读语言';;
COMMENT ON COLUMN public.t_interpretation_voice.f_voice_url       IS '语音文件 URL (CDN)';;
COMMENT ON COLUMN public.t_interpretation_voice.f_duration_seconds IS '语音时长 (秒, >= 0)';;
COMMENT ON COLUMN public.t_interpretation_voice.f_meta_info       IS '扩展元数据 (音色/语速/...)';;
COMMENT ON COLUMN public.t_interpretation_voice.f_deleted         IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_interpretation_voice.f_created_at      IS '生成时间 (UTC)';;
-- ============================================================
-- PetChat (更懂它) / 7. 运营内容 / CMS
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   Banner / 活动 / 落地页 (运营位内容)
--
-- 依赖:
--   01_enums.sql       (t_activity_type, t_banner_type, t_status, t_lang)
--
-- 被本文件引用的脚本 (下游):
--   13_welfare.sql     -> t_donation.f_target_type='activity' (弱引用)
--
-- 设计原则 (CMS Principles):
--   1. 内容按语言隔离 (f_lang), 切换语言显示对应内容
--   2. 时间窗口: f_starts_at / f_ends_at 控制曝光时段
--   3. f_link_type_id FK -> t_banner_type 决定跳转目标 (product/activity/subscription/external/page/none)
--   4. 落地页是活动的强子表 (ON DELETE CASCADE)
--   5. 软删除统一用 f_deleted INT2 NOT NULL DEFAULT 0
-- ============================================================


-- ============================================================
-- 7.1 Banner
-- ============================================================
CREATE TABLE public.t_banner (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_lang          VARCHAR(8)    NOT NULL,
    f_title         VARCHAR(128)  NOT NULL,
    f_description   TEXT          NOT NULL DEFAULT '',
    f_image_url     TEXT          NOT NULL DEFAULT '',
    f_link_type_id  INTEGER       NOT NULL DEFAULT -1,
    f_link_url      TEXT          NOT NULL DEFAULT '',
    f_order         INTEGER       NOT NULL DEFAULT 0,
    f_starts_at     TIMESTAMPTZ,
    f_ends_at       TIMESTAMPTZ,
    f_deleted       INT2          NOT NULL DEFAULT 0,
    f_created_at    BIGINT   NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at    BIGINT   NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_banner_lang FOREIGN KEY (f_lang)         REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_banner_type FOREIGN KEY (f_link_type_id) REFERENCES public.t_banner_type(f_id)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_banner_del  CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_banner IS '首页 Banner 轮播';;
COMMENT ON COLUMN public.t_banner.f_id           IS '主键';;
COMMENT ON COLUMN public.t_banner.f_lang         IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';;
COMMENT ON COLUMN public.t_banner.f_title        IS 'Banner 标题';;
COMMENT ON COLUMN public.t_banner.f_description  IS 'Banner 描述';;
COMMENT ON COLUMN public.t_banner.f_image_url    IS 'Banner 图片 URL';;
COMMENT ON COLUMN public.t_banner.f_link_type_id IS 'FK -> public.t_banner_type(f_id) | defined in 01_enums.sql | 跳转目标类型 (product/activity/subscription/external/page/none)';;
COMMENT ON COLUMN public.t_banner.f_link_url     IS '跳转 URL 或内部路径 (具体语义由 f_link_type_id 决定)';;
COMMENT ON COLUMN public.t_banner.f_order        IS '排序权重 (小→前)';;
COMMENT ON COLUMN public.t_banner.f_starts_at    IS '曝光开始时间 (可空 = 立即生效)';;
COMMENT ON COLUMN public.t_banner.f_ends_at      IS '曝光结束时间 (可空 = 长期)';;
COMMENT ON COLUMN public.t_banner.f_deleted      IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_banner.f_created_at   IS '创建时间 (UTC)';;
-- ============================================================
-- 7.2 活动 / Activity
-- ============================================================
CREATE TABLE public.t_activity (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid       UUID        NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_lang             VARCHAR(8)  NOT NULL,
    f_title            VARCHAR(128) NOT NULL,
    f_description      TEXT         NOT NULL DEFAULT '',
    f_cover_image_url  TEXT NOT NULL DEFAULT '',
    f_activity_type_id INTEGER      NOT NULL,
    f_start_time       TIMESTAMPTZ  NOT NULL,
    f_end_time         TIMESTAMPTZ  NOT NULL,
    f_location         VARCHAR(256) NOT NULL DEFAULT '',
    f_max_participants INTEGER,
    f_meta_info        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_deleted          INT2         NOT NULL DEFAULT 0,
    f_created_at       BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at       BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_activity_lang FOREIGN KEY (f_lang)             REFERENCES public.t_lang(f_code)        ON DELETE NO ACTION,
    CONSTRAINT fk_t_activity_type FOREIGN KEY (f_activity_type_id) REFERENCES public.t_activity_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_activity_time CHECK (f_end_time > f_start_time),
    CONSTRAINT ck_t_activity_max  CHECK (f_max_participants IS NULL OR f_max_participants > 0),
    CONSTRAINT ck_t_activity_del  CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_activity_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_activity IS '运营活动 (送养/讲座/志愿者/...)';;
COMMENT ON COLUMN public.t_activity.f_id               IS '主键 | 引用方: t_landing_page.f_activity_id (本文件, CASCADE) | 弱引用: t_donation.f_target_id (in 13_welfare.sql, f_target_type=activity)';;
COMMENT ON COLUMN public.t_activity.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_activity.f_lang             IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';;
COMMENT ON COLUMN public.t_activity.f_title            IS '活动标题';;
COMMENT ON COLUMN public.t_activity.f_description      IS '活动描述';;
COMMENT ON COLUMN public.t_activity.f_cover_image_url  IS '封面图 URL';;
COMMENT ON COLUMN public.t_activity.f_activity_type_id IS 'FK -> public.t_activity_type(f_id) | defined in 01_enums.sql | 活动类型';;
COMMENT ON COLUMN public.t_activity.f_start_time       IS '活动开始时间 (UTC) | 约束: < f_end_time';;
COMMENT ON COLUMN public.t_activity.f_end_time         IS '活动结束时间 (UTC)';;
COMMENT ON COLUMN public.t_activity.f_location         IS '活动地点 (线下) 或直播间 (线上)';;
COMMENT ON COLUMN public.t_activity.f_max_participants IS '最大参与人数 (NULL = 不限)';;
COMMENT ON COLUMN public.t_activity.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_activity.f_deleted          IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_activity.f_created_at       IS '创建时间 (UTC)';;
-- ============================================================
-- 7.3 落地页 / Landing Page
-- ============================================================
CREATE TABLE public.t_landing_page (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid      UUID          NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_activity_id     BIGINT        NOT NULL,
    f_lang            VARCHAR(8)    NOT NULL,
    f_title           VARCHAR(128)  NOT NULL,
    f_subtitle        VARCHAR(256)  NOT NULL DEFAULT '',
    f_cover_image_url TEXT NOT NULL DEFAULT '',
    f_cta_text        VARCHAR(64)   NOT NULL DEFAULT '',
    f_cta_url         TEXT NOT NULL DEFAULT '',
    f_deleted         INT2 NOT NULL DEFAULT 0,
    f_created_at      BIGINT   NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at      BIGINT   NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_landing_activity FOREIGN KEY (f_activity_id) REFERENCES public.t_activity(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_landing_lang     FOREIGN KEY (f_lang)        REFERENCES public.t_lang(f_code)   ON DELETE NO ACTION,
    CONSTRAINT ck_t_landing_del      CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_landing_page_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_landing_page IS '活动落地页 (活动的强子表, 活动删除时级联删除)';;
COMMENT ON COLUMN public.t_landing_page.f_id              IS '主键';;
COMMENT ON COLUMN public.t_landing_page.f_public_uid      IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_landing_page.f_activity_id     IS 'FK -> public.t_activity(f_id) | defined in 07_cms.sql | ON DELETE CASCADE';;
COMMENT ON COLUMN public.t_landing_page.f_lang            IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';;
COMMENT ON COLUMN public.t_landing_page.f_title           IS '落地页主标题';;
COMMENT ON COLUMN public.t_landing_page.f_subtitle        IS '落地页副标题';;
COMMENT ON COLUMN public.t_landing_page.f_cover_image_url IS '落地页封面图 URL';;
COMMENT ON COLUMN public.t_landing_page.f_cta_text        IS 'CTA 按钮文字, e.g. 立即报名';;
COMMENT ON COLUMN public.t_landing_page.f_cta_url         IS 'CTA 按钮跳转 URL';;
COMMENT ON COLUMN public.t_landing_page.f_deleted         IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_landing_page.f_created_at      IS '创建时间 (UTC)';;`,
  6: `-- ============================================================
-- PetChat (更懂它) / 8. 订阅与配额 / Subscription & Quota
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   功能配额定义 / 套餐计划 / 用户订阅 / 用户配额 / 使用记录
--
-- 依赖:
--   01_enums.sql       (t_plan_type, t_payment_status, t_status, t_subscription_type, t_usage_type)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本 (下游):
--   09_ecommerce.sql   -> (订单/订阅可关联, 但解耦)
--
-- 设计原则 (Subscription Principles):
--   1. 功能配额/套餐用 f_id 主键关联, (f_ver, f_code) 做唯一版本化, 永不删改老版本
--   2. 套餐包含功能: 通过 f_plan_id / f_feature_id 关联
--   3. 用户订阅: f_plan_id 指向版本化套餐
--   4. 用户配额按 (user, feature, period_start) 唯一, f_period_start=f_period_end 闭区间
--   5. -1 表示无限配额
-- ============================================================


-- ============================================================
-- 8.1 功能配额定义 / Feature Quota  (f_id 主键, (f_ver, f_code) 唯一, JSONB i18n)
-- ============================================================
CREATE TABLE public.t_feature_quota (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY,
    f_ver           INTEGER NOT NULL DEFAULT 100,
    f_code          VARCHAR(64) NOT NULL,
    f_name          JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_description   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_quota_limit   INTEGER NOT NULL,
    f_quota_period  INTEGER NOT NULL,
    f_quota_unit    INTEGER NOT NULL DEFAULT 1,
    f_is_countable  BOOLEAN NOT NULL DEFAULT true,
    f_is_renewable  BOOLEAN NOT NULL DEFAULT true,
    f_order         INTEGER NOT NULL DEFAULT 0,
    f_deleted       INT2         NOT NULL DEFAULT 0,
    f_created_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    PRIMARY KEY (f_id),
    CONSTRAINT uk_t_fq_ver_code UNIQUE (f_ver, f_code),
    CONSTRAINT ck_t_fq_name   CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_fq_desc   CHECK (jsonb_typeof(f_description) = 'object'),
    CONSTRAINT ck_t_fq_limit  CHECK (f_quota_limit >= -1),
    CONSTRAINT ck_t_fq_period CHECK (f_quota_period > 0),
    CONSTRAINT ck_t_fq_unit   CHECK (f_quota_unit > 0),
    CONSTRAINT ck_t_fq_del    CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_feature_quota IS '功能配额定义, (f_ver, f_code) 唯一;;
永不删改, 新版本+1';;
COMMENT ON COLUMN public.t_feature_quota.f_id           IS '主键 | 引用方: t_plan_feature.f_feature_id, t_user_quota.f_feature_id (in 08_subscription.sql)';;
COMMENT ON COLUMN public.t_feature_quota.f_ver          IS '逻辑版本号;;
同 f_code 内单调递增 | 应用层取最新 ver 作为活跃版本 | DEFAULT 100';;
COMMENT ON COLUMN public.t_feature_quota.f_code         IS '功能业务代码, e.g. emotion_report / health_report / chat / voice / export';;
COMMENT ON COLUMN public.t_feature_quota.f_name         IS '多语言功能名';;
COMMENT ON COLUMN public.t_feature_quota.f_description  IS '多语言功能描述';;
COMMENT ON COLUMN public.t_feature_quota.f_quota_limit  IS '默认配额上限: -1 表示无限, >=0 表示数值 | 套餐可通过 t_plan_feature.f_quota_override 覆盖';;
COMMENT ON COLUMN public.t_feature_quota.f_quota_period IS '配额周期 (天, > 0)';;
COMMENT ON COLUMN public.t_feature_quota.f_quota_unit   IS '单次使用消耗的单位数 (默认 1)';;
COMMENT ON COLUMN public.t_feature_quota.f_is_countable IS '是否计入配额 (false = 仅启用开关, 不消耗配额)';;
COMMENT ON COLUMN public.t_feature_quota.f_is_renewable IS '是否按周期重置';;
COMMENT ON COLUMN public.t_feature_quota.f_order        IS '排序权重';;
COMMENT ON COLUMN public.t_feature_quota.f_deleted      IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_feature_quota.f_created_at   IS '创建时间 (UTC)';;
-- ============================================================
-- 8.2 套餐计划 / Plan
-- ============================================================
CREATE TABLE public.t_plan (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY,
    f_public_uid    UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_ver           INTEGER NOT NULL,
    f_code          VARCHAR(64) NOT NULL,
    f_plan_type_id  INTEGER NOT NULL,
    f_name          JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_description   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_currency      VARCHAR(8) NOT NULL DEFAULT 'CNY',
    f_duration_days INTEGER NOT NULL,
    f_is_trial      BOOLEAN NOT NULL DEFAULT false,
    f_trial_days    INTEGER NOT NULL DEFAULT 0,
    f_order         INTEGER NOT NULL DEFAULT 0,
    f_created_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    PRIMARY KEY (f_id),
    CONSTRAINT uk_t_plan_ver_code UNIQUE (f_ver, f_code),
    CONSTRAINT fk_t_plan_type  FOREIGN KEY (f_plan_type_id) REFERENCES public.t_plan_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_plan_name  CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_plan_desc  CHECK (jsonb_typeof(f_description) = 'object'),
    CONSTRAINT ck_t_plan_price CHECK (f_price >= 0),
    CONSTRAINT ck_t_plan_dur   CHECK (f_duration_days > 0),
    CONSTRAINT ck_t_plan_trial CHECK (f_trial_days >= 0 AND (NOT f_is_trial OR f_trial_days > 0)),
    CONSTRAINT uk_t_plan_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_plan IS '套餐计划, (f_ver, f_code) 唯一;;
永不删改, 新版本+1';;
COMMENT ON COLUMN public.t_plan.f_id           IS '主键 | 引用方: t_plan_feature.f_plan_id, t_user_subscription.f_plan_id, t_user_quota.f_plan_id (in 08_subscription.sql)';;
COMMENT ON COLUMN public.t_plan.f_public_uid   IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_plan.f_ver          IS '逻辑版本号;;
同 f_code 内单调递增';;
COMMENT ON COLUMN public.t_plan.f_code         IS '套餐业务代码, e.g. free / basic / pro / family';;
COMMENT ON COLUMN public.t_plan.f_plan_type_id IS 'FK -> public.t_plan_type(f_id) | defined in 01_enums.sql | 免费/基础/专业/家庭/...';;
COMMENT ON COLUMN public.t_plan.f_name         IS '多语言套餐名';;
COMMENT ON COLUMN public.t_plan.f_description  IS '多语言套餐描述';;
COMMENT ON COLUMN public.t_plan.f_price        IS '套餐价格 (>= 0)';;
COMMENT ON COLUMN public.t_plan.f_currency     IS '货币, 默认 CNY';;
COMMENT ON COLUMN public.t_plan.f_duration_days IS '套餐有效期 (天, > 0)';;
COMMENT ON COLUMN public.t_plan.f_is_trial     IS '是否为试用套餐';;
COMMENT ON COLUMN public.t_plan.f_trial_days   IS '试用天数 (f_is_trial=true 时必须 > 0)';;
COMMENT ON COLUMN public.t_plan.f_order        IS '排序权重';;
COMMENT ON COLUMN public.t_plan.f_created_at   IS '创建时间 (UTC)';;
-- ============================================================
-- 8.3 套餐包含的功能 / Plan Feature
-- ============================================================
CREATE TABLE public.t_plan_feature (
    f_plan_id        BIGINT NOT NULL,
    f_feature_id     BIGINT NOT NULL,
    f_quota_override INTEGER,
    f_order          INTEGER NOT NULL DEFAULT 0,
    f_deleted        INT2    NOT NULL DEFAULT 0,
    f_created_at     BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at     BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    PRIMARY KEY (f_plan_id, f_feature_id),
    CONSTRAINT fk_t_pf_plan    FOREIGN KEY (f_plan_id)
        REFERENCES public.t_plan(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_pf_feature FOREIGN KEY (f_feature_id)
        REFERENCES public.t_feature_quota(f_id) ON DELETE CASCADE,
    CONSTRAINT ck_t_pf_qty     CHECK (f_quota_override IS NULL OR f_quota_override >= -1),
    CONSTRAINT ck_t_pf_del     CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_plan_feature IS '套餐包含的功能, PK (f_plan_id, f_feature_id)';;
COMMENT ON COLUMN public.t_plan_feature.f_plan_id        IS 'FK -> public.t_plan(f_id) | defined in 08_subscription.sql';;
COMMENT ON COLUMN public.t_plan_feature.f_feature_id     IS 'FK -> public.t_feature_quota(f_id) | defined in 08_subscription.sql';;
COMMENT ON COLUMN public.t_plan_feature.f_quota_override IS '覆盖默认配额: -1 无限, NULL 不覆盖, >=0 数值 | 引用: t_feature_quota.f_quota_limit (本文件)';;
COMMENT ON COLUMN public.t_plan_feature.f_order          IS '排序权重';;
COMMENT ON COLUMN public.t_plan_feature.f_deleted        IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_plan_feature.f_created_at     IS '创建时间 (UTC)';;
-- ============================================================
-- 8.4 用户订阅实例 / User Subscription
-- ============================================================
CREATE TABLE public.t_user_subscription (
    f_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid          UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id             BIGINT NOT NULL,
    f_plan_id             BIGINT NOT NULL,
    f_subscription_type_id INTEGER NOT NULL DEFAULT -1,
    f_start_at            TIMESTAMPTZ NOT NULL,
    f_expire_at           TIMESTAMPTZ NOT NULL,
    f_status_payment      INTEGER NOT NULL DEFAULT -1,
    f_meta_info           JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at          BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at          BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_us_user  FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_us_plan  FOREIGN KEY (f_plan_id)
        REFERENCES public.t_plan(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_us_sub_type FOREIGN KEY (f_subscription_type_id) REFERENCES public.t_subscription_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_us_pay   FOREIGN KEY (f_status_payment) REFERENCES public.t_payment_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_us_dates CHECK (f_expire_at > f_start_at),
    CONSTRAINT uk_t_user_subscription_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_user_subscription IS '用户订阅实例 (一对多: 一个用户可有多段历史订阅)';;
COMMENT ON COLUMN public.t_user_subscription.f_id                   IS '主键';;
COMMENT ON COLUMN public.t_user_subscription.f_public_uid           IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_user_subscription.f_user_id             IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_user_subscription.f_plan_id             IS 'FK -> public.t_plan(f_id) | defined in 08_subscription.sql';;
COMMENT ON COLUMN public.t_user_subscription.f_subscription_type_id IS 'FK -> public.t_subscription_type(f_id) | defined in 01_enums.sql | 订阅来源';;
COMMENT ON COLUMN public.t_user_subscription.f_start_at          IS '生效时间 (UTC)';;
COMMENT ON COLUMN public.t_user_subscription.f_expire_at         IS '过期时间 (UTC) | 约束: > f_start_at';;
COMMENT ON COLUMN public.t_user_subscription.f_status_payment    IS 'FK -> public.t_payment_status(f_id) | defined in 01_enums.sql | 支付状态';;
COMMENT ON COLUMN public.t_user_subscription.f_meta_info         IS '扩展元数据';;
COMMENT ON COLUMN public.t_user_subscription.f_created_at        IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_user_subscription.f_updated_at        IS '更新时间 (UTC)';;
-- 注: idx_t_us_user / idx_t_us_expire / idx_t_us_user_active 已统一移至 99_indexes_views.sql


-- ============================================================
-- 8.5 用户配额实例 (按周期发) / User Quota
-- ============================================================
CREATE TABLE public.t_user_quota (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id       BIGINT NOT NULL,
    f_plan_id       BIGINT NOT NULL,
    f_feature_id    BIGINT NOT NULL,
    f_period_start  TIMESTAMPTZ NOT NULL,
    f_period_end    TIMESTAMPTZ NOT NULL,
    f_total_quota   INTEGER NOT NULL,
    f_used_quota    INTEGER NOT NULL DEFAULT 0,
    f_meta_info     JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_deleted       INT2  NOT NULL DEFAULT 0,
    f_created_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_uq_user  FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_uq_plan  FOREIGN KEY (f_plan_id)
        REFERENCES public.t_plan(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_uq_feat  FOREIGN KEY (f_feature_id)
        REFERENCES public.t_feature_quota(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_uq_unique UNIQUE (f_user_id, f_feature_id, f_period_start),
    CONSTRAINT ck_t_uq_del   CHECK (f_deleted IN (0, 1)),
    CONSTRAINT ck_t_uq_total CHECK (f_total_quota >= -1),
    CONSTRAINT ck_t_uq_used  CHECK (f_used_quota >= 0),
    CONSTRAINT ck_t_uq_dates CHECK (f_period_end > f_period_start),
    CONSTRAINT ck_t_uq_used_lt_total CHECK (f_total_quota = -1 OR f_used_quota <= f_total_quota)
);;
COMMENT ON TABLE  public.t_user_quota IS '用户配额实例, (user, feature, period_start) 唯一;;
周期内闭区间';;
COMMENT ON COLUMN public.t_user_quota.f_id           IS '主键 | 引用方: t_usage_record.f_quota_id (本文件, SET NULL)';;
COMMENT ON COLUMN public.t_user_quota.f_user_id      IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_user_quota.f_plan_id      IS 'FK -> public.t_plan(f_id) | defined in 08_subscription.sql';;
COMMENT ON COLUMN public.t_user_quota.f_feature_id   IS 'FK -> public.t_feature_quota(f_id) | defined in 08_subscription.sql';;
COMMENT ON COLUMN public.t_user_quota.f_period_start IS '周期开始 (UTC) | 唯一约束 uk_t_uq_unique 的一部分';;
COMMENT ON COLUMN public.t_user_quota.f_period_end   IS '周期结束 (UTC) | 约束: > f_period_start';;
COMMENT ON COLUMN public.t_user_quota.f_total_quota  IS '周期内总配额: -1 无限, >=0 数值';;
COMMENT ON COLUMN public.t_user_quota.f_used_quota   IS '已使用量 | 约束: <= f_total_quota (无限除外)';;
COMMENT ON COLUMN public.t_user_quota.f_meta_info    IS '扩展元数据';;
COMMENT ON COLUMN public.t_user_quota.f_deleted      IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_user_quota.f_created_at   IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_user_quota.f_updated_at   IS '更新时间 (UTC)';;`,
  7: `-- 注: idx_t_uq_user_feature 已统一移至 99_indexes_views.sql


-- ============================================================
-- 8.6 使用记录 / Usage Record
-- ============================================================
CREATE TABLE public.t_usage_record (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id           BIGINT NOT NULL,
    f_feature_id        BIGINT NOT NULL,
    f_quota_id          BIGINT,
    f_usage_type_id     INTEGER NOT NULL DEFAULT -1,
    f_usage_count       INTEGER NOT NULL DEFAULT 1,
    f_related_report_id BIGINT,
    f_meta_info         JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at        BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_ur_user  FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ur_feat  FOREIGN KEY (f_feature_id)
        REFERENCES public.t_feature_quota(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ur_quota FOREIGN KEY (f_quota_id)      REFERENCES public.t_user_quota(f_id)  ON DELETE SET NULL,
    CONSTRAINT fk_t_ur_type  FOREIGN KEY (f_usage_type_id) REFERENCES public.t_usage_type(f_id)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_ur_count CHECK (f_usage_count > 0)
);;
COMMENT ON TABLE  public.t_usage_record IS '功能使用记录 (append-only, 用于扣减配额和审计)';;
COMMENT ON COLUMN public.t_usage_record.f_id                IS '主键';;
COMMENT ON COLUMN public.t_usage_record.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_usage_record.f_feature_id        IS 'FK -> public.t_feature_quota(f_id) | defined in 08_subscription.sql';;
COMMENT ON COLUMN public.t_usage_record.f_quota_id          IS 'FK -> public.t_user_quota(f_id) | defined in 08_subscription.sql | ON DELETE SET NULL';;
COMMENT ON COLUMN public.t_usage_record.f_usage_type_id     IS 'FK -> public.t_usage_type(f_id) | defined in 01_enums.sql | 使用类型: report/chat/analysis/voice/export/api/share/other';;
COMMENT ON COLUMN public.t_usage_record.f_usage_count       IS '使用量 (默认 1, > 0) | 应用层需配套更新 f_user_quota.f_used_quota';;
COMMENT ON COLUMN public.t_usage_record.f_related_report_id IS '弱引用: 报告 ID (如本次使用生成了报告) | 实际表: t_report_emotion/health/hpr/pers (in 04_ai_reports.sql)';;
COMMENT ON COLUMN public.t_usage_record.f_meta_info         IS '扩展元数据';;
COMMENT ON COLUMN public.t_usage_record.f_created_at        IS '使用时间 (UTC)';;
-- 注: idx_t_usage_record_user_time / idx_t_usage_record_feature 已统一移至 99_indexes_views.sql

-- ============================================================
-- PetChat (更懂它) / 9. 电商与库存 / E-commerce & Inventory
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   商品域 (分类 / SPU / SKU / 库存)
--   交易域 (购物车 / 订单 / 物流)
--
-- 依赖:
--   01_enums.sql       (t_inventory_status, t_inventory_serial_status, t_payment_status,
--                       t_shipping_status, t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本: 无
--
-- 设计原则 (E-commerce Principles):
--   1. 商品分类用树结构, 根节点 f_id = -1 (哨兵), 顶级分类 f_parent_id = -1
--   2. SPU = Standard Product Unit (产品级), SKU = Stock Keeping Unit (售卖级, 唯一)
--   3. SPU i18n 用 JSONB 字段 (f_name / f_description) 内联存储, 遵循 jsonb-i18n-pattern.md
--      格式: {"zh-CN": "...", "en-US": "...", "ja-JP": "..."};;
pgroonga 索引覆盖全语言搜索
--   4. 库存按 (sku, lot, warehouse) 唯一, 用预留数量 f_reserved_quantity 配合订单
--   5. 订单/订单项是强生命周期父子 (CASCADE), 商品删除不影响历史订单 (NO ACTION)
--   6. 物流: 订单和发货是 1:1~N, 独立 t_shipment 表
--   7. CHECK: f_final_amount = f_total_amount - f_discount_amount (数据库层守恒)
-- ============================================================


-- ============================================================
-- 9.A.1 产品分类 (树, JSONB i18n) / Product Category
-- ============================================================
CREATE TABLE public.t_product_category (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid  UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_parent_id   BIGINT  NOT NULL DEFAULT -1,
    f_level       INTEGER NOT NULL DEFAULT 0,
    f_code        VARCHAR(64) NOT NULL DEFAULT '',
    f_name        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_description JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_icon_url    TEXT NOT NULL DEFAULT '',
    f_order       INTEGER NOT NULL DEFAULT 0,
    f_deleted     INT2 NOT NULL DEFAULT 0,
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at  BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at  BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_pc_parent FOREIGN KEY (f_parent_id)
        REFERENCES public.t_product_category(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_pc_code UNIQUE (f_code),
    CONSTRAINT ck_t_pc_level  CHECK (f_level >= 0),
    CONSTRAINT ck_t_pc_name   CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_pc_desc   CHECK (jsonb_typeof(f_description) = 'object'),
    CONSTRAINT ck_t_pc_del    CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_product_category_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_product_category IS '产品分类树, 根节点 f_id=-1 (哨兵)';;
COMMENT ON COLUMN public.t_product_category.f_id          IS '主键;;
哨兵: -1 = 根 (内置初始化, 不允许业务写入)';;
COMMENT ON COLUMN public.t_product_category.f_public_uid  IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_product_category.f_parent_id   IS '父分类;;
顶级为 -1 | FK 自引用 (本表) | defined in 09_ecommerce.sql';;
COMMENT ON COLUMN public.t_product_category.f_level       IS '层级深度 (0=根, 1=一级, ...)';;
COMMENT ON COLUMN public.t_product_category.f_code        IS '业务代码, e.g. food / toy / medical | UNIQUE';;
COMMENT ON COLUMN public.t_product_category.f_name        IS '多语言分类名 | 引用方: t_product_spu.f_category_id (反查分类)';;
COMMENT ON COLUMN public.t_product_category.f_description IS '多语言分类描述';;
COMMENT ON COLUMN public.t_product_category.f_icon_url    IS '分类图标 URL';;
COMMENT ON COLUMN public.t_product_category.f_order       IS '排序权重';;
COMMENT ON COLUMN public.t_product_category.f_deleted     IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_product_category.f_meta_info   IS '扩展元数据';;
COMMENT ON COLUMN public.t_product_category.f_created_at  IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_product_category.f_updated_at  IS '更新时间 (UTC)';;
-- 注: idx_t_product_category_parent / idx_t_product_category_active 已统一移至 99_indexes_views.sql


-- ============================================================
-- 9.A.2 产品 SPU (主商品) / Product SPU
-- ============================================================
CREATE TABLE public.t_product_spu (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid       UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_category_id      BIGINT  NOT NULL,
    f_brand            VARCHAR(64) NOT NULL DEFAULT '',
    f_name             JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_description      JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_status_inventory INTEGER NOT NULL DEFAULT -1,
    f_deleted          INT2    NOT NULL DEFAULT 0,
    f_meta_info        JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_created_at       BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at       BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_spu_category  FOREIGN KEY (f_category_id)
        REFERENCES public.t_product_category(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_spu_inv_stat  FOREIGN KEY (f_status_inventory)
        REFERENCES public.t_inventory_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_spu_brand     CHECK (length(f_brand) <= 64),
    CONSTRAINT ck_t_spu_name      CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_spu_desc      CHECK (jsonb_typeof(f_description) = 'object'),
    CONSTRAINT ck_t_spu_del       CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_product_spu_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_product_spu IS 'SPU = Standard Product Unit (产品级, 包含一个或多个 SKU)';;
COMMENT ON COLUMN public.t_product_spu.f_id               IS '主键 | 引用方: t_product_sku.f_spu_id (本文件, NO ACTION)';;
COMMENT ON COLUMN public.t_product_spu.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_product_spu.f_category_id      IS 'FK -> public.t_product_category(f_id) | defined in 09_ecommerce.sql';;
COMMENT ON COLUMN public.t_product_spu.f_brand            IS '品牌名 (<= 64 字符)';;
COMMENT ON COLUMN public.t_product_spu.f_name             IS 'SPU 多语言名称 JSONB | 格式: {"zh-CN":"...", "en-US":"..."} | 搜索: pgroonga idx_t_product_spu_pgroonga';;
COMMENT ON COLUMN public.t_product_spu.f_description      IS 'SPU 多语言描述 JSONB | 格式: {"zh-CN":"...", "en-US":"..."}';;
COMMENT ON COLUMN public.t_product_spu.f_status_inventory IS 'FK -> public.t_inventory_status(f_id) | defined in 01_enums.sql | 汇总库存状态';;
COMMENT ON COLUMN public.t_product_spu.f_deleted          IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_product_spu.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_product_spu.f_created_at       IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_product_spu.f_updated_at       IS '更新时间 (UTC)';;
-- ============================================================
-- 9.A.4 产品 SKU / Product SKU
-- ============================================================
CREATE TABLE public.t_product_sku (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid       UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_spu_id           BIGINT NOT NULL,
    f_sku_code         VARCHAR(64) NOT NULL,
    f_price            NUMERIC(12,2) NOT NULL,
    f_currency         VARCHAR(8) NOT NULL DEFAULT 'CNY',
    f_cost_price       NUMERIC(12,2),
    f_weight           NUMERIC(8,2),
    f_status_inventory INTEGER NOT NULL DEFAULT -1,
    f_meta_info        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at       BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at       BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_sku_spu    FOREIGN KEY (f_spu_id) REFERENCES public.t_product_spu(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_sku_inv    FOREIGN KEY (f_status_inventory) REFERENCES public.t_inventory_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_sku_code   UNIQUE (f_sku_code),
    CONSTRAINT ck_t_sku_price  CHECK (f_price >= 0),
    CONSTRAINT ck_t_sku_cost   CHECK (f_cost_price IS NULL OR f_cost_price >= 0),
    CONSTRAINT uk_t_product_sku_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_product_sku IS 'SKU = Stock Keeping Unit (售卖级, 唯一编码)';;
COMMENT ON COLUMN public.t_product_sku.f_id               IS '主键 | 引用方: t_inventory_balance.f_sku_id, t_inventory_movement.f_sku_id, t_inventory_serial.f_sku_id, t_cart.f_sku_id, t_order_item.f_sku_id (本文件)';;
COMMENT ON COLUMN public.t_product_sku.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_product_sku.f_spu_id           IS 'FK -> public.t_product_spu(f_id) | defined in 09_ecommerce.sql';;
COMMENT ON COLUMN public.t_product_sku.f_sku_code         IS 'SKU 业务编码, e.g. SKU-20260617-001 | UNIQUE';;
COMMENT ON COLUMN public.t_product_sku.f_price            IS '售价 (>= 0)';;
COMMENT ON COLUMN public.t_product_sku.f_currency         IS '货币, 默认 CNY';;
COMMENT ON COLUMN public.t_product_sku.f_cost_price       IS '成本价 (可空)';;
COMMENT ON COLUMN public.t_product_sku.f_weight           IS '重量 (kg, 用于运费计算)';;
COMMENT ON COLUMN public.t_product_sku.f_status_inventory IS 'FK -> public.t_inventory_status(f_id) | defined in 01_enums.sql | 库存状态';;
COMMENT ON COLUMN public.t_product_sku.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_product_sku.f_created_at       IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_product_sku.f_updated_at       IS '更新时间 (UTC)';;
-- ============================================================
-- 9.A.5 库存批次 / Inventory Lot
-- ============================================================
CREATE TABLE public.t_inventory_lot (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid      UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_lot_code        VARCHAR(64) NOT NULL,
    f_supplier        VARCHAR(128) NOT NULL DEFAULT '',
    f_production_date DATE,
    f_expiry_date     DATE,
    f_cost_price      NUMERIC(12,2),
    f_meta_info       JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_deleted         INT2  NOT NULL DEFAULT 0,
    f_created_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT uk_t_lot_code UNIQUE (f_lot_code),
    CONSTRAINT ck_t_lot_dates CHECK (f_expiry_date IS NULL OR f_production_date IS NULL OR f_expiry_date >= f_production_date),
    CONSTRAINT ck_t_lot_del   CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_inventory_lot IS '库存批次 (同一供应商/生产日期的入库批次)';;
COMMENT ON COLUMN public.t_inventory_lot.f_id              IS '主键 | 引用方: t_inventory_balance.f_lot_id, t_inventory_movement.f_lot_id, t_inventory_serial.f_lot_id (本文件)';;
COMMENT ON COLUMN public.t_inventory_lot.f_lot_code        IS '批次编码 | UNIQUE';;
COMMENT ON COLUMN public.t_inventory_lot.f_supplier        IS '供应商';;
COMMENT ON COLUMN public.t_inventory_lot.f_production_date IS '生产日期';;
COMMENT ON COLUMN public.t_inventory_lot.f_expiry_date     IS '过期日期 | 约束: >= f_production_date';;
COMMENT ON COLUMN public.t_inventory_lot.f_cost_price      IS '批次成本价';;
COMMENT ON COLUMN public.t_inventory_lot.f_meta_info       IS '扩展元数据';;
COMMENT ON COLUMN public.t_inventory_lot.f_deleted         IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_inventory_lot.f_created_at      IS '入库时间 (UTC)';;`,
  8: `-- ============================================================
-- 9.A.6 库存余额 (按 SKU + 仓库 + 批次 唯一) / Inventory Balance
-- ============================================================
CREATE TABLE public.t_inventory_balance (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_sku_id            BIGINT NOT NULL DEFAULT -1,
    f_lot_id            BIGINT NOT NULL DEFAULT -1,
    f_warehouse_id      BIGINT NOT NULL DEFAULT -1,
    f_quantity          INTEGER NOT NULL DEFAULT 0,
    f_reserved_quantity INTEGER NOT NULL DEFAULT 0,
    f_status_inventory  INTEGER NOT NULL DEFAULT -1,
    f_created_at        BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at        BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_ib_sku FOREIGN KEY (f_sku_id)
        REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ib_lot FOREIGN KEY (f_lot_id)
        REFERENCES public.t_inventory_lot(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ib_inv FOREIGN KEY (f_status_inventory)
        REFERENCES public.t_inventory_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_ib_sku_lot_wh UNIQUE (f_sku_id, f_lot_id, f_warehouse_id),
    CONSTRAINT ck_t_ib_qty CHECK (f_quantity >= 0),
    CONSTRAINT ck_t_ib_rsv CHECK (f_reserved_quantity >= 0 AND f_reserved_quantity <= f_quantity)
);;
COMMENT ON TABLE  public.t_inventory_balance IS '库存余额, (sku, lot, warehouse) 唯一';;
COMMENT ON COLUMN public.t_inventory_balance.f_id                IS '主键';;
COMMENT ON COLUMN public.t_inventory_balance.f_sku_id            IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql';;
COMMENT ON COLUMN public.t_inventory_balance.f_lot_id            IS 'FK -> public.t_inventory_lot(f_id) | defined in 09_ecommerce.sql | 可空 (无批次)';;
COMMENT ON COLUMN public.t_inventory_balance.f_warehouse_id      IS '仓库 ID (1=主仓, 后续扩展)';;
COMMENT ON COLUMN public.t_inventory_balance.f_quantity          IS '当前库存数量 (>= 0)';;
COMMENT ON COLUMN public.t_inventory_balance.f_reserved_quantity IS '已预留数量 (订单未支付) | 约束: 0 <= reserved <= quantity';;
COMMENT ON COLUMN public.t_inventory_balance.f_status_inventory  IS 'FK -> public.t_inventory_status(f_id) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_inventory_balance.f_updated_at        IS '更新时间 (UTC)';;
-- ============================================================
-- 9.A.7 库存流水 / Inventory Movement
-- ============================================================
CREATE TABLE public.t_inventory_movement (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_sku_id          BIGINT NOT NULL,
    f_lot_id          BIGINT,
    f_public_uid      UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_movement_type   VARCHAR(16) NOT NULL,
    f_quantity        INTEGER NOT NULL,
    f_reference_type  VARCHAR(32) NOT NULL DEFAULT '',
    f_reference_id    BIGINT,
    f_reason          VARCHAR(256) NOT NULL DEFAULT '',
    f_operator_id     BIGINT,
    f_meta_info       JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_im_sku FOREIGN KEY (f_sku_id)
        REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_im_lot FOREIGN KEY (f_lot_id)
        REFERENCES public.t_inventory_lot(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_im_op  FOREIGN KEY (f_operator_id)
        REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    -- t_inventory_movement 为 append-only 流水表, 不设软删字段
    CONSTRAINT ck_t_im_type CHECK (f_movement_type IN ('in','out','adjust','transfer','return'))
);;
COMMENT ON TABLE  public.t_inventory_movement IS '库存流水 (append-only 审计)';;
COMMENT ON COLUMN public.t_inventory_movement.f_id             IS '主键';;
COMMENT ON COLUMN public.t_inventory_movement.f_sku_id         IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql';;
COMMENT ON COLUMN public.t_inventory_movement.f_lot_id         IS 'FK -> public.t_inventory_lot(f_id) | defined in 09_ecommerce.sql | 可空';;
COMMENT ON COLUMN public.t_inventory_movement.f_movement_type  IS '流水类型 (白名单): in=入库 / out=出库 / adjust=调整 / transfer=调拨 / return=退货';;
COMMENT ON COLUMN public.t_inventory_movement.f_quantity       IS '本次变动数量 (正负由 f_movement_type 决定)';;
COMMENT ON COLUMN public.t_inventory_movement.f_reference_type IS '关联业务类型, e.g. order / purchase / return';;
COMMENT ON COLUMN public.t_inventory_movement.f_reference_id   IS '关联业务 ID (弱引用)';;
COMMENT ON COLUMN public.t_inventory_movement.f_reason         IS '变动原因 (文本)';;
COMMENT ON COLUMN public.t_inventory_movement.f_operator_id    IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 操作人';;
COMMENT ON COLUMN public.t_inventory_movement.f_meta_info      IS '扩展元数据';;
COMMENT ON COLUMN public.t_inventory_movement.f_created_at     IS '流水时间 (UTC)';;
-- ============================================================
-- 9.A.8 库存序列号 (单品追踪) / Inventory Serial
-- ============================================================
CREATE TABLE public.t_inventory_serial (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_sku_id        BIGINT NOT NULL,
    f_lot_id        BIGINT,
    f_public_uid      UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_serial_number VARCHAR(128) NOT NULL,
    f_status_serial INTEGER NOT NULL DEFAULT -1,
    f_meta_info     JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_is_sku FOREIGN KEY (f_sku_id) REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_is_lot FOREIGN KEY (f_lot_id) REFERENCES public.t_inventory_lot(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_is_st  FOREIGN KEY (f_status_serial) REFERENCES public.t_inventory_serial_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_is_sn UNIQUE (f_serial_number)
);;
COMMENT ON TABLE  public.t_inventory_serial IS '库存单品序列号 (用于高价值/医疗/电子设备)';;
COMMENT ON COLUMN public.t_inventory_serial.f_id            IS '主键';;
COMMENT ON COLUMN public.t_inventory_serial.f_sku_id        IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql';;
COMMENT ON COLUMN public.t_inventory_serial.f_lot_id        IS 'FK -> public.t_inventory_lot(f_id) | defined in 09_ecommerce.sql | 可空';;
COMMENT ON COLUMN public.t_inventory_serial.f_serial_number IS '单品序列号 | UNIQUE';;
COMMENT ON COLUMN public.t_inventory_serial.f_status_serial IS 'FK -> public.t_inventory_serial_status(f_id) | defined in 01_enums.sql | in_stock / sold / returned / damaged';;
COMMENT ON COLUMN public.t_inventory_serial.f_meta_info     IS '扩展元数据';;
COMMENT ON COLUMN public.t_inventory_serial.f_created_at    IS '入库时间 (UTC)';;
-- ============================================================
-- 9.B.1 购物车 / Cart
-- ============================================================
CREATE TABLE public.t_cart (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id     BIGINT NOT NULL,
    f_sku_id      BIGINT NOT NULL,
    f_quantity    INTEGER NOT NULL DEFAULT 1,
    f_unit_price  NUMERIC(12,2) NOT NULL,
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at  BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at  BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_cart_user FOREIGN KEY (f_user_id)
        REFERENCES public.t_user(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_cart_sku  FOREIGN KEY (f_sku_id)
        REFERENCES public.t_product_sku(f_id) ON DELETE CASCADE,
    CONSTRAINT ck_t_cart_qty  CHECK (f_quantity > 0),
    CONSTRAINT ck_t_cart_price CHECK (f_unit_price >= 0),
    CONSTRAINT uk_t_cart_user_sku UNIQUE (f_user_id, f_sku_id)
);;
COMMENT ON TABLE  public.t_cart IS '购物车 (一个用户对同一 SKU 只有一条记录)';;
COMMENT ON COLUMN public.t_cart.f_id          IS '主键';;
COMMENT ON COLUMN public.t_cart.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | ON DELETE CASCADE (删用户清空车)';;
COMMENT ON COLUMN public.t_cart.f_sku_id      IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql | ON DELETE CASCADE';;
COMMENT ON COLUMN public.t_cart.f_quantity    IS '数量 (> 0) | UNIQUE: (f_user_id, f_sku_id)';;
COMMENT ON COLUMN public.t_cart.f_unit_price  IS '加入购物车时的单价快照 (>= 0) | 下单时按当前实际价格';;
COMMENT ON COLUMN public.t_cart.f_meta_info   IS '扩展元数据';;
-- t_cart 使用 ON DELETE CASCADE 清理 (用户或商品删除时), 无需额外软删字段
COMMENT ON COLUMN public.t_cart.f_created_at  IS '加入时间 (UTC)';;
COMMENT ON COLUMN public.t_cart.f_updated_at  IS '更新时间 (UTC)';;
-- ============================================================
-- 9.B.2 订单 / Order
-- ============================================================
CREATE TABLE public.t_order (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid       UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id          BIGINT NOT NULL,
    f_order_no         VARCHAR(64) NOT NULL,
    f_total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_final_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_currency         VARCHAR(8) NOT NULL DEFAULT 'CNY',
    f_payment_method   VARCHAR(32) NOT NULL DEFAULT '',
    f_status_payment   INTEGER NOT NULL DEFAULT -1,
    f_payment_time     TIMESTAMPTZ,
    f_status_shipping  INTEGER NOT NULL DEFAULT -1,
    f_receiver_name    VARCHAR(64) NOT NULL,
    f_receiver_phone   VARCHAR(32) NOT NULL,
    f_receiver_email   VARCHAR(64) NOT NULL DEFAULT '',
    f_receiver_country VARCHAR(32) NOT NULL DEFAULT '',
    f_receiver_province VARCHAR(32) NOT NULL DEFAULT '',
    f_receiver_city    VARCHAR(32) NOT NULL DEFAULT '',
    f_receiver_address VARCHAR(512) NOT NULL DEFAULT '',    
    f_meta_info        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at       BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at       BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_order_user     FOREIGN KEY (f_user_id)
        REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_order_pay_stat FOREIGN KEY (f_status_payment)
        REFERENCES public.t_payment_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_order_ship_st  FOREIGN KEY (f_status_shipping)
        REFERENCES public.t_shipping_status(f_id) ON DELETE NO ACTION,
    -- t_order 使用 f_status_payment 跟踪生命周期, 无需独立软删字段
    CONSTRAINT uk_t_order_no UNIQUE (f_order_no),
    CONSTRAINT ck_t_order_total  CHECK (f_total_amount >= 0),
    CONSTRAINT ck_t_order_disc   CHECK (f_discount_amount >= 0),
    CONSTRAINT ck_t_order_final  CHECK (f_final_amount >= 0),
    CONSTRAINT ck_t_order_amount CHECK (f_final_amount = f_total_amount - f_discount_amount),
    CONSTRAINT ck_t_order_recv_n CHECK (length(f_receiver_name) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_order_recv_p CHECK (f_receiver_phone ~ '^[0-9+\\-\\s()]{5,32}$'),
    CONSTRAINT ck_t_order_recv_a CHECK (length(f_receiver_address) BETWEEN 1 AND 512),
    CONSTRAINT uk_t_order_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_order IS '订单主表;;
f_status_payment / f_status_shipping 引用对应业务状态枚举';;
COMMENT ON COLUMN public.t_order.f_id               IS '主键 | 引用方: t_order_item.f_order_id, t_shipment.f_order_id (本文件, CASCADE)';;
COMMENT ON COLUMN public.t_order.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_order.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_order.f_order_no         IS '订单号 (对外展示) | UNIQUE';;
COMMENT ON COLUMN public.t_order.f_total_amount     IS '订单总金额 (= SUM(t_order_item.f_total_price), >= 0)';;
COMMENT ON COLUMN public.t_order.f_discount_amount  IS '优惠金额 (>= 0)';;
COMMENT ON COLUMN public.t_order.f_final_amount     IS '应付金额 | 守恒: f_final_amount = f_total_amount - f_discount_amount';;
COMMENT ON COLUMN public.t_order.f_currency         IS '货币, 默认 CNY';;
COMMENT ON COLUMN public.t_order.f_payment_method   IS '支付方式, e.g. wechat / alipay / card';;
COMMENT ON COLUMN public.t_order.f_status_payment   IS 'FK -> public.t_payment_status(f_id) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_order.f_payment_time     IS '支付完成时间 (可空)';;
COMMENT ON COLUMN public.t_order.f_status_shipping  IS 'FK -> public.t_shipping_status(f_id) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_order.f_receiver_name    IS '收货人姓名';;
COMMENT ON COLUMN public.t_order.f_receiver_phone   IS '收货人电话';;
COMMENT ON COLUMN public.t_order.f_receiver_address IS '收货地址';;
COMMENT ON COLUMN public.t_order.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_order.f_created_at       IS '下单时间 (UTC)';;
COMMENT ON COLUMN public.t_order.f_updated_at       IS '更新时间 (UTC)';;
-- 注: idx_t_order_user_created / idx_t_order_pay_status / idx_t_order_ship_status
--     已统一移至 99_indexes_views.sql


-- ============================================================
-- 9.B.3 订单项 (强生命周期子表, ON DELETE CASCADE)
-- ============================================================
CREATE TABLE public.t_order_item (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_order_id    BIGINT NOT NULL,
    f_sku_id      BIGINT NOT NULL,
    f_product_name VARCHAR(256) NOT NULL,
    f_quantity    INTEGER NOT NULL,
    f_unit_price  NUMERIC(12,2) NOT NULL,
    f_total_price NUMERIC(12,2) NOT NULL,
    f_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_final_price NUMERIC(12,2) NOT NULL,
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at  BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at  BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_oi_order  FOREIGN KEY (f_order_id) REFERENCES public.t_order(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_oi_sku    FOREIGN KEY (f_sku_id)   REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    -- t_order_item 是强子表 (ON DELETE CASCADE), 随父订单级联清理, 无需独立软删字段
    CONSTRAINT ck_t_oi_qty    CHECK (f_quantity > 0),
    CONSTRAINT ck_t_oi_price  CHECK (f_unit_price >= 0 AND f_total_price >= 0 AND f_final_price >= 0),
    CONSTRAINT ck_t_oi_amount CHECK (f_final_price = f_total_price - f_discount_amount)
);;
COMMENT ON TABLE  public.t_order_item IS '订单项 (强子表, 订单删除时级联清理)';;
COMMENT ON COLUMN public.t_order_item.f_id              IS '主键';;
COMMENT ON COLUMN public.t_order_item.f_order_id        IS 'FK -> public.t_order(f_id) | defined in 09_ecommerce.sql | ON DELETE CASCADE';;
COMMENT ON COLUMN public.t_order_item.f_sku_id          IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql | 保留原商品引用, 商品删除不影响历史订单';;
COMMENT ON COLUMN public.t_order_item.f_product_name    IS '下单时商品名称快照 (冗余, 防止商品改名)';;`,
  9: `COMMENT ON COLUMN public.t_order_item.f_quantity        IS '购买数量 (> 0)';;
COMMENT ON COLUMN public.t_order_item.f_unit_price      IS '下单时单价快照 (>= 0)';;
COMMENT ON COLUMN public.t_order_item.f_total_price     IS '总金额 = unit_price * quantity (>= 0)';;
COMMENT ON COLUMN public.t_order_item.f_discount_amount IS '优惠金额 (>= 0, 默认 0)';;
COMMENT ON COLUMN public.t_order_item.f_final_price     IS '应付金额 | 守恒: f_final_price = f_total_price - f_discount_amount';;
COMMENT ON COLUMN public.t_order_item.f_meta_info       IS '扩展元数据';;
-- t_order_item 随父订单 ON DELETE CASCADE 清理, 无独立软删字段
COMMENT ON COLUMN public.t_order_item.f_created_at      IS '创建时间 (UTC)';;
-- 注: idx_t_order_item_order / idx_t_order_item_sku 已统一移至 99_indexes_views.sql


-- ============================================================
-- 9.B.4 物流 / Shipment
-- ============================================================
CREATE TABLE public.t_shipment (
    f_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid          UUID    NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_order_id            BIGINT NOT NULL,
    f_tracking_number     VARCHAR(64) NOT NULL DEFAULT '',
    f_carrier             VARCHAR(64) NOT NULL DEFAULT '',
    f_status_shipment     INTEGER NOT NULL DEFAULT -1,
    f_estimated_delivery  TIMESTAMPTZ,
    f_actual_delivery     TIMESTAMPTZ,
    f_meta_info           JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_deleted             INT2  NOT NULL DEFAULT 0,
    f_created_at          BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at          BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_ship_order FOREIGN KEY (f_order_id) REFERENCES public.t_order(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_ship_stat  FOREIGN KEY (f_status_shipment) REFERENCES public.t_shipping_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_ship_del   CHECK (f_deleted IN (0, 1)),
    CONSTRAINT ck_t_ship_time  CHECK (f_actual_delivery IS NULL OR f_estimated_delivery IS NULL OR f_actual_delivery >= f_estimated_delivery - INTERVAL '30 days'),
    CONSTRAINT uk_t_shipment_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_shipment IS '物流 (订单的强子表, 1:1~N)';;
COMMENT ON COLUMN public.t_shipment.f_id                 IS '主键';;
COMMENT ON COLUMN public.t_shipment.f_public_uid         IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_shipment.f_order_id           IS 'FK -> public.t_order(f_id) | defined in 09_ecommerce.sql | ON DELETE CASCADE';;
COMMENT ON COLUMN public.t_shipment.f_tracking_number    IS '快递单号 (空 = 未发货)';;
COMMENT ON COLUMN public.t_shipment.f_carrier            IS '物流商, e.g. 顺丰 / 中通 / 京东';;
COMMENT ON COLUMN public.t_shipment.f_status_shipment    IS 'FK -> public.t_shipping_status(f_id) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_shipment.f_estimated_delivery IS '预计送达时间';;
COMMENT ON COLUMN public.t_shipment.f_actual_delivery    IS '实际送达时间 | 约束: >= estimated - 30 days (允许误差)';;
COMMENT ON COLUMN public.t_shipment.f_meta_info          IS '扩展元数据 (物流轨迹 JSON)';;
COMMENT ON COLUMN public.t_shipment.f_deleted            IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_shipment.f_created_at         IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_shipment.f_updated_at         IS '更新时间 (UTC)';;
-- 注: 跨表效率索引 (idx_t_product_spu_* / idx_t_inventory_* / idx_t_cart_user /
--     idx_t_shipment_*) 已统一移至 99_indexes_views.sql

-- ============================================================
-- PetChat (更懂它) / 10. IoT 设备 / IoT Devices
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   设备 / 用户-设备绑定 / 设备同步记录
--
-- 依赖:
--   01_enums.sql       (t_sync_status, t_status)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本 (下游):
--   11_agent.sql       -> (设备生产相关, 暂未引用)
--
-- 设计原则 (IoT Principles):
--   1. 设备 SN 全局唯一, 一个设备只能绑一个用户一次 (t_user_device 复合 PK)
--   2. 设备类型白名单: camera / feeder / tracker / scale / litter_box / water_fountain
--   3. 同步记录 append-only, 失败重试通过 f_retry_count
--   4. 弱引用 f_production_id / f_order_id (生产批次/订单), 不加 FK
-- ============================================================


-- ============================================================
-- 10.1 设备 / Device
-- ============================================================
CREATE TABLE public.t_device (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid       UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_device_type      VARCHAR(32)  NOT NULL,
    f_sn               VARCHAR(64)  NOT NULL,
    f_device_name      VARCHAR(128) NOT NULL,
    f_device_model     VARCHAR(64)  NOT NULL DEFAULT '',
    f_firmware_version VARCHAR(32)  NOT NULL DEFAULT '',
    f_production_id    BIGINT,
    f_order_id         BIGINT,
    f_meta_info        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_deleted          INT2         NOT NULL DEFAULT 0,
    f_created_at       BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT uk_t_device_sn UNIQUE (f_sn),
    CONSTRAINT ck_t_device_type CHECK (f_device_type IN ('camera','feeder','tracker','scale','litter_box','water_fountain')),
    CONSTRAINT ck_t_device_del  CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_device_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_device IS 'IoT 设备主表 (每个设备一个 SN)';;
COMMENT ON COLUMN public.t_device.f_id               IS '主键 | 引用方: t_user_device.f_device_id, t_device_sync.f_device_id (本文件)';;
COMMENT ON COLUMN public.t_device.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_device.f_device_type      IS '设备类型 (白名单): camera / feeder / tracker / scale / litter_box / water_fountain';;
COMMENT ON COLUMN public.t_device.f_sn               IS '设备 SN (Serial Number) | UNIQUE';;
COMMENT ON COLUMN public.t_device.f_device_name      IS '设备名 (出厂默认)';;
COMMENT ON COLUMN public.t_device.f_device_model     IS '设备型号';;
COMMENT ON COLUMN public.t_device.f_firmware_version IS '固件版本';;
COMMENT ON COLUMN public.t_device.f_production_id    IS '弱引用: 生产批次 ID (in t_inventory_lot, 09_ecommerce.sql)';;
COMMENT ON COLUMN public.t_device.f_order_id         IS '弱引用: 首次购买订单 ID (in t_order, 09_ecommerce.sql)';;
COMMENT ON COLUMN public.t_device.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_device.f_deleted          IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_device.f_created_at       IS '入库时间 (UTC)';;
-- ============================================================
-- 10.2 用户-设备绑定 / User Device  (复合 PK)
-- ============================================================
CREATE TABLE public.t_user_device (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY,
    f_user_id     BIGINT  NOT NULL,
    f_device_id   BIGINT  NOT NULL,
    f_bind_alias  VARCHAR(64) NOT NULL DEFAULT '',
    f_is_primary  BOOLEAN NOT NULL DEFAULT false,
    f_bound_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_unbound_at  TIMESTAMPTZ,
    f_deleted     INT2        NOT NULL DEFAULT 0,
    PRIMARY KEY (f_user_id, f_device_id),
    CONSTRAINT fk_t_ud_user   FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_ud_device FOREIGN KEY (f_device_id)   REFERENCES public.t_device(f_id)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_ud_time   CHECK (f_unbound_at IS NULL OR f_unbound_at >= f_bound_at),
    CONSTRAINT ck_t_ud_del    CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_user_device IS '用户-设备绑定 (复合 PK (user, device))';;
COMMENT ON COLUMN public.t_user_device.f_id          IS '主键占位 (BIGSERIAL, 实际用复合 PK)';;
COMMENT ON COLUMN public.t_user_device.f_user_id     IS 'FK -> public.t_user(f_id) | 复合 PK 第一部分 | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_user_device.f_device_id   IS 'FK -> public.t_device(f_id) | 复合 PK 第二部分 | defined in 10_iot.sql';;
COMMENT ON COLUMN public.t_user_device.f_bind_alias  IS '用户自定义昵称 (空 = 用 t_device.f_device_name)';;
COMMENT ON COLUMN public.t_user_device.f_is_primary  IS '是否主设备 (同一类型只能有一个主设备)';;
COMMENT ON COLUMN public.t_user_device.f_bound_at    IS '绑定时间 (UTC)';;
COMMENT ON COLUMN public.t_user_device.f_unbound_at  IS '解绑时间 (可空) | 约束: >= f_bound_at';;
COMMENT ON COLUMN public.t_user_device.f_deleted     IS '软删除: 0=正常 1=已删除';;
-- ============================================================
-- 10.3 设备同步记录 / Device Sync
-- ============================================================
CREATE TABLE public.t_device_sync (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_device_id   BIGINT  NOT NULL,
    f_sync_type   VARCHAR(32) NOT NULL,
    f_status_sync INTEGER NOT NULL DEFAULT -1,
    f_synced_at   TIMESTAMPTZ,
    f_retry_count INTEGER NOT NULL DEFAULT 0,
    f_error_msg   TEXT NOT NULL DEFAULT '',
    f_meta_info   JSONB  NOT NULL DEFAULT '{}'::jsonb,
    f_created_at  BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_sync_device FOREIGN KEY (f_device_id)   REFERENCES public.t_device(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_sync_status FOREIGN KEY (f_status_sync) REFERENCES public.t_sync_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_sync_retry  CHECK (f_retry_count >= 0)
);;
COMMENT ON TABLE  public.t_device_sync IS '设备同步记录 (append-only)';;
COMMENT ON COLUMN public.t_device_sync.f_id          IS '主键';;
COMMENT ON COLUMN public.t_device_sync.f_device_id   IS 'FK -> public.t_device(f_id) | defined in 10_iot.sql';;
COMMENT ON COLUMN public.t_device_sync.f_sync_type   IS '同步类型, e.g. config / firmware / data';;
COMMENT ON COLUMN public.t_device_sync.f_status_sync IS 'FK -> public.t_sync_status(f_id) | defined in 01_enums.sql | pending / syncing / success / failed';;
COMMENT ON COLUMN public.t_device_sync.f_synced_at   IS '实际同步完成时间 (可空)';;
COMMENT ON COLUMN public.t_device_sync.f_retry_count IS '重试次数 (>= 0)';;
COMMENT ON COLUMN public.t_device_sync.f_error_msg   IS '失败时的错误信息';;
COMMENT ON COLUMN public.t_device_sync.f_meta_info   IS '扩展元数据 (请求/响应快照)';;
-- t_device_sync 为 append-only 流水表, 不设软删字段
COMMENT ON COLUMN public.t_device_sync.f_created_at  IS '创建时间 (UTC)';;
-- 注: idx_t_device_sync_device 已统一移至 99_indexes_views.sql

-- ============================================================
-- PetChat (更懂它) / 11. 代理商 / Agent
-- ============================================================
-- Version: 4.1.0
-- Created: 2026-06-17
-- Updated: 2026-06-20
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   代理商实体 / 合作申请 / 提现 / 收益 (B2B 合作)
--
-- 依赖:
--   01_enums.sql       (t_status)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本: 无
--
-- 设计原则 (Agent Principles):
--   1. t_agent 是代理商实体表 (自然人/机构);;
与 t_user 关联但不强依赖
--   2. t_agent_application 聚焦合作申请审批流程、协议条款和可量化指标
--      联系方式 (f_phone / f_wechat_no / f_email) 统一在 t_agent 中维护
--   3. f_status_apply 用业务枚举 (1=待审 2=通过 3=拒绝 4=撤回), 由应用层维护
--   4. 提现和收益都是 append-only 流水, 状态由应用层推进
--   5. f_revenue_month 格式 YYYY-MM, CHECK 正则
--   6. 弱引用 f_order_id / f_order_no (订单/订单号), 不加 FK
--   7. 软删除统一用 f_deleted INT2 NOT NULL DEFAULT 0 (0=正常, 1=已删除)
-- ============================================================


-- ============================================================
-- 11.1 代理商实体 / Agent
-- ============================================================
CREATE TABLE public.t_agent (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid    UUID        NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id       BIGINT,
    f_agent_type    VARCHAR(32) NOT NULL DEFAULT 'person',
    f_real_name     VARCHAR(64) NOT NULL,
    f_company_name  VARCHAR(128) NOT NULL DEFAULT '',
    f_phone         VARCHAR(32) NOT NULL DEFAULT '',
    f_wechat_no     VARCHAR(64) NOT NULL DEFAULT '',
    f_email         VARCHAR(128) NOT NULL DEFAULT '',
    f_region        VARCHAR(128) NOT NULL DEFAULT '',
    f_introduction  TEXT        NOT NULL DEFAULT '',
    f_meta_info     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_deleted       INT2        NOT NULL DEFAULT 0,
    f_created_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_agent_user   FOREIGN KEY (f_user_id)  REFERENCES public.t_user(f_id) ON DELETE SET NULL,
    CONSTRAINT ck_t_agent_type   CHECK (f_agent_type IN ('person','company','institution','individual_biz')),
    CONSTRAINT ck_t_agent_name   CHECK (length(f_real_name) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_agent_phone  CHECK (f_phone = '' OR f_phone ~ '^[0-9+\\-\\s()]{5,32}$'),
    CONSTRAINT ck_t_agent_email  CHECK (f_email = '' OR f_email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
    CONSTRAINT ck_t_agent_del    CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_agent_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_agent IS '代理商/合作方实体 (自然人/机构);;
联系方式和基本信息统一在此维护';;
COMMENT ON COLUMN public.t_agent.f_id            IS '主键 | 引用方: t_agent_application.f_agent_id (本文件), t_agent_withdrawal.f_agent_id, t_agent_revenue.f_agent_id';;
COMMENT ON COLUMN public.t_agent.f_public_uid    IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_agent.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 关联平台账号 (可空: 代理商未注册时为空) | ON DELETE SET NULL';;
COMMENT ON COLUMN public.t_agent.f_agent_type    IS '代理商类型 (白名单): person=自然人 / company=公司 / institution=机构/组织 / individual_biz=个体工商户';;
COMMENT ON COLUMN public.t_agent.f_real_name     IS '真实姓名 / 法人姓名 (1-64 字符)';;
COMMENT ON COLUMN public.t_agent.f_company_name  IS '公司/机构名称 (自然人可空字符串)';;
COMMENT ON COLUMN public.t_agent.f_phone         IS '联系电话 (格式: ^[0-9+\\-\\s()]{5,32}$)';;
COMMENT ON COLUMN public.t_agent.f_wechat_no     IS '微信号';;
COMMENT ON COLUMN public.t_agent.f_email         IS '联系邮箱';;
COMMENT ON COLUMN public.t_agent.f_region        IS '所在地区 (省/市/区)';;
COMMENT ON COLUMN public.t_agent.f_introduction  IS '代理商简介 / 资质说明';;
COMMENT ON COLUMN public.t_agent.f_meta_info     IS '扩展元数据 (营业执照/资质材料 URL 等)';;
COMMENT ON COLUMN public.t_agent.f_deleted       IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_agent.f_created_at    IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_agent.f_updated_at    IS '更新时间 (UTC), 由 trigger 维护';;`,
  10: `-- 注: idx_t_agent_user / idx_t_agent_active 已统一移至 99_indexes_views.sql


-- ============================================================
-- 11.2 代理商合作申请 / Agent Application
-- ============================================================
-- 聚焦: 合作审批流程、协议条款和可量化合作指标
-- 联系方式已移入 t_agent, 本表不重复存储
-- ============================================================
CREATE TABLE public.t_agent_application (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_agent_id          BIGINT      NOT NULL,
    f_user_id           BIGINT      NOT NULL,
    f_apply_type        VARCHAR(32) NOT NULL,
    -- 合作协议条款
    f_cooperation_scope TEXT        NOT NULL DEFAULT '',
    f_territory         VARCHAR(256) NOT NULL DEFAULT '',
    f_contract_start    DATE,
    f_contract_end      DATE,
    -- 可量化合作指标
    f_target_gmv        NUMERIC(14,2),
    f_target_users      INTEGER,
    f_commission_rate   NUMERIC(5,4) NOT NULL DEFAULT 0,
    f_min_deposit       NUMERIC(12,2),
    -- 附件与审核
    f_attachment_urls   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    f_review_comment    TEXT        NOT NULL DEFAULT '',
    f_meta_info         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_status_apply      INTEGER     NOT NULL DEFAULT 1,
    f_deleted           INT2        NOT NULL DEFAULT 0,
    f_created_at        BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_agent_app_agent FOREIGN KEY (f_agent_id)  REFERENCES public.t_agent(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_agent_app_user  FOREIGN KEY (f_user_id)   REFERENCES public.t_user(f_id)   ON DELETE NO ACTION,
    CONSTRAINT ck_t_agent_app_type  CHECK (f_apply_type IN ('agent','doctor','partner','hospital')),
    CONSTRAINT ck_t_agent_app_rate  CHECK (f_commission_rate BETWEEN 0 AND 1),
    CONSTRAINT ck_t_agent_app_contract CHECK (f_contract_end IS NULL OR f_contract_start IS NULL OR f_contract_end >= f_contract_start),
    CONSTRAINT ck_t_agent_app_att   CHECK (jsonb_typeof(f_attachment_urls) = 'array'),
    CONSTRAINT ck_t_agent_app_del   CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_agent_application IS '代理商/合作方申请 (agent / doctor / partner / hospital);;
聚焦合作协议条款和可量化指标';;
COMMENT ON COLUMN public.t_agent_application.f_id                IS '主键';;
COMMENT ON COLUMN public.t_agent_application.f_agent_id          IS 'FK -> public.t_agent(f_id) | defined in 11_agent.sql | 申请方代理商实体';;
COMMENT ON COLUMN public.t_agent_application.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 提交申请的平台用户';;
COMMENT ON COLUMN public.t_agent_application.f_apply_type        IS '申请类型 (白名单): agent / doctor / partner / hospital';;
COMMENT ON COLUMN public.t_agent_application.f_cooperation_scope IS '合作范围说明 (文本)';;
COMMENT ON COLUMN public.t_agent_application.f_territory         IS '代理区域 (省/市/区, 文本)';;
COMMENT ON COLUMN public.t_agent_application.f_contract_start    IS '合同开始日期 (可空) | 约束: <= f_contract_end';;
COMMENT ON COLUMN public.t_agent_application.f_contract_end      IS '合同结束日期 (可空) | 约束: >= f_contract_start';;
COMMENT ON COLUMN public.t_agent_application.f_target_gmv        IS '合作目标 GMV (可空, 单位: 元)';;
COMMENT ON COLUMN public.t_agent_application.f_target_users      IS '合作目标新增用户数 (可空)';;
COMMENT ON COLUMN public.t_agent_application.f_commission_rate   IS '佣金比例 (0-1) | CHECK: BETWEEN 0 AND 1';;
COMMENT ON COLUMN public.t_agent_application.f_min_deposit       IS '最低保证金/押金 (可空, 单位: 元)';;
COMMENT ON COLUMN public.t_agent_application.f_attachment_urls   IS '附件/资质材料 URL JSONB 数组';;
COMMENT ON COLUMN public.t_agent_application.f_review_comment    IS '审核意见 (通过/拒绝时填写)';;
COMMENT ON COLUMN public.t_agent_application.f_meta_info         IS '扩展元数据';;
COMMENT ON COLUMN public.t_agent_application.f_status_apply      IS '申请审核态: 1=待审 2=通过 3=拒绝 4=撤回 | 由应用层维护 (非 t_status 外键)';;
COMMENT ON COLUMN public.t_agent_application.f_deleted           IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_agent_application.f_created_at        IS '申请时间 (UTC)';;
-- 注: idx_t_agent_app_agent / idx_t_agent_app_user / idx_t_agent_app_status
--     已统一移至 99_indexes_views.sql


-- ============================================================
-- 11.3 代理商提现 / Agent Withdrawal
-- ============================================================
CREATE TABLE public.t_agent_withdrawal (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_agent_id        BIGINT        NOT NULL,
    f_user_id         BIGINT        NOT NULL,
    f_amount          NUMERIC(12,2) NOT NULL,
    f_payment_method  VARCHAR(32)   NOT NULL,
    f_payment_account VARCHAR(128)  NOT NULL,
    f_payment_name    VARCHAR(64)   NOT NULL,
    f_status_withdraw INTEGER       NOT NULL DEFAULT 1,
    f_deleted         INT2          NOT NULL DEFAULT 0,
    f_requested_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_processed_at    TIMESTAMPTZ,
    CONSTRAINT fk_t_wd_agent FOREIGN KEY (f_agent_id)   REFERENCES public.t_agent(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_wd_user  FOREIGN KEY (f_user_id)    REFERENCES public.t_user(f_id)   ON DELETE NO ACTION,
    CONSTRAINT ck_t_wd_amount CHECK (f_amount > 0),
    CONSTRAINT ck_t_wd_del    CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_agent_withdrawal IS '代理商提现申请';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_id               IS '主键';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_agent_id         IS 'FK -> public.t_agent(f_id) | defined in 11_agent.sql | 提现代理商实体';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 提现操作人';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_amount           IS '提现金额 (> 0)';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_method   IS '收款方式, e.g. wechat / alipay / bank';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_account  IS '收款账号';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_name     IS '收款人姓名';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_status_withdraw  IS '提现审核态: 1=待审 2=通过 3=拒绝 4=已打款 | 由应用层维护';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_deleted          IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_requested_at     IS '申请时间 (UTC)';;
COMMENT ON COLUMN public.t_agent_withdrawal.f_processed_at     IS '处理时间 (可空)';;
-- 注: idx_t_agent_wd_agent 已统一移至 99_indexes_views.sql


-- ============================================================
-- 11.4 代理商收益 / Agent Revenue
-- ============================================================
CREATE TABLE public.t_agent_revenue (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_agent_id          BIGINT        NOT NULL,
    f_user_id           BIGINT        NOT NULL,
    f_revenue_type      VARCHAR(32)   NOT NULL,
    f_order_id          BIGINT,
    f_order_no          VARCHAR(64),
    f_revenue_amount    NUMERIC(12,2) NOT NULL,
    f_commission_rate   NUMERIC(5,4)  NOT NULL,
    f_commission_amount NUMERIC(12,2) NOT NULL,
    f_revenue_month     VARCHAR(7)    NOT NULL,
    f_status_settlement INTEGER       NOT NULL DEFAULT -1,
    f_meta_info         JSONB         NOT NULL DEFAULT '{}'::jsonb,
    f_deleted           INT2          NOT NULL DEFAULT 0,
    f_created_at        BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_rev_agent FOREIGN KEY (f_agent_id)  REFERENCES public.t_agent(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_rev_user  FOREIGN KEY (f_user_id)   REFERENCES public.t_user(f_id)   ON DELETE NO ACTION,
    CONSTRAINT ck_t_rev_rate  CHECK (f_commission_rate BETWEEN 0 AND 1),
    CONSTRAINT ck_t_rev_month CHECK (f_revenue_month ~ '^\\d{4}-\\d{2}$'),
    CONSTRAINT ck_t_rev_del   CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_agent_revenue IS '代理商收益 (f_status_settlement 由应用层扩展)';;
COMMENT ON COLUMN public.t_agent_revenue.f_id                 IS '主键';;
COMMENT ON COLUMN public.t_agent_revenue.f_agent_id           IS 'FK -> public.t_agent(f_id) | defined in 11_agent.sql | 收益代理商实体';;
COMMENT ON COLUMN public.t_agent_revenue.f_user_id            IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 收益归属用户';;
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_type       IS '收益类型, e.g. order_commission / subscription_share';;
COMMENT ON COLUMN public.t_agent_revenue.f_order_id           IS '弱引用: 订单 ID (in t_order, 09_ecommerce.sql) | 可空 (非订单来源)';;
COMMENT ON COLUMN public.t_agent_revenue.f_order_no           IS '订单号 (冗余) | 弱引用: t_order.f_order_no (in 09_ecommerce.sql)';;
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_amount     IS '订单金额 (基数)';;
COMMENT ON COLUMN public.t_agent_revenue.f_commission_rate    IS '佣金比例 (0-1) | CHECK: BETWEEN 0 AND 1';;
COMMENT ON COLUMN public.t_agent_revenue.f_commission_amount  IS '佣金金额 (派生: revenue_amount * rate)';;
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_month      IS '收益月份 YYYY-MM | 索引/汇总键';;
COMMENT ON COLUMN public.t_agent_revenue.f_status_settlement  IS '结算态: 1=待结算 2=已结算 3=已提现 | 由应用层维护';;
COMMENT ON COLUMN public.t_agent_revenue.f_meta_info          IS '扩展元数据';;
COMMENT ON COLUMN public.t_agent_revenue.f_deleted            IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_agent_revenue.f_created_at         IS '收益时间 (UTC)';;
-- 注: idx_t_agent_rev_agent 已统一移至 99_indexes_views.sql

-- ============================================================
-- PetChat (更懂它) / 12. 宠物医疗 / Healthcare
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   医院 / 医生 / 预约
--
-- 依赖:
--   01_enums.sql       (t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--   03_pet_profile.sql (t_pet)
--
-- 被本文件引用的脚本 (下游):
--   13_welfare.sql     -> t_donation.f_target_type='hospital' (弱引用)
--
-- 设计原则 (Healthcare Principles):
--   1. 医院和医生是多对多 (通过 f_hospital_id 强绑), 一个医生属于一个医院
--   2. 预约是独立实体, 关联用户/医院/医生/宠物
--   3. f_service_type 用业务字符串 (体检/疫苗/绝育/...), 由应用层维护枚举
--   4. 评分 f_rating 由 t_comment 多态统计 (不冗余)
-- ============================================================


-- ============================================================
-- 12.1 医院 / Hospital
-- ============================================================
CREATE TABLE public.t_hospital (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid    UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id       BIGINT       NOT NULL,
    f_lang          VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_name          VARCHAR(128) NOT NULL,
    f_address       VARCHAR(256) NOT NULL,
    f_phone         VARCHAR(32)  NOT NULL,
    f_business_hours VARCHAR(64) NOT NULL DEFAULT '',
    f_service_tags  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_rating        NUMERIC(3,2) NOT NULL DEFAULT 0,
    f_meta_info     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_deleted       INT2         NOT NULL DEFAULT 0,
    f_created_at    BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_hospital_user FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id)   ON DELETE NO ACTION,
    CONSTRAINT fk_t_hospital_lang FOREIGN KEY (f_lang)    REFERENCES public.t_lang(f_code)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_hospital_name   CHECK (length(f_name) BETWEEN 1 AND 128),
    CONSTRAINT ck_t_hospital_rating CHECK (f_rating BETWEEN 0 AND 5),
    CONSTRAINT ck_t_hospital_del    CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_hospital_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_hospital IS '宠物医院主表';;
COMMENT ON COLUMN public.t_hospital.f_id             IS '主键 | 引用方: t_doctor.f_hospital_id, t_appointment.f_hospital_id (本文件) | 弱引用: t_donation.f_target_id (in 13_welfare.sql, f_target_type=hospital)';;
COMMENT ON COLUMN public.t_hospital.f_public_uid     IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_hospital.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 入驻用户 (医院管理员)';;
COMMENT ON COLUMN public.t_hospital.f_lang           IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 主语言';;
COMMENT ON COLUMN public.t_hospital.f_name           IS '医院名';;
COMMENT ON COLUMN public.t_hospital.f_address        IS '医院地址';;
COMMENT ON COLUMN public.t_hospital.f_phone          IS '联系电话';;
COMMENT ON COLUMN public.t_hospital.f_business_hours IS '营业时间, e.g. 09:00-21:00';;
COMMENT ON COLUMN public.t_hospital.f_service_tags   IS '服务标签 JSONB 数组, e.g. ["内科","外科","急诊"]';;
COMMENT ON COLUMN public.t_hospital.f_rating         IS '综合评分 0-5 (由 t_comment 统计, 应用层定期刷新)';;
COMMENT ON COLUMN public.t_hospital.f_meta_info      IS '扩展元数据 (坐标/资质/...)';;
COMMENT ON COLUMN public.t_hospital.f_deleted        IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_hospital.f_created_at     IS '入驻时间 (UTC)';;
-- 注: idx_t_hospital_rating 已统一移至 99_indexes_views.sql


-- ============================================================
-- 12.2 医生 / Doctor
-- ============================================================
CREATE TABLE public.t_doctor (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id         BIGINT       NOT NULL,
    f_hospital_id     BIGINT       NOT NULL,
    f_title           VARCHAR(64)  NOT NULL,
    f_expertise       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_experience_years INTEGER     NOT NULL DEFAULT 0,
    f_intro           TEXT         NOT NULL DEFAULT '',
    f_deleted         INT2         NOT NULL DEFAULT 0,
    f_created_at      BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_doctor_user     FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_doctor_hospital FOREIGN KEY (f_hospital_id) REFERENCES public.t_hospital(f_id)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_doctor_exp      CHECK (f_experience_years >= 0),
    CONSTRAINT ck_t_doctor_del      CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_doctor IS '医生主表 (一个医生属于一个医院)';;
COMMENT ON COLUMN public.t_doctor.f_id                IS '主键 | 引用方: t_appointment.f_doctor_id (本文件, 可空)';;
COMMENT ON COLUMN public.t_doctor.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 医生账号';;
COMMENT ON COLUMN public.t_doctor.f_hospital_id       IS 'FK -> public.t_hospital(f_id) | defined in 12_healthcare.sql | 所属医院';;
COMMENT ON COLUMN public.t_doctor.f_title             IS '职称, e.g. 主任医师 / 主治医师';;
COMMENT ON COLUMN public.t_doctor.f_expertise         IS '专长 JSONB 数组, e.g. ["心脏","皮肤","牙科"]';;
COMMENT ON COLUMN public.t_doctor.f_experience_years  IS '从业年限 (>= 0)';;
COMMENT ON COLUMN public.t_doctor.f_intro             IS '个人简介';;
COMMENT ON COLUMN public.t_doctor.f_deleted           IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_doctor.f_created_at        IS '入驻时间 (UTC)';;`,
  11: `-- ========================================================= ===
-- 12.3 预约 / Appointment
-- ============================================================
CREATE TABLE public.t_appointment (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid      UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id         BIGINT       NOT NULL,
    f_hospital_id     BIGINT       NOT NULL,
    f_doctor_id       BIGINT,
    f_pet_id          BIGINT,
    f_appointment_time TIMESTAMPTZ NOT NULL,
    f_service_type    VARCHAR(64)  NOT NULL,
    f_symptoms        TEXT         NOT NULL DEFAULT '',
    f_meta_info       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_deleted         INT2         NOT NULL DEFAULT 0,
    f_created_at      BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_appt_user     FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)     ON DELETE NO ACTION,
    CONSTRAINT fk_t_appt_hospital FOREIGN KEY (f_hospital_id) REFERENCES public.t_hospital(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_appt_doctor   FOREIGN KEY (f_doctor_id)   REFERENCES public.t_doctor(f_id)   ON DELETE NO ACTION,
    CONSTRAINT fk_t_appt_pet      FOREIGN KEY (f_pet_id)      REFERENCES public.t_pet(f_id)      ON DELETE NO ACTION,
    CONSTRAINT ck_t_appt_del      CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_appointment_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_appointment IS '宠物医疗预约';;
COMMENT ON COLUMN public.t_appointment.f_id               IS '主键';;
COMMENT ON COLUMN public.t_appointment.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_appointment.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 预约人';;
COMMENT ON COLUMN public.t_appointment.f_hospital_id      IS 'FK -> public.t_hospital(f_id) | defined in 12_healthcare.sql';;
COMMENT ON COLUMN public.t_appointment.f_doctor_id        IS 'FK -> public.t_doctor(f_id) | defined in 12_healthcare.sql | 可空 (不指定医生)';;
COMMENT ON COLUMN public.t_appointment.f_pet_id           IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 可空 (新宠未录入)';;
COMMENT ON COLUMN public.t_appointment.f_appointment_time IS '预约时间 (UTC)';;
COMMENT ON COLUMN public.t_appointment.f_service_type     IS '服务类型, e.g. 体检 / 疫苗 / 绝育 / 急诊';;
COMMENT ON COLUMN public.t_appointment.f_symptoms         IS '症状描述';;
COMMENT ON COLUMN public.t_appointment.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_appointment.f_deleted          IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_appointment.f_created_at       IS '创建时间 (UTC)';;
-- ============================================================
-- PetChat (更懂它) / 13. 公益与寻宠 / Welfare & Lost-Pet
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   救助申请 / 领养 / 志愿者 / 捐款 / 寻宠
--
-- 依赖:
--   01_enums.sql       (t_pet_type, t_adoption_type, t_volunteer_type,
--                       t_payment_status, t_status, t_lang)
--   02_rbac_users.sql  (t_user, 含 -1 哨兵匿名用户)
--   03_pet_profile.sql (t_pet)
--
-- 被本文件引用的脚本: 无 (叶子模块)
--
-- 设计原则 (Welfare Principles):
--   1. 捐款 f_user_id = -1 表示匿名捐款 (引用 t_user 哨兵), 应用层需先确保 -1 哨兵存在
--   2. 救助/领养/寻宠可绑定已有宠物 (f_pet_id), 也可独立发布 (f_pet_id IS NULL)
--   3. f_target_type 多态捐款目标: rescue / adoption / hospital / activity / general
--   4. 寻宠 f_status_lost 业务态: 1=寻宠中 2=已找到 3=已关闭
-- ============================================================


-- ============================================================
-- 13.1 救助申请 / Rescue Request
-- ============================================================
CREATE TABLE public.t_rescue_request (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid    UUID        NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id       BIGINT      NOT NULL,
    f_lang          VARCHAR(8)  NOT NULL DEFAULT 'zh-CN',
    f_pet_type_id   BIGINT      NOT NULL,
    f_location      VARCHAR(256) NOT NULL,
    f_description   TEXT        NOT NULL,
    f_contact_phone VARCHAR(32) NOT NULL DEFAULT '',
    f_meta_info     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_deleted       INT2        NOT NULL DEFAULT 0,
    f_created_at    BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_rescue_user  FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_rescue_lang  FOREIGN KEY (f_lang)        REFERENCES public.t_lang(f_code)     ON DELETE NO ACTION,
    CONSTRAINT fk_t_rescue_type  FOREIGN KEY (f_pet_type_id) REFERENCES public.t_pet_type(f_id)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_rescue_phone CHECK (f_contact_phone = '' OR f_contact_phone ~ '^[0-9+\\-\\s()]{5,32}$'),
    CONSTRAINT ck_t_rescue_del   CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_rescue_request_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_rescue_request IS '救助申请 (f_pet_type_id 引用 t_pet_type, JSONB i18n)';;
COMMENT ON COLUMN public.t_rescue_request.f_id            IS '主键 | 弱引用: t_donation.f_target_id (本文件, f_target_type=rescue)';;
COMMENT ON COLUMN public.t_rescue_request.f_public_uid    IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_rescue_request.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 申请人';;
COMMENT ON COLUMN public.t_rescue_request.f_lang          IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';;
COMMENT ON COLUMN public.t_rescue_request.f_pet_type_id   IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 被救助宠物类型';;
COMMENT ON COLUMN public.t_rescue_request.f_location      IS '发现地点';;
COMMENT ON COLUMN public.t_rescue_request.f_description   IS '情况描述';;
COMMENT ON COLUMN public.t_rescue_request.f_contact_phone IS '联系电话 (可空)';;
COMMENT ON COLUMN public.t_rescue_request.f_meta_info     IS '扩展元数据 (现场照片)';;
COMMENT ON COLUMN public.t_rescue_request.f_deleted       IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_rescue_request.f_created_at    IS '申请时间 (UTC)';;
-- ============================================================
-- 13.2 领养 (送养/申请) / Adoption
-- ============================================================
CREATE TABLE public.t_adoption (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid      UUID        NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id         BIGINT      NOT NULL,
    f_pet_id          BIGINT,
    f_pet_type_id     BIGINT,
    f_pet_name        VARCHAR(64) NOT NULL,
    f_pet_age         VARCHAR(32) NOT NULL DEFAULT '',
    f_adoption_type_id BIGINT     NOT NULL,
    f_description     TEXT        NOT NULL DEFAULT '',
    f_requirements    TEXT        NOT NULL DEFAULT '',
    f_location        VARCHAR(256) NOT NULL DEFAULT '',
    f_contact_phone   VARCHAR(32) NOT NULL DEFAULT '',
    f_meta_info       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_deleted         INT2        NOT NULL DEFAULT 0,
    f_created_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_adoption_user  FOREIGN KEY (f_user_id)          REFERENCES public.t_user(f_id)          ON DELETE NO ACTION,
    CONSTRAINT fk_t_adoption_pet   FOREIGN KEY (f_pet_id)           REFERENCES public.t_pet(f_id)           ON DELETE NO ACTION,
    CONSTRAINT fk_t_adoption_type  FOREIGN KEY (f_pet_type_id)      REFERENCES public.t_pet_type(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_adoption_kind  FOREIGN KEY (f_adoption_type_id) REFERENCES public.t_adoption_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_adoption_name  CHECK (length(f_pet_name) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_adoption_phone CHECK (f_contact_phone = '' OR f_contact_phone ~ '^[0-9+\\-\\s()]{5,32}$'),
    CONSTRAINT ck_t_adoption_del   CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_adoption_public_uid UNIQUE (f_public_uid)
);;
COMMENT ON TABLE  public.t_adoption IS '领养信息: 1=送养 2=领养申请';;
COMMENT ON COLUMN public.t_adoption.f_id               IS '主键 | 弱引用: t_donation.f_target_id (本文件, f_target_type=adoption)';;
COMMENT ON COLUMN public.t_adoption.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_adoption.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 发布人';;
COMMENT ON COLUMN public.t_adoption.f_pet_id           IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 可空 (未录入系统的宠物)';;
COMMENT ON COLUMN public.t_adoption.f_pet_type_id      IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 可空 (与 f_pet_id 互斥)';;
COMMENT ON COLUMN public.t_adoption.f_pet_name         IS '宠物昵称';;
COMMENT ON COLUMN public.t_adoption.f_pet_age          IS '宠物年龄文本, e.g. 3岁 / 2个月';;
COMMENT ON COLUMN public.t_adoption.f_adoption_type_id IS 'FK -> public.t_adoption_type(f_id) | defined in 01_enums.sql | 1=送养 2=领养申请';;
COMMENT ON COLUMN public.t_adoption.f_description      IS '描述 (性格/疫苗/...)';;
COMMENT ON COLUMN public.t_adoption.f_requirements     IS '领养要求';;
COMMENT ON COLUMN public.t_adoption.f_location         IS '地点';;
COMMENT ON COLUMN public.t_adoption.f_contact_phone    IS '联系电话';;
COMMENT ON COLUMN public.t_adoption.f_meta_info        IS '扩展元数据';;
COMMENT ON COLUMN public.t_adoption.f_deleted          IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_adoption.f_created_at       IS '发布时间 (UTC)';;
-- ============================================================
-- 13.3 志愿者 / Volunteer
-- ============================================================
CREATE TABLE public.t_volunteer (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id           BIGINT  NOT NULL,
    f_volunteer_type_id BIGINT  NOT NULL,
    f_skills            JSONB   NOT NULL DEFAULT '[]'::jsonb,
    f_experience        TEXT    NOT NULL DEFAULT '',
    f_available         BOOLEAN NOT NULL DEFAULT true,
    f_meta_info         JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_deleted           INT2    NOT NULL DEFAULT 0,
    f_joined_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_volunteer_user  FOREIGN KEY (f_user_id)           REFERENCES public.t_user(f_id)           ON DELETE NO ACTION,
    CONSTRAINT fk_t_volunteer_type  FOREIGN KEY (f_volunteer_type_id) REFERENCES public.t_volunteer_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_volunteer_del   CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_volunteer_user_type UNIQUE (f_user_id, f_volunteer_type_id)
);;
COMMENT ON TABLE  public.t_volunteer IS '志愿者档案 (一个用户可担任多种志愿者类型)';;
COMMENT ON COLUMN public.t_volunteer.f_id                IS '主键';;
COMMENT ON COLUMN public.t_volunteer.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';;
COMMENT ON COLUMN public.t_volunteer.f_volunteer_type_id IS 'FK -> public.t_volunteer_type(f_id) | defined in 01_enums.sql | 复合 UNIQUE 第二部分';;
COMMENT ON COLUMN public.t_volunteer.f_skills            IS '技能 JSONB 数组, e.g. ["急救","驾驶","翻译"]';;
COMMENT ON COLUMN public.t_volunteer.f_experience        IS '经验描述';;
COMMENT ON COLUMN public.t_volunteer.f_available         IS '当前是否可接单';;
COMMENT ON COLUMN public.t_volunteer.f_meta_info         IS '扩展元数据';;
COMMENT ON COLUMN public.t_volunteer.f_deleted           IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_volunteer.f_joined_at         IS '加入时间 (UTC)';;
-- ============================================================
-- 13.4 捐款 / Donation
-- ============================================================
-- f_user_id = -1 引用"系统匿名用户"哨兵, 表示匿名捐款
-- 实际 NO ACTION (不删除系统匿名用户即可保证 FK 成立)
CREATE TABLE public.t_donation (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id       BIGINT       NOT NULL DEFAULT -1,
    f_target_type   VARCHAR(32)  NOT NULL,
    f_target_id     BIGINT       NOT NULL,
    f_amount        NUMERIC(12,2) NOT NULL,
    f_currency      VARCHAR(8)   NOT NULL DEFAULT 'CNY',
    f_payment_method VARCHAR(32) NOT NULL DEFAULT '',
    f_status_payment INTEGER     NOT NULL DEFAULT -1,
    f_anonymous     BOOLEAN      NOT NULL DEFAULT false,
    f_message       TEXT         NOT NULL DEFAULT '',
    f_meta_info     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_deleted       INT2         NOT NULL DEFAULT 0,
    f_created_at    BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_donation_user   FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)           ON DELETE NO ACTION,
    CONSTRAINT fk_t_donation_pay    FOREIGN KEY (f_status_payment) REFERENCES public.t_payment_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_donation_amount CHECK (f_amount > 0),
    CONSTRAINT ck_t_donation_target CHECK (f_target_type IN ('rescue','adoption','hospital','activity','general')),
    CONSTRAINT ck_t_donation_del    CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_donation IS '捐款记录, f_user_id = -1 表示匿名 (引用 t_user 哨兵)';;
COMMENT ON COLUMN public.t_donation.f_id             IS '主键';;
COMMENT ON COLUMN public.t_donation.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | -1=系统匿名用户;;
真实用户 >= 1';;
COMMENT ON COLUMN public.t_donation.f_target_type    IS '捐款目标类型 (白名单): rescue / adoption / hospital / activity / general';;
COMMENT ON COLUMN public.t_donation.f_target_id      IS '捐款目标 ID (弱引用, 实际表由 f_target_type 决定) | rescue->t_rescue_request, adoption->t_adoption, hospital->t_hospital (in 12_healthcare.sql), activity->t_activity (in 07_cms.sql)';;
COMMENT ON COLUMN public.t_donation.f_amount         IS '金额 (> 0)';;
COMMENT ON COLUMN public.t_donation.f_currency       IS '货币, 默认 CNY';;
COMMENT ON COLUMN public.t_donation.f_payment_method IS '支付方式';;
COMMENT ON COLUMN public.t_donation.f_status_payment IS 'FK -> public.t_payment_status(f_id) | defined in 01_enums.sql';;
COMMENT ON COLUMN public.t_donation.f_anonymous      IS '是否匿名 (冗余 f_user_id=-1, 用于查询)';;
COMMENT ON COLUMN public.t_donation.f_message        IS '留言';;
COMMENT ON COLUMN public.t_donation.f_meta_info      IS '扩展元数据 (支付回执)';;
COMMENT ON COLUMN public.t_donation.f_deleted        IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_donation.f_created_at     IS '捐款时间 (UTC)';;`,
  12: `-- 注: idx_t_donation_user / idx_t_donation_target 已统一移至 99_indexes_views.sql


-- ============================================================
-- 13.5 寻宠 / Lost Pet
-- ============================================================
CREATE TABLE public.t_record_lost_pet (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id         BIGINT       NOT NULL,
    f_pet_id          BIGINT,
    f_lang            VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_lost_time       TIMESTAMPTZ  NOT NULL,
    f_lost_location   VARCHAR(256) NOT NULL,
    f_contact_phone   VARCHAR(32)  NOT NULL,
    f_reward_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_reward_currency VARCHAR(8)   NOT NULL DEFAULT 'CNY',
    f_description     TEXT         NOT NULL DEFAULT '',
    f_status_lost     INTEGER      NOT NULL DEFAULT 1,
    f_deleted         INT2         NOT NULL DEFAULT 0,
    f_meta_info       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at      BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_lost_user  FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id)   ON DELETE NO ACTION,
    CONSTRAINT fk_t_lost_pet   FOREIGN KEY (f_pet_id)  REFERENCES public.t_pet(f_id)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_lost_lang  FOREIGN KEY (f_lang)    REFERENCES public.t_lang(f_code)  ON DELETE NO ACTION,
    CONSTRAINT ck_t_lost_phone  CHECK (f_contact_phone ~ '^[0-9+\\-\\s()]{5,32}$'),
    CONSTRAINT ck_t_lost_reward CHECK (f_reward_amount >= 0),
    CONSTRAINT ck_t_lost_del    CHECK (f_deleted IN (0, 1))
);;
COMMENT ON TABLE  public.t_record_lost_pet IS '寻宠启事';;
COMMENT ON COLUMN public.t_record_lost_pet.f_id              IS '主键';;
COMMENT ON COLUMN public.t_record_lost_pet.f_user_id         IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 启事人';;
COMMENT ON COLUMN public.t_record_lost_pet.f_pet_id          IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 可空 (未录入系统)';;
COMMENT ON COLUMN public.t_record_lost_pet.f_lang            IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';;
COMMENT ON COLUMN public.t_record_lost_pet.f_lost_time       IS '走失时间 (UTC)';;
COMMENT ON COLUMN public.t_record_lost_pet.f_lost_location   IS '走失地点';;
COMMENT ON COLUMN public.t_record_lost_pet.f_contact_phone   IS '联系电话 (必填)';;
COMMENT ON COLUMN public.t_record_lost_pet.f_reward_amount   IS '悬赏金额 (>= 0, 默认 0)';;
COMMENT ON COLUMN public.t_record_lost_pet.f_reward_currency IS '悬赏货币, 默认 CNY';;
COMMENT ON COLUMN public.t_record_lost_pet.f_description     IS '宠物特征描述';;
COMMENT ON COLUMN public.t_record_lost_pet.f_status_lost     IS '寻宠业务态: 1=寻宠中 2=已找到 3=已关闭 | 由应用层维护 (非 t_status 外键)';;
COMMENT ON COLUMN public.t_record_lost_pet.f_deleted         IS '软删除: 0=正常 1=已删除';;
COMMENT ON COLUMN public.t_record_lost_pet.f_meta_info       IS '扩展元数据 (照片/特征)';;
COMMENT ON COLUMN public.t_record_lost_pet.f_created_at      IS '发布时间 (UTC)';;
-- ============================================================
-- PetChat (更懂它) / 50. 统一 AB 实验平台 / Unified AB Experiment Platform
-- ============================================================
-- Version: 0.7
-- Created: 2026-06-20
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   AB 实验平台核心表 (t_ab / t_ab_variant / t_ab_domain / t_ab_status
--   / t_ab_event / t_ab_assignment / t_ab_footprint / t_user_tag
--   / t_ab_user_skin), 跨 5 个域 (PROMPT / FEATURE / SKIN / AD / SUBSCRIPTION)
--
-- 设计文档:
--   doc/reference/ab-platform-unified-v0.7.md
--
-- 依赖:
--   00_extensions.sql  (pgroonga / pgcrypto)
--   01_enums.sql       (t_status)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本: 无
--
-- 设计原则 (AB Platform Principles):
--   1. 对外暴露的非 enum 表主键后增 f_publish_uid UUID (enum 表不加)
--   2. 关联表 ON DELETE CASCADE, 字典表/枚举 ON DELETE NO ACTION
--   3. t_ab_assignment.f_user_id 用 SET NULL (保留历史, 详见 foreign-key.md §4.2)
--   4. t_ab_footprint.f_event_id / f_assignment_id 为软外键 (不建 FK)
--      原因: BI 回填时 UPDATE, 强 FK 会阻碍;;
上报期间可为 NULL
--   5. 互斥靠算法 (t_ab_domain.f_max_concurrent + hash) 不靠 layer 表
--   6. CHECK 守恒: 业务规则用 CHECK 约束, 避免应用层遗漏
-- ============================================================


-- ============================================================
-- 50.1 AB 域 / t_ab_domain
-- ============================================================
-- enum 表, 不对外暴露单条记录, 不需要 f_publish_uid
-- 预设值 PROMPT/FEATURE/SKIN/AD/SUBSCRIPTION, 可按需扩展
CREATE TABLE public.t_ab_domain (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_code            VARCHAR(32)  NOT NULL UNIQUE,
    f_name            VARCHAR(64)  NOT NULL DEFAULT '',
    f_desc            TEXT         NOT NULL DEFAULT '',
    f_max_concurrent  INTEGER      NOT NULL DEFAULT 1,
    f_status_id       INTEGER      NOT NULL DEFAULT 1,
    f_created_at      BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at      BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_ab_domain_status FOREIGN KEY (f_status_id)
        REFERENCES public.t_status(f_id) ON DELETE NO ACTION
);;
COMMENT ON TABLE  public.t_ab_domain IS 'AB 实验所属域 (enum, 互斥靠算法 f_max_concurrent + hash, 不靠 layer 表)';;
COMMENT ON COLUMN public.t_ab_domain.f_id             IS '主键 (内部, enum 表不对外暴露单条记录)';;
COMMENT ON COLUMN public.t_ab_domain.f_code           IS '业务代码, UPPERCASE: PROMPT / FEATURE / SKIN / AD / SUBSCRIPTION | UNIQUE';;
COMMENT ON COLUMN public.t_ab_domain.f_name           IS '人类可读名';;
COMMENT ON COLUMN public.t_ab_domain.f_desc           IS '描述';;
COMMENT ON COLUMN public.t_ab_domain.f_max_concurrent IS '同 t_ab_domain 内互斥上限 (默认 1)';;
COMMENT ON COLUMN public.t_ab_domain.f_status_id      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';;
COMMENT ON COLUMN public.t_ab_domain.f_created_at     IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_ab_domain.f_updated_at     IS '更新时间 (UTC)';;
-- ============================================================
-- 50.2 AB 状态 / t_ab_status
-- ============================================================
-- 实验状态 enum, 替代 v0.6 的 t_ab.f_status VARCHAR + CHECK
-- 约定值: -1=NOT-SET / 1=DRAFT / 10=RUNNING / 15=PAUSED / 20=DELETED / 30=COMPLETED / 40=KILLED
CREATE TABLE public.t_ab_status (
    f_id        INTEGER PRIMARY KEY,
    f_code      VARCHAR(32) NOT NULL UNIQUE,
    f_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_desc      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_order     INTEGER NOT NULL DEFAULT 0,
    f_deleted   INT2 NOT NULL DEFAULT 0,
    CONSTRAINT ck_t_ab_status_name_is_object CHECK (jsonb_typeof(f_name) = 'object')
);;
COMMENT ON TABLE  public.t_ab_status IS 'AB 实验状态 enum (替代 VARCHAR + CHECK, 可按需扩展)';;
COMMENT ON COLUMN public.t_ab_status.f_id      IS '主键;;
哨兵: -1=NOT-SET;;
业务约定: 1=DRAFT / 10=RUNNING / 15=PAUSED / 20=DELETED / 30=COMPLETED / 40=KILLED';;
COMMENT ON COLUMN public.t_ab_status.f_code    IS '业务语义代码, e.g. DRAFT / RUNNING | UNIQUE';;
COMMENT ON COLUMN public.t_ab_status.f_name    IS '多语言名称 | 引用方: t_ab.f_status_ab_id (本文件)';;
COMMENT ON COLUMN public.t_ab_status.f_desc    IS '多语言描述';;
COMMENT ON COLUMN public.t_ab_status.f_order   IS '排序权重';;
COMMENT ON COLUMN public.t_ab_status.f_deleted IS '启用开关';;
-- ============================================================
-- 50.3 AB 事件 / t_ab_event
-- ============================================================
-- v0.7 承担双角色: 无业务含义 (IMPRESSION/CLICK/SCROLL/SWIPE) + 有业务含义 (CONVERT/BUSINESS)
-- 同一张表, 通过 f_type 区分粒度
CREATE TABLE public.t_ab_event (
    f_event_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_type            VARCHAR(32)  NOT NULL DEFAULT 'IMPRESSION',
    f_name            VARCHAR(128) NOT NULL UNIQUE,
    f_desc            TEXT         NOT NULL DEFAULT '',
    f_ver             INTEGER      NOT NULL DEFAULT 100,
    f_status_id       INTEGER      NOT NULL DEFAULT 1,
    f_created_at      BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at      BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT ck_t_ab_event_ver CHECK (f_ver >= 1),
    CONSTRAINT fk_t_ab_event_status FOREIGN KEY (f_status_id) REFERENCES public.t_status(f_id) ON DELETE NO ACTION
);;
COMMENT ON TABLE  public.t_ab_event IS 'AB 事件 enum (双角色: 无业务含义原始交互 + 有业务含义 BI 回填)';;
COMMENT ON COLUMN public.t_ab_event.f_event_id   IS '主键';;
COMMENT ON COLUMN public.t_ab_event.f_type       IS '事件大类;;
约定值: 无业务含义: IMPRESSION / CLICK / SCROLL / SWIPE;;
有业务含义: CONVERT / BUSINESS';;
COMMENT ON COLUMN public.t_ab_event.f_name       IS '事件名 (UPPERCASE, UNIQUE), e.g. PAGE_VIEW / BUTTON_CLICK / PROMPT_LIKED';;
COMMENT ON COLUMN public.t_ab_event.f_desc       IS '描述 (含角色说明)';;
COMMENT ON COLUMN public.t_ab_event.f_ver        IS '版本号, 默认 100 (软删除 + 兼容多版本共存) | CHECK: >= 1';;
COMMENT ON COLUMN public.t_ab_event.f_status_id  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';;
COMMENT ON COLUMN public.t_ab_event.f_created_at IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_ab_event.f_updated_at IS '更新时间 (UTC)';;
-- ============================================================
-- 50.4 实验主表 / t_ab
-- ============================================================
CREATE TABLE public.t_ab (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_publish_uid       UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_code              VARCHAR(128) NOT NULL,
    f_name              VARCHAR(64)  NOT NULL DEFAULT '',
    f_domain_id         BIGINT       NOT NULL,
    f_status_ab_id      INTEGER      NOT NULL DEFAULT 1,
    f_traffic_pct       SMALLINT     NOT NULL DEFAULT 100,
    f_target_user_ids   BIGINT[]     NOT NULL DEFAULT '{}'::bigint[],
    f_target_rule       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_primary_metric    VARCHAR(64)  NOT NULL DEFAULT '',
    f_guardrail_metrics JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_starts_at         TIMESTAMPTZ,
    f_ends_at           TIMESTAMPTZ,
    f_owner_team        VARCHAR(64)  NOT NULL DEFAULT '',
    f_desc              TEXT         NOT NULL DEFAULT '',
    f_created_at        BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at        BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT uk_t_ab_domain_code UNIQUE (f_domain_id, f_code),
    CONSTRAINT ck_t_ab_traffic    CHECK (f_traffic_pct BETWEEN 1 AND 100),
    CONSTRAINT fk_t_ab_domain     FOREIGN KEY (f_domain_id) REFERENCES public.t_ab_domain(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ab_status_ab  FOREIGN KEY (f_status_ab_id) REFERENCES public.t_ab_status(f_id) ON DELETE NO ACTION
);;
COMMENT ON TABLE  public.t_ab IS 'AB 实验主表';;
COMMENT ON COLUMN public.t_ab.f_id                IS '主键 (内部) | 引用方: t_ab_variant.f_ab_id, t_ab_assignment.f_ab_id (本文件, CASCADE)';;
COMMENT ON COLUMN public.t_ab.f_publish_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成 (API 返回这个)';;
COMMENT ON COLUMN public.t_ab.f_code              IS '实验代码 (UPPERCASE, 同 f_domain_id 唯一) | UNIQUE (f_domain_id, f_code)';;
COMMENT ON COLUMN public.t_ab.f_name              IS '实验显示名 (简单字符串, 不做 i18n)';;
COMMENT ON COLUMN public.t_ab.f_domain_id         IS 'FK -> public.t_ab_domain(f_id) | defined in 50_ab.sql | 所属域 (软外键, NO ACTION)';;
COMMENT ON COLUMN public.t_ab.f_status_ab_id      IS 'FK -> public.t_ab_status(f_id) | defined in 50_ab.sql | 实验状态: -1=NOT-SET / 1=DRAFT / 10=RUNNING / 15=PAUSED / 20=DELETED / 30=COMPLETED / 40=KILLED';;
COMMENT ON COLUMN public.t_ab.f_traffic_pct       IS '流量比例 1-100 (CHECK)';;
COMMENT ON COLUMN public.t_ab.f_target_user_ids   IS '圈定用户 ID 集合 (启动实验时生成)';;
COMMENT ON COLUMN public.t_ab.f_target_rule       IS '定向规则 JSONB (含 tags / countries / platforms / custom_sql)';;
COMMENT ON COLUMN public.t_ab.f_primary_metric    IS '主指标名';;
COMMENT ON COLUMN public.t_ab.f_guardrail_metrics IS '保护指标 JSONB 数组';;
COMMENT ON COLUMN public.t_ab.f_starts_at         IS '实验开始时间 (UTC, 可空)';;
COMMENT ON COLUMN public.t_ab.f_ends_at           IS '实验结束时间 (UTC, 可空)';;
COMMENT ON COLUMN public.t_ab.f_owner_team        IS '负责团队';;
COMMENT ON COLUMN public.t_ab.f_desc              IS '实验描述';;
COMMENT ON COLUMN public.t_ab.f_created_at        IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_ab.f_updated_at        IS '更新时间 (UTC)';;
-- ============================================================
-- 50.5 实验变体 / t_ab_variant
-- ============================================================
CREATE TABLE public.t_ab_variant (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_ab_id           BIGINT       NOT NULL,
    f_code            VARCHAR(64)  NOT NULL,
    f_name            VARCHAR(64)  NOT NULL DEFAULT '',
    f_weight          SMALLINT     NOT NULL,
    f_config          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_desc            TEXT         NOT NULL DEFAULT '',
    f_status_id       INTEGER      NOT NULL DEFAULT 1,
    f_created_at      BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_ab_variant_ab     FOREIGN KEY (f_ab_id)     REFERENCES public.t_ab(f_id)     ON DELETE CASCADE,
    CONSTRAINT fk_t_ab_variant_status FOREIGN KEY (f_status_id) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_var_ab_code UNIQUE (f_ab_id, f_code)
);;
COMMENT ON TABLE  public.t_ab_variant IS 'AB 实验变体 (一个实验多个 variant, 权重总和=100)';;
COMMENT ON COLUMN public.t_ab_variant.f_id         IS '主键 | 引用方: t_ab_assignment.f_variant_id (本文件, CASCADE)';;
COMMENT ON COLUMN public.t_ab_variant.f_ab_id      IS 'FK -> public.t_ab(f_id) | defined in 50_ab.sql | 关联实验 (ON DELETE CASCADE)';;
COMMENT ON COLUMN public.t_ab_variant.f_code       IS '变体代码 (UPPERCASE: CONTROL / VARIANT_A / ...) | UNIQUE (f_ab_id, f_code)';;
COMMENT ON COLUMN public.t_ab_variant.f_name       IS '变体名';;
COMMENT ON COLUMN public.t_ab_variant.f_weight     IS '权重 (同实验总和=100)';;
COMMENT ON COLUMN public.t_ab_variant.f_config     IS '变体业务配置 JSONB, e.g. {"prompt_code": "AI_REPORT_EMOTION_ANALYZE_V3", "temperature": 0.7}';;
COMMENT ON COLUMN public.t_ab_variant.f_desc       IS '描述';;
COMMENT ON COLUMN public.t_ab_variant.f_status_id  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';;
COMMENT ON COLUMN public.t_ab_variant.f_created_at IS '创建时间 (UTC)';;`,
  13: `-- ============================================================
-- 50.6 用户分组记录 / t_ab_assignment
-- ============================================================
-- v0.7 完整版: f_user_id 可为 NULL (匿名), f_anonymous_id 可为 NULL (登录后)
-- 两个 UK 用 WHERE 条件 (PostgreSQL 局部唯一索引) 解决"必须有一个非空"问题
CREATE TABLE public.t_ab_assignment (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_publish_uid   UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_ab_id         BIGINT       NOT NULL,
    f_variant_id    BIGINT       NOT NULL,
    f_user_id       BIGINT,
    f_anonymous_id  VARCHAR(128),
    f_assigned_at   BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_status_id     INTEGER      NOT NULL DEFAULT 1,
    CONSTRAINT fk_t_assign_ab      FOREIGN KEY (f_ab_id)      REFERENCES public.t_ab(f_id)            ON DELETE CASCADE,
    CONSTRAINT fk_t_assign_variant FOREIGN KEY (f_variant_id) REFERENCES public.t_ab_variant(f_id)    ON DELETE CASCADE,
    CONSTRAINT fk_t_assign_user    FOREIGN KEY (f_user_id)    REFERENCES public.t_user(f_id)          ON DELETE SET NULL,
    CONSTRAINT fk_t_assign_status  FOREIGN KEY (f_status_id)  REFERENCES public.t_status(f_id)        ON DELETE NO ACTION,
    CONSTRAINT ck_t_assign_identity CHECK (f_user_id IS NOT NULL OR f_anonymous_id IS NOT NULL)
    -- 注: 部分唯一约束 (f_user_id / f_anonymous_id 各取一非空) 由下方
    --     CREATE UNIQUE INDEX ... WHERE ... 实现 (PG 不支持 inline 部分 UNIQUE)
);;
COMMENT ON TABLE  public.t_ab_assignment IS 'AB 用户分组记录 (f_user_id 与 f_anonymous_id 二选一非空, 见 CHECK)';;
COMMENT ON COLUMN public.t_ab_assignment.f_id            IS '主键 (内部)';;
COMMENT ON COLUMN public.t_ab_assignment.f_publish_uid   IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_ab_assignment.f_ab_id         IS 'FK -> public.t_ab(f_id) | defined in 50_ab.sql | 关联实验 (CASCADE)';;
COMMENT ON COLUMN public.t_ab_assignment.f_variant_id    IS 'FK -> public.t_ab_variant(f_id) | defined in 50_ab.sql | 关联变体 (CASCADE)';;
COMMENT ON COLUMN public.t_ab_assignment.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 登录用户, 可空 (匿名);;
ON DELETE SET NULL (保历史)';;
COMMENT ON COLUMN public.t_ab_assignment.f_anonymous_id  IS '匿名 UUID, 可空 (登录后置 NULL);;
由前端 generateAnonymousId() 生成 (见 v0.7 §7.4)';;
COMMENT ON COLUMN public.t_ab_assignment.f_assigned_at   IS '分配时间 (UTC)';;
COMMENT ON COLUMN public.t_ab_assignment.f_status_id     IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';;
-- 注: uk_t_assign_ab_user / uk_t_assign_ab_anon / idx_t_assign_user / idx_t_assign_anon
--     (部分唯一/索引: 同一实验内, 登录用户唯一 / 匿名用户唯一)
--     已统一移至 99_indexes_views.sql


-- ============================================================
-- 50.7 用户行为跟踪 / t_ab_footprint
-- ============================================================
-- f_event_id / f_assignment_id 均为软外键 (不建 FK 约束, 详见 v0.7 §4.6)
CREATE TABLE public.t_ab_footprint (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_event_id        BIGINT,
    f_assignment_id   BIGINT,
    f_user_id         BIGINT,
    f_anonymous_id    VARCHAR(128),
    f_url             TEXT         NOT NULL DEFAULT '',
    f_backend_api     VARCHAR(256) NOT NULL DEFAULT '',
    f_os              VARCHAR(16)  NOT NULL DEFAULT '',
    f_device          VARCHAR(64)  NOT NULL DEFAULT '',
    f_browser         VARCHAR(64)  NOT NULL DEFAULT '',
    f_ip_address      VARCHAR(45)  NOT NULL DEFAULT '',
    f_app_version     VARCHAR(32)  NOT NULL DEFAULT '',
    f_session_id      VARCHAR(64)  NOT NULL DEFAULT '',
    f_context         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_occurred_at     BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_fp_user FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION
);;
COMMENT ON TABLE  public.t_ab_footprint IS 'AB 用户行为跟踪 (append-only, 客户端 SDK 上报 + BI 异步回填)';;
COMMENT ON COLUMN public.t_ab_footprint.f_id            IS '主键';;
COMMENT ON COLUMN public.t_ab_footprint.f_event_id      IS '软外键 -> public.t_ab_event(f_event_id) | 上报时: 填无业务含义原始事件;;
BI 回填后: 替换为有业务含义事件;;
可为 NULL';;
COMMENT ON COLUMN public.t_ab_footprint.f_assignment_id IS '软外键 -> public.t_ab_assignment(f_id) | BI 异步回填;;
客户端上报时为 NULL;;
空悬保留原值有分析价值';;
COMMENT ON COLUMN public.t_ab_footprint.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 登录用户, 可空 (NO ACTION)';;
COMMENT ON COLUMN public.t_ab_footprint.f_anonymous_id  IS '匿名 UUID, 可空 (无 FK)';;
COMMENT ON COLUMN public.t_ab_footprint.f_url           IS '用户当前 URL (TEXT 兼容长 URL + query) | 来自 window.location.href';;
COMMENT ON COLUMN public.t_ab_footprint.f_backend_api   IS '该行为触发的后端 API 路径, e.g. POST /api/v1/report/regenerate';;
COMMENT ON COLUMN public.t_ab_footprint.f_os            IS '客户端系统 (来自 X-Platform header) | ANDROID / IOS / H5 / MP_WECHAT';;
COMMENT ON COLUMN public.t_ab_footprint.f_device        IS '设备型号, e.g. iPhone15,2 / Pixel 8';;
COMMENT ON COLUMN public.t_ab_footprint.f_browser       IS '浏览器类型/版本, e.g. Chrome 120 / Safari 17 (H5 端)';;
COMMENT ON COLUMN public.t_ab_footprint.f_ip_address    IS '用户 IP (VARCHAR(45) 兼容 IPv4/IPv6) | 反作弊 + 地域分析';;
COMMENT ON COLUMN public.t_ab_footprint.f_app_version   IS 'APP 构建号 (来自 X-App-Version header), e.g. 4.2.1.1234';;
COMMENT ON COLUMN public.t_ab_footprint.f_session_id    IS '客户端会话 ID (用于漏斗分析)';;
COMMENT ON COLUMN public.t_ab_footprint.f_context       IS 'JSONB 扩展 (按钮文本 / 元素 ID / AB 实验上下文 / 脱敏用户输入)';;
COMMENT ON COLUMN public.t_ab_footprint.f_occurred_at   IS '发生时间 (UTC, 客户端传)';;
-- ============================================================
-- 50.8 用户标签 / t_user_tag
-- ============================================================
CREATE TABLE public.t_user_tag (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id     BIGINT       NOT NULL,
    f_tag         VARCHAR(64)  NOT NULL,
    f_tag_value   VARCHAR(128) NOT NULL DEFAULT '',
    f_source      VARCHAR(32)  NOT NULL DEFAULT 'SYSTEM',
    f_weight      NUMERIC(3,2) DEFAULT 1.0,
    f_expires_at  TIMESTAMPTZ,
    f_status_id   INTEGER      NOT NULL DEFAULT 1,
    f_created_at  BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at  BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_user_tag_user   FOREIGN KEY (f_user_id)   REFERENCES public.t_user(f_id)   ON DELETE CASCADE,
    CONSTRAINT fk_t_user_tag_status FOREIGN KEY (f_status_id) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_user_tag UNIQUE (f_user_id, f_tag)
);;
COMMENT ON TABLE  public.t_user_tag IS '用户标签 (AB 定向: tags / 二次过滤)';;
COMMENT ON COLUMN public.t_user_tag.f_id         IS '主键';;
COMMENT ON COLUMN public.t_user_tag.f_user_id    IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | ON DELETE CASCADE (用户删 -> 标签删)';;
COMMENT ON COLUMN public.t_user_tag.f_tag        IS '标签名';;
COMMENT ON COLUMN public.t_user_tag.f_tag_value  IS '标签值';;
COMMENT ON COLUMN public.t_user_tag.f_source     IS '来源;;
约定值: SYSTEM / MANUAL / IMPORTED / ML_INFERRED / AB_TEST (可扩展, 不用 CHECK 锁死)';;
COMMENT ON COLUMN public.t_user_tag.f_weight     IS '权重 (0-1, 默认 1.0)';;
COMMENT ON COLUMN public.t_user_tag.f_expires_at IS '过期时间 (可空)';;
COMMENT ON COLUMN public.t_user_tag.f_status_id  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';;
COMMENT ON COLUMN public.t_user_tag.f_created_at IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_user_tag.f_updated_at IS '更新时间 (UTC)';;
-- 注: idx_t_user_tag_tag 已统一移至 99_indexes_views.sql


-- ============================================================
-- 50.9 SKIN 域 AB override / t_ab_user_skin
-- ============================================================
-- 限定为 SKIN 域专用 (v0.7 改名, 替代 v0.6 t_ab_user_pref_override)
-- 用于 AB 平台内部强制覆盖 (SYSTEM/ADMIN/USER_TRIAL_ACCEPT/USER_TRIAL_REJECT)
CREATE TABLE public.t_ab_user_skin (
    f_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_publish_uid  UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id      BIGINT       NOT NULL,
    f_pref_code    VARCHAR(128) NOT NULL,
    f_pref_value   TEXT         NOT NULL DEFAULT '',
    f_reason       VARCHAR(256) NOT NULL DEFAULT '',
    f_source       VARCHAR(16)  NOT NULL DEFAULT 'SYSTEM',
    f_expires_at   TIMESTAMPTZ,
    f_status_id    INTEGER      NOT NULL DEFAULT 1,
    f_meta_info    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at   BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at   BIGINT       NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_ab_user_skin_user   FOREIGN KEY (f_user_id)   REFERENCES public.t_user(f_id)   ON DELETE CASCADE,
    CONSTRAINT fk_t_ab_user_skin_status FOREIGN KEY (f_status_id) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_ab_user_skin_user UNIQUE (f_user_id)
);;
COMMENT ON TABLE  public.t_ab_user_skin IS 'SKIN 域 AB override (系统自动 / 运营手工, 优先级 3, 详见 v0.7 §9)';;
COMMENT ON COLUMN public.t_ab_user_skin.f_id          IS '主键';;
COMMENT ON COLUMN public.t_ab_user_skin.f_publish_uid IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';;
COMMENT ON COLUMN public.t_ab_user_skin.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | ON DELETE CASCADE';;
COMMENT ON COLUMN public.t_ab_user_skin.f_pref_code   IS '偏好项, e.g. "skin_code"';;
COMMENT ON COLUMN public.t_ab_user_skin.f_pref_value  IS '偏好值 (TEXT)';;
COMMENT ON COLUMN public.t_ab_user_skin.f_reason      IS '备注';;
COMMENT ON COLUMN public.t_ab_user_skin.f_source      IS '来源;;
约定值: SYSTEM / ADMIN / USER_TRIAL_ACCEPT / USER_TRIAL_REJECT (可扩展)';;
COMMENT ON COLUMN public.t_ab_user_skin.f_expires_at  IS '过期时间 (可空, e.g. 试用 7 天)';;
COMMENT ON COLUMN public.t_ab_user_skin.f_status_id   IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';;
COMMENT ON COLUMN public.t_ab_user_skin.f_meta_info   IS '扩展 JSONB, e.g. {"trial_count": 3, "last_reject_at": "2026-06-19T10:00:00Z"}';;
COMMENT ON COLUMN public.t_ab_user_skin.f_created_at  IS '创建时间 (UTC)';;
COMMENT ON COLUMN public.t_ab_user_skin.f_updated_at  IS '更新时间 (UTC)';;
-- ============================================================
-- 50 文件结束
-- ============================================================
-- 至此 50_ab.sql 全部 DDL 部署完成;;
接下来执行:
--   - database/init/db_init.sql  (初始化 enum 数据: t_ab_domain / t_ab_status / t_ab_event)
--   - 应用层 API 接入 (/api/v1/ab/resolve + /api/v1/ab/event)
-- ============================================================

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
--   业务查询走 f_id;;
偶发 LIKE 全表扫可忽略
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
-- 前提: CREATE EXTENSION pgroonga WITH SCHEMA extensions;;
(见 00_extensions.sql)
--
-- 注意: 仅对 i18n 长文本业务表建立 pgroonga;;
枚举表 (<1000 行) 走 B-tree 等值 (Rule 1)

-- 99.2.1 产品 SPU (f_name JSONB, f_description JSONB — JSONB i18n 内联方案)
-- pgroonga 索引已内联在 09_ecommerce.sql: idx_t_product_spu_pgroonga (Form A, language-agnostic)
-- B-tree 表达式索引已内联在 09_ecommerce.sql: idx_t_product_spu_name_en / idx_t_product_spu_name_zh
-- (此处不重复建立)

-- 99.2.2 Banner (CMS, per-language row, f_title VARCHAR(128), f_description TEXT)
-- 表结构见 07_cms.sql: t_banner (FK -> t_lang)
CREATE INDEX IF NOT EXISTS idx_t_banner_pgroonga
    ON public.t_banner
    USING pgroonga (f_title, f_description);;
-- 99.2.3 活动 Activity (CMS, per-language row, f_title VARCHAR(128), f_description TEXT)
-- 表结构见 07_cms.sql: t_activity (FK -> t_lang)
CREATE INDEX IF NOT EXISTS idx_t_activity_pgroonga
    ON public.t_activity
    USING pgroonga (f_title, f_description);;
-- 99.2.4 落地页 Landing Page (CMS, per-language row, f_title VARCHAR(128), f_subtitle VARCHAR(256))
-- 表结构见 07_cms.sql: t_landing_page (FK -> t_lang)
CREATE INDEX IF NOT EXISTS idx_t_landing_page_pgroonga
    ON public.t_landing_page
    USING pgroonga (f_title, f_subtitle);;
-- 99.2.5 AI 性格报告分析 (per-pet 报告, f_personality_analysis TEXT)
-- 表结构见 04_ai_reports.sql: t_report_personality
CREATE INDEX IF NOT EXISTS idx_t_report_pers_pgroonga
    ON public.t_report_personality
    USING pgroonga (f_personality_analysis);;
-- 99.2.6 救助申请描述 (f_description TEXT)
-- 表结构见 13_welfare.sql: t_rescue_request
CREATE INDEX IF NOT EXISTS idx_t_rescue_request_pgroonga
    ON public.t_rescue_request
    USING pgroonga (f_description);;
-- 99.2.7 领养描述/要求 (f_description TEXT, f_requirements TEXT)
-- 表结构见 13_welfare.sql: t_adoption
CREATE INDEX IF NOT EXISTS idx_t_adoption_pgroonga
    ON public.t_adoption
    USING pgroonga (f_description, f_requirements);;
-- 99.2.8 志愿者经验 (f_experience TEXT)
-- 表结构见 13_welfare.sql: t_volunteer
CREATE INDEX IF NOT EXISTS idx_t_volunteer_pgroonga
    ON public.t_volunteer
    USING pgroonga (f_experience);;
-- 99.2.9 捐款留言 (f_message TEXT)
-- 表结构见 13_welfare.sql: t_donation
CREATE INDEX IF NOT EXISTS idx_t_donation_pgroonga
    ON public.t_donation
    USING pgroonga (f_message);;`,
  14: `-- 99.2.10 寻宠描述 (f_description TEXT)
-- 表结构见 13_welfare.sql: t_record_lost_pet
CREATE INDEX IF NOT EXISTS idx_t_record_lost_pet_pgroonga
    ON public.t_record_lost_pet
    USING pgroonga (f_description);;
-- 99.2.11 医生个人简介 (f_intro TEXT)
-- 表结构见 12_healthcare.sql: t_doctor
CREATE INDEX IF NOT EXISTS idx_t_doctor_pgroonga
    ON public.t_doctor
    USING pgroonga (f_intro);;
-- 99.2.12 预约症状描述 (f_symptoms TEXT)
-- 表结构见 12_healthcare.sql: t_appointment
CREATE INDEX IF NOT EXISTS idx_t_appointment_pgroonga
    ON public.t_appointment
    USING pgroonga (f_symptoms);;
-- 99.2.13 AI 提示词正文 (f_content TEXT, 按 code+lang+ver 隔离)
-- 表结构见 04_ai_reports.sql: t_prompt
CREATE INDEX IF NOT EXISTS idx_t_prompt_pgroonga
    ON public.t_prompt
    USING pgroonga (f_content);;
-- 99.2.14 代理商申请审核意见 (f_review_comment TEXT, pgroonga 全文搜索)
-- 表结构见 11_agent.sql: t_agent_application
CREATE INDEX IF NOT EXISTS idx_t_agent_application_pgroonga
    ON public.t_agent_application
    USING pgroonga (f_review_comment);;
-- 99.2.15 评论内容 (f_content TEXT, 多态目标: hospital/doctor/product/...)
-- 表结构见 05_chat_comments.sql: t_comment
CREATE INDEX IF NOT EXISTS idx_t_comment_pgroonga
    ON public.t_comment
    USING pgroonga (f_content);;
-- ============================================================
-- 99.2.5 各模块内联索引汇总 (从 0x_*.sql 抽出, 集中维护)
-- ============================================================
-- 原则: 模块文件 (0x_*.sql) 只声明表结构 + 注释, 索引统一在 99_indexes_views.sql
--       维护. 便于一次评估/重建全套索引.
-- 注: 此段是单表内联索引的"集中地", 跨模块/跨表的索引继续放在 99.3 段.

-- 99.2.5.1 用户表 (02_rbac_users.sql: t_user)
-- partial unique: 排除空字符串
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_user_phone
    ON public.t_user(f_phone) WHERE f_phone <> '';;
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_user_email
    ON public.t_user(f_email) WHERE f_email <> '';;
-- active 状态过滤 (status_id = 10 表示 active)
CREATE INDEX IF NOT EXISTS idx_t_user_phone_active
    ON public.t_user(f_phone) WHERE f_status_id = 10;;
CREATE INDEX IF NOT EXISTS idx_t_user_email_active
    ON public.t_user(f_email) WHERE f_status_id = 10;;
-- 99.2.5.2 评论表 (05_chat_comments.sql: t_comment)
CREATE INDEX IF NOT EXISTS idx_t_comment_target
    ON public.t_comment(f_target_type, f_target_id);;
CREATE INDEX IF NOT EXISTS idx_t_comment_user
    ON public.t_comment(f_user_id);;
-- 99.2.5.3 订阅表 (08_subscription.sql: t_user_subscription / t_user_quota / t_usage_record)
CREATE INDEX IF NOT EXISTS idx_t_us_user
    ON public.t_user_subscription(f_user_id);;
CREATE INDEX IF NOT EXISTS idx_t_us_expire
    ON public.t_user_subscription(f_expire_at);;
CREATE INDEX IF NOT EXISTS idx_t_us_user_active
    ON public.t_user_subscription(f_user_id, f_expire_at DESC) WHERE f_status_payment > 0;;
CREATE INDEX IF NOT EXISTS idx_t_uq_user_feature
    ON public.t_user_quota(f_user_id, f_feature_id, f_period_start DESC);;
CREATE INDEX IF NOT EXISTS idx_t_usage_record_user_time
    ON public.t_usage_record(f_user_id, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_usage_record_feature
    ON public.t_usage_record(f_feature_id, f_created_at DESC);;
-- 99.2.5.4 电商表 (09_ecommerce.sql: t_product_category / t_order / t_order_item / t_product_spu / t_product_sku / t_inventory_* / t_cart / t_shipment)
CREATE INDEX IF NOT EXISTS idx_t_product_category_parent
    ON public.t_product_category(f_parent_id);;
CREATE INDEX IF NOT EXISTS idx_t_product_category_active
    ON public.t_product_category(f_deleted) WHERE f_deleted = 0;;
CREATE INDEX IF NOT EXISTS idx_t_order_user_created
    ON public.t_order(f_user_id, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_order_pay_status
    ON public.t_order(f_status_payment, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_order_ship_status
    ON public.t_order(f_status_shipping, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_order_item_order
    ON public.t_order_item(f_order_id);;
CREATE INDEX IF NOT EXISTS idx_t_order_item_sku
    ON public.t_order_item(f_sku_id);;
CREATE INDEX IF NOT EXISTS idx_t_product_spu_name_en
    ON public.t_product_spu ((f_name->>'en-US'));;
CREATE INDEX IF NOT EXISTS idx_t_product_spu_name_zh
    ON public.t_product_spu ((f_name->>'zh-CN'));;
-- pgroonga 索引: idx_t_product_spu_pgroonga 已在 09_ecommerce.sql: 见该文件
CREATE INDEX IF NOT EXISTS idx_t_product_spu_brand
    ON public.t_product_spu(f_brand);;
CREATE INDEX IF NOT EXISTS idx_t_product_sku_spu
    ON public.t_product_sku(f_spu_id);;
CREATE INDEX IF NOT EXISTS idx_t_inventory_lot_supplier
    ON public.t_inventory_lot(f_supplier);;
CREATE INDEX IF NOT EXISTS idx_t_inventory_balance_sku
    ON public.t_inventory_balance(f_sku_id);;
CREATE INDEX IF NOT EXISTS idx_t_inventory_movement_created
    ON public.t_inventory_movement(f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_inventory_serial_sku
    ON public.t_inventory_serial(f_sku_id);;
CREATE INDEX IF NOT EXISTS idx_t_cart_user
    ON public.t_cart(f_user_id);;
CREATE INDEX IF NOT EXISTS idx_t_shipment_order
    ON public.t_shipment(f_order_id);;
CREATE INDEX IF NOT EXISTS idx_t_shipment_tracking
    ON public.t_shipment(f_tracking_number) WHERE f_tracking_number <> '';;
-- 99.2.5.5 IoT 设备同步 (10_iot.sql: t_device_sync)
CREATE INDEX IF NOT EXISTS idx_t_device_sync_device
    ON public.t_device_sync(f_device_id, f_created_at DESC);;
-- 99.2.5.6 代理商 (11_agent.sql: t_agent / t_agent_application / t_agent_withdrawal / t_agent_revenue)
CREATE INDEX IF NOT EXISTS idx_t_agent_user
    ON public.t_agent(f_user_id) WHERE f_user_id IS NOT NULL;;
CREATE INDEX IF NOT EXISTS idx_t_agent_active
    ON public.t_agent(f_agent_type) WHERE f_deleted = 0;;
CREATE INDEX IF NOT EXISTS idx_t_agent_app_agent
    ON public.t_agent_application(f_agent_id);;
CREATE INDEX IF NOT EXISTS idx_t_agent_app_user
    ON public.t_agent_application(f_user_id);;
CREATE INDEX IF NOT EXISTS idx_t_agent_app_status
    ON public.t_agent_application(f_status_apply) WHERE f_deleted = 0;;
CREATE INDEX IF NOT EXISTS idx_t_agent_wd_agent
    ON public.t_agent_withdrawal(f_agent_id);;
CREATE INDEX IF NOT EXISTS idx_t_agent_rev_agent
    ON public.t_agent_revenue(f_agent_id, f_revenue_month);;
-- 99.2.5.7 医院 (12_healthcare.sql: t_hospital)
CREATE INDEX IF NOT EXISTS idx_t_hospital_rating
    ON public.t_hospital(f_rating DESC);;
-- 99.2.5.8 捐款 (13_welfare.sql: t_donation)
-- 注: idx_t_donation_user / idx_t_donation_target 已在 99.3 段 (跨模块)
-- 此处省略

-- 99.2.5.9 AB 实验 (50_ab.sql: t_ab_assignment / t_user_tag)
-- 跨表高频索引 (按 user/anon 复合) — 已在 99.3 段
-- 此处补: t_user_tag 按 tag 过滤
CREATE INDEX IF NOT EXISTS idx_t_user_tag_tag
    ON public.t_user_tag(f_tag);;
-- ============================================================
-- 99.3 跨模块高频查询索引 (跨表)
-- ============================================================

-- 宠物: 按用户/类型/状态
CREATE INDEX IF NOT EXISTS idx_t_pet_user     ON public.t_pet(f_user_id);;
CREATE INDEX IF NOT EXISTS idx_t_pet_type     ON public.t_pet(f_pet_type_id);;
CREATE INDEX IF NOT EXISTS idx_t_pet_status   ON public.t_pet(f_status_pet, f_deleted);;
CREATE INDEX IF NOT EXISTS idx_t_pet_photo_pet        ON public.t_pet_photo(f_pet_id);;
CREATE INDEX IF NOT EXISTS idx_t_pet_photo_primary    ON public.t_pet_photo(f_pet_id) WHERE f_is_primary;;
-- 聊天: 按用户时间/按宠物
CREATE INDEX IF NOT EXISTS idx_t_chat_history_user ON public.t_chat_history(f_user_id, f_started_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_chat_history_pet  ON public.t_chat_history(f_pet_id);;
-- 捐款: 按用户/按目标
CREATE INDEX IF NOT EXISTS idx_t_donation_user_created ON public.t_donation(f_user_id, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_donation_target       ON public.t_donation(f_target_type, f_target_id, f_created_at DESC);;
-- 领养: 按用户/类型
CREATE INDEX IF NOT EXISTS idx_t_adoption_user ON public.t_adoption(f_user_id);;
CREATE INDEX IF NOT EXISTS idx_t_adoption_type ON public.t_adoption(f_adoption_type_id);;
-- 志愿者/救助
CREATE INDEX IF NOT EXISTS idx_t_volunteer_user     ON public.t_volunteer(f_user_id);;
CREATE INDEX IF NOT EXISTS idx_t_rescue_created     ON public.t_rescue_request(f_created_at DESC);;
-- 报告: 按 (user, pet, time)
CREATE INDEX IF NOT EXISTS idx_t_report_emotion_user_pet ON public.t_report_emotion(f_user_id, f_pet_id, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_report_health_user_pet  ON public.t_report_health(f_user_id, f_pet_id, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_report_hpr_user_pet     ON public.t_report_human_pet_risk(f_user_id, f_pet_id, f_created_at DESC);;
CREATE INDEX IF NOT EXISTS idx_t_report_pers_user_pet    ON public.t_report_personality(f_user_id, f_pet_id, f_created_at DESC);;
-- 活动/Banner/提示词
CREATE INDEX IF NOT EXISTS idx_t_activity_time ON public.t_activity(f_start_time);;
CREATE INDEX IF NOT EXISTS idx_t_banner_lang   ON public.t_banner(f_lang, f_order);;
CREATE INDEX IF NOT EXISTS idx_t_prompt_code   ON public.t_prompt(f_code, f_lang) WHERE f_deleted = 0;;
-- AB 平台 (50_ab.sql): 按 (domain, status) / 时间窗 / owner
-- 解析 API 主路径: WHERE f_status_ab_id = 10 AND f_domain_id = $1
CREATE INDEX IF NOT EXISTS idx_t_ab_domain_status
    ON public.t_ab(f_domain_id, f_status_ab_id);;
-- 时间窗过滤: WHERE f_starts_at < now() AND f_ends_at > now() AND f_status_ab_id = 10
CREATE INDEX IF NOT EXISTS idx_t_ab_running_time
    ON public.t_ab(f_starts_at, f_ends_at) WHERE f_status_ab_id = 10;;
-- 按 owner_team 过滤
CREATE INDEX IF NOT EXISTS idx_t_ab_owner ON public.t_ab(f_owner_team) WHERE f_status_ab_id <> 20;;
-- 按 (f_domain_id, f_status_ab_id, f_created_at DESC) 列表分页
CREATE INDEX IF NOT EXISTS idx_t_ab_domain_created
    ON public.t_ab(f_domain_id, f_status_ab_id, f_created_at DESC);;
-- AB 变体: 按 (f_ab_id, f_status_id) 列表 (已 UNIQUE f_ab_id + f_code, 此处补 f_status_id)
CREATE INDEX IF NOT EXISTS idx_t_ab_variant_status ON public.t_ab_variant(f_status_id);;
-- AB 分组: 按 variant 查所有分配 (用于按 variant 聚合统计)
CREATE INDEX IF NOT EXISTS idx_t_ab_assignment_variant
    ON public.t_ab_assignment(f_variant_id);;
-- 按 f_ab_id + f_status_id 过滤 (同实验有效分配)
CREATE INDEX IF NOT EXISTS idx_t_ab_assignment_ab_status
    ON public.t_ab_assignment(f_ab_id, f_status_id);;
-- 按 f_assigned_at DESC 时间范围 (最近分配)
CREATE INDEX IF NOT EXISTS idx_t_ab_assignment_assigned
    ON public.t_ab_assignment(f_assigned_at DESC);;
-- AB 足迹 (append-only, 大表): 核心分析路径
-- 按 f_event_id 分析: BI 按事件类型统计
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_event
    ON public.t_ab_footprint(f_event_id) WHERE f_event_id IS NOT NULL;;
-- 按 f_assignment_id 归因: 实验效果分析
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_assignment
    ON public.t_ab_footprint(f_assignment_id) WHERE f_assignment_id IS NOT NULL;;
-- 按用户时间链: f_user_id + f_occurred_at DESC
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_user_occurred
    ON public.t_ab_footprint(f_user_id, f_occurred_at DESC) WHERE f_user_id IS NOT NULL;;
-- 按匿名设备时间链
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_anon_occurred
    ON public.t_ab_footprint(f_anonymous_id, f_occurred_at DESC) WHERE f_anonymous_id IS NOT NULL;;
-- 按 f_occurred_at 范围扫描 (全局)
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_occurred
    ON public.t_ab_footprint(f_occurred_at DESC);;
-- 按会话 ID 漏斗分析
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_session
    ON public.t_ab_footprint(f_session_id) WHERE f_session_id <> '';;
-- 按 URL 分析 (页面流量)
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_url
    ON public.t_ab_footprint(f_url) WHERE f_url <> '';;
-- 按 (f_os, f_app_version) 客户端分布
CREATE INDEX IF NOT EXISTS idx_t_ab_fp_os_version
    ON public.t_ab_footprint(f_os, f_app_version);;
-- AB 用户标签: 按 f_source 过滤 (AB_TEST 标签可独立清理)
CREATE INDEX IF NOT EXISTS idx_t_user_tag_source
    ON public.t_user_tag(f_source) WHERE f_status_id = 1;;
-- 过期标签清理: WHERE f_expires_at < now() AND f_status_id = 1
CREATE INDEX IF NOT EXISTS idx_t_user_tag_expires
    ON public.t_user_tag(f_expires_at) WHERE f_expires_at IS NOT NULL AND f_status_id = 1;;
-- AB 用户皮肤 override: 按 f_source 过滤 (SYSTEM/ADMIN/USER_TRIAL_ACCEPT/...)
CREATE INDEX IF NOT EXISTS idx_t_ab_user_skin_source
    ON public.t_ab_user_skin(f_source) WHERE f_status_id = 1;;
-- 过期清理
CREATE INDEX IF NOT EXISTS idx_t_ab_user_skin_expires
    ON public.t_ab_user_skin(f_expires_at) WHERE f_expires_at IS NOT NULL AND f_status_id = 1;;
-- 按 f_pref_code 查偏好项
CREATE INDEX IF NOT EXISTS idx_t_ab_user_skin_pref
    ON public.t_ab_user_skin(f_pref_code) WHERE f_status_id = 1;;
-- AB 事件 enum: 按 f_type 过滤 (无业务含义 vs 有业务含义)
CREATE INDEX IF NOT EXISTS idx_t_ab_event_type
    ON public.t_ab_event(f_type) WHERE f_status_id = 1;;
-- 按 f_ver 过滤 (多版本兼容)
CREATE INDEX IF NOT EXISTS idx_t_ab_event_ver
    ON public.t_ab_event(f_ver) WHERE f_status_id = 1;;
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
FROM public.t_pet p;;
-- 99.4.2 用户是否系统匿名
CREATE OR REPLACE VIEW public.v_user_is_anonymous AS
SELECT f_id, f_nickname,
       (f_meta_info->>'role' = 'anonymous') AS f_is_anonymous
FROM public.t_user;;
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
LEFT JOIN public.t_user u ON u.f_id = o.f_user_id;;
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
GROUP BY s.f_id, s.f_sku_code, s.f_price;;
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
LEFT JOIN public.t_ab_status  s ON s.f_id = a.f_status_ab_id;;`,
  15: `-- 99.4.6 AB 用户当前分配视图 (含实验/变体/域信息)
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
WHERE g.f_status_id = 1;;
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
WHERE d.f_status_id = 1;;
-- ============================================================
-- 99 文件结束
-- ============================================================
-- 至此 00-13 + 50 + 99 全部 DDL 部署完成;;`,

};

function getConnString() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const projectRef = url.match(/\/\/(.+)\.supabase/)?.[1] || "";
  return {
    hostname: Deno.env.get("SUPABASE_DB_HOST") || `db.${projectRef}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: Deno.env.get("SUPABASE_DB_PASSWORD") || "",
    tls: { enabled: true, enforce: false },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  }

  try {
    const body: { token?: string; step?: number } = await req.json();
    if (body.token !== "petchat-migrate-2026") {
      return errorResponse("UNAUTHORIZED", "Invalid token", 401);
    }

    const step = body.step ?? 0;
    const sql = MIGRATIONS[step];
    if (!sql) {
      return okResponse({ done: true, totalChunks: Object.keys(MIGRATIONS).length });
    }

    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const client = new Client(getConnString());
    await client.connect();

    try {
      const stmts = sql.split(";").filter((s: string) => s.trim());
      let executed = 0;
      for (const stmt of stmts) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;
        await client.queryObject(trimmed + ";");
        executed++;
      }
      await client.end();

      const nextStep = step + 1;
      const hasMore = MIGRATIONS[nextStep] !== undefined;

      return okResponse({
        step,
        executed,
        nextStep: hasMore ? nextStep : -1,
        hasMore,
      });
    } catch (sqlErr) {
      await client.end();
      return okResponse({
        step,
        status: "error",
        error: (sqlErr as Error).message,
      });
    }
  } catch (err) {
    console.error("migrate-schema:", err);
    return errorResponse("INTERNAL", (err as Error).message, 500);
  }
});
