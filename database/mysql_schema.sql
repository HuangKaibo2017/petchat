-- ============================================================
-- PetChat (更懂它) / MySQL Schema
-- ============================================================
-- Version: 1.0.0
-- Created: 2026-06-23
-- Target: MySQL 8.0+ / MariaDB 10.5+
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 语言表
CREATE TABLE IF NOT EXISTS t_lang (
    f_code   VARCHAR(8)   PRIMARY KEY,
    f_name   VARCHAR(64)  NOT NULL,
    f_desc   VARCHAR(256) NOT NULL DEFAULT '',
    f_order  INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO t_lang (f_code, f_name, f_order) VALUES
('zh-CN', '简体中文', 1),
('en-US', 'English', 2),
('ja-JP', '日本語', 3);

-- 通用状态表
CREATE TABLE IF NOT EXISTS t_status (
    f_id      INT PRIMARY KEY,
    f_code    VARCHAR(32) NOT NULL UNIQUE,
    f_name    JSON NOT NULL,
    f_desc    JSON NOT NULL,
    f_order   INT NOT NULL DEFAULT 0,
    f_deleted TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO t_status (f_id, f_code, f_name, f_desc, f_order) VALUES
(-1, 'NOT_SET',    '{"zh-CN":"未设置","en-US":"Not Set"}',         '{}', 99),
(1,  'PENDING',    '{"zh-CN":"待审核","en-US":"Pending"}',          '{}', 1),
(10, 'ACTIVE',     '{"zh-CN":"激活","en-US":"Active"}',             '{}', 2),
(20, 'ARCHIVED',   '{"zh-CN":"已归档","en-US":"Archived"}',         '{}', 3),
(30, 'DISABLED',   '{"zh-CN":"已禁用","en-US":"Disabled"}',         '{}', 4),
(40, 'DELETED',    '{"zh-CN":"已删除","en-US":"Deleted"}',          '{}', 5);

-- 宠物类型
CREATE TABLE IF NOT EXISTS t_pet_type (
    f_id      INT PRIMARY KEY,
    f_name    JSON NOT NULL,
    f_desc    JSON NOT NULL,
    f_order   INT NOT NULL DEFAULT 0,
    f_deleted TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO t_pet_type (f_id, f_name, f_desc, f_order) VALUES
(1, '{"zh-CN":"狗","en-US":"Dog"}',       '{}', 1),
(2, '{"zh-CN":"猫","en-US":"Cat"}',       '{}', 2),
(3, '{"zh-CN":"其他","en-US":"Other"}',    '{}', 3);

-- 性别
CREATE TABLE IF NOT EXISTS t_gender (
    f_id      INT PRIMARY KEY,
    f_name    JSON NOT NULL,
    f_desc    JSON NOT NULL,
    f_order   INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO t_gender (f_id, f_name, f_desc, f_order) VALUES
(-1, '{"zh-CN":"未知","en-US":"Unknown"}',    '{}', 99),
(1,  '{"zh-CN":"公","en-US":"Male"}',         '{}', 1),
(2,  '{"zh-CN":"母","en-US":"Female"}',       '{}', 2);

-- 报告类型
CREATE TABLE IF NOT EXISTS t_report_type (
    f_id      INT PRIMARY KEY,
    f_code    VARCHAR(32) NOT NULL UNIQUE,
    f_name    JSON NOT NULL,
    f_desc    JSON NOT NULL,
    f_order   INT NOT NULL DEFAULT 0,
    f_deleted TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO t_report_type (f_id, f_code, f_name, f_desc, f_order) VALUES
(1, 'EMOTION',  '{"zh-CN":"情绪解读","en-US":"Emotion Analysis"}',    '{}', 1),
(2, 'HEALTH',   '{"zh-CN":"健康监测","en-US":"Health Check"}',        '{}', 2),
(3, 'RISK',     '{"zh-CN":"风险评估","en-US":"Risk Assessment"}',     '{}', 3),
(4, 'MEDICAL',  '{"zh-CN":"医疗科普","en-US":"Medical Education"}',   '{}', 4);

-- 用户表
CREATE TABLE IF NOT EXISTS t_user (
    f_id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid      CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_lang            VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_nickname        VARCHAR(64)  NOT NULL,
    f_avatar_url      VARCHAR(512) NOT NULL DEFAULT '',
    f_phone           VARCHAR(32)  NOT NULL DEFAULT '',
    f_email           VARCHAR(128) NOT NULL DEFAULT '',
    f_wx_openid       VARCHAR(64)  NOT NULL DEFAULT '',
    f_wx_unionid      VARCHAR(64)  NOT NULL DEFAULT '',
    f_password_hash   VARCHAR(256) NOT NULL DEFAULT '',
    f_status_id       INT          NOT NULL DEFAULT 10,
    f_meta_info       JSON         NOT NULL DEFAULT ('{}'),
    f_created_at      BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    f_updated_at      BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    UNIQUE KEY uk_public_uid (f_public_uid),
    UNIQUE KEY uk_wx_openid (f_wx_openid),
    KEY idx_status (f_status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 宠物表
CREATE TABLE IF NOT EXISTS t_pet (
    f_id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid       CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_user_id          BIGINT       NOT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_pet_type_id      INT          NOT NULL,
    f_breed_id         INT          DEFAULT NULL,
    f_name             VARCHAR(64)  NOT NULL,
    f_avatar_url       VARCHAR(512) NOT NULL DEFAULT '',
    f_gender_id        INT          NOT NULL DEFAULT -1,
    f_birth_date       DATE         DEFAULT NULL,
    f_birth_year       INT          DEFAULT NULL,
    f_birth_month      INT          DEFAULT NULL,
    f_weight           DECIMAL(6,2) DEFAULT NULL,
    f_sterilized       TINYINT(1)   NOT NULL DEFAULT 0,
    f_vaccinated       TINYINT(1)   NOT NULL DEFAULT 0,
    f_status_pet       INT          NOT NULL DEFAULT 1,
    f_status_id        INT          NOT NULL DEFAULT 10,
    f_personality_tags JSON         NOT NULL DEFAULT ('[]'),
    f_meta_info        JSON         NOT NULL DEFAULT ('{}'),
    f_deleted          TINYINT      NOT NULL DEFAULT 0,
    f_created_at       BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    f_updated_at       BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    UNIQUE KEY uk_public_uid (f_public_uid),
    KEY idx_user (f_user_id),
    KEY idx_type (f_pet_type_id),
    KEY idx_status (f_status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI 报告表 - 情绪
CREATE TABLE IF NOT EXISTS t_report_emotion (
    f_id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid       CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_user_id          BIGINT       NOT NULL,
    f_pet_id           BIGINT       NOT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_input_content    TEXT         NOT NULL,
    f_input_question   VARCHAR(512) DEFAULT '',
    f_input_numbers    JSON         DEFAULT NULL,
    f_div_system       VARCHAR(64)  DEFAULT '',
    f_core_answer      TEXT         NOT NULL,
    f_core_basis       TEXT,
    f_food_satisfaction VARCHAR(16) DEFAULT '★★★☆☆',
    f_mood_level       VARCHAR(16)  DEFAULT '★★★☆☆',
    f_body_status      VARCHAR(128) DEFAULT '',
    f_status_summary   TEXT,
    f_owner_view       TEXT,
    f_pet_message      TEXT,
    f_pet_wish         TEXT,
    f_product_recommend JSON        DEFAULT NULL,
    f_raw_response     JSON         DEFAULT NULL,
    f_status_id        INT          NOT NULL DEFAULT 10,
    f_deleted          TINYINT      NOT NULL DEFAULT 0,
    f_created_at       BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id),
    KEY idx_pet (f_pet_id),
    KEY idx_created (f_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI 报告表 - 健康
CREATE TABLE IF NOT EXISTS t_report_health (
    f_id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid       CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_user_id          BIGINT       NOT NULL,
    f_pet_id           BIGINT       NOT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_input_content    TEXT         NOT NULL,
    f_input_question   VARCHAR(512) DEFAULT '',
    f_input_numbers    JSON         DEFAULT NULL,
    f_div_system       VARCHAR(64)  DEFAULT '',
    f_core_answer      TEXT         NOT NULL,
    f_core_basis       TEXT,
    f_health_score     INT          DEFAULT 80,
    f_health_level     VARCHAR(32)  DEFAULT 'normal',
    f_symptom_analysis TEXT,
    f_diet_advice      TEXT,
    f_exercise_advice  TEXT,
    f_care_tips        TEXT,
    f_vet_advice       TEXT,
    f_raw_response     JSON         DEFAULT NULL,
    f_status_id        INT          NOT NULL DEFAULT 10,
    f_deleted          TINYINT      NOT NULL DEFAULT 0,
    f_created_at       BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id),
    KEY idx_pet (f_pet_id),
    KEY idx_created (f_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI 报告表 - 风险
CREATE TABLE IF NOT EXISTS t_report_risk (
    f_id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid       CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_user_id          BIGINT       NOT NULL,
    f_pet_id           BIGINT       NOT NULL,
    f_lang             VARCHAR(8)   NOT NULL DEFAULT 'zh-CN',
    f_input_content    TEXT         NOT NULL,
    f_input_question   VARCHAR(512) DEFAULT '',
    f_input_numbers    JSON         DEFAULT NULL,
    f_div_system       VARCHAR(64)  DEFAULT '',
    f_core_answer      TEXT         NOT NULL,
    f_core_basis       TEXT,
    f_risk_level       VARCHAR(32)  DEFAULT 'low',
    f_risk_score       INT          DEFAULT 10,
    f_risk_factors     JSON         DEFAULT NULL,
    f_prevention       TEXT,
    f_emergency_guide  TEXT,
    f_raw_response     JSON         DEFAULT NULL,
    f_status_id        INT          NOT NULL DEFAULT 10,
    f_deleted          TINYINT      NOT NULL DEFAULT 0,
    f_created_at       BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id),
    KEY idx_pet (f_pet_id),
    KEY idx_created (f_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- 聊天会话
CREATE TABLE IF NOT EXISTS t_chat_session (
    f_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_user_id      BIGINT     NOT NULL,
    f_pet_id       BIGINT     NOT NULL,
    f_lang         VARCHAR(8) NOT NULL DEFAULT 'zh-CN',
    f_title        VARCHAR(128) NOT NULL DEFAULT '',
    f_status_id    INT        NOT NULL DEFAULT 10,
    f_created_at   BIGINT     NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    f_updated_at   BIGINT     NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id),
    KEY idx_pet (f_pet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 聊天消息
CREATE TABLE IF NOT EXISTS t_chat_message (
    f_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_session_id    BIGINT       NOT NULL,
    f_role          VARCHAR(16)  NOT NULL,
    f_content       TEXT         NOT NULL,
    f_meta_info     JSON         NOT NULL DEFAULT ('{}'),
    f_created_at    BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_session (f_session_id),
    KEY idx_created (f_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 收藏
CREATE TABLE IF NOT EXISTS t_favorite (
    f_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_user_id      BIGINT       NOT NULL,
    f_target_id    VARCHAR(64)  NOT NULL,
    f_target_type  VARCHAR(32)  NOT NULL DEFAULT 'report',
    f_created_at   BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    UNIQUE KEY uk_user_target (f_user_id, f_target_id, f_target_type),
    KEY idx_user (f_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商城商品
CREATE TABLE IF NOT EXISTS t_product (
    f_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_public_uid   CHAR(36)     NOT NULL DEFAULT (UUID()),
    f_name         VARCHAR(128) NOT NULL,
    f_desc         TEXT         NOT NULL,
    f_category     VARCHAR(32)  NOT NULL DEFAULT 'food',
    f_price        DECIMAL(10,2) NOT NULL DEFAULT 0,
    f_image_url    VARCHAR(512) NOT NULL DEFAULT '',
    f_stock        INT          NOT NULL DEFAULT 999,
    f_status_id    INT          NOT NULL DEFAULT 10,
    f_deleted      TINYINT      NOT NULL DEFAULT 0,
    f_created_at   BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_category (f_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO t_product (f_name, f_desc, f_category, f_price, f_image_url) VALUES
('皇家猫粮 2kg', '高品质猫粮，营养均衡', 'food', 168, ''),
('宠物自动喂食器', '智能定时定量喂食', 'device', 299, ''),
('逗猫棒套装', '三种替换头，猫咪最爱', 'toy', 29, ''),
('犬用钙片 120片', '强壮骨骼，增强体质', 'health', 89, '');

-- 订单
CREATE TABLE IF NOT EXISTS t_order (
    f_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_user_id      BIGINT       NOT NULL,
    f_product_id   BIGINT       DEFAULT NULL,
    f_product_name VARCHAR(128) NOT NULL DEFAULT '',
    f_price        DECIMAL(10,2) NOT NULL DEFAULT 0,
    f_quantity     INT          NOT NULL DEFAULT 1,
    f_status       VARCHAR(32)  NOT NULL DEFAULT 'paid',
    f_meta_info    JSON         NOT NULL DEFAULT ('{}'),
    f_created_at   BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 宠物医院
CREATE TABLE IF NOT EXISTS t_hospital (
    f_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_name         VARCHAR(128) NOT NULL,
    f_address      VARCHAR(256) NOT NULL DEFAULT '',
    f_phone        VARCHAR(32)  NOT NULL DEFAULT '',
    f_rating       DECIMAL(2,1) DEFAULT 4.5,
    f_tags         JSON         DEFAULT ('[]'),
    f_business_hours VARCHAR(128) DEFAULT '09:00-18:00',
    f_image_url    VARCHAR(512) NOT NULL DEFAULT '',
    f_lat          DOUBLE       DEFAULT NULL,
    f_lng          DOUBLE       DEFAULT NULL,
    f_status_id    INT          NOT NULL DEFAULT 10,
    f_deleted      TINYINT      NOT NULL DEFAULT 0,
    f_created_at   BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_rating (f_rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO t_hospital (f_name, f_address, f_phone, f_rating, f_tags) VALUES
('宠爱国际动物医院', '北京市朝阳区建国路88号', '010-88886666', 4.8, '["疫苗","手术","体检"]'),
('瑞鹏宠物医院',     '北京市海淀区中关村大街1号', '010-66668888', 4.6, '["疫苗","美容","寄养"]');

-- 文件上传记录
CREATE TABLE IF NOT EXISTS t_upload (
    f_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    f_user_id      BIGINT       NOT NULL,
    f_pet_id       BIGINT       DEFAULT NULL,
    f_category     VARCHAR(32)  NOT NULL DEFAULT 'general',
    f_file_url     VARCHAR(512) NOT NULL,
    f_file_name    VARCHAR(256) NOT NULL DEFAULT '',
    f_file_size    INT          DEFAULT 0,
    f_mime_type    VARCHAR(64)  DEFAULT '',
    f_created_at   BIGINT       NOT NULL DEFAULT (CAST(DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') AS UNSIGNED)),
    KEY idx_user (f_user_id),
    KEY idx_pet (f_pet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
