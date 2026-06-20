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
--      原因: BI 回填时 UPDATE, 强 FK 会阻碍; 上报期间可为 NULL
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
);
COMMENT ON TABLE  public.t_ab_domain IS 'AB 实验所属域 (enum, 互斥靠算法 f_max_concurrent + hash, 不靠 layer 表)';
COMMENT ON COLUMN public.t_ab_domain.f_id             IS '主键 (内部, enum 表不对外暴露单条记录)';
COMMENT ON COLUMN public.t_ab_domain.f_code           IS '业务代码, UPPERCASE: PROMPT / FEATURE / SKIN / AD / SUBSCRIPTION | UNIQUE';
COMMENT ON COLUMN public.t_ab_domain.f_name           IS '人类可读名';
COMMENT ON COLUMN public.t_ab_domain.f_desc           IS '描述';
COMMENT ON COLUMN public.t_ab_domain.f_max_concurrent IS '同 t_ab_domain 内互斥上限 (默认 1)';
COMMENT ON COLUMN public.t_ab_domain.f_status_id      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';
COMMENT ON COLUMN public.t_ab_domain.f_created_at     IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_ab_domain.f_updated_at     IS '更新时间 (UTC)';


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
);
COMMENT ON TABLE  public.t_ab_status IS 'AB 实验状态 enum (替代 VARCHAR + CHECK, 可按需扩展)';
COMMENT ON COLUMN public.t_ab_status.f_id      IS '主键; 哨兵: -1=NOT-SET; 业务约定: 1=DRAFT / 10=RUNNING / 15=PAUSED / 20=DELETED / 30=COMPLETED / 40=KILLED';
COMMENT ON COLUMN public.t_ab_status.f_code    IS '业务语义代码, e.g. DRAFT / RUNNING | UNIQUE';
COMMENT ON COLUMN public.t_ab_status.f_name    IS '多语言名称 | 引用方: t_ab.f_status_ab_id (本文件)';
COMMENT ON COLUMN public.t_ab_status.f_desc    IS '多语言描述';
COMMENT ON COLUMN public.t_ab_status.f_order   IS '排序权重';
COMMENT ON COLUMN public.t_ab_status.f_deleted IS '启用开关';


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
);
COMMENT ON TABLE  public.t_ab_event IS 'AB 事件 enum (双角色: 无业务含义原始交互 + 有业务含义 BI 回填)';
COMMENT ON COLUMN public.t_ab_event.f_event_id   IS '主键';
COMMENT ON COLUMN public.t_ab_event.f_type       IS '事件大类; 约定值: 无业务含义: IMPRESSION / CLICK / SCROLL / SWIPE; 有业务含义: CONVERT / BUSINESS';
COMMENT ON COLUMN public.t_ab_event.f_name       IS '事件名 (UPPERCASE, UNIQUE), e.g. PAGE_VIEW / BUTTON_CLICK / PROMPT_LIKED';
COMMENT ON COLUMN public.t_ab_event.f_desc       IS '描述 (含角色说明)';
COMMENT ON COLUMN public.t_ab_event.f_ver        IS '版本号, 默认 100 (软删除 + 兼容多版本共存) | CHECK: >= 1';
COMMENT ON COLUMN public.t_ab_event.f_status_id  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';
COMMENT ON COLUMN public.t_ab_event.f_created_at IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_ab_event.f_updated_at IS '更新时间 (UTC)';


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
);
COMMENT ON TABLE  public.t_ab IS 'AB 实验主表';
COMMENT ON COLUMN public.t_ab.f_id                IS '主键 (内部) | 引用方: t_ab_variant.f_ab_id, t_ab_assignment.f_ab_id (本文件, CASCADE)';
COMMENT ON COLUMN public.t_ab.f_publish_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成 (API 返回这个)';
COMMENT ON COLUMN public.t_ab.f_code              IS '实验代码 (UPPERCASE, 同 f_domain_id 唯一) | UNIQUE (f_domain_id, f_code)';
COMMENT ON COLUMN public.t_ab.f_name              IS '实验显示名 (简单字符串, 不做 i18n)';
COMMENT ON COLUMN public.t_ab.f_domain_id         IS 'FK -> public.t_ab_domain(f_id) | defined in 50_ab.sql | 所属域 (软外键, NO ACTION)';
COMMENT ON COLUMN public.t_ab.f_status_ab_id      IS 'FK -> public.t_ab_status(f_id) | defined in 50_ab.sql | 实验状态: -1=NOT-SET / 1=DRAFT / 10=RUNNING / 15=PAUSED / 20=DELETED / 30=COMPLETED / 40=KILLED';
COMMENT ON COLUMN public.t_ab.f_traffic_pct       IS '流量比例 1-100 (CHECK)';
COMMENT ON COLUMN public.t_ab.f_target_user_ids   IS '圈定用户 ID 集合 (启动实验时生成)';
COMMENT ON COLUMN public.t_ab.f_target_rule       IS '定向规则 JSONB (含 tags / countries / platforms / custom_sql)';
COMMENT ON COLUMN public.t_ab.f_primary_metric    IS '主指标名';
COMMENT ON COLUMN public.t_ab.f_guardrail_metrics IS '保护指标 JSONB 数组';
COMMENT ON COLUMN public.t_ab.f_starts_at         IS '实验开始时间 (UTC, 可空)';
COMMENT ON COLUMN public.t_ab.f_ends_at           IS '实验结束时间 (UTC, 可空)';
COMMENT ON COLUMN public.t_ab.f_owner_team        IS '负责团队';
COMMENT ON COLUMN public.t_ab.f_desc              IS '实验描述';
COMMENT ON COLUMN public.t_ab.f_created_at        IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_ab.f_updated_at        IS '更新时间 (UTC)';


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
);
COMMENT ON TABLE  public.t_ab_variant IS 'AB 实验变体 (一个实验多个 variant, 权重总和=100)';
COMMENT ON COLUMN public.t_ab_variant.f_id         IS '主键 | 引用方: t_ab_assignment.f_variant_id (本文件, CASCADE)';
COMMENT ON COLUMN public.t_ab_variant.f_ab_id      IS 'FK -> public.t_ab(f_id) | defined in 50_ab.sql | 关联实验 (ON DELETE CASCADE)';
COMMENT ON COLUMN public.t_ab_variant.f_code       IS '变体代码 (UPPERCASE: CONTROL / VARIANT_A / ...) | UNIQUE (f_ab_id, f_code)';
COMMENT ON COLUMN public.t_ab_variant.f_name       IS '变体名';
COMMENT ON COLUMN public.t_ab_variant.f_weight     IS '权重 (同实验总和=100)';
COMMENT ON COLUMN public.t_ab_variant.f_config     IS '变体业务配置 JSONB, e.g. {"prompt_code": "AI_REPORT_EMOTION_ANALYZE_V3", "temperature": 0.7}';
COMMENT ON COLUMN public.t_ab_variant.f_desc       IS '描述';
COMMENT ON COLUMN public.t_ab_variant.f_status_id  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';
COMMENT ON COLUMN public.t_ab_variant.f_created_at IS '创建时间 (UTC)';


-- ============================================================
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
);
COMMENT ON TABLE  public.t_ab_assignment IS 'AB 用户分组记录 (f_user_id 与 f_anonymous_id 二选一非空, 见 CHECK)';
COMMENT ON COLUMN public.t_ab_assignment.f_id            IS '主键 (内部)';
COMMENT ON COLUMN public.t_ab_assignment.f_publish_uid   IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_ab_assignment.f_ab_id         IS 'FK -> public.t_ab(f_id) | defined in 50_ab.sql | 关联实验 (CASCADE)';
COMMENT ON COLUMN public.t_ab_assignment.f_variant_id    IS 'FK -> public.t_ab_variant(f_id) | defined in 50_ab.sql | 关联变体 (CASCADE)';
COMMENT ON COLUMN public.t_ab_assignment.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 登录用户, 可空 (匿名); ON DELETE SET NULL (保历史)';
COMMENT ON COLUMN public.t_ab_assignment.f_anonymous_id  IS '匿名 UUID, 可空 (登录后置 NULL); 由前端 generateAnonymousId() 生成 (见 v0.7 §7.4)';
COMMENT ON COLUMN public.t_ab_assignment.f_assigned_at   IS '分配时间 (UTC)';
COMMENT ON COLUMN public.t_ab_assignment.f_status_id     IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';
-- 部分唯一索引: 同一实验内, 登录用户唯一 / 匿名用户唯一
CREATE UNIQUE INDEX uk_t_assign_ab_user ON public.t_ab_assignment(f_ab_id, f_user_id)      WHERE f_user_id      IS NOT NULL;
CREATE UNIQUE INDEX uk_t_assign_ab_anon ON public.t_ab_assignment(f_ab_id, f_anonymous_id) WHERE f_anonymous_id IS NOT NULL;
CREATE INDEX idx_t_assign_user ON public.t_ab_assignment(f_user_id, f_ab_id)      WHERE f_user_id      IS NOT NULL;
CREATE INDEX idx_t_assign_anon ON public.t_ab_assignment(f_anonymous_id, f_ab_id) WHERE f_anonymous_id IS NOT NULL;


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
);
COMMENT ON TABLE  public.t_ab_footprint IS 'AB 用户行为跟踪 (append-only, 客户端 SDK 上报 + BI 异步回填)';
COMMENT ON COLUMN public.t_ab_footprint.f_id            IS '主键';
COMMENT ON COLUMN public.t_ab_footprint.f_event_id      IS '软外键 -> public.t_ab_event(f_event_id) | 上报时: 填无业务含义原始事件; BI 回填后: 替换为有业务含义事件; 可为 NULL';
COMMENT ON COLUMN public.t_ab_footprint.f_assignment_id IS '软外键 -> public.t_ab_assignment(f_id) | BI 异步回填; 客户端上报时为 NULL; 空悬保留原值有分析价值';
COMMENT ON COLUMN public.t_ab_footprint.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 登录用户, 可空 (NO ACTION)';
COMMENT ON COLUMN public.t_ab_footprint.f_anonymous_id  IS '匿名 UUID, 可空 (无 FK)';
COMMENT ON COLUMN public.t_ab_footprint.f_url           IS '用户当前 URL (TEXT 兼容长 URL + query) | 来自 window.location.href';
COMMENT ON COLUMN public.t_ab_footprint.f_backend_api   IS '该行为触发的后端 API 路径, e.g. POST /api/v1/report/regenerate';
COMMENT ON COLUMN public.t_ab_footprint.f_os            IS '客户端系统 (来自 X-Platform header) | ANDROID / IOS / H5 / MP_WECHAT';
COMMENT ON COLUMN public.t_ab_footprint.f_device        IS '设备型号, e.g. iPhone15,2 / Pixel 8';
COMMENT ON COLUMN public.t_ab_footprint.f_browser       IS '浏览器类型/版本, e.g. Chrome 120 / Safari 17 (H5 端)';
COMMENT ON COLUMN public.t_ab_footprint.f_ip_address    IS '用户 IP (VARCHAR(45) 兼容 IPv4/IPv6) | 反作弊 + 地域分析';
COMMENT ON COLUMN public.t_ab_footprint.f_app_version   IS 'APP 构建号 (来自 X-App-Version header), e.g. 4.2.1.1234';
COMMENT ON COLUMN public.t_ab_footprint.f_session_id    IS '客户端会话 ID (用于漏斗分析)';
COMMENT ON COLUMN public.t_ab_footprint.f_context       IS 'JSONB 扩展 (按钮文本 / 元素 ID / AB 实验上下文 / 脱敏用户输入)';
COMMENT ON COLUMN public.t_ab_footprint.f_occurred_at   IS '发生时间 (UTC, 客户端传)';


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
);
COMMENT ON TABLE  public.t_user_tag IS '用户标签 (AB 定向: tags / 二次过滤)';
COMMENT ON COLUMN public.t_user_tag.f_id         IS '主键';
COMMENT ON COLUMN public.t_user_tag.f_user_id    IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | ON DELETE CASCADE (用户删 -> 标签删)';
COMMENT ON COLUMN public.t_user_tag.f_tag        IS '标签名';
COMMENT ON COLUMN public.t_user_tag.f_tag_value  IS '标签值';
COMMENT ON COLUMN public.t_user_tag.f_source     IS '来源; 约定值: SYSTEM / MANUAL / IMPORTED / ML_INFERRED / AB_TEST (可扩展, 不用 CHECK 锁死)';
COMMENT ON COLUMN public.t_user_tag.f_weight     IS '权重 (0-1, 默认 1.0)';
COMMENT ON COLUMN public.t_user_tag.f_expires_at IS '过期时间 (可空)';
COMMENT ON COLUMN public.t_user_tag.f_status_id  IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';
COMMENT ON COLUMN public.t_user_tag.f_created_at IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_user_tag.f_updated_at IS '更新时间 (UTC)';
CREATE INDEX idx_t_user_tag_tag ON public.t_user_tag(f_tag);


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
);
COMMENT ON TABLE  public.t_ab_user_skin IS 'SKIN 域 AB override (系统自动 / 运营手工, 优先级 3, 详见 v0.7 §9)';
COMMENT ON COLUMN public.t_ab_user_skin.f_id          IS '主键';
COMMENT ON COLUMN public.t_ab_user_skin.f_publish_uid IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_ab_user_skin.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | ON DELETE CASCADE';
COMMENT ON COLUMN public.t_ab_user_skin.f_pref_code   IS '偏好项, e.g. "skin_code"';
COMMENT ON COLUMN public.t_ab_user_skin.f_pref_value  IS '偏好值 (TEXT)';
COMMENT ON COLUMN public.t_ab_user_skin.f_reason      IS '备注';
COMMENT ON COLUMN public.t_ab_user_skin.f_source      IS '来源; 约定值: SYSTEM / ADMIN / USER_TRIAL_ACCEPT / USER_TRIAL_REJECT (可扩展)';
COMMENT ON COLUMN public.t_ab_user_skin.f_expires_at  IS '过期时间 (可空, e.g. 试用 7 天)';
COMMENT ON COLUMN public.t_ab_user_skin.f_status_id   IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删除';
COMMENT ON COLUMN public.t_ab_user_skin.f_meta_info   IS '扩展 JSONB, e.g. {"trial_count": 3, "last_reject_at": "2026-06-19T10:00:00Z"}';
COMMENT ON COLUMN public.t_ab_user_skin.f_created_at  IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_ab_user_skin.f_updated_at  IS '更新时间 (UTC)';


-- ============================================================
-- 50 文件结束
-- ============================================================
-- 至此 50_ab.sql 全部 DDL 部署完成; 接下来执行:
--   - database/init/db_init.sql  (初始化 enum 数据: t_ab_domain / t_ab_status / t_ab_event)
--   - 应用层 API 接入 (/api/v1/ab/resolve + /api/v1/ab/event)
-- ============================================================
