-- ============================================================
-- Gengdongta (更懂它) / 2b. 用户去重 / User Dedup (一次性)
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-18
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   一次性清理 t_user 表中的重复手机号和邮箱。
--   优先保留 f_id 最小（最早）的记录，删除较新的重复项。
--
-- ⚠️  警告: 此脚本包含 DESTRUCTIVE DELETE 操作！
--   仅在部署唯一索引之前执行一次。
--   执行前建议先导出受影响的行：
--     SELECT * FROM public.t_user WHERE f_phone IN (
--       SELECT f_phone FROM public.t_user WHERE f_phone <> '' GROUP BY f_phone HAVING count(*) > 1
--     );
--
-- 依赖:
--   02_rbac_users.sql (必须先创建 t_user 表)
--
-- 说明:
--   本脚本从 02_rbac_users.sql 中移出，避免重复执行导致数据丢失。
--   首次部署时在 02_rbac_users.sql 之后、创建唯一索引之前执行。
--   后续重复运行是安全的（DELETE 无匹配行时不做任何操作）。
-- ============================================================

DO $$
DECLARE
    dup_phone_count INTEGER;
    dup_email_count INTEGER;
BEGIN
    SELECT count(*) INTO dup_phone_count
    FROM public.t_user a
    JOIN public.t_user b ON a.f_phone = b.f_phone AND a.f_phone <> ''
    WHERE a.f_id > b.f_id;

    SELECT count(*) INTO dup_email_count
    FROM public.t_user a
    JOIN public.t_user b ON a.f_email = b.f_email AND a.f_email <> ''
    WHERE a.f_id > b.f_id;

    IF dup_phone_count > 0 THEN
        RAISE WARNING '发现 % 条重复手机号，将删除较新记录', dup_phone_count;
    END IF;

    IF dup_email_count > 0 THEN
        RAISE WARNING '发现 % 条重复邮箱，将删除较新记录', dup_email_count;
    END IF;
END $$;

-- 清理重复手机 (保留最早创建的记录)
DELETE FROM public.t_user a
USING public.t_user b
WHERE a.f_id > b.f_id AND a.f_phone = b.f_phone AND a.f_phone <> '';

-- 清理重复邮箱 (保留最早创建的记录)
DELETE FROM public.t_user a
USING public.t_user b
WHERE a.f_id > b.f_id AND a.f_email = b.f_email AND a.f_email <> '';
