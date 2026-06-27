# Backend 测试指南

## 1. 环境准备

### 1.1 安装依赖

```bash
cd backend
pnpm install
```

### 1.2 配置 Supabase 凭证

编辑 `backend/.env.test`，填入真实的 Supabase 连接信息：

```bash
# 从 Supabase Dashboard > Settings > API 获取
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# 从 Supabase Dashboard > Settings > Database > Connection string 获取密码
# host/user/port 在测试代码里 hardcode (pooler URL), 这里只存密码 (单引号防 dotenv 插值)
SUPABASE_PASSWORD='YOUR-DB-PASSWORD'
```

| 变量 | 用途 | 获取位置 |
|------|------|----------|
| `SUPABASE_URL` | REST API 地址 | Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | publishable key (新命名, 替代 anon) | Settings → API Keys → Publishable key |
| `SUPABASE_PASSWORD` | pg 直连密码 (单引号包) | Settings → Database → Connection string |

> 注: 测试代码从 `SUPABASE_PASSWORD` 拼出完整的 Postgres connectionString (`postgresql://postgres.<ref>:<encoded-pwd>@aws-...pooler.supabase.com:6543/postgres`). host/user/port 是项目拓扑信息, 不算机密, 写死在测试里.

### 1.3 确保数据库已初始化

测试用例 2.1 依赖 `t_pet_type` 表，运行前请确保数据库已执行 `database/init/db_init.sql`。

---

## 2. 运行测试

```bash
cd backend

# 运行全部测试
pnpm test

# 监听模式（文件变更自动重跑）
pnpm test:watch

# 运行单个测试文件
pnpm vitest run test/database/connection.test.js

# 指定测试名称模式
pnpm vitest run -t "2.1"
pnpm vitest run -t "2.2"
```

---

## 3. 测试说明

### 3.1 `test/database/connection.test.js` — 数据库连接测试

| 测试 | 连接方式 | 操作 | 校验点 |
|------|----------|------|--------|
| 2.1 | `@supabase/supabase-js` (REST API) | 查询 `t_pet_type` | 行数 = 预期值，每条 `f_id` 和 `f_name` 与 `db_init.sql` 一致 |
| 2.2 | `pg` (直连 PostgreSQL) | 创建 → 插入 → 查询 → 删除 | 建表成功、插入 2 行可查到、删表后确认不存在 |

**测试 2.1** 不需要写数据库，只读查询。

**测试 2.2** 创建临时表 `t_temp_[HHMMSS]`（格式如 `t_temp_091530`），测试结束后立即删除。`afterAll` 钩子兜底清理，即使测试中途失败也会尝试 `DROP TABLE IF EXISTS`。

---

## 4. 日志

测试日志自动输出到 `backend/log/` 目录。

日志文件名格式：`test_[feat-name]_[YYYYmmDD]-[HHMMSS].log`

示例：`backend/log/test_connection_20260624-085956.log`

日志同时写入文件和控制台（stdout）。

---

## 5. 没有配置 Supabase 时

若 `.env.test` 中未填入真实凭证，测试将在 `beforeAll` 阶段输出 warn 日志提示"NOT SET"，随后在用例执行时抛出明确错误。

填入真实凭证后重新运行即可。

## 6. CI / CD 建议

```yaml
# GitHub Actions 示例
- name: Run backend tests
  working-directory: backend
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}
    SUPABASE_PASSWORD: ${{ secrets.SUPABASE_PASSWORD }}
  run: pnpm test
```

> 注意：`.env.test` 文件已加入 `.gitignore`（规则 `!.env.example` 不包含 `.env.test`），不会提交到仓库。
