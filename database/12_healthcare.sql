-- ============================================================
-- Gengdongta (更懂它) / 12. 宠物医疗 / Healthcare
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
    f_user_id       BIGINT       NOT NULL,
    f_lang          VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_name          VARCHAR(128) NOT NULL,
    f_address       VARCHAR(256) NOT NULL,
    f_phone         VARCHAR(32)  NOT NULL,
    f_business_hours VARCHAR(64) NOT NULL DEFAULT '',
    f_service_tags  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_rating        NUMERIC(3,2) NOT NULL DEFAULT 0,
    f_meta_info     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_status_user   INTEGER      NOT NULL DEFAULT 1,
    f_created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_hospital_user FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_hospital_lang FOREIGN KEY (f_lang)         REFERENCES public.t_lang(f_code) ON DELETE NO ACTION,
    CONSTRAINT fk_t_hospital_stat FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_hospital_name CHECK (length(f_name) BETWEEN 1 AND 128),
    CONSTRAINT ck_t_hospital_rating CHECK (f_rating BETWEEN 0 AND 5)
);
COMMENT ON TABLE  public.t_hospital IS '宠物医院主表';
COMMENT ON COLUMN public.t_hospital.f_id             IS '主键 | 引用方: t_doctor.f_hospital_id, t_appointment.f_hospital_id (本文件) | 弱引用: t_donation.f_target_id (in 13_welfare.sql, f_target_type=hospital)';
COMMENT ON COLUMN public.t_hospital.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 入驻用户 (医院管理员)';
COMMENT ON COLUMN public.t_hospital.f_lang           IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 主语言';
COMMENT ON COLUMN public.t_hospital.f_name           IS '医院名';
COMMENT ON COLUMN public.t_hospital.f_address        IS '医院地址';
COMMENT ON COLUMN public.t_hospital.f_phone          IS '联系电话';
COMMENT ON COLUMN public.t_hospital.f_business_hours IS '营业时间, e.g. 09:00-21:00';
COMMENT ON COLUMN public.t_hospital.f_service_tags   IS '服务标签 JSONB 数组, e.g. ["内科","外科","急诊"]';
COMMENT ON COLUMN public.t_hospital.f_rating         IS '综合评分 0-5 (由 t_comment 统计, 应用层定期刷新)';
COMMENT ON COLUMN public.t_hospital.f_meta_info      IS '扩展元数据 (坐标/资质/...)';
COMMENT ON COLUMN public.t_hospital.f_status_user    IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_hospital.f_created_at     IS '入驻时间 (UTC)';
CREATE INDEX idx_t_hospital_rating ON public.t_hospital(f_rating DESC);


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
    f_status_user     INTEGER      NOT NULL DEFAULT 1,
    f_created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_doctor_user     FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_doctor_hospital FOREIGN KEY (f_hospital_id) REFERENCES public.t_hospital(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_doctor_stat     FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id)    ON DELETE NO ACTION,
    CONSTRAINT ck_t_doctor_exp      CHECK (f_experience_years >= 0)
);
COMMENT ON TABLE  public.t_doctor IS '医生主表 (一个医生属于一个医院)';
COMMENT ON COLUMN public.t_doctor.f_id                IS '主键 | 引用方: t_appointment.f_doctor_id (本文件, 可空)';
COMMENT ON COLUMN public.t_doctor.f_user_id           IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 医生账号';
COMMENT ON COLUMN public.t_doctor.f_hospital_id       IS 'FK -> public.t_hospital(f_id) | defined in 12_healthcare.sql | 所属医院';
COMMENT ON COLUMN public.t_doctor.f_title             IS '职称, e.g. 主任医师 / 主治医师';
COMMENT ON COLUMN public.t_doctor.f_expertise         IS '专长 JSONB 数组, e.g. ["心脏","皮肤","牙科"]';
COMMENT ON COLUMN public.t_doctor.f_experience_years  IS '从业年限 (>= 0)';
COMMENT ON COLUMN public.t_doctor.f_intro             IS '个人简介';
COMMENT ON COLUMN public.t_doctor.f_status_user       IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_doctor.f_created_at        IS '入驻时间 (UTC)';


-- ========================================================= ===
-- 12.3 预约 / Appointment
-- ============================================================
CREATE TABLE public.t_appointment (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id         BIGINT       NOT NULL,
    f_hospital_id     BIGINT       NOT NULL,
    f_doctor_id       BIGINT,
    f_pet_id          BIGINT,
    f_appointment_time TIMESTAMPTZ NOT NULL,
    f_service_type    VARCHAR(64)  NOT NULL,
    f_symptoms        TEXT         NOT NULL DEFAULT '',
    f_meta_info       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_status_user     INTEGER      NOT NULL DEFAULT 1,
    f_created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_appt_user     FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)     ON DELETE NO ACTION,
    CONSTRAINT fk_t_appt_hospital FOREIGN KEY (f_hospital_id) REFERENCES public.t_hospital(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_appt_doctor   FOREIGN KEY (f_doctor_id)   REFERENCES public.t_doctor(f_id)   ON DELETE NO ACTION,
    CONSTRAINT fk_t_appt_pet      FOREIGN KEY (f_pet_id)      REFERENCES public.t_pet(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_appt_stat     FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id)   ON DELETE NO ACTION
);
COMMENT ON TABLE  public.t_appointment IS '宠物医疗预约';
COMMENT ON COLUMN public.t_appointment.f_id               IS '主键';
COMMENT ON COLUMN public.t_appointment.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 预约人';
COMMENT ON COLUMN public.t_appointment.f_hospital_id      IS 'FK -> public.t_hospital(f_id) | defined in 12_healthcare.sql';
COMMENT ON COLUMN public.t_appointment.f_doctor_id        IS 'FK -> public.t_doctor(f_id) | defined in 12_healthcare.sql | 可空 (不指定医生)';
COMMENT ON COLUMN public.t_appointment.f_pet_id           IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 可空 (新宠未录入)';
COMMENT ON COLUMN public.t_appointment.f_appointment_time IS '预约时间 (UTC)';
COMMENT ON COLUMN public.t_appointment.f_service_type     IS '服务类型, e.g. 体检 / 疫苗 / 绝育 / 急诊';
COMMENT ON COLUMN public.t_appointment.f_symptoms         IS '症状描述';
COMMENT ON COLUMN public.t_appointment.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_appointment.f_status_user      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_appointment.f_created_at       IS '创建时间 (UTC)';

-- Basic query indexes
CREATE INDEX IF NOT EXISTS idx_t_appointment_user   ON public.t_appointment(f_user_id, f_appointment_time DESC);
CREATE INDEX IF NOT EXISTS idx_t_appointment_hosp   ON public.t_appointment(f_hospital_id, f_appointment_time DESC);
CREATE INDEX IF NOT EXISTS idx_t_doctor_hospital     ON public.t_doctor(f_hospital_id);
