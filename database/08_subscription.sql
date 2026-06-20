-- ============================================================
-- Gengdongta (更懂它) / 8. 订阅与配额 / Subscription & Quota
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   功能配额定义 / 套餐计划 / 用户订阅 / 用户配额 / 使用记录
--
-- 依赖:
--   01_enums.sql       (t_plan_type, t_payment_status, t_status, t_subscription_type)
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
    f_is_active     BOOLEAN NOT NULL DEFAULT true,
    f_status_user   INTEGER NOT NULL DEFAULT 1,
    f_created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (f_id),
    CONSTRAINT uk_t_fq_ver_code UNIQUE (f_ver, f_code),
    CONSTRAINT fk_t_fq_status FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_fq_name   CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_fq_desc   CHECK (jsonb_typeof(f_description) = 'object'),
    CONSTRAINT ck_t_fq_limit  CHECK (f_quota_limit >= -1),
    CONSTRAINT ck_t_fq_period CHECK (f_quota_period > 0),
    CONSTRAINT ck_t_fq_unit   CHECK (f_quota_unit > 0)
);
COMMENT ON TABLE  public.t_feature_quota IS '功能配额定义, (f_ver, f_code) 唯一; 永不删改, 新版本+1';
COMMENT ON COLUMN public.t_feature_quota.f_id           IS '主键 | 引用方: t_plan_feature.f_feature_id, t_user_quota.f_feature_id (in 08_subscription.sql)';
COMMENT ON COLUMN public.t_feature_quota.f_ver          IS '逻辑版本号; 同 f_code 内单调递增 | 应用层取最新 ver 作为活跃版本 | DEFAULT 100';
COMMENT ON COLUMN public.t_feature_quota.f_code         IS '功能业务代码, e.g. emotion_report / health_report / chat / voice / export';
COMMENT ON COLUMN public.t_feature_quota.f_name         IS '多语言功能名';
COMMENT ON COLUMN public.t_feature_quota.f_description  IS '多语言功能描述';
COMMENT ON COLUMN public.t_feature_quota.f_quota_limit  IS '默认配额上限: -1 表示无限, >=0 表示数值 | 套餐可通过 t_plan_feature.f_quota_override 覆盖';
COMMENT ON COLUMN public.t_feature_quota.f_quota_period IS '配额周期 (天, > 0)';
COMMENT ON COLUMN public.t_feature_quota.f_quota_unit   IS '单次使用消耗的单位数 (默认 1)';
COMMENT ON COLUMN public.t_feature_quota.f_is_countable IS '是否计入配额 (false = 仅启用开关, 不消耗配额)';
COMMENT ON COLUMN public.t_feature_quota.f_is_renewable IS '是否按周期重置';
COMMENT ON COLUMN public.t_feature_quota.f_order        IS '排序权重';
COMMENT ON COLUMN public.t_feature_quota.f_is_active    IS '是否启用 (false = 历史版本)';
COMMENT ON COLUMN public.t_feature_quota.f_status_user  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_feature_quota.f_created_at   IS '创建时间 (UTC)';


-- ============================================================
-- 8.2 套餐计划 / Plan
-- ============================================================
CREATE TABLE public.t_plan (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY,
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
    f_is_active     BOOLEAN NOT NULL DEFAULT true,
    f_status_user   INTEGER NOT NULL DEFAULT 1,
    f_created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (f_id),
    CONSTRAINT uk_t_plan_ver_code UNIQUE (f_ver, f_code),
    CONSTRAINT fk_t_plan_type  FOREIGN KEY (f_plan_type_id) REFERENCES public.t_plan_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_plan_stat  FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_plan_name  CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_plan_desc  CHECK (jsonb_typeof(f_description) = 'object'),
    CONSTRAINT ck_t_plan_price CHECK (f_price >= 0),
    CONSTRAINT ck_t_plan_dur   CHECK (f_duration_days > 0),
    CONSTRAINT ck_t_plan_trial CHECK (f_trial_days >= 0 AND (NOT f_is_trial OR f_trial_days > 0))
);
COMMENT ON TABLE  public.t_plan IS '套餐计划, (f_ver, f_code) 唯一; 永不删改, 新版本+1';
COMMENT ON COLUMN public.t_plan.f_id           IS '主键 | 引用方: t_plan_feature.f_plan_id, t_user_subscription.f_plan_id, t_user_quota.f_plan_id (in 08_subscription.sql)';
COMMENT ON COLUMN public.t_plan.f_ver          IS '逻辑版本号; 同 f_code 内单调递增';
COMMENT ON COLUMN public.t_plan.f_code         IS '套餐业务代码, e.g. free / basic / pro / family';
COMMENT ON COLUMN public.t_plan.f_plan_type_id IS 'FK -> public.t_plan_type(f_id) | defined in 01_enums.sql | 免费/基础/专业/家庭/...';
COMMENT ON COLUMN public.t_plan.f_name         IS '多语言套餐名';
COMMENT ON COLUMN public.t_plan.f_description  IS '多语言套餐描述';
COMMENT ON COLUMN public.t_plan.f_price        IS '套餐价格 (>= 0)';
COMMENT ON COLUMN public.t_plan.f_currency     IS '货币, 默认 CNY';
COMMENT ON COLUMN public.t_plan.f_duration_days IS '套餐有效期 (天, > 0)';
COMMENT ON COLUMN public.t_plan.f_is_trial     IS '是否为试用套餐';
COMMENT ON COLUMN public.t_plan.f_trial_days   IS '试用天数 (f_is_trial=true 时必须 > 0)';
COMMENT ON COLUMN public.t_plan.f_order        IS '排序权重';
COMMENT ON COLUMN public.t_plan.f_is_active    IS '是否启用 (false = 历史版本)';
COMMENT ON COLUMN public.t_plan.f_status_user  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_plan.f_created_at   IS '创建时间 (UTC)';


-- ============================================================
-- 8.3 套餐包含的功能 / Plan Feature
-- ============================================================
CREATE TABLE public.t_plan_feature (
    f_plan_id        BIGINT NOT NULL,
    f_feature_id     BIGINT NOT NULL,
    f_quota_override INTEGER,
    f_order          INTEGER NOT NULL DEFAULT 0,
    f_status_user    INTEGER NOT NULL DEFAULT 1,
    f_created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (f_plan_id, f_feature_id),
    CONSTRAINT fk_t_pf_plan    FOREIGN KEY (f_plan_id)
        REFERENCES public.t_plan(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_pf_feature FOREIGN KEY (f_feature_id)
        REFERENCES public.t_feature_quota(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_pf_stat    FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_pf_qty     CHECK (f_quota_override IS NULL OR f_quota_override >= -1)
);
COMMENT ON TABLE  public.t_plan_feature IS '套餐包含的功能, PK (f_plan_id, f_feature_id)';
COMMENT ON COLUMN public.t_plan_feature.f_plan_id        IS 'FK -> public.t_plan(f_id) | defined in 08_subscription.sql';
COMMENT ON COLUMN public.t_plan_feature.f_feature_id     IS 'FK -> public.t_feature_quota(f_id) | defined in 08_subscription.sql';
COMMENT ON COLUMN public.t_plan_feature.f_quota_override IS '覆盖默认配额: -1 无限, NULL 不覆盖, >=0 数值 | 引用: t_feature_quota.f_quota_limit (本文件)';
COMMENT ON COLUMN public.t_plan_feature.f_order          IS '排序权重';
COMMENT ON COLUMN public.t_plan_feature.f_status_user    IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_plan_feature.f_created_at     IS '创建时间 (UTC)';


-- ============================================================
-- 8.4 用户订阅实例 / User Subscription
-- ============================================================
CREATE TABLE public.t_user_subscription (
    f_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id             BIGINT NOT NULL,
    f_plan_id             BIGINT NOT NULL,
    f_subscription_type_id INTEGER NOT NULL DEFAULT -1,
    f_start_at            TIMESTAMPTZ NOT NULL,
    f_expire_at           TIMESTAMPTZ NOT NULL,
    f_status_payment      INTEGER NOT NULL DEFAULT -1,
    f_status_user         INTEGER NOT NULL DEFAULT 1,
    f_meta_info           JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_us_user  FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_us_plan  FOREIGN KEY (f_plan_id)
        REFERENCES public.t_plan(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_us_sub_type FOREIGN KEY (f_subscription_type_id) REFERENCES public.t_subscription_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_us_pay   FOREIGN KEY (f_status_payment) REFERENCES public.t_payment_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_us_stat  FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_us_dates CHECK (f_expire_at > f_start_at)
);
COMMENT ON TABLE  public.t_user_subscription IS '用户订阅实例 (一对多: 一个用户可有多段历史订阅)';
COMMENT ON COLUMN public.t_user_subscription.f_id                   IS '主键';
COMMENT ON COLUMN public.t_user_subscription.f_user_id             IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_user_subscription.f_plan_id             IS 'FK -> public.t_plan(f_id) | defined in 08_subscription.sql';
COMMENT ON COLUMN public.t_user_subscription.f_subscription_type_id IS 'FK -> public.t_subscription_type(f_id) | defined in 01_enums.sql | 订阅来源';
COMMENT ON COLUMN public.t_user_subscription.f_start_at          IS '生效时间 (UTC)';
COMMENT ON COLUMN public.t_user_subscription.f_expire_at         IS '过期时间 (UTC) | 约束: > f_start_at';
COMMENT ON COLUMN public.t_user_subscription.f_status_payment    IS 'FK -> public.t_payment_status(f_id) | defined in 01_enums.sql | 支付状态';
COMMENT ON COLUMN public.t_user_subscription.f_status_user       IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_user_subscription.f_meta_info         IS '扩展元数据';
COMMENT ON COLUMN public.t_user_subscription.f_created_at        IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_user_subscription.f_updated_at        IS '更新时间 (UTC)';
CREATE INDEX idx_t_us_user      ON public.t_user_subscription(f_user_id);
CREATE INDEX idx_t_us_expire   ON public.t_user_subscription(f_expire_at);
CREATE INDEX idx_t_us_user_active ON public.t_user_subscription(f_user_id, f_expire_at DESC) WHERE f_status_user = 1;


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
    f_status_user   INTEGER NOT NULL DEFAULT 1,
    f_meta_info     JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_uq_user  FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_uq_plan  FOREIGN KEY (f_plan_id)
        REFERENCES public.t_plan(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_uq_feat  FOREIGN KEY (f_feature_id)
        REFERENCES public.t_feature_quota(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_uq_stat  FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_uq_unique UNIQUE (f_user_id, f_feature_id, f_period_start),
    CONSTRAINT ck_t_uq_total CHECK (f_total_quota >= -1),
    CONSTRAINT ck_t_uq_used  CHECK (f_used_quota >= 0),
    CONSTRAINT ck_t_uq_dates CHECK (f_period_end > f_period_start),
    CONSTRAINT ck_t_uq_used_lt_total CHECK (f_total_quota = -1 OR f_used_quota <= f_total_quota)
);
COMMENT ON TABLE  public.t_user_quota IS '用户配额实例, (user, feature, period_start) 唯一; 周期内闭区间';
COMMENT ON COLUMN public.t_user_quota.f_id           IS '主键 | 引用方: t_usage_record.f_quota_id (本文件, SET NULL)';
COMMENT ON COLUMN public.t_user_quota.f_user_id      IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_user_quota.f_plan_id      IS 'FK -> public.t_plan(f_id) | defined in 08_subscription.sql';
COMMENT ON COLUMN public.t_user_quota.f_feature_id   IS 'FK -> public.t_feature_quota(f_id) | defined in 08_subscription.sql';
COMMENT ON COLUMN public.t_user_quota.f_period_start IS '周期开始 (UTC) | 唯一约束 uk_t_uq_unique 的一部分';
COMMENT ON COLUMN public.t_user_quota.f_period_end   IS '周期结束 (UTC) | 约束: > f_period_start';
COMMENT ON COLUMN public.t_user_quota.f_total_quota  IS '周期内总配额: -1 无限, >=0 数值';
COMMENT ON COLUMN public.t_user_quota.f_used_quota   IS '已使用量 | 约束: <= f_total_quota (无限除外)';
COMMENT ON COLUMN public.t_user_quota.f_status_user  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_user_quota.f_meta_info    IS '扩展元数据';
COMMENT ON COLUMN public.t_user_quota.f_created_at   IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_user_quota.f_updated_at   IS '更新时间 (UTC)';
CREATE INDEX idx_t_uq_user_feature ON public.t_user_quota(f_user_id, f_feature_id, f_period_start DESC);


-- ============================================================
-- 8.6 使用记录 / Usage Record
-- ============================================================
CREATE TABLE public.t_usage_record (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id           BIGINT NOT NULL,
    f_feature_id        BIGINT NOT NULL,
    f_quota_id          BIGINT,
    f_usage_type        VARCHAR(32) NOT NULL,
    f_usage_count       INTEGER NOT NULL DEFAULT 1,
    f_related_report_id BIGINT,
    f_meta_info         JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_status_user       INTEGER NOT NULL DEFAULT 1,
    f_created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_ur_user  FOREIGN KEY (f_user_id) REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ur_feat  FOREIGN KEY (f_feature_id)
        REFERENCES public.t_feature_quota(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ur_quota FOREIGN KEY (f_quota_id) REFERENCES public.t_user_quota(f_id) ON DELETE SET NULL,
    CONSTRAINT fk_t_ur_stat  FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_ur_count CHECK (f_usage_count > 0),
    CONSTRAINT ck_t_ur_type  CHECK (f_usage_type IN ('report','chat','analysis','voice','export','api','share','other'))
);
COMMENT ON TABLE  public.t_usage_record IS '功能使用记录 (append-only, 用于扣减配额和审计)';
COMMENT ON COLUMN public.t_usage_record.f_id                IS '主键';
COMMENT ON COLUMN public.t_usage_record.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_usage_record.f_feature_id        IS 'FK -> public.t_feature_quota(f_id) | defined in 08_subscription.sql';
COMMENT ON COLUMN public.t_usage_record.f_quota_id          IS 'FK -> public.t_user_quota(f_id) | defined in 08_subscription.sql | ON DELETE SET NULL';
COMMENT ON COLUMN public.t_usage_record.f_usage_type        IS '使用类型 (白名单): report / chat / analysis / voice / export / api / share / other';
COMMENT ON COLUMN public.t_usage_record.f_usage_count       IS '使用量 (默认 1, > 0) | 应用层需配套更新 f_user_quota.f_used_quota';
COMMENT ON COLUMN public.t_usage_record.f_related_report_id IS '弱引用: 报告 ID (如本次使用生成了报告) | 实际表: t_report_emotion/health/hpr/pers (in 04_ai_reports.sql)';
COMMENT ON COLUMN public.t_usage_record.f_meta_info         IS '扩展元数据';
COMMENT ON COLUMN public.t_usage_record.f_status_user       IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_usage_record.f_created_at        IS '使用时间 (UTC)';
CREATE INDEX idx_t_usage_record_user_time ON public.t_usage_record(f_user_id, f_created_at DESC);
CREATE INDEX idx_t_usage_record_feature   ON public.t_usage_record(f_feature_id, f_created_at DESC);
