-- ============================================================
-- Gengdongta (更懂它) / 部署入口 / Deployment Orchestrator
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
--
-- 用法 (Usage):
--   psql 模式:
--     \i database/_run_all.sql
--   shell 模式:
--     for f in database/[0-9]*.sql; do psql -f "$f"; done
--
-- 加载顺序 (按依赖关系):
--   00_extensions -> 01_enums -> 02_rbac_users -> 03_pet_profile
--   -> 04_ai_reports -> 05_chat_comments -> 06_share_interpretation
--   -> 07_cms -> 08_subscription -> 09_ecommerce -> 10_iot
--   -> 11_agent -> 12_healthcare -> 13_welfare -> 99_indexes_views
--
-- 注意事项:
--   1. 部署前确保 PostgreSQL 15+ 已安装, 角色有 CREATE / EXTENSION 权限
--   2. Supabase Cloud: pgroonga 已在 Dashboard 启用, 自建需先 OS 安装
--   3. rpc/rpc_gen_uuid.sql 必须在 02_rbac_users.sql 之前手动执行 (用于 t_user.f_public_id DEFAULT)
--   4. 部署完成后, 再执行 gengdongta_db_init.sql 写入初始 enum 数据 / 系统用户 / 匿名哨兵
-- ============================================================

\echo '=== Gengdongta 数据库部署开始 ==='
\echo 'Step 1/15: 00_extensions.sql'
\i 00_extensions.sql
\echo 'Step 2/15: 01_enums.sql'
\i 01_enums.sql
\echo 'Step 3/15: 02_rbac_users.sql'
\i 02_rbac_users.sql
\echo 'Step 4/15: 03_pet_profile.sql'
\i 03_pet_profile.sql
\echo 'Step 5/15: 04_ai_reports.sql'
\i 04_ai_reports.sql
\echo 'Step 6/15: 05_chat_comments.sql'
\i 05_chat_comments.sql
\echo 'Step 7/15: 06_share_interpretation.sql'
\i 06_share_interpretation.sql
\echo 'Step 8/15: 07_cms.sql'
\i 07_cms.sql
\echo 'Step 9/15: 08_subscription.sql'
\i 08_subscription.sql
\echo 'Step 10/15: 09_ecommerce.sql'
\i 09_ecommerce.sql
\echo 'Step 11/15: 10_iot.sql'
\i 10_iot.sql
\echo 'Step 12/15: 11_agent.sql'
\i 11_agent.sql
\echo 'Step 13/15: 12_healthcare.sql'
\i 12_healthcare.sql
\echo 'Step 14/15: 13_welfare.sql'
\i 13_welfare.sql
\echo 'Step 15/15: 99_indexes_views.sql'
\i 99_indexes_views.sql
\echo '=== Gengdongta 数据库部署完成 ==='
\echo '下一步: 执行 gengdongta_db_init.sql 写入初始数据'
