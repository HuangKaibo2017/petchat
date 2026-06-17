-- ============================================================
-- PetChat (灵犀宠语) / 0. 扩展 / Extensions
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   启用数据库所需扩展, 必须在所有建表脚本之前执行
--
-- 依赖:
--   无 (第 0 层)
--
-- 依赖本文件的脚本 (按加载顺序):
--   01_enums.sql
--   02_rbac_users.sql
--   03_pet_profile.sql
--   04_ai_reports.sql
--   05_chat_comments.sql
--   06_share_interpretation.sql
--   07_cms.sql
--   08_subscription.sql
--   09_ecommerce.sql
--   10_iot.sql
--   11_agent.sql
--   12_healthcare.sql
--   13_welfare.sql
--   99_indexes_views.sql
-- ============================================================


-- ============================================================
-- 0. 扩展 / Extensions
-- ============================================================
-- Supabase Cloud: pgroonga 已在 Dashboard 启用
-- 自建: 需先在 OS 安装, 然后执行 CREATE EXTENSION
CREATE EXTENSION IF NOT EXISTS pgroonga   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
