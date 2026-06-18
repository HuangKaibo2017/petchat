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
    f_is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uk_t_sys_role_name UNIQUE (f_name)
);
COMMENT ON TABLE  public.t_sys_role IS '平台角色 (非 i18n, 系统内部用, e.g. user/agent/admin/ops/super_admin)';
COMMENT ON COLUMN public.t_sys_role.f_id        IS '主键 | 引用方: t_user_role.f_role_id, t_role_api.f_role_id (本文件内)';
COMMENT ON COLUMN public.t_sys_role.f_name      IS '角色名, e.g. user / agent / admin / super_admin | UNIQUE';
COMMENT ON COLUMN public.t_sys_role.f_desc      IS '角色说明';
COMMENT ON COLUMN public.t_sys_role.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_sys_role.f_is_active IS '启用开关';


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
    f_is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uk_t_api_method_endpoint UNIQUE (f_method, f_endpoint),
    CONSTRAINT ck_t_api_method CHECK (f_method IN ('GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'))
);
COMMENT ON TABLE  public.t_api IS '平台 API 端点注册表 (用于 RBAC 授权)';
COMMENT ON COLUMN public.t_api.f_id        IS '主键 | 引用方: t_role_api.f_api_id (本文件内)';
COMMENT ON COLUMN public.t_api.f_name      IS '端点名称, e.g. 用户登录 / 创建订单';
COMMENT ON COLUMN public.t_api.f_method    IS 'HTTP 方法, e.g. GET / POST';
COMMENT ON COLUMN public.t_api.f_endpoint  IS '端点路径, e.g. /api/v1/auth/login';
COMMENT ON COLUMN public.t_api.f_desc      IS '端点说明';
COMMENT ON COLUMN public.t_api.f_order     IS '排序权重';
COMMENT ON COLUMN public.t_api.f_is_active IS '启用开关';


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
);
COMMENT ON TABLE  public.t_role_api IS '角色-API 授权关联表 (复合 PK)';
COMMENT ON COLUMN public.t_role_api.f_role_id    IS 'FK -> public.t_sys_role(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_role_api.f_api_id     IS 'FK -> public.t_api(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_role_api.f_is_enabled IS '是否启用该授权 (false 即禁用, 保留历史)';


-- ============================================================
-- 2.4 用户 / User
-- ============================================================
CREATE TABLE public.t_user (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_id       UUID        NOT NULL DEFAULT rpc_gen_uuid(),
    f_lang            VARCHAR(8)  NOT NULL DEFAULT 'zh-CN',
    f_nickname        VARCHAR(64) NOT NULL,
    f_avatar_url      VARCHAR(512) NOT NULL DEFAULT '',
    f_phone           VARCHAR(32)  NOT NULL DEFAULT '',
    f_email           VARCHAR(128) NOT NULL DEFAULT '',
    f_password_hash   VARCHAR(256) NOT NULL DEFAULT '',
    f_status_user     INTEGER     NOT NULL DEFAULT 1,
    f_meta_info       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_user_lang       FOREIGN KEY (f_lang)        REFERENCES public.t_lang(f_code)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_user_status     FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id)          ON DELETE NO ACTION,
    CONSTRAINT ck_t_user_nickname   CHECK (length(f_nickname) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_user_phone      CHECK (f_phone = '' OR f_phone ~ '^[0-9+\-\s()]{5,32}$'),
    CONSTRAINT ck_t_user_email      CHECK (f_email = '' OR f_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT ck_t_user_meta_object CHECK (jsonb_typeof(f_meta_info) = 'object')
);
-- 确保 f_public_id DEFAULT 已设置 (修复旧表无 DEFAULT 问题)
ALTER TABLE public.t_user ALTER COLUMN f_public_id SET DEFAULT rpc_gen_uuid();
COMMENT ON TABLE  public.t_user IS '平台用户主表 (f_public_id 对外暴露, BIGINT 仅内部)';
COMMENT ON COLUMN public.t_user.f_id            IS '主键 (内部使用) | 引用方: 几乎所有业务表 f_user_id';
COMMENT ON COLUMN public.t_user.f_public_id     IS '对外暴露 UUID, 由 rpc/rpc_gen_uuid.sql 生成';
COMMENT ON COLUMN public.t_user.f_lang          IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 用户界面默认语言';
COMMENT ON COLUMN public.t_user.f_nickname      IS '昵称, 1-64 字符';
COMMENT ON COLUMN public.t_user.f_avatar_url    IS '头像 URL (空 = 默认头像)';
COMMENT ON COLUMN public.t_user.f_phone         IS '手机号 (空字符串表示未填, 部分唯一索引见 99_indexes_views.sql)';
COMMENT ON COLUMN public.t_user.f_email         IS '邮箱 (空字符串表示未填, 部分唯一索引见 99_indexes_views.sql)';
COMMENT ON COLUMN public.t_user.f_password_hash IS '密码哈希 (argon2id / bcrypt, 不存明文)';
COMMENT ON COLUMN public.t_user.f_status_user   IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 1=active 2=disabled 3=deleted 4=archived 5=pending';
COMMENT ON COLUMN public.t_user.f_meta_info     IS '扩展元数据, 存 is_anonymous / role / 偏好设置等; 匿名捐款哨兵 f_id=-1 通过 f_meta_info.role=anonymous 标识';
COMMENT ON COLUMN public.t_user.f_created_at    IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_user.f_updated_at    IS '更新时间 (UTC), 由 trigger 维护';

-- 清理重复手机/邮箱 (保留最早创建的记录)
DELETE FROM public.t_user a
USING public.t_user b
WHERE a.f_id > b.f_id AND a.f_phone = b.f_phone AND a.f_phone <> '';
DELETE FROM public.t_user a
USING public.t_user b
WHERE a.f_id > b.f_id AND a.f_email = b.f_email AND a.f_email <> '';

-- 部分唯一索引 (排除空字符串)
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_user_phone ON public.t_user(f_phone) WHERE f_phone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_user_email ON public.t_user(f_email) WHERE f_email <> '';
CREATE INDEX IF NOT EXISTS idx_t_user_phone_active ON public.t_user(f_phone) WHERE f_status_user = 1;
CREATE INDEX IF NOT EXISTS idx_t_user_email_active ON public.t_user(f_email) WHERE f_status_user = 1;


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
);
COMMENT ON TABLE  public.t_user_role IS '用户-角色 多对多绑定 (复合 PK)';
COMMENT ON COLUMN public.t_user_role.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_user_role.f_role_id     IS 'FK -> public.t_sys_role(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_user_role.f_assigned_at IS '授权时间 (UTC)';
