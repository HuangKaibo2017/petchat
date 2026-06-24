# prompt 01

1. 使用全局 volta 在 backend/ 创建一个最新的node 稳定版环境。
2. 在 backend\test 增加一个 目录 database，并用适合 node backend testing 的 框架，构建 connection test。读取 backend\.env.test 进行以下测试：
2.1 测试采用 SUPABASE_URL + SUPABASE_KEY 连接 supabase 并查询 t_pet_type，并校验返回值 和 database\init\db_init.sql 中的 t_pet_type 初始化数据是否一致（数据量，值（f_id, f_name））。
2.2 测试采用 SUPBASE_DIRECT，创建表 t_temp_[HHMMSS]（f_id integer NOT NULL DEFAULT -1）。并插入两条数据，并查询校验插入数据，然后删除这个表。

---

## 如何运行（How to Run）

### 1. 配置凭证

编辑 `backend\.env.test`，填入真实的 Supabase 连接信息：

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGciOi...
SUPABASE_DIRECT=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
```

| 变量 | 来源 |
|------|------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_KEY` | Supabase Dashboard → Settings → API → anon key |
| `SUPABASE_DIRECT` | Supabase Dashboard → Settings → Database → Connection string → URI |

### 2. 安装依赖

```bash
cd backend
pnpm install
```

### 3. 运行测试

```bash
# 工作目录：backend/
cd backend

# 全部测试
pnpm test

# 或直接调用 vitest
pnpm vitest run

# 监听模式（改代码自动重跑）
pnpm test:watch
```

### 4. 查看日志

```bash
# 日志文件位置
backend\log\test_connection_[YYYYmmDD]-[HHMMSS].log
```

日志同时输出到控制台（stdout）和文件。