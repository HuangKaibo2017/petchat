-- ============================================================
-- PetChat (更懂它) / 11. 代理商 / Agent
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   代理商申请 / 提现 / 收益 (B2B 合作)
--
-- 依赖:
--   01_enums.sql       (t_status)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本: 无
--
-- 设计原则 (Agent Principles):
--   1. f_status_apply 用业务枚举 (1=待审 2=通过 3=拒绝 4=撤回), 由应用层维护
--   2. 提现和收益都是 append-only 流水, 状态由应用层推进
--   3. f_revenue_month 格式 YYYY-MM, CHECK 正则
--   4. 弱引用 f_order_id / f_order_no (订单/订单号), 不加 FK
-- ============================================================


-- ============================================================
-- 11.1 代理商申请 / Agent Application
-- ============================================================
CREATE TABLE public.t_agent_application (
    f_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id      BIGINT      NOT NULL,
    f_apply_type   VARCHAR(32) NOT NULL,
    f_real_name    VARCHAR(64) NOT NULL,
    f_phone        VARCHAR(32) NOT NULL,
    f_wechat_no    VARCHAR(64) NOT NULL DEFAULT '',
    f_introduction TEXT        NOT NULL DEFAULT '',
    f_meta_info    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_status_apply INTEGER     NOT NULL DEFAULT 1,
    f_status_user  INTEGER     NOT NULL DEFAULT 1,
    f_created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_agent_app_user FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_agent_app_stat FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_agent_app_type CHECK (f_apply_type IN ('agent','doctor','partner','hospital'))
);
ALTER TABLE public.t_agent_application ADD COLUMN IF NOT EXISTS f_status_apply INTEGER NOT NULL DEFAULT 1;
COMMENT ON TABLE  public.t_agent_application IS '代理商/合作方申请 (agent / doctor / partner / hospital)';
COMMENT ON COLUMN public.t_agent_application.f_id           IS '主键';
COMMENT ON COLUMN public.t_agent_application.f_user_id      IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 申请人';
COMMENT ON COLUMN public.t_agent_application.f_apply_type   IS '申请类型 (白名单): agent / doctor / partner / hospital';
COMMENT ON COLUMN public.t_agent_application.f_real_name    IS '真实姓名';
COMMENT ON COLUMN public.t_agent_application.f_phone        IS '联系电话';
COMMENT ON COLUMN public.t_agent_application.f_wechat_no    IS '微信号';
COMMENT ON COLUMN public.t_agent_application.f_introduction IS '自我介绍 / 申请说明';
COMMENT ON COLUMN public.t_agent_application.f_meta_info    IS '扩展元数据 (附件/资质材料)';
COMMENT ON COLUMN public.t_agent_application.f_status_apply IS '申请审核态: 1=待审 2=通过 3=拒绝 4=撤回 | 由应用层维护 (非 t_status 外键)';
COMMENT ON COLUMN public.t_agent_application.f_status_user  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_agent_application.f_created_at   IS '申请时间 (UTC)';


-- ============================================================
-- 11.2 代理商提现 / Agent Withdrawal
-- ============================================================
CREATE TABLE public.t_agent_withdrawal (
    f_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id        BIGINT       NOT NULL,
    f_amount         NUMERIC(12,2) NOT NULL,
    f_payment_method VARCHAR(32)  NOT NULL,
    f_payment_account VARCHAR(128) NOT NULL,
    f_payment_name   VARCHAR(64)  NOT NULL,
    f_status_withdraw INTEGER     NOT NULL DEFAULT 1,
    f_status_user    INTEGER      NOT NULL DEFAULT 1,
    f_requested_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_processed_at   TIMESTAMPTZ,
    CONSTRAINT fk_t_wd_user FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_wd_stat FOREIGN KEY (f_status_user)    REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_wd_amount CHECK (f_amount > 0)
);
COMMENT ON TABLE  public.t_agent_withdrawal IS '代理商提现申请';
COMMENT ON COLUMN public.t_agent_withdrawal.f_id               IS '主键';
COMMENT ON COLUMN public.t_agent_withdrawal.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 提现人';
COMMENT ON COLUMN public.t_agent_withdrawal.f_amount           IS '提现金额 (> 0)';
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_method   IS '收款方式, e.g. wechat / alipay / bank';
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_account  IS '收款账号';
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_name     IS '收款人姓名';
COMMENT ON COLUMN public.t_agent_withdrawal.f_status_withdraw  IS '提现审核态: 1=待审 2=通过 3=拒绝 4=已打款 | 由应用层维护';
COMMENT ON COLUMN public.t_agent_withdrawal.f_status_user      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_agent_withdrawal.f_requested_at     IS '申请时间 (UTC)';
COMMENT ON COLUMN public.t_agent_withdrawal.f_processed_at     IS '处理时间 (可空)';


-- ============================================================
-- 11.3 代理商收益 / Agent Revenue
-- ============================================================
CREATE TABLE public.t_agent_revenue (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id          BIGINT       NOT NULL,
    f_revenue_type     VARCHAR(32)  NOT NULL,
    f_order_id         BIGINT,
    f_order_no         VARCHAR(64),
    f_revenue_amount   NUMERIC(12,2) NOT NULL,
    f_commission_rate  NUMERIC(5,4) NOT NULL,
    f_commission_amount NUMERIC(12,2) NOT NULL,
    f_revenue_month    VARCHAR(7)   NOT NULL,
    f_status_settlement INTEGER     NOT NULL DEFAULT -1,
    f_meta_info        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_status_user      INTEGER      NOT NULL DEFAULT 1,
    f_created_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_rev_user FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_rev_stat FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_rev_rate  CHECK (f_commission_rate BETWEEN 0 AND 1),
    CONSTRAINT ck_t_rev_month CHECK (f_revenue_month ~ '^\d{4}-\d{2}$')
);
COMMENT ON TABLE  public.t_agent_revenue IS '代理商收益 (f_status_settlement 与电商共用, 由应用层扩展)';
COMMENT ON COLUMN public.t_agent_revenue.f_id                 IS '主键';
COMMENT ON COLUMN public.t_agent_revenue.f_user_id            IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 收益人';
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_type       IS '收益类型, e.g. order_commission / subscription_share';
COMMENT ON COLUMN public.t_agent_revenue.f_order_id           IS '弱引用: 订单 ID (in t_order, 09_ecommerce.sql) | 可空 (非订单来源)';
COMMENT ON COLUMN public.t_agent_revenue.f_order_no           IS '订单号 (冗余) | 弱引用: t_order.f_order_no (in 09_ecommerce.sql)';
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_amount     IS '订单金额 (基数)';
COMMENT ON COLUMN public.t_agent_revenue.f_commission_rate    IS '佣金比例 (0-1) | CHECK: BETWEEN 0 AND 1';
COMMENT ON COLUMN public.t_agent_revenue.f_commission_amount  IS '佣金金额 (派生: revenue_amount * rate)';
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_month      IS '收益月份 YYYY-MM | 索引/汇总键';
COMMENT ON COLUMN public.t_agent_revenue.f_status_settlement  IS '结算态: 1=待结算 2=已结算 3=已提现 | 由应用层维护';
COMMENT ON COLUMN public.t_agent_revenue.f_meta_info          IS '扩展元数据';
COMMENT ON COLUMN public.t_agent_revenue.f_status_user        IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_agent_revenue.f_created_at         IS '收益时间 (UTC)';
