-- ============================================================
-- Migration: 新增 体质 / 医疗 AI 报告表（MySQL）
-- Created: 2026-06-23
-- 幂等：可重复执行
-- ============================================================

SET NAMES utf8mb4;

-- AI 报告表 - 体质综合分析
CREATE TABLE IF NOT EXISTS t_report_constitution (
    f_id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid       CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_user_id          BIGINT       NOT NULL,
    f_pet_id           BIGINT       NOT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_input_content    TEXT         NOT NULL,
    f_owner_birthday   VARCHAR(32)  DEFAULT '',
    f_core_answer      TEXT         NOT NULL,
    f_pet_constitution TEXT,
    f_owner_match      TEXT,
    f_season_advice    TEXT,
    f_diet_advice      TEXT,
    f_raw_response     JSON         DEFAULT NULL,
    f_status_id        INT          NOT NULL DEFAULT 10,
    f_deleted          TINYINT      NOT NULL DEFAULT 0,
    f_created_at       BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id),
    KEY idx_pet (f_pet_id),
    KEY idx_created (f_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI 报告表 - 医疗科普
CREATE TABLE IF NOT EXISTS t_report_medical (
    f_id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid       CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_user_id          BIGINT       NOT NULL,
    f_pet_id           BIGINT       DEFAULT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_input_content    TEXT         NOT NULL,
    f_symptom          VARCHAR(512) DEFAULT '',
    f_duration         VARCHAR(64)  DEFAULT '',
    f_core_answer      TEXT         NOT NULL,
    f_symptom_explain  TEXT,
    f_home_care        JSON         DEFAULT NULL,
    f_warning_sign     JSON         DEFAULT NULL,
    f_hospital_check   JSON         DEFAULT NULL,
    f_raw_response     JSON         DEFAULT NULL,
    f_status_id        INT          NOT NULL DEFAULT 10,
    f_deleted          TINYINT      NOT NULL DEFAULT 0,
    f_created_at       BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id),
    KEY idx_pet (f_pet_id),
    KEY idx_created (f_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
