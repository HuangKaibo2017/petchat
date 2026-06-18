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
    f_share_url       VARCHAR(2048) NOT NULL DEFAULT '',
    f_view_count      INTEGER NOT NULL DEFAULT 0,
    f_meta_info       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_status_user     INTEGER NOT NULL DEFAULT 1,
    f_created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_share_user    FOREIGN KEY (f_user_id)         REFERENCES public.t_user(f_id)        ON DELETE NO ACTION,
    CONSTRAINT fk_t_share_type    FOREIGN KEY (f_share_type_id)   REFERENCES public.t_share_type(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_share_channel FOREIGN KEY (f_share_channel_id) REFERENCES public.t_share_channel(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_share_report  FOREIGN KEY (f_report_type_id)  REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_share_stat    FOREIGN KEY (f_status_user)     REFERENCES public.t_status(f_id)      ON DELETE NO ACTION,
    CONSTRAINT ck_t_share_view    CHECK (f_view_count >= 0)
);
COMMENT ON TABLE  public.t_share_record IS '报告分享记录 (f_report_id 为弱引用, 实际表由 f_report_type 决定)';
COMMENT ON COLUMN public.t_share_record.f_id              IS '主键';
COMMENT ON COLUMN public.t_share_record.f_user_id         IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 分享者';
COMMENT ON COLUMN public.t_share_record.f_report_id       IS '弱引用: 报告 ID | 实际表由 f_report_type 决定 | defined in 04_ai_reports.sql (emotion|health|human_pet_risk|personality)';
COMMENT ON COLUMN public.t_share_record.f_report_type_id  IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 报告类型';
COMMENT ON COLUMN public.t_share_record.f_share_type_id   IS 'FK -> public.t_share_type(f_id) | defined in 01_enums.sql | 分享内容类型';
COMMENT ON COLUMN public.t_share_record.f_share_channel_id IS 'FK -> public.t_share_channel(f_id) | defined in 01_enums.sql | 分享渠道 (微信/朋友圈/...)';
COMMENT ON COLUMN public.t_share_record.f_share_url       IS '生成的分享 URL (空 = 仅内部)';
COMMENT ON COLUMN public.t_share_record.f_view_count      IS '查看次数 (>= 0)';
COMMENT ON COLUMN public.t_share_record.f_meta_info       IS '扩展元数据 (渠道回执/分享缩略图)';
COMMENT ON COLUMN public.t_share_record.f_status_user     IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_share_record.f_created_at      IS '分享时间 (UTC)';


-- ============================================================
-- 6.2 AI 语音解读 / Interpretation Voice
-- ============================================================
CREATE TABLE public.t_interpretation_voice (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id         BIGINT  NOT NULL,
    f_report_id       BIGINT  NOT NULL,
    f_report_type_id  INTEGER NOT NULL,
    f_lang            VARCHAR(8) NOT NULL,
    f_voice_url       VARCHAR(512) NOT NULL,
    f_duration_seconds INTEGER NOT NULL DEFAULT 0,
    f_meta_info       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    f_status_user     INTEGER NOT NULL DEFAULT 1,
    f_created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_voice_user FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_voice_lang FOREIGN KEY (f_lang)         REFERENCES public.t_lang(f_code) ON DELETE NO ACTION,
    CONSTRAINT fk_t_voice_stat FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_voice_type FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_voice_dur  CHECK (f_duration_seconds >= 0)
);
COMMENT ON TABLE  public.t_interpretation_voice IS 'AI 报告语音解读 (TTS 生成的语音文件)';
COMMENT ON COLUMN public.t_interpretation_voice.f_id              IS '主键';
COMMENT ON COLUMN public.t_interpretation_voice.f_user_id         IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 发起生成的用户';
COMMENT ON COLUMN public.t_interpretation_voice.f_report_id       IS '弱引用: 报告 ID | 实际表由 f_report_type 决定 | defined in 04_ai_reports.sql';
COMMENT ON COLUMN public.t_interpretation_voice.f_report_type_id  IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 报告类型';
COMMENT ON COLUMN public.t_interpretation_voice.f_lang            IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 朗读语言';
COMMENT ON COLUMN public.t_interpretation_voice.f_voice_url       IS '语音文件 URL (CDN)';
COMMENT ON COLUMN public.t_interpretation_voice.f_duration_seconds IS '语音时长 (秒, >= 0)';
COMMENT ON COLUMN public.t_interpretation_voice.f_meta_info       IS '扩展元数据 (音色/语速/...)';
COMMENT ON COLUMN public.t_interpretation_voice.f_status_user     IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_interpretation_voice.f_created_at      IS '生成时间 (UTC)';
