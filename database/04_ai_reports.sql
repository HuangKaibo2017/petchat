-- ============================================================
-- PetChat (更懂它) / 4. AI 报告 / AI Reports & Prompts
-- ============================================================
-- Version: 4.1.0
-- Created: 2026-06-17
-- Updated: 2026-06-26
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   6 张 AI 报告表 (情绪/健康/人宠风险/性格/体质/医疗咨询) + 提示词版本管理
--
-- 依赖:
--   01_enums.sql       (t_report_type, t_risk_level, t_health_level, t_status, t_lang, t_emotion_state, t_emotion_trend)
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
--      constitution -> t_report_constitution
--      consultation -> t_report_consultation
--   3. 提示词按 (f_code, f_lang, f_ver) 版本化, f_ver 在 (code, lang) 内单调递增
--   4. CHECK 约束用业务枚举值列表 (白名单), 新增情绪/健康等级需先迁移 CHECK
--   5. 每张报告表均含 f_status (生成状态机), f_meta (LLM 调用元信息), f_llm_input (输入快照),
--      f_llm_resp (完整 LLM 原始响应), f_prompt_id (提示词版本溯源)
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
    f_deleted     INT2         NOT NULL DEFAULT 0,
    f_created_at  BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at  BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_prompt_lang   FOREIGN KEY (f_lang) REFERENCES public.t_lang(f_code) ON DELETE NO ACTION,
    CONSTRAINT uk_t_prompt_code_lang_ver UNIQUE (f_code, f_lang, f_ver),
    CONSTRAINT ck_t_prompt_content CHECK (length(f_content) > 0),
    CONSTRAINT ck_t_prompt_del     CHECK (f_deleted IN (0, 1))
);
COMMENT ON TABLE  public.t_prompt IS 'AI 提示词, (f_code, f_lang, f_ver) 唯一';
COMMENT ON COLUMN public.t_prompt.f_id          IS '主键 (内部使用, 业务查询用 f_code+f_lang+f_ver)';
COMMENT ON COLUMN public.t_prompt.f_code        IS '提示词业务代码, e.g. emotion_analyze / health_assess / chat_persona';
COMMENT ON COLUMN public.t_prompt.f_lang        IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 提示词语言';
COMMENT ON COLUMN public.t_prompt.f_ver         IS '逻辑版本号, 同 (code, lang) 内单调递增 | 引用: 应用层通过 (code, lang, max_ver) 取最新';
COMMENT ON COLUMN public.t_prompt.f_content     IS '提示词正文 (模板, 支持 {{pet_name}} 等占位符)';
COMMENT ON COLUMN public.t_prompt.f_deleted     IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_prompt.f_created_at  IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_prompt.f_updated_at  IS '更新时间 (UTC)';


-- ============================================================
-- 4.2 情绪报告 / Emotion Report (multi_dim 多维度报告)
-- ============================================================
-- 注: single_qa (一事一问) 不放入本表, 归入聊天会话体系 (t_chat_history)
CREATE TABLE public.t_report_emotion (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid    UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id       BIGINT       NOT NULL,
    f_pet_id        BIGINT       NOT NULL,
    f_lang          VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id INTEGER     NOT NULL,
    f_emotion_state_id INTEGER   NOT NULL DEFAULT -1,
    f_emotion_trend_id INTEGER   NOT NULL DEFAULT -1,
    f_mood_stars    VARCHAR(8)   NOT NULL DEFAULT '★★★☆☆',
    f_food_stars    VARCHAR(8)   NOT NULL DEFAULT '★★★☆☆',
    f_body_status   VARCHAR(64)  NOT NULL DEFAULT '',
    f_core_answer   TEXT         NOT NULL DEFAULT '',
    f_core_basis    TEXT         NOT NULL DEFAULT '',
    f_status_summary TEXT        NOT NULL DEFAULT '',
    f_owner_view    TEXT         NOT NULL DEFAULT '',
    f_pet_message   TEXT         NOT NULL DEFAULT '',
    f_pet_wish      TEXT         NOT NULL DEFAULT '',
    f_care_plan     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_products      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_risk_level    VARCHAR(8)   NOT NULL DEFAULT '',
    f_risk_text     VARCHAR(16)  NOT NULL DEFAULT '',
    f_summary       TEXT         NOT NULL DEFAULT '',
    f_llm_resp      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_llm_input     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_meta          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_prompt_id     BIGINT       NOT NULL DEFAULT -1,
    f_status        INT          NOT NULL DEFAULT 1,
    f_started_at    BIGINT       NOT NULL DEFAULT 0,
    f_finished_at   BIGINT       NOT NULL DEFAULT 0,
    f_error_code    VARCHAR(64)  NOT NULL DEFAULT '',
    f_error_message TEXT         NOT NULL DEFAULT '',
    f_view_count    INT          NOT NULL DEFAULT 0,
    f_share_count   INT          NOT NULL DEFAULT 0,
    f_last_viewed_at BIGINT      NOT NULL DEFAULT 0,
    f_deleted       INT2         NOT NULL DEFAULT 0,
    f_created_at    BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_emotion_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_state   FOREIGN KEY (f_emotion_state_id) REFERENCES public.t_emotion_state(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_trend   FOREIGN KEY (f_emotion_trend_id) REFERENCES public.t_emotion_trend(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_status  FOREIGN KEY (f_status)         REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_emotion_prompt  FOREIGN KEY (f_prompt_id)      REFERENCES public.t_prompt(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_emotion_mood    CHECK (f_mood_stars ~ '^[★☆]{5}$'),
    CONSTRAINT ck_t_report_emotion_food    CHECK (f_food_stars ~ '^[★☆]{5}$'),
    CONSTRAINT ck_t_report_emotion_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_emotion_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_report_emotion IS '宠物情绪分析报告 (multi_dim 多维度报告, single_qa 归入 t_chat_history)';
COMMENT ON COLUMN public.t_report_emotion.f_id             IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=emotion)';
COMMENT ON COLUMN public.t_report_emotion.f_public_uid     IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_report_emotion.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 报告创建者';
COMMENT ON COLUMN public.t_report_emotion.f_pet_id         IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 被分析的宠物';
COMMENT ON COLUMN public.t_report_emotion.f_lang           IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 报告内容语言';
COMMENT ON COLUMN public.t_report_emotion.f_report_type_id IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: emotion';
COMMENT ON COLUMN public.t_report_emotion.f_emotion_state_id IS 'FK -> public.t_emotion_state(f_id) | defined in 01_enums.sql | 情绪状态 (happy/calm/anxious/...)';
COMMENT ON COLUMN public.t_report_emotion.f_emotion_trend_id IS 'FK -> public.t_emotion_trend(f_id) | defined in 01_enums.sql | 情绪趋势 (rising/falling/stable/fluctuating)';
COMMENT ON COLUMN public.t_report_emotion.f_mood_stars     IS '心情等级星级 (★★☆☆☆ ~ ★★★★★)';
COMMENT ON COLUMN public.t_report_emotion.f_food_stars     IS '饮食满意度星级 (★★☆☆☆ ~ ★★★★★)';
COMMENT ON COLUMN public.t_report_emotion.f_body_status    IS '身体状态关键词, 如: 无不适 / 轻微疲劳 / 需关注';
COMMENT ON COLUMN public.t_report_emotion.f_core_answer    IS '核心回答, 直接回答主人问题, 60-100字';
COMMENT ON COLUMN public.t_report_emotion.f_core_basis     IS '解读依据, 结合占卜体系简要说明推理逻辑, 40-80字';
COMMENT ON COLUMN public.t_report_emotion.f_status_summary IS '今日整体状态一句话总结, 20-40字';
COMMENT ON COLUMN public.t_report_emotion.f_owner_view     IS '以宠物第一人称视角描述它眼中的主人状态, 60-100字, 温暖共情风格';
COMMENT ON COLUMN public.t_report_emotion.f_pet_message    IS '宠物想对主人说的心里话, 60-100字, 治愈风格';
COMMENT ON COLUMN public.t_report_emotion.f_pet_wish       IS '宠物的一个小愿望或请求, 20-40字';
COMMENT ON COLUMN public.t_report_emotion.f_care_plan      IS '护理方案 JSONB 数组, e.g. [{"title":"方案标题","desc":"具体建议"}]';
COMMENT ON COLUMN public.t_report_emotion.f_products       IS '推荐商品 JSONB 数组, e.g. [{"id":"care001","name":"商品名","price":"价格","image":""}]';
COMMENT ON COLUMN public.t_report_emotion.f_risk_level     IS '风险等级: low / medium / high';
COMMENT ON COLUMN public.t_report_emotion.f_risk_text      IS '风险文字: 安全 / 需关注 / 需警惕';
COMMENT ON COLUMN public.t_report_emotion.f_summary        IS '报告一句话总结, 20-30字';
COMMENT ON COLUMN public.t_report_emotion.f_llm_resp IS '完整 LLM 原始响应 JSONB (原始响应存档, 用于调试/回溯)';
COMMENT ON COLUMN public.t_report_emotion.f_llm_input  IS '发起报告时的输入上下文快照, e.g. {"pet_name":"旺财","breed":"柯基","age":3,"question":"..."} | 用于报告复现、审计';
COMMENT ON COLUMN public.t_report_emotion.f_meta           IS 'LLM 调用元信息 (LLM 返回后填入). Schema: {llm:{provider,model,temperature,max_tokens,endpoint}, prompt:{code,lang,ver}, usage:{prompt_tokens,completion_tokens,total_tokens}, timing:{started_at,finished_at,latency_ms}, error:{code,message}}';
COMMENT ON COLUMN public.t_report_emotion.f_prompt_id      IS 'FK -> public.t_prompt(f_id) | 追溯该报告生成所用的提示词版本, 默认 -1 表示系统预设/无版本';
COMMENT ON COLUMN public.t_report_emotion.f_status         IS '报告状态 (引用 t_status): 1=pending 10=active 20=failed 30=timeout 40=disabled | 默认 1, LLM 调用成功后置 10';
COMMENT ON COLUMN public.t_report_emotion.f_started_at     IS 'LLM 调用开始时间 (UTC ms), 默认 0 表示未开始';
COMMENT ON COLUMN public.t_report_emotion.f_finished_at    IS 'LLM 调用结束时间 (UTC ms), 默认 0 表示未完成';
COMMENT ON COLUMN public.t_report_emotion.f_error_code     IS '失败错误码, e.g. TIMEOUT/LLM_FAILED/PARSE_ERROR, 成功时为空';
COMMENT ON COLUMN public.t_report_emotion.f_error_message  IS '失败错误详情, 成功时为空';
COMMENT ON COLUMN public.t_report_emotion.f_view_count     IS '查看次数, 由分享/查看触发器或应用层更新';
COMMENT ON COLUMN public.t_report_emotion.f_share_count    IS '分享次数, 由 t_share_record INSERT 触发器累加';
COMMENT ON COLUMN public.t_report_emotion.f_last_viewed_at IS '最近一次查看时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_emotion.f_deleted        IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_report_emotion.f_created_at     IS '生成时间 (UTC)';


-- ============================================================
-- 4.3 健康报告 / Health Report
-- ============================================================
CREATE TABLE public.t_report_health (
    f_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid          UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id             BIGINT       NOT NULL,
    f_pet_id              BIGINT       NOT NULL,
    f_lang                VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id      INTEGER      NOT NULL,
    f_health_level_id     INTEGER      NOT NULL,
    f_health_stars        VARCHAR(8)   NOT NULL DEFAULT '★★★☆☆',
    f_core_answer         TEXT         NOT NULL DEFAULT '',
    f_core_basis          TEXT         NOT NULL DEFAULT '',
    f_current_symptoms    TEXT         NOT NULL DEFAULT '',
    f_symptom_mapping     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_symptom_analysis    TEXT         NOT NULL DEFAULT '',
    f_potential_deficiencies TEXT      NOT NULL DEFAULT '',
    f_deficiency_details  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_emergency           TEXT         NOT NULL DEFAULT '',
    f_future_risk         TEXT         NOT NULL DEFAULT '',
    f_diet_advice         TEXT         NOT NULL DEFAULT '',
    f_exercise_advice     TEXT         NOT NULL DEFAULT '',
    f_care_plan           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_disclaimer          TEXT         NOT NULL DEFAULT '',
    f_health_issues       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_health_suggestions  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_llm_resp            JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_llm_input           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_meta                JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_prompt_id           BIGINT       NOT NULL DEFAULT -1,
    f_status              INT          NOT NULL DEFAULT 1,
    f_started_at          BIGINT       NOT NULL DEFAULT 0,
    f_finished_at         BIGINT       NOT NULL DEFAULT 0,
    f_error_code          VARCHAR(64)  NOT NULL DEFAULT '',
    f_error_message       TEXT         NOT NULL DEFAULT '',
    f_view_count          INT          NOT NULL DEFAULT 0,
    f_share_count         INT          NOT NULL DEFAULT 0,
    f_last_viewed_at      BIGINT       NOT NULL DEFAULT 0,
    f_deleted             INT2         NOT NULL DEFAULT 0,
    f_created_at          BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_health_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_health  FOREIGN KEY (f_health_level_id) REFERENCES public.t_health_level(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_status  FOREIGN KEY (f_status)         REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_health_prompt  FOREIGN KEY (f_prompt_id)      REFERENCES public.t_prompt(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_health_stars   CHECK (f_health_stars ~ '^[★☆]{5}$'),
    CONSTRAINT ck_t_report_health_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_health_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_report_health IS '宠物健康评估报告';
COMMENT ON COLUMN public.t_report_health.f_id                 IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=health)';
COMMENT ON COLUMN public.t_report_health.f_public_uid         IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_report_health.f_user_id            IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_health.f_pet_id             IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_health.f_lang               IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_health.f_report_type_id     IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: health';
COMMENT ON COLUMN public.t_report_health.f_health_level_id    IS 'FK -> public.t_health_level(f_id) | defined in 01_enums.sql | 临床紧急度 (urgent/attention/normal/good)';
COMMENT ON COLUMN public.t_report_health.f_health_stars       IS '健康星级 (★★☆☆☆ ~ ★★★★★)';
COMMENT ON COLUMN public.t_report_health.f_core_answer        IS '核心健康结论, 直接回答主人, 60-100字';
COMMENT ON COLUMN public.t_report_health.f_core_basis         IS '推理依据, 结合症状/营养简要说明, 40-80字';
COMMENT ON COLUMN public.t_report_health.f_current_symptoms   IS '当前症状总结, 40-80字';
COMMENT ON COLUMN public.t_report_health.f_symptom_mapping    IS '症状部位映射 JSONB 数组, e.g. [{"area":"腹部","symptoms":"轻微胀气"}]';
COMMENT ON COLUMN public.t_report_health.f_symptom_analysis   IS '症状综合分析, 40-80字';
COMMENT ON COLUMN public.t_report_health.f_potential_deficiencies IS '潜在营养缺失总结, 30-60字';
COMMENT ON COLUMN public.t_report_health.f_deficiency_details IS '营养缺失详情 JSONB 数组, e.g. [{"type":"Omega-3","manifestations":"毛发干枯"}]';
COMMENT ON COLUMN public.t_report_health.f_emergency          IS '是否需要立即就医, 20-40字 (安全攸关字段)';
COMMENT ON COLUMN public.t_report_health.f_future_risk        IS '风险评估, 30-60字';
COMMENT ON COLUMN public.t_report_health.f_diet_advice        IS '饮食调理建议, 40-80字';
COMMENT ON COLUMN public.t_report_health.f_exercise_advice    IS '运动/作息建议, 40-80字';
COMMENT ON COLUMN public.t_report_health.f_care_plan          IS '护理方案 JSONB 数组, e.g. [{"title":"方案","desc":"建议40-60字"}]';
COMMENT ON COLUMN public.t_report_health.f_disclaimer         IS '免责声明 (合规要求)';
COMMENT ON COLUMN public.t_report_health.f_health_issues      IS '健康问题 JSONB 数组, e.g. [{"code":"obesity","severity":"low"}]';
COMMENT ON COLUMN public.t_report_health.f_health_suggestions IS '健康建议 JSONB 数组';
COMMENT ON COLUMN public.t_report_health.f_llm_resp     IS '完整 LLM 原始响应 JSONB';
COMMENT ON COLUMN public.t_report_health.f_llm_input      IS '发起报告时的输入上下文快照';
COMMENT ON COLUMN public.t_report_health.f_meta               IS 'LLM 调用元信息 (LLM 返回后填入). Schema: {llm:{provider,model,temperature,max_tokens,endpoint}, prompt:{code,lang,ver}, usage:{...}, timing:{...}, error:{...}}';
COMMENT ON COLUMN public.t_report_health.f_prompt_id          IS 'FK -> public.t_prompt(f_id) | 追溯该报告生成所用的提示词版本';
COMMENT ON COLUMN public.t_report_health.f_status             IS '报告状态 (引用 t_status): 1=pending 10=active 20=failed 30=timeout 40=disabled';
COMMENT ON COLUMN public.t_report_health.f_started_at         IS 'LLM 调用开始时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_health.f_finished_at        IS 'LLM 调用结束时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_health.f_error_code         IS '失败错误码';
COMMENT ON COLUMN public.t_report_health.f_error_message      IS '失败错误详情';
COMMENT ON COLUMN public.t_report_health.f_view_count         IS '查看次数';
COMMENT ON COLUMN public.t_report_health.f_share_count        IS '分享次数';
COMMENT ON COLUMN public.t_report_health.f_last_viewed_at     IS '最近一次查看时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_health.f_deleted            IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_report_health.f_created_at         IS '生成时间 (UTC)';


-- ============================================================
-- 4.4 人宠风险报告 / Human-Pet Risk Report
-- ============================================================
CREATE TABLE public.t_report_human_pet_risk (
    f_id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid             UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id                BIGINT       NOT NULL,
    f_pet_id                 BIGINT       NOT NULL,
    f_lang                   VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id         INTEGER      NOT NULL,
    f_risk_level_id          INTEGER      NOT NULL,
    f_risk_score             INT          NOT NULL,
    f_pet_imbalance          TEXT         NOT NULL DEFAULT '',
    f_qi_risk                TEXT         NOT NULL DEFAULT '',
    f_microbiome_risk        TEXT         NOT NULL DEFAULT '',
    f_lifestyle_risk         TEXT         NOT NULL DEFAULT '',
    f_joint_care_plan        TEXT         NOT NULL DEFAULT '',
    f_medical_advice         TEXT         NOT NULL DEFAULT '',
    f_risk_factors           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_risk_recommendations   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_llm_resp               JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_llm_input              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_meta                   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_prompt_id              BIGINT       NOT NULL DEFAULT -1,
    f_status                 INT          NOT NULL DEFAULT 1,
    f_started_at             BIGINT       NOT NULL DEFAULT 0,
    f_finished_at            BIGINT       NOT NULL DEFAULT 0,
    f_error_code             VARCHAR(64)  NOT NULL DEFAULT '',
    f_error_message          TEXT         NOT NULL DEFAULT '',
    f_view_count             INT          NOT NULL DEFAULT 0,
    f_share_count            INT          NOT NULL DEFAULT 0,
    f_last_viewed_at         BIGINT       NOT NULL DEFAULT 0,
    f_deleted                INT2         NOT NULL DEFAULT 0,
    f_created_at             BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_hpr_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_level   FOREIGN KEY (f_risk_level_id)  REFERENCES public.t_risk_level(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_status  FOREIGN KEY (f_status)         REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_hpr_prompt  FOREIGN KEY (f_prompt_id)      REFERENCES public.t_prompt(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_hpr_score   CHECK (f_risk_score BETWEEN 0 AND 100),
    CONSTRAINT ck_t_report_hpr_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_hpr_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_report_human_pet_risk IS '人宠相处风险评估报告';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_id                    IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=human_pet_risk)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_public_uid            IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_user_id               IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_pet_id                IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_lang                  IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_report_type_id        IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: human_pet_risk';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_level_id         IS 'FK -> public.t_risk_level(f_id) | defined in 01_enums.sql | 低/中/高';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_score            IS '风险分 0-100 (高分=高风险, 整数)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_pet_imbalance         IS '宠物体质偏颇分析, 40-80字';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_qi_risk               IS '气场不和风险评估, 30-60字';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_microbiome_risk       IS '微生物群风险评估, 30-60字';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_lifestyle_risk        IS '生活方式风险评估, 30-60字';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_joint_care_plan       IS '关节养护方案, 40-80字';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_medical_advice        IS '医疗建议, 30-60字';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_factors          IS '风险因子 JSONB 数组, e.g. [{"factor":"气虚体质","level":"high"}] | factor 取自中医体质维度';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_risk_recommendations  IS '风险建议 JSONB 数组';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_llm_resp        IS '完整 LLM 原始响应 JSONB';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_llm_input         IS '发起报告时的输入上下文快照';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_meta                  IS 'LLM 调用元信息 (LLM 返回后填入)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_prompt_id             IS 'FK -> public.t_prompt(f_id) | 追溯该报告生成所用的提示词版本';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_status                IS '报告状态 (引用 t_status): 1=pending 10=active 20=failed 30=timeout 40=disabled';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_started_at            IS 'LLM 调用开始时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_finished_at           IS 'LLM 调用结束时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_error_code            IS '失败错误码';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_error_message         IS '失败错误详情';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_view_count            IS '查看次数';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_share_count           IS '分享次数';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_last_viewed_at        IS '最近一次查看时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_deleted               IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_report_human_pet_risk.f_created_at            IS '生成时间 (UTC)';


-- ============================================================
-- 4.5 性格报告 / Personality Report
-- ============================================================
CREATE TABLE public.t_report_personality (
    f_id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid           UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id              BIGINT       NOT NULL,
    f_pet_id               BIGINT       NOT NULL,
    f_lang                 VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id       INTEGER      NOT NULL,
    f_personality_tags     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_personality_traits   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_personality_dimensions JSONB      NOT NULL DEFAULT '{}'::jsonb,
    f_personality_analysis TEXT         NOT NULL DEFAULT '',
    f_core_answer          TEXT         NOT NULL DEFAULT '',
    f_core_basis           TEXT         NOT NULL DEFAULT '',
    f_pet_message          TEXT         NOT NULL DEFAULT '',
    f_owner_view           TEXT         NOT NULL DEFAULT '',
    f_pet_wish             TEXT         NOT NULL DEFAULT '',
    f_status_summary       TEXT         NOT NULL DEFAULT '',
    f_care_plan            JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_products             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_llm_resp             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_llm_input            JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_meta                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_prompt_id            BIGINT       NOT NULL DEFAULT -1,
    f_status               INT          NOT NULL DEFAULT 1,
    f_started_at           BIGINT       NOT NULL DEFAULT 0,
    f_finished_at          BIGINT       NOT NULL DEFAULT 0,
    f_error_code           VARCHAR(64)  NOT NULL DEFAULT '',
    f_error_message        TEXT         NOT NULL DEFAULT '',
    f_view_count           INT          NOT NULL DEFAULT 0,
    f_share_count          INT          NOT NULL DEFAULT 0,
    f_last_viewed_at       BIGINT       NOT NULL DEFAULT 0,
    f_deleted              INT2         NOT NULL DEFAULT 0,
    f_created_at           BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_pers_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_status  FOREIGN KEY (f_status)         REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_pers_prompt  FOREIGN KEY (f_prompt_id)      REFERENCES public.t_prompt(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_pers_traits  CHECK (jsonb_typeof(f_personality_traits) = 'object'),
    CONSTRAINT ck_t_report_pers_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_pers_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_report_personality IS '宠物性格画像报告';
COMMENT ON COLUMN public.t_report_personality.f_id                   IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=personality)';
COMMENT ON COLUMN public.t_report_personality.f_public_uid           IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_report_personality.f_user_id              IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_personality.f_pet_id               IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_personality.f_lang                 IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_personality.f_report_type_id       IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: personality';
COMMENT ON COLUMN public.t_report_personality.f_personality_tags     IS '性格标签 JSONB 数组 (引用参考 t_personality_tag, defined in 01_enums.sql)';
COMMENT ON COLUMN public.t_report_personality.f_personality_traits   IS '性格维度量化分 JSONB 对象, 7 个维度, 值域 0.0-1.0. Schema: {"extraversion":0.0-1.0, "boldness":0.0-1.0, "independence":0.0-1.0, "sociability_with_humans":0.0-1.0, "sociability_with_animals":0.0-1.0, "trainability":0.0-1.0, "environmental_adaptability":0.0-1.0}';
COMMENT ON COLUMN public.t_report_personality.f_personality_dimensions IS '性格维度描述 JSONB 对象, 5 个维度 (来自 Prompt 分析). Schema: {"personality_type":"...", "social_tendency":"...", "behavior_habits":"...", "training_advice":"...", "environment_fit":"..."}';
COMMENT ON COLUMN public.t_report_personality.f_personality_analysis IS 'AI 生成的文字解读 (Express 端纯文本, <=300字)';
COMMENT ON COLUMN public.t_report_personality.f_core_answer          IS '核心性格分析, 80-120字 (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_core_basis           IS '分析依据, 40-60字 (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_pet_message          IS '宠物想对主人说的话, 60-100字 (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_owner_view           IS '以宠物第一人称描述它对自己的看法, 60-100字 (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_pet_wish             IS '宠物的一个小愿望, 20-40字 (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_status_summary       IS '一句话总结, 20-30字 (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_care_plan            IS '护理方案 JSONB 数组 (互动方式/训练重点/环境优化) (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_products             IS '推荐商品 JSONB 数组 (Edge Function 端)';
COMMENT ON COLUMN public.t_report_personality.f_llm_resp       IS '完整 LLM 原始响应 JSONB';
COMMENT ON COLUMN public.t_report_personality.f_llm_input        IS '发起报告时的输入上下文快照';
COMMENT ON COLUMN public.t_report_personality.f_meta                 IS 'LLM 调用元信息 (LLM 返回后填入)';
COMMENT ON COLUMN public.t_report_personality.f_prompt_id            IS 'FK -> public.t_prompt(f_id) | 追溯该报告生成所用的提示词版本';
COMMENT ON COLUMN public.t_report_personality.f_status               IS '报告状态 (引用 t_status): 1=pending 10=active 20=failed 30=timeout 40=disabled';
COMMENT ON COLUMN public.t_report_personality.f_started_at           IS 'LLM 调用开始时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_personality.f_finished_at          IS 'LLM 调用结束时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_personality.f_error_code           IS '失败错误码';
COMMENT ON COLUMN public.t_report_personality.f_error_message        IS '失败错误详情';
COMMENT ON COLUMN public.t_report_personality.f_view_count           IS '查看次数';
COMMENT ON COLUMN public.t_report_personality.f_share_count          IS '分享次数';
COMMENT ON COLUMN public.t_report_personality.f_last_viewed_at       IS '最近一次查看时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_personality.f_deleted              IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_report_personality.f_created_at           IS '生成时间 (UTC)';


-- ============================================================
-- 4.6 体质分析报告 / Constitution Report
-- ============================================================
CREATE TABLE public.t_report_constitution (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid       UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id          BIGINT       NOT NULL,
    f_pet_id           BIGINT       NOT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id   INTEGER      NOT NULL,
    f_pet_constitution TEXT         NOT NULL DEFAULT '',
    f_owner_match      TEXT         NOT NULL DEFAULT '',
    f_season_advice    TEXT         NOT NULL DEFAULT '',
    f_diet_advice      TEXT         NOT NULL DEFAULT '',
    f_core_answer      TEXT         NOT NULL DEFAULT '',
    f_llm_resp         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_llm_input        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_meta             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_prompt_id        BIGINT       NOT NULL DEFAULT -1,
    f_status           INT          NOT NULL DEFAULT 1,
    f_started_at       BIGINT       NOT NULL DEFAULT 0,
    f_finished_at      BIGINT       NOT NULL DEFAULT 0,
    f_error_code       VARCHAR(64)  NOT NULL DEFAULT '',
    f_error_message    TEXT         NOT NULL DEFAULT '',
    f_view_count       INT          NOT NULL DEFAULT 0,
    f_share_count      INT          NOT NULL DEFAULT 0,
    f_last_viewed_at   BIGINT       NOT NULL DEFAULT 0,
    f_deleted          INT2         NOT NULL DEFAULT 0,
    f_created_at       BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_const_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_const_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_const_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_const_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_const_status  FOREIGN KEY (f_status)         REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_const_prompt  FOREIGN KEY (f_prompt_id)      REFERENCES public.t_prompt(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_const_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_const_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_report_constitution IS '宠物体质综合分析报告 (五行/中医体质)';
COMMENT ON COLUMN public.t_report_constitution.f_id               IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=constitution)';
COMMENT ON COLUMN public.t_report_constitution.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_report_constitution.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_constitution.f_pet_id           IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_constitution.f_lang             IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_constitution.f_report_type_id   IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: constitution';
COMMENT ON COLUMN public.t_report_constitution.f_pet_constitution IS '宠物体质类型分析, 40-80字';
COMMENT ON COLUMN public.t_report_constitution.f_owner_match      IS '人宠体质匹配度分析, 40-80字';
COMMENT ON COLUMN public.t_report_constitution.f_season_advice    IS '四季调理建议, 60-100字';
COMMENT ON COLUMN public.t_report_constitution.f_diet_advice      IS '饮食建议, 40-80字';
COMMENT ON COLUMN public.t_report_constitution.f_core_answer      IS '综合分析总结, 60-100字';
COMMENT ON COLUMN public.t_report_constitution.f_llm_resp   IS '完整 LLM 原始响应 JSONB';
COMMENT ON COLUMN public.t_report_constitution.f_llm_input    IS '发起报告时的输入上下文快照';
COMMENT ON COLUMN public.t_report_constitution.f_meta             IS 'LLM 调用元信息 (LLM 返回后填入)';
COMMENT ON COLUMN public.t_report_constitution.f_prompt_id        IS 'FK -> public.t_prompt(f_id) | 追溯该报告生成所用的提示词版本';
COMMENT ON COLUMN public.t_report_constitution.f_status           IS '报告状态 (引用 t_status): 1=pending 10=active 20=failed 30=timeout 40=disabled';
COMMENT ON COLUMN public.t_report_constitution.f_started_at       IS 'LLM 调用开始时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_constitution.f_finished_at      IS 'LLM 调用结束时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_constitution.f_error_code       IS '失败错误码';
COMMENT ON COLUMN public.t_report_constitution.f_error_message    IS '失败错误详情';
COMMENT ON COLUMN public.t_report_constitution.f_view_count       IS '查看次数';
COMMENT ON COLUMN public.t_report_constitution.f_share_count      IS '分享次数';
COMMENT ON COLUMN public.t_report_constitution.f_last_viewed_at   IS '最近一次查看时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_constitution.f_deleted          IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_report_constitution.f_created_at       IS '生成时间 (UTC)';


-- ============================================================
-- 4.7 医疗咨询报告 / Consultation Report
-- ============================================================
CREATE TABLE public.t_report_consultation (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_public_uid       UUID         NOT NULL DEFAULT public.rpc_gen_uuid(),
    f_user_id          BIGINT       NOT NULL,
    f_pet_id           BIGINT       NOT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_report_type_id   INTEGER      NOT NULL,
    f_judgment         TEXT         NOT NULL DEFAULT '',
    f_symptom_explain  TEXT         NOT NULL DEFAULT '',
    f_home_care        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_warning_sign     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_hospital_check   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    f_disclaimer       TEXT         NOT NULL DEFAULT '',
    f_llm_resp         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_llm_input        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_meta             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_prompt_id        BIGINT       NOT NULL DEFAULT -1,
    f_status           INT          NOT NULL DEFAULT 1,
    f_started_at       BIGINT       NOT NULL DEFAULT 0,
    f_finished_at      BIGINT       NOT NULL DEFAULT 0,
    f_error_code       VARCHAR(64)  NOT NULL DEFAULT '',
    f_error_message    TEXT         NOT NULL DEFAULT '',
    f_view_count       INT          NOT NULL DEFAULT 0,
    f_share_count      INT          NOT NULL DEFAULT 0,
    f_last_viewed_at   BIGINT       NOT NULL DEFAULT 0,
    f_deleted          INT2         NOT NULL DEFAULT 0,
    f_created_at       BIGINT  NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_report_consult_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_consult_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)         ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_consult_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_consult_type    FOREIGN KEY (f_report_type_id) REFERENCES public.t_report_type(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_consult_status  FOREIGN KEY (f_status)         REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT fk_t_report_consult_prompt  FOREIGN KEY (f_prompt_id)      REFERENCES public.t_prompt(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_report_consult_del     CHECK (f_deleted IN (0, 1)),
    CONSTRAINT uk_t_report_consult_public_uid UNIQUE (f_public_uid)
);
COMMENT ON TABLE  public.t_report_consultation IS '宠物医疗科普/咨询报告';
COMMENT ON COLUMN public.t_report_consultation.f_id               IS '主键 | 弱引用: t_share_record.f_report_id, t_interpretation_voice.f_report_id (in 06_share_interpretation.sql, f_report_type=consultation)';
COMMENT ON COLUMN public.t_report_consultation.f_public_uid       IS '对外暴露 UUID, 由 public.rpc_gen_uuid() 生成';
COMMENT ON COLUMN public.t_report_consultation.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_report_consultation.f_pet_id           IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql';
COMMENT ON COLUMN public.t_report_consultation.f_lang             IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_report_consultation.f_report_type_id   IS 'FK -> public.t_report_type(f_id) | defined in 01_enums.sql | 业务值约定: consultation';
COMMENT ON COLUMN public.t_report_consultation.f_judgment         IS '综合判断, 50-100字';
COMMENT ON COLUMN public.t_report_consultation.f_symptom_explain  IS '问题说明, 50-100字';
COMMENT ON COLUMN public.t_report_consultation.f_home_care        IS '居家护理建议 JSONB 数组, e.g. ["保持环境通风","每日测量体温3次"]';
COMMENT ON COLUMN public.t_report_consultation.f_warning_sign     IS '警示信号 JSONB 数组, e.g. ["持续呕吐超过24小时立即就医"]';
COMMENT ON COLUMN public.t_report_consultation.f_hospital_check   IS '建议检查项目 JSONB 数组, e.g. ["血常规检查","腹部B超"]';
COMMENT ON COLUMN public.t_report_consultation.f_disclaimer       IS '免责声明 (合规要求)';
COMMENT ON COLUMN public.t_report_consultation.f_llm_resp   IS '完整 LLM 原始响应 JSONB';
COMMENT ON COLUMN public.t_report_consultation.f_llm_input    IS '发起报告时的输入上下文快照';
COMMENT ON COLUMN public.t_report_consultation.f_meta             IS 'LLM 调用元信息 (LLM 返回后填入)';
COMMENT ON COLUMN public.t_report_consultation.f_prompt_id        IS 'FK -> public.t_prompt(f_id) | 追溯该报告生成所用的提示词版本';
COMMENT ON COLUMN public.t_report_consultation.f_status           IS '报告状态 (引用 t_status): 1=pending 10=active 20=failed 30=timeout 40=disabled';
COMMENT ON COLUMN public.t_report_consultation.f_started_at       IS 'LLM 调用开始时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_consultation.f_finished_at      IS 'LLM 调用结束时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_consultation.f_error_code       IS '失败错误码';
COMMENT ON COLUMN public.t_report_consultation.f_error_message    IS '失败错误详情';
COMMENT ON COLUMN public.t_report_consultation.f_view_count       IS '查看次数';
COMMENT ON COLUMN public.t_report_consultation.f_share_count      IS '分享次数';
COMMENT ON COLUMN public.t_report_consultation.f_last_viewed_at   IS '最近一次查看时间 (UTC ms)';
COMMENT ON COLUMN public.t_report_consultation.f_deleted          IS '软删除: 0=正常 1=已删除';
COMMENT ON COLUMN public.t_report_consultation.f_created_at       IS '生成时间 (UTC)';
