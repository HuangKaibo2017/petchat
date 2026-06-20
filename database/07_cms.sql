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
);
COMMENT ON TABLE  public.t_banner IS '首页 Banner 轮播';
COMMENT ON COLUMN public.t_banner.f_id           IS '主键';
COMMENT ON COLUMN public.t_banner.f_lang         IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';
COMMENT ON COLUMN public.t_banner.f_title        IS 'Banner 标题';
COMMENT ON COLUMN public.t_banner.f_description  IS 'Banner 描述';
COMMENT ON COLUMN public.t_banner.f_image_url    IS 'Banner 图片 URL';
COMMENT ON COLUMN public.t_banner.f_link_type_id IS 'FK -> public.t_banner_type(f_id) | defined in 01_enums.sql | 跳转目标类型 (product/activity/subscription/external/page/none)';
COMMENT ON COLUMN public.t_banner.f_link_url     IS '跳转 URL 或内部路径 (具体语义由 f_link_type_id 决定)';
COMMENT ON COLUMN public.t_banner.f_order        IS '排序权重 (小→前)';
COMMENT ON COLUMN public.t_banner.f_starts_at    IS '曝光开始时间 (可空 = 立即生效)';
COMMENT ON COLUMN public.t_banner.f_ends_at      IS '曝光结束时间 (可空 = 长期)';
COMMENT ON COLUMN public.t_banner.f_deleted      IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_banner.f_created_at   IS '创建时间 (UTC)';


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
);
COMMENT ON TABLE  public.t_activity IS '运营活动 (送养/讲座/志愿者/...)';
COMMENT ON COLUMN public.t_activity.f_id               IS '主键 | 引用方: t_landing_page.f_activity_id (本文件, CASCADE) | 弱引用: t_donation.f_target_id (in 13_welfare.sql, f_target_type=activity)';
COMMENT ON COLUMN public.t_activity.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_activity.f_lang             IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';
COMMENT ON COLUMN public.t_activity.f_title            IS '活动标题';
COMMENT ON COLUMN public.t_activity.f_description      IS '活动描述';
COMMENT ON COLUMN public.t_activity.f_cover_image_url  IS '封面图 URL';
COMMENT ON COLUMN public.t_activity.f_activity_type_id IS 'FK -> public.t_activity_type(f_id) | defined in 01_enums.sql | 活动类型';
COMMENT ON COLUMN public.t_activity.f_start_time       IS '活动开始时间 (UTC) | 约束: < f_end_time';
COMMENT ON COLUMN public.t_activity.f_end_time         IS '活动结束时间 (UTC)';
COMMENT ON COLUMN public.t_activity.f_location         IS '活动地点 (线下) 或直播间 (线上)';
COMMENT ON COLUMN public.t_activity.f_max_participants IS '最大参与人数 (NULL = 不限)';
COMMENT ON COLUMN public.t_activity.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_activity.f_deleted          IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_activity.f_created_at       IS '创建时间 (UTC)';


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
);
COMMENT ON TABLE  public.t_landing_page IS '活动落地页 (活动的强子表, 活动删除时级联删除)';
COMMENT ON COLUMN public.t_landing_page.f_id              IS '主键';
COMMENT ON COLUMN public.t_landing_page.f_public_uid      IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_landing_page.f_activity_id     IS 'FK -> public.t_activity(f_id) | defined in 07_cms.sql | ON DELETE CASCADE';
COMMENT ON COLUMN public.t_landing_page.f_lang            IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';
COMMENT ON COLUMN public.t_landing_page.f_title           IS '落地页主标题';
COMMENT ON COLUMN public.t_landing_page.f_subtitle        IS '落地页副标题';
COMMENT ON COLUMN public.t_landing_page.f_cover_image_url IS '落地页封面图 URL';
COMMENT ON COLUMN public.t_landing_page.f_cta_text        IS 'CTA 按钮文字, e.g. 立即报名';
COMMENT ON COLUMN public.t_landing_page.f_cta_url         IS 'CTA 按钮跳转 URL';
COMMENT ON COLUMN public.t_landing_page.f_deleted         IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_landing_page.f_created_at      IS '创建时间 (UTC)';
