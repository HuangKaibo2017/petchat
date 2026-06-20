-- ============================================================
-- Gengdongta (更懂它) / 5. 聊天与评论 / Chat & Comments
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   聊天会话 + 通用评论/评分
--
-- 依赖:
--   01_enums.sql       (t_session_status, t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--   03_pet_profile.sql (t_pet)
--
-- 被本文件引用的脚本: 无 (本文件为叶子模块)
--
-- 设计原则 (Chat & Comments Principles):
--   1. 聊天会话与宠物是弱关联: 删宠物时改会话状态 (f_status_session=2) 而非 ON DELETE SET NULL
--   2. 评论通用化: f_target_type + f_target_id 组合, 配合 CHECK 白名单支持多目标
--   3. 评分: -1 = 未评分, 1-5 = 整数评分
-- ============================================================


-- ============================================================
-- 5.1 聊天历史 / Chat History
-- ============================================================
CREATE TABLE public.t_chat_history (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id       BIGINT      NOT NULL,
    f_pet_id        BIGINT,
    f_lang          VARCHAR(8)  NOT NULL DEFAULT 'zh-CN',
    f_status_session INTEGER    NOT NULL DEFAULT 1,
    f_chat_history  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    f_meta_info     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    f_started_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_ended_at      TIMESTAMPTZ,
    f_status_user   INTEGER     NOT NULL DEFAULT 1,
    CONSTRAINT fk_t_chat_history_user    FOREIGN KEY (f_user_id)        REFERENCES public.t_user(f_id)            ON DELETE NO ACTION,
    CONSTRAINT fk_t_chat_history_pet     FOREIGN KEY (f_pet_id)         REFERENCES public.t_pet(f_id)             ON DELETE NO ACTION,
    CONSTRAINT fk_t_chat_history_lang    FOREIGN KEY (f_lang)           REFERENCES public.t_lang(f_code)          ON DELETE NO ACTION,
    CONSTRAINT fk_t_chat_history_status  FOREIGN KEY (f_status_session) REFERENCES public.t_session_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_chat_history_user_st FOREIGN KEY (f_status_user)    REFERENCES public.t_status(f_id)          ON DELETE NO ACTION,
    CONSTRAINT ck_t_chat_history_history CHECK (jsonb_typeof(f_chat_history) = 'array'),
    CONSTRAINT ck_t_chat_history_ended   CHECK (f_ended_at IS NULL OR f_ended_at >= f_started_at)
);
COMMENT ON TABLE  public.t_chat_history IS '聊天历史 (用户与 AI 的对话上下文)';
COMMENT ON COLUMN public.t_chat_history.f_id             IS '主键';
COMMENT ON COLUMN public.t_chat_history.f_user_id        IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 会话创建者';
COMMENT ON COLUMN public.t_chat_history.f_pet_id         IS 'FK -> public.t_pet(f_id) | defined in 03_pet_profile.sql | 弱关联 (可空); 宠物删除时应用层将 f_status_session=2 关闭会话, 而非 FK SET NULL';
COMMENT ON COLUMN public.t_chat_history.f_lang           IS 'FK -> public.t_lang(f_code) | defined in 01_enums.sql | 会话语言';
COMMENT ON COLUMN public.t_chat_history.f_status_session IS 'FK -> public.t_session_status(f_id) | defined in 01_enums.sql | 1=active 2=closed 3=archived';
COMMENT ON COLUMN public.t_chat_history.f_chat_history   IS '聊天历史 JSONB 数组, e.g. [{"role":"user","content":"...","at":"2026-06-17T..."}]';
COMMENT ON COLUMN public.t_chat_history.f_meta_info      IS '扩展元数据 (模型/token消耗/...)';
COMMENT ON COLUMN public.t_chat_history.f_started_at     IS '会话开始时间 (UTC)';
COMMENT ON COLUMN public.t_chat_history.f_ended_at       IS '会话结束时间 (UTC, 可空) | 约束: >= f_started_at';
COMMENT ON COLUMN public.t_chat_history.f_status_user    IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';


-- ============================================================
-- 5.2 评论 / 评分 / Comment
-- ============================================================
CREATE TABLE public.t_comment (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id     BIGINT       NOT NULL,
    f_target_type VARCHAR(32)  NOT NULL,
    f_target_id   BIGINT       NOT NULL,
    f_rating      INTEGER      NOT NULL DEFAULT -1,
    f_content     TEXT         NOT NULL DEFAULT '',
    f_meta_info   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_status_user INTEGER      NOT NULL DEFAULT 1,
    f_created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_comment_user   FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_comment_status FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_comment_rating CHECK (f_rating = -1 OR f_rating BETWEEN 1 AND 5),
    CONSTRAINT ck_t_comment_target CHECK (f_target_type IN ('hospital','doctor','product','order','agent','service','activity','pet','user'))
);
COMMENT ON TABLE  public.t_comment IS '通用评论/评分 (多态目标, 通过 f_target_type + f_target_id 定位)';
COMMENT ON COLUMN public.t_comment.f_id          IS '主键';
COMMENT ON COLUMN public.t_comment.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 评论者';
COMMENT ON COLUMN public.t_comment.f_target_type IS '目标类型 (白名单): hospital / doctor / product / order / agent / service / activity / pet / user';
COMMENT ON COLUMN public.t_comment.f_target_id   IS '目标 ID (弱引用, 实际表由 f_target_type 决定)';
COMMENT ON COLUMN public.t_comment.f_rating      IS '评分: -1=未评分 1-5 整数 | 业务表只对支持评分的 target_type 校验';
COMMENT ON COLUMN public.t_comment.f_content     IS '评论内容 (可空字符串)';
COMMENT ON COLUMN public.t_comment.f_meta_info   IS '扩展元数据 (图片/回复/匿名标记)';
COMMENT ON COLUMN public.t_comment.f_status_user IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_comment.f_created_at  IS '创建时间 (UTC)';
CREATE INDEX idx_t_comment_target ON public.t_comment(f_target_type, f_target_id);
CREATE INDEX idx_t_comment_user   ON public.t_comment(f_user_id);
