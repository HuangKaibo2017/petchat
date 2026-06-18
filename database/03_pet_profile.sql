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
--   1. 三种出生精度: 精确日 (f_birth_date) 优先; 否则仅年 (f_birth_year); 可选月 (f_birth_month)
--   2. 软删除通过 f_status_user = 3 (引用 t_status)
--   3. 业务态 f_status_pet: 1=在册 2=走失 3=已送养 4=已故 5=已归档 (引用 t_status 复用, 业务值由应用层约定)
--   4. 个性标签 f_personality_tags 用 JSONB 数组 (太多无法穷举), 枚举表 t_personality_tag 仅作参考
-- ============================================================


-- ============================================================
-- 3.1 宠物主表 / Pet
-- ============================================================
CREATE TABLE public.t_pet (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id       BIGINT      NOT NULL,
    f_lang          VARCHAR(8)  NOT NULL DEFAULT 'zh-CN',
    f_pet_type_id   INTEGER     NOT NULL,
    f_breed_id      INTEGER,
    f_name          VARCHAR(64) NOT NULL,
    f_gender_id     INTEGER NOT NULL DEFAULT -1,
    f_birth_date    DATE,
    f_birth_year    INTEGER,
    f_birth_month   INTEGER,
    f_weight        NUMERIC(6,2),
    f_sterilized    BOOLEAN     NOT NULL DEFAULT false,
    f_vaccinated    BOOLEAN     NOT NULL DEFAULT false,
    f_status_pet    INTEGER     NOT NULL DEFAULT 1,
    f_status_user   INTEGER     NOT NULL DEFAULT 1,
    f_personality_tags JSONB    NOT NULL DEFAULT '[]'::jsonb,
    f_meta_info     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_pet_user        FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_lang        FOREIGN KEY (f_lang)         REFERENCES public.t_lang(f_code)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_type        FOREIGN KEY (f_pet_type_id)  REFERENCES public.t_pet_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_breed       FOREIGN KEY (f_breed_id)     REFERENCES public.t_pet_breed(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_gender      FOREIGN KEY (f_gender_id)    REFERENCES public.t_gender(f_id)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_status_pet  FOREIGN KEY (f_status_pet)   REFERENCES public.t_status(f_id)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_status_user FOREIGN KEY (f_status_user)  REFERENCES public.t_status(f_id)    ON DELETE NO ACTION,
    CONSTRAINT ck_t_pet_name        CHECK (length(f_name) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_pet_birth_info  CHECK (f_birth_date IS NOT NULL OR f_birth_year IS NOT NULL),
    CONSTRAINT ck_t_pet_birth_year  CHECK (f_birth_year  IS NULL OR (f_birth_year  BETWEEN 1980 AND 2100)),
    CONSTRAINT ck_t_pet_birth_month CHECK (f_birth_month IS NULL OR (f_birth_month BETWEEN 1 AND 12)),
    CONSTRAINT ck_t_pet_weight      CHECK (f_weight IS NULL OR (f_weight > 0 AND f_weight < 1000)),
    CONSTRAINT ck_t_pet_personality_array CHECK (jsonb_typeof(f_personality_tags) = 'array')
);
COMMENT ON TABLE  public.t_pet IS '宠物主表';
COMMENT ON COLUMN public.t_pet.f_id               IS '主键 | 引用方: t_pet_photo.f_pet_id (本文件) / t_chat_history.f_pet_id (in 05_chat_comments.sql) / t_report_emotion.f_pet_id, t_report_health.f_pet_id, t_report_hpr.f_pet_id, t_report_pers.f_pet_id (in 04_ai_reports.sql) / t_appointment.f_pet_id (in 12_healthcare.sql) / t_adoption.f_pet_id, t_record_lost_pet.f_pet_id (in 13_welfare.sql)';
COMMENT ON COLUMN public.t_pet.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 宠物主人';
COMMENT ON COLUMN public.t_pet.f_lang             IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 宠物档案主语言';
COMMENT ON COLUMN public.t_pet.f_pet_type_id      IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 必填, 不可空';
COMMENT ON COLUMN public.t_pet.f_breed_id         IS 'FK -> public.t_pet_breed(f_id) | defined in 01_enums.sql | 可空 (用户可能不知道品种)';
COMMENT ON COLUMN public.t_pet.f_name             IS '宠物昵称, 1-64 字符';
COMMENT ON COLUMN public.t_pet.f_gender_id        IS 'FK -> public.t_gender(f_id) | defined in 01_enums.sql | 可空 (哨兵 -1 = 未知)';
COMMENT ON COLUMN public.t_pet.f_birth_date       IS '精确生日 (优先); 与 f_birth_year / f_birth_month 互斥 (CHECK: f_birth_date IS NOT NULL OR f_birth_year IS NOT NULL)';
COMMENT ON COLUMN public.t_pet.f_birth_year       IS '出生年份 (f_birth_date 为空时使用), 1980-2100 | 互斥: t_pet.f_birth_date / t_pet.f_birth_month';
COMMENT ON COLUMN public.t_pet.f_birth_month      IS '出生月份 (可选, 1-12) | 互斥: t_pet.f_birth_date / t_pet.f_birth_year';
COMMENT ON COLUMN public.t_pet.f_weight           IS '体重 (kg), 0 < weight < 1000';
COMMENT ON COLUMN public.t_pet.f_sterilized       IS '是否已绝育';
COMMENT ON COLUMN public.t_pet.f_vaccinated       IS '是否已接种疫苗';
COMMENT ON COLUMN public.t_pet.f_status_pet       IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 业务态: 1=在册 2=走失 3=已送养 4=已故 5=已归档';
COMMENT ON COLUMN public.t_pet.f_status_user      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 用户态 (软删): 1=active 3=deleted';
COMMENT ON COLUMN public.t_pet.f_personality_tags IS '用户自定义性格标签 JSONB 数组 (引用参考 t_personality_tag, defined in 01_enums.sql, 太多无法穷举)';
COMMENT ON COLUMN public.t_pet.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_pet.f_created_at       IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_pet.f_updated_at       IS '更新时间 (UTC), 由 trigger 维护';


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
    f_status_user   INTEGER      NOT NULL DEFAULT 1,
    f_meta_info     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_pet_photo_pet   FOREIGN KEY (f_pet_id)        REFERENCES public.t_pet(f_id)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_photo_type  FOREIGN KEY (f_photo_type_id) REFERENCES public.t_photo_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_pet_photo_user  FOREIGN KEY (f_status_user)   REFERENCES public.t_status(f_id)     ON DELETE NO ACTION,
    CONSTRAINT ck_t_pet_photo_url   CHECK (length(f_photo_url) > 0)
);
COMMENT ON TABLE  public.t_pet_photo IS '宠物照片 (主表, 替代原 t_pet.f_photo_url/f_photo_urls)';
COMMENT ON COLUMN public.t_pet_photo.f_id            IS '主键';
COMMENT ON COLUMN public.t_pet_photo.f_pet_id        IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_pet_photo.f_photo_type_id IS 'FK -> public.t_photo_type(f_id) | defined in 01_enums.sql | 头像/相册/报告配图/...';
COMMENT ON COLUMN public.t_pet_photo.f_photo_url     IS '原图 URL (CDN)';
COMMENT ON COLUMN public.t_pet_photo.f_thumbnail_url IS '缩略图 URL (空 = 客户端按需生成)';
COMMENT ON COLUMN public.t_pet_photo.f_is_primary    IS '是否主图; 主图唯一性约束见 99_indexes_views.sql: idx_t_pet_photo_primary';
COMMENT ON COLUMN public.t_pet_photo.f_status_user   IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_pet_photo.f_meta_info     IS '扩展元数据 (宽高/EXIF/...)';
COMMENT ON COLUMN public.t_pet_photo.f_created_at    IS '上传时间 (UTC)';
