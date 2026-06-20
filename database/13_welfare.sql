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
    CONSTRAINT ck_t_rescue_phone CHECK (f_contact_phone = '' OR f_contact_phone ~ '^[0-9+\-\s()]{5,32}$'),
    CONSTRAINT ck_t_rescue_del   CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_rescue_request_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_rescue_request IS '救助申请 (f_pet_type_id 引用 t_pet_type, JSONB i18n)';
COMMENT ON COLUMN public.t_rescue_request.f_id            IS '主键 | 弱引用: t_donation.f_target_id (本文件, f_target_type=rescue)';
COMMENT ON COLUMN public.t_rescue_request.f_public_uid    IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_rescue_request.f_user_id       IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 申请人';
COMMENT ON COLUMN public.t_rescue_request.f_lang          IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';
COMMENT ON COLUMN public.t_rescue_request.f_pet_type_id   IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 被救助宠物类型';
COMMENT ON COLUMN public.t_rescue_request.f_location      IS '发现地点';
COMMENT ON COLUMN public.t_rescue_request.f_description   IS '情况描述';
COMMENT ON COLUMN public.t_rescue_request.f_contact_phone IS '联系电话 (可空)';
COMMENT ON COLUMN public.t_rescue_request.f_meta_info     IS '扩展元数据 (现场照片)';
COMMENT ON COLUMN public.t_rescue_request.f_deleted       IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_rescue_request.f_created_at    IS '申请时间 (UTC)';


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
    CONSTRAINT ck_t_adoption_phone CHECK (f_contact_phone = '' OR f_contact_phone ~ '^[0-9+\-\s()]{5,32}$'),
    CONSTRAINT ck_t_adoption_del   CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_adoption_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_adoption IS '领养信息: 1=送养 2=领养申请';
COMMENT ON COLUMN public.t_adoption.f_id               IS '主键 | 弱引用: t_donation.f_target_id (本文件, f_target_type=adoption)';
COMMENT ON COLUMN public.t_adoption.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_adoption.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 发布人';
COMMENT ON COLUMN public.t_adoption.f_pet_id           IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 可空 (未录入系统的宠物)';
COMMENT ON COLUMN public.t_adoption.f_pet_type_id      IS 'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql | 可空 (与 f_pet_id 互斥)';
COMMENT ON COLUMN public.t_adoption.f_pet_name         IS '宠物昵称';
COMMENT ON COLUMN public.t_adoption.f_pet_age          IS '宠物年龄文本, e.g. 3岁 / 2个月';
COMMENT ON COLUMN public.t_adoption.f_adoption_type_id IS 'FK -> public.t_adoption_type(f_id) | defined in 01_enums.sql | 1=送养 2=领养申请';
COMMENT ON COLUMN public.t_adoption.f_description      IS '描述 (性格/疫苗/...)';
COMMENT ON COLUMN public.t_adoption.f_requirements     IS '领养要求';
COMMENT ON COLUMN public.t_adoption.f_location         IS '地点';
COMMENT ON COLUMN public.t_adoption.f_contact_phone    IS '联系电话';
COMMENT ON COLUMN public.t_adoption.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_adoption.f_deleted          IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_adoption.f_created_at       IS '发布时间 (UTC)';


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
);
COMMENT ON TABLE  public.t_volunteer IS '志愿者档案 (一个用户可担任多种志愿者类型)';
COMMENT ON COLUMN public.t_volunteer.f_id                IS '主键';
COMMENT ON COLUMN public.t_volunteer.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_volunteer.f_volunteer_type_id IS 'FK -> public.t_volunteer_type(f_id) | defined in 01_enums.sql | 复合 UNIQUE 第二部分';
COMMENT ON COLUMN public.t_volunteer.f_skills            IS '技能 JSONB 数组, e.g. ["急救","驾驶","翻译"]';
COMMENT ON COLUMN public.t_volunteer.f_experience        IS '经验描述';
COMMENT ON COLUMN public.t_volunteer.f_available         IS '当前是否可接单';
COMMENT ON COLUMN public.t_volunteer.f_meta_info         IS '扩展元数据';
COMMENT ON COLUMN public.t_volunteer.f_deleted           IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_volunteer.f_joined_at         IS '加入时间 (UTC)';


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
);
COMMENT ON TABLE  public.t_donation IS '捐款记录, f_user_id = -1 表示匿名 (引用 t_user 哨兵)';
COMMENT ON COLUMN public.t_donation.f_id             IS '主键';
COMMENT ON COLUMN public.t_donation.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | -1=系统匿名用户; 真实用户 >= 1';
COMMENT ON COLUMN public.t_donation.f_target_type    IS '捐款目标类型 (白名单): rescue / adoption / hospital / activity / general';
COMMENT ON COLUMN public.t_donation.f_target_id      IS '捐款目标 ID (弱引用, 实际表由 f_target_type 决定) | rescue->t_rescue_request, adoption->t_adoption, hospital->t_hospital (in 12_healthcare.sql), activity->t_activity (in 07_cms.sql)';
COMMENT ON COLUMN public.t_donation.f_amount         IS '金额 (> 0)';
COMMENT ON COLUMN public.t_donation.f_currency       IS '货币, 默认 CNY';
COMMENT ON COLUMN public.t_donation.f_payment_method IS '支付方式';
COMMENT ON COLUMN public.t_donation.f_status_payment IS 'FK -> public.t_payment_status(f_id) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_donation.f_anonymous      IS '是否匿名 (冗余 f_user_id=-1, 用于查询)';
COMMENT ON COLUMN public.t_donation.f_message        IS '留言';
COMMENT ON COLUMN public.t_donation.f_meta_info      IS '扩展元数据 (支付回执)';
COMMENT ON COLUMN public.t_donation.f_deleted        IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_donation.f_created_at     IS '捐款时间 (UTC)';
CREATE INDEX idx_t_donation_user ON public.t_donation(f_user_id);
CREATE INDEX idx_t_donation_target ON public.t_donation(f_target_type, f_target_id);


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
    CONSTRAINT ck_t_lost_phone  CHECK (f_contact_phone ~ '^[0-9+\-\s()]{5,32}$'),
    CONSTRAINT ck_t_lost_reward CHECK (f_reward_amount >= 0),
    CONSTRAINT ck_t_lost_del    CHECK (f_deleted IN (0, 1))
);
COMMENT ON TABLE  public.t_record_lost_pet IS '寻宠启事';
COMMENT ON COLUMN public.t_record_lost_pet.f_id              IS '主键';
COMMENT ON COLUMN public.t_record_lost_pet.f_user_id         IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 启事人';
COMMENT ON COLUMN public.t_record_lost_pet.f_pet_id          IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 可空 (未录入系统)';
COMMENT ON COLUMN public.t_record_lost_pet.f_lang            IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 内容语言';
COMMENT ON COLUMN public.t_record_lost_pet.f_lost_time       IS '走失时间 (UTC)';
COMMENT ON COLUMN public.t_record_lost_pet.f_lost_location   IS '走失地点';
COMMENT ON COLUMN public.t_record_lost_pet.f_contact_phone   IS '联系电话 (必填)';
COMMENT ON COLUMN public.t_record_lost_pet.f_reward_amount   IS '悬赏金额 (>= 0, 默认 0)';
COMMENT ON COLUMN public.t_record_lost_pet.f_reward_currency IS '悬赏货币, 默认 CNY';
COMMENT ON COLUMN public.t_record_lost_pet.f_description     IS '宠物特征描述';
COMMENT ON COLUMN public.t_record_lost_pet.f_status_lost     IS '寻宠业务态: 1=寻宠中 2=已找到 3=已关闭 | 由应用层维护 (非 t_status 外键)';
COMMENT ON COLUMN public.t_record_lost_pet.f_deleted         IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_record_lost_pet.f_meta_info       IS '扩展元数据 (照片/特征)';
COMMENT ON COLUMN public.t_record_lost_pet.f_created_at      IS '发布时间 (UTC)';
