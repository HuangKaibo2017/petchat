-- ============================================================
-- PetChat (更懂它) / 4. AI 报告 / AI Reports & Prompts
-- ============================================================
-- Version: 4.1.0
-- Created: 2026-06-17 / Last Modified: 2026-06-18
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   4 张 AI 报告表 (情绪/健康/人宠风险/性格) + 提示词版本管理
--   v4.1.0: 新增 Coze 输入上下文列 (f_input_symptoms / f_check_mode /
--           f_photo_ids / f_consultation_answers / f_owner_info),
--           新增 f_meta_info 扩展列, 修正 t_report_personality.f_status_user DEFAULT
--
-- 依赖:
--   01_enums.sql       (t_report_type, t_risk_level, t_health_level, t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--   03_pet_profile.sql (t_pet)
--
-- 被本文件引用的脚本 (下游, 弱引用 f_report_id):
--   06_share_interpretation.sql  -> t_share_record.f_report_id, t_interpretation_voice.f_report_id (f_report_type 区分)
--   08_subscription.sql          -> t_usage_record.f_related_report_id (弱引用)
--
-- 设计原则 (AI Reports Principles):
--   1. 报告是只写历史, 不修改 (append-only)
--   2. f_report_type 字段保留为弱引用, 实际表由 f_report_type 决定:
--      emotion -> t_report_emotion
--      health  -> t_report_health
--      human_pet_risk -> t_report_human_pet_risk
--      personality  -> t_report_personality
--   3. 提示词按 (f_code, f_lang, f_ver) 版本化, f_ver 在 (code, lang) 内单调递增
--   4. CHECK 约束用业务枚举值列表 (白名单), 新增情绪/健康等级需先迁移 CHECK
--   5. 输入上下文完整留痕: 每张报告表通过 f_meta_info + 专属列保存 Coze prompt 的原始输入, 支持报告溯源
-- ============================================================


-- ============================================================
-- 4.1 提示词 / Prompts (按 code + lang 隔离, f_ver 逻辑版本)
-- ============================================================
CREATE TABLE public.t_prompt (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_code        VARCHAR(64)  NOT NULL,
    f_lang        VARCHAR(8)   NOT NULL,
    f_ver         INTEGER      NOT NULL,
    f_content     TEXT         NOT NULL,
    f_is_active   BOOLEAN      NOT NULL DEFAULT true,
    f_status_user INTEGER      NOT NULL DEFAULT 1,
    f_created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_prompt_lang   FOREIGN KEY (f_lang)        REFERENCES public.t_lang(f_code)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_prompt_status FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_prompt_code_lang_ver UNIQUE (f_code, f_lang, f_ver),
    CONSTRAINT ck_t_prompt_content CHECK (length(f_content) > 0)
);
COMMENT ON TABLE  public.t_prompt IS 'AI 提示词, (f_code, f_lang, f_ver) 唯一';
COMMENT ON COLUMN public.t_prompt.f_id          IS '主键 (内部使用, 业务查询用 f_code+f_lang+f_ver)';
COMMENT ON COLUMN public.t_prompt.f_code        IS '提示词业务代码, e.g. emotion_analyze / health_assess / chat_persona';
COMMENT ON COLUMN public.t_prompt.f_lang        IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 提示词语言';
COMMENT ON COLUMN public.t_prompt.f_ver         IS '逻辑版本号, 同 (code, lang) 内单调递增 | 引用: 应用层通过 (code, lang, max_ver) 取最新';
COMMENT ON COLUMN public.t_prompt.f_content     IS '提示词正文 (模板, 支持 {{pet_name}} 等占位符)';
COMMENT ON COLUMN public.t_prompt.f_is_active   IS '是否启用 (false = 历史版本, 不再被加载)';
COMMENT ON COLUMN public.t_prompt.f_status_user IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_prompt.f_created_at  IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_prompt.f_updated_at  IS '更新时间 (UTC)';


-- ============================================================
-- 4.2 情绪报告 / Emotion Report
-- ============================================================
CREATE TABLE public.t_report_emotion (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id         BIGINT       NOT NULL,
    f_pet_id          BIGINT       NOT NULL,
    f_lang            VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id  INTEGER      NOT NULL,
    f_emotion_score   NUMERIC(5,2) NOT NULL,
    f_emotion_state   VARCHAR(32)  NOT NULL,
    f_emotion_tags    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_emotion_trend   VARCHAR(16)  NOT NULL DEFAULT '',
    f_input_symptoms  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_status_user     INTEGER      NOT NULL DEFAULT 1,
    f_meta_info       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_report_emotion_user          FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_pet           FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_lang          FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_type          FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_status        FOREIGN KEY (f_status_user)    REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_emotion_score         CHECK (f_emotion_score BETWEEN 0 AND 100),
    CONSTRAINT ck_t_report_emotion_state         CHECK (f_emotion_state IN ('开心','平静','焦虑','恐惧','愤怒','悲伤','兴奋','紧张','满足','不安')),
    CONSTRAINT ck_t_report_emotion_trend         CHECK (f_emotion_trend IN ('','上升','下降','稳定','波动')),
    CONSTRAINT ck_t_report_emotion_input_symptom CHECK (jsonb_typeof(f_input_symptoms) = 'array'),
    CONSTRAINT ck_t_report_emotion_meta          CHECK (jsonb_typeof(f_meta_info) = 'object')
);
COMMENT ON TABLE  public.t_report_emotion IS '宠物情绪分析报告';
COMMENT ON COLUMN public.t_report_emotion.f_id             IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=emotion)';
COMMENT ON COLUMN public.t_report_emotion.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 报告创建者';
COMMENT ON COLUMN public.t_report_emotion.f_pet_id         IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 被分析的宠物';
COMMENT ON COLUMN public.t_report_emotion.f_lang           IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 报告内容语言';
COMMENT ON COLUMN public.t_report_emotion.f_report_type_id IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: emotion';
COMMENT ON COLUMN public.t_report_emotion.f_emotion_score  IS '情绪分 0-100 (高分=积极)';
COMMENT ON COLUMN public.t_report_emotion.f_emotion_state  IS '情绪状态 (白名单): 开心/平静/焦虑/恐惧/愤怒/悲伤/兴奋/紧张/满足/不安';
COMMENT ON COLUMN public.t_report_emotion.f_emotion_tags   IS '情绪标签 JSONB 数组, e.g. ["尾巴摇动","耳朵竖起"]';
COMMENT ON COLUMN public.t_report_emotion.f_emotion_trend  IS '趋势: 空(单次) / 上升 / 下降 / 稳定 / 波动';
COMMENT ON COLUMN public.t_report_emotion.f_input_symptoms IS '输入症状 JSONB 数组, 对应 Coze /api/mood 的 currentSymptoms, e.g. ["食欲不振","频繁舔毛"]';
COMMENT ON COLUMN public.t_report_emotion.f_status_user    IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_report_emotion.f_meta_info      IS '扩展元数据, 存 numbers / question 等 Coze 输入上下文';
COMMENT ON COLUMN public.t_report_emotion.f_created_at     IS '生成时间 (UTC)';


-- ============================================================
-- 4.3 健康报告 / Health Report
-- ============================================================
CREATE TABLE public.t_report_health (
    f_id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id               BIGINT       NOT NULL,
    f_pet_id                BIGINT       NOT NULL,
    f_lang                  VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id        INTEGER      NOT NULL,
    f_check_mode            VARCHAR(16)  NOT NULL DEFAULT 'overall',
    f_photo_ids             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_health_score          NUMERIC(5,2) NOT NULL,
    f_health_level_id       INTEGER      NOT NULL,
    f_health_issues         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_health_suggestions    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_consultation_answers  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_status_user           INTEGER      NOT NULL DEFAULT 1,
    f_meta_info             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_report_health_user          FOREIGN KEY (f_user_id)           REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_pet           FOREIGN KEY (f_pet_id)            REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_lang          FOREIGN KEY (f_lang)              REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_type          FOREIGN KEY (f_report_type_id)    REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_status        FOREIGN KEY (f_status_user)       REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_health_score         CHECK (f_health_score BETWEEN 0 AND 100),
    CONSTRAINT fk_t_report_health_health        FOREIGN KEY (f_health_level_id)   REFERENCES public.t_health_level(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_health_check_mode    CHECK (f_check_mode IN ('overall','specific','consultation')),
    CONSTRAINT ck_t_report_health_photo_ids     CHECK (jsonb_typeof(f_photo_ids) = 'array'),
    CONSTRAINT ck_t_report_health_answers       CHECK (jsonb_typeof(f_consultation_answers) = 'object'),
    CONSTRAINT ck_t_report_health_meta          CHECK (jsonb_typeof(f_meta_info) = 'object')
);
COMMENT ON TABLE  public.t_report_health IS '宠物健康评估报告';
COMMENT ON COLUMN public.t_report_health.f_id                 IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=health)';
COMMENT ON COLUMN public.t_report_health.f_user_id            IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_health.f_pet_id             IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_health.f_lang               IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_health.f_report_type_id     IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: health';
COMMENT ON COLUMN public.t_report_health.f_check_mode          IS '检测模式 (白名单): overall=全面体检 / specific=针对性问诊 / consultation=临床科普 | 对应 Coze /api/health-check 的 checkMode';
COMMENT ON COLUMN public.t_report_health.f_photo_ids           IS '本次分析使用的照片 ID 列表 JSONB 数组, 弱引用 t_pet_photo.f_id';
COMMENT ON COLUMN public.t_report_health.f_health_score        IS '健康分 0-100';
COMMENT ON COLUMN public.t_report_health.f_health_level_id     IS 'FK -> public.t_health_level(f_id) | defined in 01_enums.sql | 健康等级';
COMMENT ON COLUMN public.t_report_health.f_health_issues       IS '健康问题 JSONB 数组, e.g. [{"code":"obesity","severity":"low"}]';
COMMENT ON COLUMN public.t_report_health.f_health_suggestions  IS '健康建议 JSONB 数组';
COMMENT ON COLUMN public.t_report_health.f_consultation_answers IS '追问链 Q&A JSONB 对象, e.g. {"呕吐频率":"每天1次","食欲":"下降"} | 仅 consultation 模式有值';
COMMENT ON COLUMN public.t_report_health.f_status_user         IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_report_health.f_meta_info           IS '扩展元数据, 存 question / rhythm / photos 等 Coze 输入上下文';
COMMENT ON COLUMN public.t_report_health.f_created_at          IS '生成时间 (UTC)';


-- ============================================================
-- 4.4 人宠风险报告 / Human-Pet Risk Report
-- ============================================================
CREATE TABLE public.t_report_human_pet_risk (
    f_id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id                BIGINT       NOT NULL,
    f_pet_id                 BIGINT       NOT NULL,
    f_lang                   VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id         INTEGER      NOT NULL,
    f_owner_info             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_risk_level_id          INTEGER      NOT NULL,
    f_risk_score             NUMERIC(5,2) NOT NULL,
    f_risk_factors           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_risk_recommendations   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_status_user            INTEGER      NOT NULL DEFAULT 1,
    f_meta_info              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at             TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_report_hpr_user      FOREIGN KEY (f_user_id)          REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_pet       FOREIGN KEY (f_pet_id)           REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_lang      FOREIGN KEY (f_lang)             REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_type      FOREIGN KEY (f_report_type_id)   REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_level     FOREIGN KEY (f_risk_level_id)    REFERENCES public.t_risk_level(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_status    FOREIGN KEY (f_status_user)      REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_hpr_score     CHECK (f_risk_score BETWEEN 0 AND 100),
    CONSTRAINT ck_t_report_hpr_owner     CHECK (jsonb_typeof(f_owner_info) = 'object'),
    CONSTRAINT ck_t_report_hpr_meta      CHECK (jsonb_typeof(f_meta_info) = 'object')
);
COMMENT ON TABLE  public.t_report_human_pet_risk IS '人宠相处风险评估报告';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_id                    IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=human_pet_risk)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_user_id               IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_pet_id                IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_lang                  IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_report_type_id        IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: human_pet_risk';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_owner_info             IS '主人信息 JSONB 对象, 对应 Coze /api/constitution 的 ownerBirthDate/ownerBirthTime/ownerName, e.g. {"birthDate":"1990-05-20","birthTime":"08:30","name":"张三"}';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_level_id          IS 'FK -> public.t_risk_level(f_id) | defined in 01_enums.sql | 低/中/高';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_score             IS '风险分 0-100 (高分=高风险)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_factors           IS '风险因子 JSONB 数组, e.g. [{"factor":"小孩","level":"medium"}]';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_recommendations   IS '风险建议 JSONB 数组';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_status_user            IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_meta_info              IS '扩展元数据, 存 healthConstitution / healthCheckPetName 等输入上下文';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_created_at             IS '生成时间 (UTC)';


-- ============================================================
-- 4.5 性格报告 / Personality Report
-- ============================================================
CREATE TABLE public.t_report_personality (
    f_id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id              BIGINT       NOT NULL,
    f_pet_id               BIGINT       NOT NULL,
    f_lang                 VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id       INTEGER      NOT NULL,
    f_personality_tags     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_personality_traits   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_personality_analysis TEXT         NOT NULL DEFAULT '',
    f_status_user          INTEGER      NOT NULL DEFAULT 1,
    f_meta_info            JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_report_pers_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_status  FOREIGN KEY (f_status_user)    REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_pers_traits  CHECK (jsonb_typeof(f_personality_traits) = 'object'),
    CONSTRAINT ck_t_report_pers_meta    CHECK (jsonb_typeof(f_meta_info) = 'object')
);
COMMENT ON TABLE  public.t_report_personality IS '宠物性格画像报告';
COMMENT ON COLUMN public.t_report_personality.f_id                   IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=personality)';
COMMENT ON COLUMN public.t_report_personality.f_user_id              IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_personality.f_pet_id               IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_personality.f_lang                 IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_personality.f_report_type_id       IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: personality';
COMMENT ON COLUMN public.t_report_personality.f_personality_tags     IS '性格标签 JSONB 数组 (引用参考 t_personality_tag, defined in 01_enums.sql)';
COMMENT ON COLUMN public.t_report_personality.f_personality_traits   IS '性格维度分 JSONB 对象, e.g. {"sociability":0.8,"aggression":0.2}';
COMMENT ON COLUMN public.t_report_personality.f_personality_analysis IS 'AI 生成的文字解读';
COMMENT ON COLUMN public.t_report_personality.f_status_user          IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_report_personality.f_meta_info            IS '扩展元数据, 存 birthDate / rhythm 等 Coze 输入上下文';
COMMENT ON COLUMN public.t_report_personality.f_created_at           IS '生成时间 (UTC)';
