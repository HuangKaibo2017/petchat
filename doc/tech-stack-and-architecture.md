# PetChat 技术栈与技术架构文档

> **文档版本**: v1.4
> **更新日期**: 2026-06-24\
> **维护团队**: 技术架构组

***

## 1. 总体架构概览

PetChat 采用前后端分离的多端架构，以 **Supabase** 作为统一数据层，**NestJS** 作为业务中台，**Next.js** 承载 PC/Mobile H5 端，微信原生小程序承载移动端入口，**LangChain.js** 提供 AI 能力编排（Context Engineering）。

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              客户端层 (Clients)                                  │
├───────────────────────────────┬─────────────────────────────────────────────────┤
│         PC/Mobile H5          │              微信小程序                          │
│       (Next.js 15)            │            (原生框架)                            │
│         响应式设计             │                                                │
└───────────────┬───────────────┴──────────────────────┬──────────────────────────┘
                │                                     │
                │         ┌────────────────────────────┐
                │         │     RESTful API           │
                │         │       (NestJS)            │
                └────────▶│     WebSocket             │◀──────────────────────────┘
                          │     实时通信服务           │
                          └───────────┬────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   认证服务     │           │   业务逻辑    │           │   AI 服务     │
│   (Auth)      │           │  (Business)   │           │ (Context Eng.)│
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  PostgreSQL   │           │   统一存储    │           │   向量存储     │
│  (Supabase)   │           │   (OSS)       │           │  (pgvector)   │
└───────────────┘           └───────────────┘           └───────────────┘
```

### 1.2 技术选型总览

| 层面           | 技术选型                    | 说明                            |
| ------------ | ----------------------- | ----------------------------- |
| PC/Mobile H5 | Next.js 15              | React 生态、响应式设计、SSR/SSG        |
| 移动端          | 微信小程序原生                 | 微信生态、启动性能最优                   |
| 后端框架         | NestJS                  | TypeScript、模块化、企业级设计          |
| 数据库          | Supabase (PostgreSQL)   | 开源可控、功能丰富、国内外双轨               |
| AI 框架        | LangChain.js            | Context Engineering、记忆管理、工具集成 |
| 认证           | JWT + OAuth2 + 微信 OAuth | 标准协议、支持多平台登录                  |
| 存储           | 统一 OSS 组件               | 通过配置适配 AWS S3 / 阿里云 OSS       |
| 向量检索         | pgvector                | 免费版即支持，零额外成本                  |
| Node 版本管理    | Volta                   | 快速切换、自动配置                     |
| 进程管理         | PM2                     | 生产级进程管理、负载均衡                  |
| 状态管理         | Zustand                 | 轻量（1KB）、简洁、Hooks 原生支持         |
| 密码加密         | bcryptjs                | 纯 JS 实现，无需 native build       |

***

## 2. 前端技术栈

### 2.1 PC/Mobile H5：Next.js 15

PC 端和移动端 H5 均采用 **Next.js 15**（App Router）构建，通过响应式设计同时适配桌面和移动浏览器。

#### 核心特性

- **渲染策略**：
  - 核心页面使用 SSR（服务端渲染）
  - 营销与文档页使用 SSG（静态生成）
  - 用户后台使用 CSR + 数据流式加载
- **响应式设计**：
  - Tailwind CSS 断点系统：`sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)
  - 移动优先设计，渐进增强
  - 触摸优化：按钮间距、字体大小、滚动行为
- **样式方案**：
  - Tailwind CSS 原子化样式
  - shadcn/ui 组件库
- **状态管理**：
  - Zustand：轻量全局状态管理
  - React Query (TanStack Query)：服务端状态缓存
- **多语言切换**：
  - 支持 zh-CN / en-US 语言切换
  - 语言包按需加载

> **为什么选择 Zustand？**
>
> 1. **轻量简洁**：Zustand 核心仅 1KB，无需 Provider wrapper，对比 Redux 需要大量模板代码
> 2. **Hooks 原生支持**：与 React Hooks 完美集成，无需 connect() 或高阶组件
> 3. **性能优异**：基于发布订阅模式，只触发订阅了相关状态的组件重渲染
> 4. **TypeScript 友好**：完整的类型推导，开箱即用
> 5. **学习成本低**：API 简单直观，5 分钟即可上手
> 6. **适用场景**：PetChat 以服务端状态为主（React Query），客户端状态简单，Zustand 足够胜任

### 2.2 微信小程序：原生框架

小程序端使用微信原生框架开发，保证极致的启动性能与微信生态深度集成。

### 2.3 前端统一机制

| 机制    | 实现方案                      | 覆盖范围          |
| ----- | ------------------------- | ------------- |
| 权限菜单  | 后端返回菜单树 + 前端递归渲染          | PC / H5 / 小程序 |
| 登录态管理 | HttpOnly Cookie 存 Token   | 全端            |
| 表单校验  | zod / yup 定义 schema，前后端复用 | 全端            |
| 错误提示  | 全局 Error Boundary + Toast | 全端            |

### 2.4 多国语言支持

采用 **i18next** + **React Context** 方案，按页面/组件独立管理翻译文件：

```
frontend/
├── lib/i18n/
│   ├── provider.tsx          # React i18next Provider
│   ├── settings.ts           # i18next 配置
│   ├── useLanguageDetection.ts # 语言自动检测 Hook
│   └── utils.ts              # 语言工具函数
├── public/locales/
│   ├── zh-CN/
│   │   ├── home.json         # 首页翻译
│   │   ├── pets.json         # 宠物页翻译
│   │   ├── profile.json      # 个人中心翻译
│   │   ├── auth.json         # 登录/注册翻译
│   │   └── components/       # 组件翻译
│   │       ├── header.json
│   │       ├── footer.json
│   │       └── button.json
│   └── en-US/
│       ├── home.json
│       ├── pets.json
│       ├── profile.json
│       ├── auth.json
│       └── components/
│           ├── header.json
│           ├── footer.json
│           └── button.json
└── config/
    └── i18n.config.ts        # 语言配置
```

> **设计原则**：每个页面/组件对应独立的翻译文件，避免翻译文件过大，便于维护和按需加载。

***

## 3. 后端技术栈：NestJS

### 3.1 运行环境管理

- **Node 版本管理**：Volta（项目级锁定）
- **进程管理**：PM2（进程守护、负载均衡、热部署）
- **包管理**：pnpm（各自项目独立管理）

#### 3.1.1 常用 pnpm 命令

```bash
cd backend

# 安装依赖
pnpm install

# 编译 NestJS TypeScript → dist/
pnpm build

# 启动开发服务器（热重载）
pnpm start:dev

# 构建 + 启动生产模式
pnpm start

# 直接运行编译产物
pnpm start:prod

# 运行测试
pnpm test

# 运行测试（监听模式）
pnpm test:watch

# 运行 Express 遗留服务
pnpm start:express
```

### 3.2 数据库操作规范

**核心原则**：所有数据库操作必须通过 Supabase RPC（Remote Procedure Call），禁止任何 SQL 文本拼接语法。

```typescript
// ✅ 正确：通过 RPC 调用
const result = await supabase.rpc('get_pet_list', { 
  p_user_id: userId,
  p_page: 1,
  p_page_size: 20
});

// ❌ 错误：禁止 SQL 文本拼接
const result = await supabase.rpc('execute_sql', {
  sql: `SELECT * FROM pets WHERE user_id = ${userId}`  // 禁止！
});
```

#### RPC 设计规范

```sql
-- 禁止直接操作表，必须通过 RPC
CREATE OR REPLACE FUNCTION get_pet_list(
  p_user_id UUID,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
) RETURNS TABLE (
  id UUID,
  name TEXT,
  species TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT id, name, species, created_at
  FROM pets
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.3 认证授权机制

- **JWT 认证**：
  - Access Token：有效期 15 分钟，用于 API 访问
  - Refresh Token：有效期 30 天，用于自动续期
  - 借助 Supabase Auth 统一管理，支持多平台 OAuth（微信等）
- **微信 OAuth**：通过微信开放平台 OAuth2 授权码流程完成用户注册/登录
- **RBAC 权限**：角色（user/admin/vet）+ 权限码

> **设计说明**：Refresh Token 30 天足够用户日常使用，同时避免过长有效期带来的安全风险。Supabase Auth 会自动处理 Token 续期，前端无感知。

### 3.4 源代码文件命名规范

#### 3.4.1 目录结构

```
backend/
├── src/
│   ├── main.ts                   # NestJS 引导入口（模块局外人，不带域前缀）
│   ├── server.js                 # 遗留 Express 服务（迁移中）
│   ├── app.module.ts             # 根模块
│   ├── app.controller.ts         # 根控制器
│   ├── app.service.ts            # 根服务
│   ├── database/
│   │   ├── database.module.ts    # 数据库特性模块
│   │   └── database.service.ts   # 数据库特性服务
│   └── utils/
│       └── logger.js             # 共享日志工具（CommonJS）
├── test/
│   └── database/
│       └── connection.test.js    # 数据库连接测试
├── nest-cli.json
├── tsconfig.json
├── vitest.config.js
├── package.json
└── pnpm-lock.yaml
```

#### 3.4.2 核心命名规则：`[domain].[type].ts`

所有 NestJS 源代码文件遵循 **`[domain].[type].ts`** 格式，其中：

- **`[domain]`**：领域/特性名称（如 `app`、`database`、`auth`、`pets`）
- **`[type]`** ：文件类型（如 `module`、`controller`、`service`、`gateway`、`guard`、`dto`）

**示例**：

| 文件 | 领域 | 类型 | 说明 |
|------|------|------|------|
| `app.module.ts` | `app`（根） | `module` | NestJS 根模块 |
| `app.controller.ts` | `app`（根） | `controller` | NestJS 根控制器 |
| `app.service.ts` | `app`（根） | `service` | NestJS 根服务 |
| `database.module.ts` | `database` | `module` | 数据库特性模块 |
| `database.service.ts` | `database` | `service` | 数据库特性服务 |
| `auth.controller.ts` | `auth` | `controller` | 认证控制器 |
| `pets.service.ts` | `pets` | `service` | 宠物服务 |

#### 3.4.3 唯一例外：`main.ts`

`main.ts` 是 NestJS 框架约定的引导入口文件，不带域前缀。它不属任何模块——唯一职责是通过 `NestFactory.create(AppModule)` 创建应用实例并启动 `app.listen()`，没有其他文件 import 它。

```typescript
// main.ts — 模块局外人，只负责启动
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

#### 3.4.4 非 TypeScript 文件

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 工具脚本（CommonJS） | `snake_case.js` | `logger.js` |
| 遗留服务 | `snake_case.js` | `server.js` |
| Shell 脚本 | `snake_case.sh` | `start.sh`、`deploy.sh` |
| 测试文件 | `[test-feature].test.js` | `connection.test.js` |

#### 3.4.5 命名设计理由

选择 `[domain].[type].ts`（如 `app.service.ts`）而非 `[domain]/service.ts`（目录嵌套），基于以下考量：

| 维度 | `app.service.ts` | `app/service.ts` |
|------|-----------------|-------------------|
| **Goto File 搜索** | `app.service` → 精准命中 1 个结果 | `service` → 多个重名文件，必须选目录 |
| **导入自文档化** | `from './app.service'` 一眼识别来源 | `from './service'` 丢失上下文，需看目录 |
| **新增领域** | 直接加 `pets.service.ts`，无需建目录 | 必须建 `pets/` 目录，否则多 `service.ts` 冲突 |
| **NestJS 对齐** | CLI 生成 `cats/cats.service.ts`，完全一致 | 需要自定义 schematics |
| **移动文件** | import 路径不变（文件名自包含语义） | 跨目录移动后语义变化 |

> 核心原则：**文件名应包含完整语义，不依赖目录层级提供上下文**。第 3 个开发者（或 3 个月后的你自己）打开任意 import 语句，即刻理解依赖关系，无需在文件树中溯源。

### 3.5 核心模块划分

| 模块             | 职责                | 关键技术                               |
| -------------- | ----------------- | ---------------------------------- |
| Auth Module    | 用户认证、JWT、微信 OAuth | Passport.js, bcryptjs, @nestjs/jwt |
| User Module    | 用户画像、权限管理         | CASL, RBAC                         |
| Pet Module     | 宠物档案、健康记录         | Supabase RPC                       |
| AI Module      | LLM 调用、RAG 检索     | LangChain.js, DeepSeek, MiniMax    |
| Payment Module | 统一收款              | 微信支付、支付宝                           |
| Sms Module     | 短信验证码             | 阿里云短信                              |
| Email Module   | 邮件发送              | 阿里云邮件（免费）                          |

***

## 4. 数据库与数据层：Supabase

### 4.1 部署策略：国外 + 国内双轨

| 环境 | 方案                   | 说明                    |
| -- | -------------------- | --------------------- |
| 国外 | supabase.com         | 免费版即支持 pgvector，开发版也用 |
| 国内 | 阿里云 PolarDB Supabase | 国内合规、企业级高可用。有余钱上这个。   |

### 4.2 数据规范与约束

| 规范   | 要求      | 实现方式                                     |
| ---- | ------- | ---------------------------------------- |
| 金额存储 | 禁止使用浮点数 | 使用 `bigint`（整数分）或 `numeric(19,4)`        |
| 状态枚举 | 必须受约束   | PostgreSQL `CHECK` 约束                    |
| 审计字段 | 核心表必须记录 | `created_at`, `updated_at`, `created_by` |

### 4.3 数据库命名规范

#### 4.3.1 标识符命名规则

使用小写标识符 + 前缀约定，避免大小写敏感问题：

```sql
-- ✅ 正确：小写 + 前缀
CREATE TABLE t_users (
  f_id bigint PRIMARY KEY,
  f_first_name text,
  f_last_name text
);

-- ❌ 错误：混合大小写（需引号包裹）
CREATE TABLE "Users" (
  "userId" bigint PRIMARY KEY
);
```

#### 4.3.2 表命名规范

| 类型 | 前缀 | 示例 |
|------|------|------|
| 业务表 | `t_` | `t_users`, `t_orders`, `t_pets` |
| 枚举表 | `te_` | `te_order_status`, `te_pet_species` |
| 关联表 | `tr_` | `tr_user_pets` (用户-宠物关联) |
| 日志表 | `tl_` | `tl_audit_logs`, `tl_payment_logs` |

#### 4.3.3 字段命名规范

| 类型 | 前缀 | 示例 |
|------|------|------|
| 主键 | `f_id` | `f_id bigint identity` |
| 外键 | `f_[table]_id` | `f_user_id`, `f_customer_id` |
| 时间戳 | `f_[action]_at` | `f_created_at`, `f_updated_at` |
| 状态 | `f_[entity]_status` | `f_order_status`, `f_payment_status` |
| 布尔值 | `f_is_[adj]` | `f_is_active`, `f_is_deleted` |
| 金额 | `f_[entity]_amount` | `f_order_amount`, `f_balance` |

#### 4.3.4 索引命名规范

```sql
-- 索引命名：idx_t_[table]_f_[column(s)]
idx_t_orders_f_customer_id
idx_t_orders_f_status_f_created_at

-- 唯一约束：unique_t_[table]_[fields]
unique_t_users_f_email
unique_t_pets_f_user_id_f_name
```

#### 4.3.5 数据类型选择

```sql
-- ID：使用 bigint（避免 int 溢出）
f_id bigint generated always as identity primary key

-- 字符串：text 无长度限制，或 VARCHAR(n) 需约束时
f_email text
f_phone varchar(20)  -- 需限制长度时

-- 时间：YYYYMMDDHHMMSS 格式 BIGINT（便于范围查询）
f_created_at bigint default (to_char(now(), 'YYYYMMDDHH24MISS')::bigint)

-- 布尔值：boolean（1 字节 vs 字符串）
f_is_active boolean default false

-- 金额：numeric（精确计算）
f_amount numeric(10,2)

-- 状态枚举：smallint，-1 表示未初始化
f_status smallint default -1
f_error_code smallint default -1
```

#### 4.3.6 外键设计规范

- 使用逻辑外键（`bigint default -1`）替代物理外键约束
- 用 `-1` 表示"无关联"，比 NULL 更明确
- 所有外键字段必须建立索引

```sql
CREATE TABLE t_orders (
  f_id bigint generated always as identity primary key,
  f_customer_id bigint default -1,  -- t_customers.f_id
  f_product_id bigint default -1,   -- t_products.f_id
  f_total numeric(10,2)
);

-- 为外键建立索引
CREATE INDEX idx_t_orders_f_customer_id ON t_orders (f_customer_id);
CREATE INDEX idx_t_orders_f_product_id ON t_orders (f_product_id);
```

***

## 5. AI 层：Context Engineering

### 5.1 模型选型策略

#### 5.1.1 LLM 模型配置

LLM 运行时参数放在 JSON 文件中，API Keys 通过环境变量注入：

```json
// backend/config/llm_provider.json
{
  "providers": {
    "deepseek": {
      "name": "DeepSeek Pro",
      "apiEndpoint": "https://api.deepseek.com/v1",
      "model": "deepseek-pro",
      "temperature": 0.7,
      "maxTokens": 4096,
      "timeout": 30000
    },
    "minimax": {
      "name": "MiniMax",
      "apiEndpoint": "https://api.minimax.chat/v1",
      "model": "minimax-01",
      "temperature": 0.7,
      "maxTokens": 4096,
      "timeout": 30000
    }
  },
  "embedding": {
    "provider": "bge-large-zh",
    "dimension": 1024,
    "apiEndpoint": "https://api.openai.com/v1"
  },
  "fallback": {
    "enabled": true,
    "order": ["deepseek", "minimax"],
    "retryCount": 2
  }
}
```

```bash
# backend/.env.local / .env.test / .env.prd
LLM_CONFIG_PATH=./config/llm_provider.json

# LLM API Keys（命名规则：LLM_KEY_[provider-name]）
LLM_KEY_DEEPSEEK=sk-xxxxxxxxxxxxxxxxxxxxxxxx
LLM_KEY_MINIMAX=xxxxxxxxxxxxxxxxxxxxxxxx

# Embedding API Key
LLM_KEY_EMBEDDING=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

> **安全原则**：所有 LLM API Keys 必须放在 .env 文件中，禁止写入 JSON 配置文件。

### 5.2 LLM 调用 Fallback 机制

```typescript
// llm-gateway.service.ts
@Injectable()
export class LlmGatewayService {
  private config: LlmProviderConfig;

  async chat(prompt: string, options?: LlmOptions): Promise<LlmResponse> {
    const providers = this.config.fallback.order;

    for (let i = 0; i < providers.length; i++) {
      try {
        const provider = providers[i];
        const model = this.getModel(provider);
        const response = await this.callWithTimeout(model, prompt, options);
        return { model: provider, content: response };
      } catch (error) {
        this.logger.warn(`Provider ${providers[i]} failed: ${error.message}`);
        if (i < providers.length - 1) continue;
        throw new LlmAllModelsFailedError();
      }
    }
  }
}
```

### 5.3 记忆体系设计

- **短期记忆**：会话期间内存存储，保留最近 20 轮对话
- **长期记忆**：PostgreSQL + pgvector 向量索引
- **上下文注入优先级**：用户输入 → 实时上下文 → 短期记忆 → 长期记忆 → 系统提示词

***

## 6. 统一组件设计

### 6.1 统一收款组件（Payment Gateway）

```typescript
// interfaces/payment-gateway.interface.ts
export interface IPaymentGateway {
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  verifyCallback(payload: unknown, headers: Record<string, string>): Promise<CallbackResult>;
  refund(params: RefundParams): Promise<RefundResult>;
}
```

| 渠道     | 优先级 |
| ------ | --- |
| 微信支付   | 高   |
| 支付宝    | 高   |
| Stripe | 低   |
| PayPal | 低   |

### 6.2 统一存储组件（OSS Gateway）

```typescript
// interfaces/oss-gateway.interface.ts
export interface IOssGateway {
  upload(key: string, file: Buffer, options?: OssOptions): Promise<OssResult>;
  getUrl(key: string, expires?: number): string;
}
```

| 后端               | 适用场景  |
| ---------------- | ----- |
| Supabase Storage | 开发/海外 |
| AWS S3           | 海外生产  |
| 阿里云 OSS          | 国内生产  |

### 6.3 统一缓存组件（Cache Gateway）

```typescript
// interfaces/cache-gateway.interface.ts
export interface ICacheGateway {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}
```

| 后端       | 适用场景       |
| -------- | ---------- |
| Memory   | 开发/单实例     |
| Redis    | 生产环境       |
| Database | 无 Redis 环境 |

***

## 7. 对外接口规范

### 7.1 支付接口

- **微信支付**：国内主流
- **支付宝**：国内主流
- **Stripe**：海外市场（低优先级）
- **PayPal**：海外市场（低优先级）

### 7.2 短信接口

- **阿里云短信**：国内唯一

### 7.3 邮件接口

- **阿里云邮件推送**：国内免费邮箱

***

## 8. 环境变量配置

### 8.1 环境文件结构

```
backend/
├── .env.local             # 本地开发
├── .env.test              # 测试环境
├── .env.prd               # 生产环境
└── config/
    └── llm_provider.json  # LLM 配置（由 .env 引用）

frontend/
├── .env.local             # 本地开发
├── .env.test              # 测试环境
└── .env.prd               # 生产环境
```

### 8.2 backend/.env.local 示例

```bash
# 应用配置
APP_NAME=petchat
APP_PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# LLM 配置（指向 JSON 文件）
LLM_CONFIG_PATH=./config/llm_provider.json

# 微信支付
WECHAT_APP_ID=xxx
WECHAT_MCH_ID=xxx
WECHAT_API_KEY=xxx

# 支付宝
ALIPAY_APP_ID=xxx
ALIPAY_PRIVATE_KEY=xxx

# 短信（阿里云）
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx

# 邮件（阿里云）
ALIYUN_EMAIL_ACCESS_KEY_ID=xxx

# OSS
OSS_PROVIDER=supabase

# 缓存
CACHE_PROVIDER=memory

# JWT
JWT_SECRET=xxx
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

***

## 9. 前端安全设计：存储规范

### 9.1 Cookie 存储规范

| 内容            | 存储位置            | 说明               |
| ------------- | --------------- | ---------------- |
| Access Token  | HttpOnly Cookie | 禁止 JS 访问，防 XSS   |
| Refresh Token | HttpOnly Cookie | 禁止 JS 访问，30 天有效期 |
| Session ID    | HttpOnly Cookie | 用于服务端会话          |

**禁止存储到 Cookie**：用户密码、敏感 PII、支付信息

### 9.2 LocalStorage 存储规范

| 内容     | 存储位置         | 说明              |
| ------ | ------------ | --------------- |
| 用户语言偏好 | LocalStorage | `user_language` |
| UI 状态  | LocalStorage | 非敏感状态           |

**禁止存储到 LocalStorage**：任何 Token、密码、敏感信息、API 密钥

### 9.3 安全规则汇总

| 信息类型          | Cookie     | LocalStorage |
| ------------- | ---------- | ------------ |
| Access Token  | ✓ HttpOnly | ✗            |
| Refresh Token | ✓ HttpOnly | ✗            |
| 用户密码          | ✗          | ✗            |
| 身份证号/手机号      | ✗          | ✗            |
| 银行卡号          | ✗          | ✗            |
| 语言偏好          | ✓          | ✓            |
| UI 状态         | ✓          | ✓            |

***

## 10. 部署与运维架构

### 10.1 国外环境

| 组件           | 部署方案                            |
| ------------ | ------------------------------- |
| PC/Mobile H5 | Vercel                          |
| 微信小程序        | 微信开发者工具                         |
| NestJS API   | Railway / Render / Fly.io (PM2) |
| Supabase     | supabase.com                    |
| Redis        | Redis Cloud / Upstash           |

### 10.2 国内环境

| 组件           | 部署方案                     |
| ------------ | ------------------------ |
| PC/Mobile H5 | 阿里云 OSS + CDN            |
| 微信小程序        | 微信开发者工具                  |
| NestJS API   | 函数计算 FC / 容器服务 ACK (PM2) |
| Supabase     | PolarDB Supabase         |
| Redis        | 阿里云 Redis                |
| 域名与备案        | ICP 备案                   |

***

## 11. 第三方服务集成

| 服务类型 | 国内 Provider      | 国外 Provider      | 优先级                        |
| ---- | ---------------- | ---------------- | -------------------------- |
| 支付   | 微信支付、支付宝         | Stripe、PayPal    | 高：微信/支付宝 / 低：Stripe/PayPal |
| 短信   | 阿里云短信            | -                | 仅阿里云                       |
| 邮件   | 阿里云邮件            | -                | 仅阿里云                       |
| 对象存储 | 阿里云 OSS          | AWS S3           | 统一 OSS 组件                  |
| LLM  | DeepSeek、MiniMax | DeepSeek、MiniMax | 统一配置                       |

***

## 12. 日志体系

- **业务日志**：宠物创建、健康记录、问诊、订单支付等
- **接口日志**：HTTP 请求（method, path, status\_code, duration\_ms, request\_id）
- **回调日志**：第三方回调完整记录
- **敏感信息脱敏**：密码、Token、银行卡号自动替换为 `***`

***

## 13. 安全与合规

### 13.1 身份认证安全

- **密码安全**：bcryptjs（纯 JS 实现，无需 native build）
- **登录态管理**：Access Token 15 分钟，Refresh Token 30 天，Supabase Auth 统一管理
- **微信 OAuth**：标准 OAuth2 授权码流程

### 13.2 权限控制安全

- **RBAC 模型**：角色 + 权限码
- **前后端双重控制**：前端渲染控制 + 后端独立鉴权
- **数据范围隔离**：业务层校验

### 13.3 Web 安全防护

- **SQL 注入防护**：通过 RPC 操作数据库，禁止 SQL 文本拼接
- **XSS 防护**：输入转义、CSP 策略、HttpOnly Cookie
- **CSRF 防护**：CSRF Token、SameSite Cookie、Origin 校验
- **Rate Limiting**：全局限流 + 接口级限流

***

## 14. 参考来源

1. [Supabase pgvector 支持说明](https://supabase.com/docs/guides/database/extensions/pgvector)
2. [LangChain 官方文档](https://js.langchain.com/)
3. [i18next 官方文档](https://www.i18next.com/)
4. [Volta 官方文档](https://volta.sh/)
5. [PM2 官方文档](https://pm2.keymetrics.io/)
6. [bcryptjs 纯 JS 实现](https://github.com/dcodeIO/bcrypt.js)

***

**文档结束**
