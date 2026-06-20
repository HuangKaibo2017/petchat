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
--   1. t_agent 是代理商实体表 (自然人/机构); 与 t_user 关联但不强依赖
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
    CONSTRAINT ck_t_agent_phone  CHECK (f_phone = '' OR f_phone ~ '^[0-9+\-\s()]{5,32}$'),
    CONSTRAINT ck_t_agent_email  CHECK (f_email = '' OR f_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT ck_t_agent_del    CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_agent_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_agent IS '代理商/合作方实体 (自然人/机构); 联系方式和基本信息统一在此维护';
COMMENT ON COLUMN public.t_agent.f_id            IS '主键 | 引用方: t_agent_application.f_agent_id (本文件), t_agent_withdrawal.f_agent_id, t_agent_revenue.f_agent_id';
COMMENT ON COLUMN public.t_agent.f_public_uid    IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_agent.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 关联平台账号 (可空: 代理商未注册时为空) | ON DELETE SET NULL';
COMMENT ON COLUMN public.t_agent.f_agent_type    IS '代理商类型 (白名单): person=自然人 / company=公司 / institution=机构/组织 / individual_biz=个体工商户';
COMMENT ON COLUMN public.t_agent.f_real_name     IS '真实姓名 / 法人姓名 (1-64 字符)';
COMMENT ON COLUMN public.t_agent.f_company_name  IS '公司/机构名称 (自然人可空字符串)';
COMMENT ON COLUMN public.t_agent.f_phone         IS '联系电话 (格式: ^[0-9+\-\s()]{5,32}$)';
COMMENT ON COLUMN public.t_agent.f_wechat_no     IS '微信号';
COMMENT ON COLUMN public.t_agent.f_email         IS '联系邮箱';
COMMENT ON COLUMN public.t_agent.f_region        IS '所在地区 (省/市/区)';
COMMENT ON COLUMN public.t_agent.f_introduction  IS '代理商简介 / 资质说明';
COMMENT ON COLUMN public.t_agent.f_meta_info     IS '扩展元数据 (营业执照/资质材料 URL 等)';
COMMENT ON COLUMN public.t_agent.f_deleted       IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_agent.f_created_at    IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_agent.f_updated_at    IS '更新时间 (UTC), 由 trigger 维护';
CREATE INDEX idx_t_agent_user    ON public.t_agent(f_user_id) WHERE f_user_id IS NOT NULL;
CREATE INDEX idx_t_agent_active  ON public.t_agent(f_agent_type) WHERE f_deleted = 0;


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
);
COMMENT ON TABLE  public.t_agent_application IS '代理商/合作方申请 (agent / doctor / partner / hospital); 聚焦合作协议条款和可量化指标';
COMMENT ON COLUMN public.t_agent_application.f_id                IS '主键';
COMMENT ON COLUMN public.t_agent_application.f_agent_id          IS 'FK -> public.t_agent(f_id) | defined in 11_agent.sql | 申请方代理商实体';
COMMENT ON COLUMN public.t_agent_application.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 提交申请的平台用户';
COMMENT ON COLUMN public.t_agent_application.f_apply_type        IS '申请类型 (白名单): agent / doctor / partner / hospital';
COMMENT ON COLUMN public.t_agent_application.f_cooperation_scope IS '合作范围说明 (文本)';
COMMENT ON COLUMN public.t_agent_application.f_territory         IS '代理区域 (省/市/区, 文本)';
COMMENT ON COLUMN public.t_agent_application.f_contract_start    IS '合同开始日期 (可空) | 约束: <= f_contract_end';
COMMENT ON COLUMN public.t_agent_application.f_contract_end      IS '合同结束日期 (可空) | 约束: >= f_contract_start';
COMMENT ON COLUMN public.t_agent_application.f_target_gmv        IS '合作目标 GMV (可空, 单位: 元)';
COMMENT ON COLUMN public.t_agent_application.f_target_users      IS '合作目标新增用户数 (可空)';
COMMENT ON COLUMN public.t_agent_application.f_commission_rate   IS '佣金比例 (0-1) | CHECK: BETWEEN 0 AND 1';
COMMENT ON COLUMN public.t_agent_application.f_min_deposit       IS '最低保证金/押金 (可空, 单位: 元)';
COMMENT ON COLUMN public.t_agent_application.f_attachment_urls   IS '附件/资质材料 URL JSONB 数组';
COMMENT ON COLUMN public.t_agent_application.f_review_comment    IS '审核意见 (通过/拒绝时填写)';
COMMENT ON COLUMN public.t_agent_application.f_meta_info         IS '扩展元数据';
COMMENT ON COLUMN public.t_agent_application.f_status_apply      IS '申请审核态: 1=待审 2=通过 3=拒绝 4=撤回 | 由应用层维护 (非 t_status 外键)';
COMMENT ON COLUMN public.t_agent_application.f_deleted           IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_agent_application.f_created_at        IS '申请时间 (UTC)';
CREATE INDEX idx_t_agent_app_agent  ON public.t_agent_application(f_agent_id);
CREATE INDEX idx_t_agent_app_user   ON public.t_agent_application(f_user_id);
CREATE INDEX idx_t_agent_app_status ON public.t_agent_application(f_status_apply) WHERE f_deleted = 0;


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
);
COMMENT ON TABLE  public.t_agent_withdrawal IS '代理商提现申请';
COMMENT ON COLUMN public.t_agent_withdrawal.f_id               IS '主键';
COMMENT ON COLUMN public.t_agent_withdrawal.f_agent_id         IS 'FK -> public.t_agent(f_id) | defined in 11_agent.sql | 提现代理商实体';
COMMENT ON COLUMN public.t_agent_withdrawal.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 提现操作人';
COMMENT ON COLUMN public.t_agent_withdrawal.f_amount           IS '提现金额 (> 0)';
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_method   IS '收款方式, e.g. wechat / alipay / bank';
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_account  IS '收款账号';
COMMENT ON COLUMN public.t_agent_withdrawal.f_payment_name     IS '收款人姓名';
COMMENT ON COLUMN public.t_agent_withdrawal.f_status_withdraw  IS '提现审核态: 1=待审 2=通过 3=拒绝 4=已打款 | 由应用层维护';
COMMENT ON COLUMN public.t_agent_withdrawal.f_deleted          IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_agent_withdrawal.f_requested_at     IS '申请时间 (UTC)';
COMMENT ON COLUMN public.t_agent_withdrawal.f_processed_at     IS '处理时间 (可空)';
CREATE INDEX idx_t_agent_wd_agent ON public.t_agent_withdrawal(f_agent_id);


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
    CONSTRAINT ck_t_rev_month CHECK (f_revenue_month ~ '^\d{4}-\d{2}$'),
    CONSTRAINT ck_t_rev_del   CHECK (f_deleted IN (0, 1))
);
COMMENT ON TABLE  public.t_agent_revenue IS '代理商收益 (f_status_settlement 由应用层扩展)';
COMMENT ON COLUMN public.t_agent_revenue.f_id                 IS '主键';
COMMENT ON COLUMN public.t_agent_revenue.f_agent_id           IS 'FK -> public.t_agent(f_id) | defined in 11_agent.sql | 收益代理商实体';
COMMENT ON COLUMN public.t_agent_revenue.f_user_id            IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 收益归属用户';
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_type       IS '收益类型, e.g. order_commission / subscription_share';
COMMENT ON COLUMN public.t_agent_revenue.f_order_id           IS '弱引用: 订单 ID (in t_order, 09_ecommerce.sql) | 可空 (非订单来源)';
COMMENT ON COLUMN public.t_agent_revenue.f_order_no           IS '订单号 (冗余) | 弱引用: t_order.f_order_no (in 09_ecommerce.sql)';
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_amount     IS '订单金额 (基数)';
COMMENT ON COLUMN public.t_agent_revenue.f_commission_rate    IS '佣金比例 (0-1) | CHECK: BETWEEN 0 AND 1';
COMMENT ON COLUMN public.t_agent_revenue.f_commission_amount  IS '佣金金额 (派生: revenue_amount * rate)';
COMMENT ON COLUMN public.t_agent_revenue.f_revenue_month      IS '收益月份 YYYY-MM | 索引/汇总键';
COMMENT ON COLUMN public.t_agent_revenue.f_status_settlement  IS '结算态: 1=待结算 2=已结算 3=已提现 | 由应用层维护';
COMMENT ON COLUMN public.t_agent_revenue.f_meta_info          IS '扩展元数据';
COMMENT ON COLUMN public.t_agent_revenue.f_deleted            IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_agent_revenue.f_created_at         IS '收益时间 (UTC)';
CREATE INDEX idx_t_agent_rev_agent ON public.t_agent_revenue(f_agent_id, f_revenue_month);
