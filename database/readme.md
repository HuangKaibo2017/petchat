# PetChat 数据库 / Database

> PostgreSQL 15+ / Supabase Cloud (pgroonga 可用)
> Version: 4.0.0  |  Last Refactored: 2026-06-17

本目录为 PetChat (更懂它) 数据库 DDL 入口，按 **业务模块** + **功能分层** 原则拆分为 15 个有序文件，方便增量维护与按需加载。

---

## 一、文件结构

### 1.1 当前主文件 (推荐使用)

| 顺序 | 文件 | 用途 | 表数量 | 依赖 |
|---|---|---|---|---|
| 00 | [00_extensions.sql](00_extensions.sql) | 扩展: pgroonga / pgcrypto | 0 | — |
| 01 | [01_enums.sql](01_enums.sql) | 基础枚举层: t_lang + 19 张 enum 表 | 20 | 00 |
| 02 | [02_rbac_users.sql](02_rbac_users.sql) | 身份与权限: 角色 / API / 用户 | 5 | 00, 01 |
| 03 | [03_pet_profile.sql](03_pet_profile.sql) | 宠物域: 宠物主表 + 照片 | 2 | 01, 02 |
| 04 | [04_ai_reports.sql](04_ai_reports.sql) | AI 域: 4 张报告 + 提示词版本化 | 5 | 01, 02, 03 |
| 05 | [05_chat_comments.sql](05_chat_comments.sql) | 聊天 + 通用评论/评分 | 2 | 01, 02, 03 |
| 06 | [06_share_interpretation.sql](06_share_interpretation.sql) | 分享 + AI 语音解读 | 2 | 01, 02, 04 |
| 07 | [07_cms.sql](07_cms.sql) | 运营内容: Banner / 活动 / 落地页 | 3 | 01 |
| 08 | [08_subscription.sql](08_subscription.sql) | 订阅域: 配额 / 套餐 / 订阅 / 使用 | 6 | 01, 02 |
| 09 | [09_ecommerce.sql](09_ecommerce.sql) | 电商域: 商品 / 库存 / 购物车 / 订单 / 物流 | 12 | 01, 02 |
| 10 | [10_iot.sql](10_iot.sql) | IoT 设备 | 3 | 01, 02 |
| 11 | [11_agent.sql](11_agent.sql) | 代理商: 申请 / 提现 / 收益 | 3 | 01, 02 |
| 12 | [12_healthcare.sql](12_healthcare.sql) | 医疗: 医院 / 医生 / 预约 | 3 | 01, 02, 03 |
| 13 | [13_welfare.sql](13_welfare.sql) | 公益与寻宠: 救助 / 领养 / 志愿者 / 捐款 / 寻宠 | 5 | 01, 02, 03 |
| 99 | [99_indexes_views.sql](99_indexes_views.sql) | 跨模块索引 + 视图 | 0 (views) | 全部 |
| — | [_run_all.sql](_run_all.sql) | 一键部署入口 (`\i` 编排) | 0 | 全部 |

**合计: 15 个 DDL 文件 + 1 个入口 + 1 个本 readme**

### 1.2 其它

| 文件 | 说明 |
|---|---|
| [petchat_db_init.sql](petchat_db_init.sql) | 初始数据 (enum 值 / 系统用户 / 匿名哨兵), 不动 |
| [rpc/rpc_gen_uuid.sql](rpc/rpc_gen_uuid.sql) | UUID 生成函数, t_user.f_public_id DEFAULT 依赖 |

---

## 二、加载顺序与依赖图

```
00_extensions
    └─→ 01_enums  (t_lang + 19 enum)
            └─→ 02_rbac_users  (t_user)
                    ├─→ 03_pet_profile
                    │      ├─→ 04_ai_reports
                    │      │      └─→ 06_share_interpretation
                    │      └─→ 05_chat_comments
                    │      └─→ 12_healthcare
                    │      └─→ 13_welfare
                    ├─→ 08_subscription
                    ├─→ 09_ecommerce
                    ├─→ 10_iot
                    ├─→ 11_agent
                    └─→ 07_cms  (仅依赖 01)
99_indexes_views  (依赖全部 00-13)
```

**文件名前缀数字保证字典序 = 拓扑序**, 可直接 `for f in [0-9]*.sql; do psql -f $f; done`。

---

## 三、拆分原则

### 3.1 半功能 / 半业务

| 层级 | 范围 | 文件 |
|---|---|---|
| 基础层 | 所有 enum 表 (被几乎所有业务表 FK) | 01_enums |
| 身份层 | 角色 / 用户 (核心主键源) | 02_rbac_users |
| 业务层 | 按业务域切分 | 03 - 13 |
| 性能层 | 跨模块索引 + 视图 | 99_indexes_views |

**为什么 enums 集中？**

- 19 张 enum 表被 ~30 张业务表 FK 引用
- 加载顺序必须最前, 集中后只需看一个文件即可掌握所有"字典数据"
- 跨域更新 (e.g. 新增 payment_status) 只改一个文件, 风险可控

### 3.2 业务域切分

按"内聚度"成对打包, 14 个域压缩到 11 个文件:

| 域 | 文件 | 表 |
|---|---|---|
| 宠物 | 03_pet_profile | t_pet, t_pet_photo |
| AI 报告 | 04_ai_reports | t_prompt + 4 张 report |
| 互动 | 05_chat_comments | t_chat_session, t_comment |
| 分享 | 06_share_interpretation | t_share_record, t_interpretation_voice |
| 运营 | 07_cms | t_banner, t_activity, t_landing_page |
| 订阅 | 08_subscription | t_feature_quota, t_plan, t_plan_feature, t_user_subscription, t_user_quota, t_usage_record |
| 电商 | 09_ecommerce | t_product_category, t_product_spu(+i18n), t_product_sku, t_inventory_lot/balance/movement/serial, t_cart, t_order(+item), t_shipment |
| IoT | 10_iot | t_device, t_user_device, t_device_sync |
| 代理 | 11_agent | t_agent_application, t_agent_withdrawal, t_agent_revenue |
| 医疗 | 12_healthcare | t_hospital, t_doctor, t_appointment |
| 公益 | 13_welfare | t_rescue_request, t_adoption, t_volunteer, t_donation, t_record_lost_pet |

---

## 四、字段注释规范

**每个字段必须有注释**, 格式统一, 方便检索 / 文档生成 / AI 辅助。

### 4.1 三种注释模板

#### 模板 A: FK 字段
```
'FK -> public.t_<table>(f_<col>) | [业务含义] | defined in <file>.sql'
```
例:
```sql
COMMENT ON COLUMN public.t_pet.f_pet_type_id IS
    'FK -> public.t_pet_type(f_id) | defined in 01_enums.sql';
```

#### 模板 B: 软删/状态字段
```
'FK -> public.t_status(f_id) | [业务值列表] | defined in 01_enums.sql'
```
例:
```sql
COMMENT ON COLUMN public.t_user.f_status_user IS
    'FK -> public.t_status(f_id) | 1=active 2=disabled 3=deleted 4=archived 5=pending | defined in 01_enums.sql';
```

#### 模板 C: 普通业务字段
```
'[业务含义] | 关联: [field1, field2 / table.field]'
```
例:
```sql
COMMENT ON COLUMN public.t_pet.f_birth_year IS
    '出生年份 (f_birth_date 为空时使用), 1980-2100 | 互斥: t_pet.f_birth_date / t_pet.f_birth_month';
```

### 4.2 弱引用注释约定

跨表弱引用 (无 FK 约束) 必须显式说明目标表:
```
'弱引用: 报告 ID | 实际表由 f_report_type 决定: emotion|health|human_pet_risk|personality | defined in 04_ai_reports.sql'
```

### 4.3 通用约定

- **哨兵**: `f_id = -1` 表示 NOT-SET (除 t_lang 外, 所有 enum 都有)
- **软删**: `f_status_user = 3 (deleted)` (引用 t_status)
- **业务态**: `f_status_xxx` 字段, 业务值由应用层在 t_status 内复用 (e.g. t_pet.f_status_pet: 1=在册 2=走失 3=已送养 4=已故 5=已归档)
- **复合 PK**: 用于版本化 (e.g. t_feature_quota 的 (f_ver, f_code))

---

## 五、部署指南

### 5.1 一键部署 (推荐)

```bash
# psql 模式
psql -d petchat -f database/_run_all.sql

# 或 shell 循环
for f in database/[0-9]*.sql; do psql -d petchat -f "$f"; done
```

`_run_all.sql` 内会按 00 → 99 顺序 `\i` 每个文件, 并打印进度。

### 5.2 完整部署顺序

```bash
# 0. (Supabase Cloud 跳过) 启用扩展
psql -d petchat -c "CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA extensions;"

# 1. 部署 DDL
psql -d petchat -f database/_run_all.sql

# 2. 写入初始数据 (enum 值 / 系统用户 / 匿名哨兵)
psql -d petchat -f database/petchat_db_init.sql
```

> **注意**: `rpc/rpc_gen_uuid.sql` 必须在 02_rbac_users.sql 之前手动执行, 用于 `t_user.f_public_id` DEFAULT。
> `_run_all.sql` 不包含此步骤, 需单独执行。

### 5.3 验证

部署后建议执行以下检查:
```sql
-- 1. 确认所有 enum 已初始化哨兵 -1
SELECT 't_status' as t, count(*) FROM t_status WHERE f_id = -1
UNION ALL
SELECT 't_payment_status', count(*) FROM t_payment_status WHERE f_id = -1
UNION ALL
SELECT 't_shipping_status', count(*) FROM t_shipping_status WHERE f_id = -1
-- ... 其它 19 张 enum

-- 2. 确认表数量 (期望 51 张业务表 + 4 视图)
SELECT count(*) FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 3. 确认所有 FK 约束有效 (无 dangling reference)
SELECT conrelid::regclass, conname
  FROM pg_constraint
 WHERE contype = 'f' AND NOT EXISTS (
   SELECT 1 FROM pg_class c WHERE c.oid = confrelid
 );
-- 应返回 0 行
```

---

## 六、设计原则 (Database Design Principles)

1. **JSONB i18n 模式**: 概念枚举 (t_pet_type / t_status / t_report_type ...) 用 `f_name JSONB` 存多语言, 单一 IDENTITY PK; 业务态枚举 (t_payment_status / t_shipping_status ...) 额外加 `f_code VARCHAR(32) UNIQUE` 表达业务语义
2. **哨兵 -1**: 所有 enum 预置 `f_id = -1` 哨兵 = NOT-SET; 业务表 FK 必填时用哨兵而非 NULL, NULL 留给"业务不适用"语义
3. **软删**: 统一 `f_status_user` 引用 `t_status.f_id`, `3=deleted`; 不使用物理删除
4. **物理外键**: 默认 `ON DELETE NO ACTION`; 仅"强生命周期父子"用 `CASCADE` (e.g. t_order_item / t_plan_feature / t_landing_page)
5. **CHECK 守恒**: 关键业务字段必有 CHECK, e.g. `f_final_amount = f_total_amount - f_discount_amount` (订单守恒)
6. **部分唯一索引**: 可空唯一字段用 `CREATE UNIQUE INDEX ... WHERE f_phone <> ''`, 允许"未填写"
7. **复合 PK 版本化**: 不可变配置 (套餐/配额) 用 `(f_ver, f_code)` 复合 PK, 永不改老版本
8. **JSONB i18n 引用方注释**: 每个 enum 字段的注释里列出所有引用方表, 反向检索方便
9. **弱引用透明化**: 跨表弱引用 (e.g. f_report_id) 在注释中明确"实际表由 f_report_type 决定"
10. **CJK 全文搜索**: Supabase Cloud 用 pgroonga, 自建用 zhparser / pg_bigm; 索引在 99_indexes_views.sql

---

## 七、变更指南

### 7.1 新增 enum 值

- 仅修改 [01_enums.sql](01_enums.sql) 的目标 enum 表
- 不需要改任何业务表 (业务表用 FK 自动同步)
- 在 [petchat_db_init.sql](petchat_db_init.sql) 加初始数据

### 7.2 新增业务表

- 选最贴近的模块文件, 或新建 `<NN>_<name>.sql` (NN 在 03-13 之间插入, 后续文件统一 +1)
- 在文件头部的"依赖"和"被引用"块里双向更新
- 在 [readme.md](readme.md) 表格里加一行
- 在 [_run_all.sql](_run_all.sql) 里加 `\i` 行
- 新表字段注释遵循本文档 §四 规范

### 7.3 修改字段

- 找到该字段所在文件, 改 `COMMENT ON COLUMN`
- 若涉及 CHECK 约束变更, 需先迁移 (DROP + ADD CHECK) 而非直接改
- 跨文件的影响 (e.g. 删 enum f_code) 需 grep 所有引用方

### 7.4 加索引

- 单表高频索引: 内联在表文件末尾
- 跨表/跨 enum: 加到 [99_indexes_views.sql](99_indexes_views.sql)
- 命名约定: `idx_<table>_<col1>[_<col2>]_[DESC]`

---

## 八、迁移说明

原 `petchat_database_design.sql` (1100+ 行) + `petchat_ecommerce.sql` (540 行) 已于 2026-06-17 拆分为 15 个模块文件并删除。所有表结构已完整迁移，后续 DDL 变更按本文档 §七 在新文件里追加。

---

## 九、附录

### 9.1 表统计

| 类型 | 数量 | 文件 |
|---|---|---|
| 语言表 | 1 | 01 |
| 概念 enum (JSONB i18n) | 9 | 01 |
| 业务 enum (f_code) | 10 | 01 |
| 核心主表 (user/pet/order) | 5 | 02, 03, 09 |
| 业务主表 | ~26 | 04-13 |
| 业务从表/子表 | ~10 | 04-13 |
| **合计** | **~51** | — |
| 视图 | 4 | 99 |

### 9.2 待办 (TODO)

- [ ] pgroonga 索引 (CJK 全文搜索) 模板化到 99
- [ ] 触发器: t_updated_at 自动维护
- [ ] RLS (Row Level Security) 策略文件 `XX_rls.sql` 按需
- [ ] 数据库审计表 (t_audit_log) 设计
- [ ] 备份/恢复脚本 (pg_dump 模板)

---

## 十、设计标准 (Design Standards)

> 遵循 [Supabase Postgres Best Practices](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/SKILL.md) 技能规范。
> 以下为 PetChat 项目采纳的 Postgres 数据库设计标准清单, 按优先级排列。

### 10.1 Schema Design (schema-)

| # | 标准 | 说明 | PetChat 实施 |
|---|---|---|---|
| S01 | [主键策略](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/schema-primary-keys.md) | BIGINT IDENTITY PK + UUID public_id | `f_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`; `f_public_id UUID DEFAULT rpc_gen_uuid()` |
| S02 | [小写标识符 + t_/f_ 前缀](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md) | t_ 表前缀, f_ 字段前缀, idx_t_ 索引前缀 | 所有表/字段/索引均遵循 Hungarian 命名 |
| S03 | [逻辑外键 + -1 默认值](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md) | 用逻辑 FK (BIGINT DEFAULT -1) 替代物理 FK; -1 哨兵 = 无关联 | PetChat 全部 FK 为逻辑引用, `DEFAULT -1`, 注释标注目标表 |
| S04 | [合适的数据类型](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/schema-data-types.md) | BIGINT ID, TEXT/VARCHAR(n), BIGINT 时间戳, SMALLINT 状态 | 时间戳: `BIGINT` 格式 YYYYMMDDHHMMSS; 状态: `SMALLINT DEFAULT -1`; 金额: `NUMERIC(10,2)` |
| S05 | [大表分区](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/schema-partitioning.md) | >100M 行的大表按时间范围分区 | 暂未应用 (预留: t_chat_session, t_usage_record) |

### 10.2 Query Performance (query-)

| # | 标准 | 说明 | PetChat 实施 |
|---|---|---|---|
| Q01 | [保守索引策略](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/query-missing-indexes.md) | **默认不建索引**, 仅在高频 JOIN / 业务关键查询 / 明确性能需求时建 | PK + UNIQUE 自动建索引; 其余按需添加到 99_indexes_views.sql |
| Q02 | [复合索引](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/query-composite-indexes.md) | 多列查询用复合索引, 等值列在前, 范围列在后 | `idx_t_xxx_f_status_f_created_at` |
| Q03 | [部分索引](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/query-partial-indexes.md) | 仅索引 WHERE 条件匹配的行 (e.g. `WHERE f_status = 1`) | 适用于活跃记录查询、非空值查询 |
| Q04 | [覆盖索引](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/query-covering-indexes.md) | INCLUDE 非键列避免回表 | 高频查询使用 |
| Q05 | [索引类型选择](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/query-index-types.md) | B-tree (默认) / GIN (JSONB/全文) / BRIN (时序) / GiST | CJK 全文: GIN (pgroonga _SEARCH) ; JSONB: GIN |

### 10.3 Connection Management (conn-)

| # | 标准 | 说明 | PetChat 实施 |
|---|---|---|---|
| C01 | [连接池](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/conn-pooling.md) | PgBouncer Transaction mode; pool_size ≈ (CPU * 2) + spindle | Supabase Cloud 自带 PgBouncer |
| C02 | [连接数限制](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/conn-limits.md) | 避免连接耗尽 | Supabase 项目设置中配置 max_connections |
| C03 | [空闲超时](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/conn-idle-timeout.md) | idle_in_transaction_session_timeout 防止悬挂事务 | Supabase 默认配置 |
| C04 | [预处理语句](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/conn-prepared-statements.md) | 复用查询计划, 减少解析开销 | 应用层使用 Prepared Statements |

### 10.4 Concurrency & Locking (lock-)

| # | 标准 | 说明 | PetChat 实施 |
|---|---|---|---|
| L01 | [短事务](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/lock-short-transactions.md) | 事务内不做外部 API 调用, 持锁毫秒级 | 所有事务只做 DB 操作 |
| L02 | [SKIP LOCKED](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/lock-skip-locked.md) | 工作队列并行处理, 跳过已锁定行 | 适用于 t_agent_withdrawal 等队列场景 |
| L03 | [死锁预防](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md) | 统一加锁顺序, statement_timeout | 所有表按固定顺序访问 |
| L04 | [咨询锁](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/lock-advisory.md) | pg_advisory_lock 应用级互斥 | 适用于关键业务互斥场景 |

### 10.5 Data Access Patterns (data-)

| # | 标准 | 说明 | PetChat 实施 |
|---|---|---|---|
| D01 | [游标分页](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/data-pagination.md) | WHERE f_id > last_id 替代 OFFSET, O(1) 性能 | API 分页使用 Keyset Pagination |
| D02 | [批量插入](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/data-batch-inserts.md) | INSERT ... SELECT unnest() 替代逐条插入 | 批量导入使用 |
| D03 | [UPSERT](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/data-upsert.md) | INSERT ... ON CONFLICT DO UPDATE | 幂等写入 |
| D04 | [避免 N+1](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/data-n-plus-one.md) | JOIN / WHERE IN 替代循环查询 | 查询设计准则 |

### 10.6 Monitoring & Diagnostics (monitor-)

| # | 标准 | 说明 | PetChat 实施 |
|---|---|---|---|
| M01 | [EXPLAIN ANALYZE](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md) | 诊断慢查询瓶颈 | 开发环境性能调试 |
| M02 | [pg_stat_statements](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md) | 追踪 TOP N 慢查询 | Supabase Dashboard 监控 |
| M03 | [VACUUM / ANALYZE](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md) | 定期维护统计信息 | Supabase 自动维护 |

### 10.7 Advanced Features (advanced-)

| # | 标准 | 说明 | PetChat 实施 |
|---|---|---|---|
| A01 | [JSONB i18n](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/jsonb-i18n-pattern.md) | JSONB 存多语言, pgroonga 做 CJK 全文搜索 | 全部 enum 表 `f_name JSONB`; pgroonga 索引 |
| A02 | [Full-Text Search](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/advanced-full-text-search.md) | GIN 索引 + tsvector 全文搜索 | 宠物搜索、商品搜索 |
| A03 | [JSONB 索引](file:///D:/prj/trinity_skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md) | GIN 索引 JSONB 路径查询 | JSONB 字段按需建索引 |

### 10.8 命名约定速查

```sql
-- 表名: t_ 前缀, 小写, 下划线分隔
t_users / t_order_items / t_product_categories

-- 字段名: f_ 前缀, 小写, 下划线分隔
f_id              -- 主键
f_created_at      -- 创建时间 (BIGINT)
f_status          -- 状态 (SMALLINT, DEFAULT -1)
f_customer_id     -- 逻辑外键 (BIGINT, DEFAULT -1)

-- 索引名: idx_t_[table]_f_[column(s)]
idx_t_orders_f_customer_id
idx_t_orders_f_status_f_created_at

-- 唯一约束: unique_t_[table]_[fields]
unique_t_users_f_email

-- 视图名: v_ 前缀
v_order_summary / v_user_is_anonymous
```

---

**维护**: PetChat Platform Team
**最后更新**: 2026-06-17
