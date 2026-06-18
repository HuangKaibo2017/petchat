# PetChat Backend

> Supabase Edge Functions + PostgREST · 微信小程序后端  
> Version: 1.0.0 · Last Updated: 2026-06-18

---

## 目录

- [架构概览](#架构概览)
- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [部署](#部署)
- [API 文档](#api-文档)
  - [认证](#1-认证-wechat-auth)
  - [文件上传](#2-文件上传-upload)
  - [情绪解读报告](#3-情绪解读报告-emotion-report)
  - [健康监测报告](#4-健康监测报告-health-report)
  - [人宠风险评估](#5-人宠风险评估-risk-report)
  - [AI 宠物聊天](#6-ai-宠物聊天-chat)
  - [PostgREST 直连](#7-postgrest-直连)
- [数据库](#数据库)
- [环境变量](#环境变量)
- [公共模块](#公共模块-shared)
- [开发指南](#开发指南)
- [故障排查](#故障排查)

---

## 架构概览

```
┌──────────────────────────────────────────────────┐
│                  微信小程序                        │
│             wx.request + wx.uploadFile            │
└──────┬───────────────────────────────┬────────────┘
       │                               │
       │  Edge Functions               │  PostgREST
       │  (业务逻辑 + AI)               │  (自动 CRUD)
       ▼                               ▼
┌──────────────────────────────────────────────────┐
│              Supabase Cloud                       │
│                                                  │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Edge Functions│  │ PostgREST  │  │  Auth    │ │
│  │ (Deno/TS)    │  │ (自动API)  │  │ (JWT)    │ │
│  └──────┬───────┘  └─────┬──────┘  └────┬─────┘ │
│         │                │              │        │
│  ┌──────▼────────────────▼──────────────▼──────┐ │
│  │           PostgreSQL 15+ (RLS)              │ │
│  │       pgroonga CJK 全文搜索                  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────┐  ┌──────────────┐               │
│  │  Storage   │  │   Realtime   │               │
│  │ (图片/CDN) │  │ (WebSocket)  │               │
│  └────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────┘
```

**设计原则：**

- **简单 CRUD 零代码**：PostgREST 根据数据库 DDL + RLS Policy 自动生成 REST API
- **复杂逻辑走函数**：AI 报告生成、支付回调、配额管理等走 Edge Function
- **客户端直传文件**：小程序先请求 signed URL，再直接上传到 Supabase Storage，不经过函数层
- **RLS 保证安全**：每张表都有行级安全策略，用户只能访问自己的数据

---

## 目录结构

```
backend/
├── README.md                          # 本文件
├── deploy.sh                          # 一键部署脚本
│
└── supabase/
    ├── config.toml                    # Edge Functions 部署配置
    ├── seed.sql                       # 种子数据 (enum + prompt)
    │
    ├── migrations/                    # 数据库迁移
    │   ├── 20260618_rls_policies.sql  # 28 张表的 RLS 策略
    │   └── 20260618_storage_buckets.sql # Storage 桶 + 策略
    │
    └── functions/                     # Edge Functions (Deno/TypeScript)
        ├── _shared/                   # 公共模块 (被所有函数引用)
        │   ├── cors.ts                # CORS 头 + 响应封装
        │   ├── errors.ts              # 错误码定义 + AppError 类
        │   ├── auth.ts                # JWT 校验 + 微信 code 换 token
        │   ├── db.ts                  # 配额检查 / 记录 / prompt 模板
        │   └── ai.ts                  # AI 调用 (stream + JSON + parse)
        │
        ├── wechat-auth/               # P0 认证
        │   └── index.ts               # POST: 微信登录 → Supabase JWT
        │
        ├── upload/                    # P1 文件上传
        │   └── index.ts               # POST: 生成签名上传 URL
        │
        ├── emotion-report/            # P2 AI 报告
        │   └── index.ts               # POST: 情绪解读 (六爻/梅花/塔罗)
        ├── health-report/
        │   └── index.ts               # POST: 中医辨证健康监测
        ├── risk-report/
        │   └── index.ts               # POST: 人宠同构风险评估
        │
        └── chat/                      # P4 聊天
            └── index.ts               # GET/POST: 会话管理 + AI 聊天
```

## 快速开始

### 前置条件

- [Supabase CLI](https://supabase.com/docs/guides/cli) `>= 1.0`
- 一个 Supabase 项目（[免费创建](https://supabase.com)）
- 微信小程序 AppID + AppSecret
- AI API Key（OpenAI 或兼容接口）
- 已执行 `database/_run_all.sql` 完成建表

### 本地开发

```bash
# 1. 登录 Supabase
supabase login

# 2. 链接项目
supabase link --project-ref <your-project-ref>

# 3. 设置环境变量 (本地 secrets)
supabase secrets set \
  WECHAT_APPID=wxXXXX \
  WECHAT_SECRET=XXXX \
  AI_API_KEY=sk-XXXX \
  AI_BASE_URL=https://api.openai.com/v1 \
  AI_MODEL=gpt-4o-mini

# 4. 本地启动函数调试
supabase functions serve --no-verify-jwt

# 5. 测试
curl -X POST http://localhost:54321/functions/v1/wechat-auth \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}'
```

---

## 部署

### 自动部署

```bash
cd backend
./deploy.sh <your-supabase-project-ref>
```

脚本会依次完成：
1. 推送数据库迁移（RLS + Storage）
2. 运行种子数据
3. 部署全部 6 个 Edge Functions
4. 交互式设置环境变量

### 手动部署

```bash
# 1. 设置 secrets
supabase secrets set \
  WECHAT_APPID=wxXXXX \
  WECHAT_SECRET=XXXX \
  AI_API_KEY=sk-XXXX \
  --project-ref <ref>

# 2. 逐个部署函数
supabase functions deploy wechat-auth --project-ref <ref>
supabase functions deploy upload --project-ref <ref>
supabase functions deploy emotion-report --project-ref <ref>
supabase functions deploy health-report --project-ref <ref>
supabase functions deploy risk-report --project-ref <ref>
supabase functions deploy chat --project-ref <ref>

# 3. 执行数据库迁移 (通过 Supabase Dashboard SQL Editor 或 psql)
```

---

## API 文档

> 所有 Edge Function 的基础 URL：`https://<project-ref>.supabase.co/functions/v1`  
> PostgREST 基础 URL：`https://<project-ref>.supabase.co/rest/v1`

### 通用约定

**鉴权：** 需要登录的接口在 Header 中携带：

```
Authorization: Bearer <supabase-jwt-token>
```

**错误响应：** 所有接口统一返回：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读的错误信息"
  }
}
```

| HTTP 状态码 | 含义 |
|---|---|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未登录 / token 过期 |
| 402 | 配额用完 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | AI 服务不可用 |

---

### 1. 认证 (wechat-auth)

#### POST /wechat-auth — 微信登录

交换 `wx.login()` 返回的临时 code 为 Supabase JWT。

**Request**

```json
{
  "code": "081xAb000...",          // wx.login() 返回的 code
  "nickName": "张三",               // 可选: 用户微信昵称
  "avatarUrl": "https://..."       // 可选: 用户微信头像
}
```

**Response**

```json
{
  "token": "eyJhbGciOi...",        // Supabase JWT，后续请求用此 token
  "expiresIn": 3600,
  "user": {
    "openid": "oXXXX-XXXX",
    "supabaseUserId": "uuid"
  }
}
```

**鉴权链路：**

```
1. 小程序: wx.login() → code
2. 小程序: POST /wechat-auth { code } → token
3. 小程序: wx.setStorageSync('token', token)
4. 小程序: 后续请求 Header: Authorization: Bearer <token>
5. Edge Function: verifyJWT(req) → 解析出 t_user.f_id
6. PostgREST: RLS 自动使用 auth.uid() 过滤
```

---

### 2. 文件上传 (upload)

#### POST /upload — 获取上传签名

不直接上传文件，而是返回一个临时签名 URL，小程序用此 URL 直传文件到 Supabase Storage。

**Request**

```json
{
  "fileName": "photo.jpg",
  "fileType": "image/jpeg",
  "category": "pet_avatar",
  "petId": 1
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| fileName | string | 原始文件名 |
| fileType | string | MIME 类型 (仅支持 image/jpeg, image/png, image/webp, image/gif) |
| category | string | 分类: `pet_avatar`, `pet_gallery`, `report`, `symptom`, `tongue` |
| petId | number | 可选: 关联的宠物 ID |

**Response**

```json
{
  "signedUrl": "https://...?token=...",   // PUT 上传到此 URL
  "publicUrl": "https://.../pet_avatar/...",  // 上传成功后用此 URL 访问
  "token": "upload-token",
  "filePath": "pet_avatar/1_1718000000_a1b2c3d4.jpg"
}
```

**上传流程：**

```
1. 小程序: wx.chooseImage() → tempFilePath
2. 小程序: POST /upload { fileName, fileType, category } → signedUrl + publicUrl
3. 小程序: wx.uploadFile({ url: signedUrl, filePath: tempFilePath })
4. 小程序: 用 publicUrl 显示图片 / 写入数据库
```

---

### 3. 情绪解读报告 (emotion-report)

#### POST /emotion-report — 生成情绪解读

结合占卜方式（六爻/梅花易数/大六壬/塔罗），通过 AI 解读宠物心声。

**Request**

```json
{
  "petId": 1,
  "question": "小橘今天为什么不开心？",
  "divSystem": "liuyao",
  "numbers": ["6", "8", "3", "7", "2", "9"],
  "imageUrl": "https://.../report/xxx.jpg",
  "reportType": "emotion"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| petId | number | 是 | 宠物 ID |
| question | string | 是 | 主人想问的问题 |
| divSystem | string | 是 | `liuyao`, `meihua`, `daliuren`, `tarot` |
| numbers | string[] | 条件必填 | 六爻需 6 位数字，梅花/大六壬需 3 位，塔罗不需要 |
| imageUrl | string | 否 | 已上传的宠物照片 URL |
| reportType | string | 是 | `emotion` 或 `personality` |

**Response**

```json
{
  "reportId": 42,
  "petName": "小橘",
  "time": "2026/6/18 14:30:00",
  "divSystem": "liuyao",
  "question": "小橘今天为什么不开心？",
  "coreAnswer": "小橘今天整体状态不错，但对早餐的猫粮不太满意...",
  "coreBasis": "卦象显示坤土生金，脾胃之气稍弱...",
  "foodSatisfaction": "★★☆☆☆",
  "moodLevel": "★★★☆☆",
  "bodyStatus": "基本正常",
  "statusSummary": "宠物今天情绪平稳偏低落...",
  "ownerView": "我感觉你今天有点累...",
  "petMessage": "妈妈，我今天想吃那个带汤的罐头...",
  "petWish": "希望今晚你能早点回家陪我玩逗猫棒...",
  "carePlan": [
    { "title": "中兽医养护", "desc": "适量温补脾胃..." },
    { "title": "香疗建议", "desc": "使用合香安神香珠..." }
  ],
  "products": [
    { "id": 1, "name": "合香安神香珠", "price": "168", "reason": "安神定志" }
  ],
  "remaining": 2
}
```

**流程：**

```
1. 校验 JWT → 获取 user_id
2. 检查配额 (emotion_report, 默认 3 次/天)
3. 查询宠物信息 (name, type, gender, weight)
4. 构建 AI prompt (system + user)
5. 调用 AI → 解析 JSON 响应
6. 匹配推荐商品 (从 t_product_spu 按名称查找)
7. 写入 t_report_emotion
8. 记录使用量 (t_usage_record)
9. 返回完整报告
```

---

### 4. 健康监测报告 (health-report)

#### POST /health-report — 生成健康监测

基于症状描述，通过 AI 进行中医辨证分析。

**Request**

```json
{
  "petId": 1,
  "symptom": "猫咪出现尿频、尿量减少、频繁舔舐生殖器区域",
  "duration": "2-3天",
  "abnormal": "精神状态比平时低落",
  "numbers": ["6", "8", "3", "7", "2", "9"],
  "imageUrl": "https://.../report/xxx.jpg"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| petId | number | 是 | 宠物 ID |
| symptom | string | 是 | 症状描述 |
| duration | string | 是 | 持续时间: `今天`, `2-3天`, `一周`, `一个月以上` |
| abnormal | string | 否 | 异常行为补充 |
| numbers | string[] | 否 | 六爻数字 |
| imageUrl | string | 否 | 症状照片 URL |

**Response**

```json
{
  "reportId": 43,
  "petName": "小橘",
  "time": "2026/6/18 14:35:00",
  "currentSymptoms": "猫咪出现尿频、尿量减少...",
  "symptomMapping": [
    { "area": "泌尿系统", "symptoms": "尿带隐血、尿频尿急..." }
  ],
  "potentialDeficiencies": "脾肾气虚，膀胱气化不利...",
  "deficiencyDetails": [
    { "type": "肾气不足", "manifestations": "不爱动、玩一会就累了..." }
  ],
  "emergency": "如出现尿闭（超过12小时无排尿），请立即就医！",
  "futureRisk": "最需重点关注泌尿系统健康...",
  "healthScore": "★★☆☆☆",
  "carePlan": [
    { "title": "中兽医养护", "desc": "温补肾阳，健脾利湿..." }
  ],
  "remaining": 2
}
```

---

### 5. 人宠风险评估 (risk-report)

#### POST /risk-report — 生成风险评估

结合宠物健康报告和主人生日（八字），分析人宠同构风险。

**Request**

```json
{
  "petId": 1,
  "reportId": 43,
  "ownerBirthday": "1990-05-20",
  "tongueImage": "https://.../report/tongue.jpg"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| petId | number | 是 | 宠物 ID |
| reportId | number | 否 | 关联的历史健康报告 ID |
| ownerBirthday | string | 是 | 主人生日 `YYYY-MM-DD` |
| tongueImage | string | 否 | 舌诊照片 URL |

**Response**

```json
{
  "reportId": 44,
  "petName": "小橘",
  "time": "2026/6/18 14:40:00",
  "riskLevel": { "level": "medium", "label": "中等风险" },
  "petImbalance": "小橘当前呈现肾气不足、膀胱气化不利的失衡状态...",
  "qiRisk": "宠物肾气不足常对应主人的肾气同样处于亚健康状态...",
  "microbiomeRisk": "共栖菌群研究显示...",
  "lifestyleRisk": "宠物近期饮水减少、活动量下降...",
  "jointCarePlan": "1. 饮食同步...\n2. 作息同步...",
  "medicalAdvice": "建议主人进行肾功能检查...",
  "riskScore": 55,
  "riskFactors": [
    { "factor": "肾气不足", "level": "medium" }
  ],
  "recommendations": ["定期体检", "增加互动", "调整作息"],
  "remaining": 0
}
```

---

### 6. AI 宠物聊天 (chat)

Chat 函数提供三个端点，让用户以宠物身份与 AI 对话。

#### GET /chat — 列出会话

返回当前用户的所有聊天会话。

**Response**

```json
{
  "sessions": [
    {
      "f_id": 1,
      "f_pet_id": 1,
      "petName": "小橘",
      "f_status_session": 1,
      "f_started_at": "2026-06-18T14:00:00Z"
    }
  ]
}
```

#### POST /chat/sessions — 创建会话

为指定宠物创建（或返回已有的活跃）聊天会话。

**Request**

```json
{ "petId": 1 }
```

**Response**

```json
{
  "sessionId": 1,
  "isNew": true,
  "greeting": "汪汪！我是小橘，今天想跟你聊聊天~ 你想跟我说什么呀？"
}
```

#### GET /chat/messages?sessionId=1 — 获取消息

获取指定会话的全部历史消息。

**Response**

```json
{
  "sessionId": 1,
  "petId": 1,
  "messages": [
    { "id": 1718000000, "role": "pet", "content": "汪汪！我是小橘...", "at": "2026-06-18T14:00:00Z" },
    { "id": 1718000100, "role": "user", "content": "你今天开心吗？", "at": "2026-06-18T14:01:00Z" },
    { "id": 1718000200, "role": "pet", "content": "主人主人！我今天很开心呢~", "at": "2026-06-18T14:01:02Z" }
  ]
}
```

#### POST /chat/send — 发送消息

发送用户消息，获取 AI 以宠物身份生成的回复。

**Request**

```json
{
  "sessionId": 1,
  "message": "你今天想吃什么？"
}
```

**Response**

```json
{
  "sessionId": 1,
  "userMessage": {
    "id": 1718000300,
    "role": "user",
    "content": "你今天想吃什么？",
    "at": "2026-06-18T14:02:00Z"
  },
  "petMessage": {
    "id": 1718000301,
    "role": "pet",
    "content": "我想吃那个带肉肉的小饼干！还有罐头~ 主人你会给我吗？汪汪！",
    "at": "2026-06-18T14:02:02Z"
  }
}
```

**AI Persona 设定：**

```
你是{宠物名字}，一只可爱的{宠物类型}。你需要以宠物的身份和主人聊天。

规则：
1. 用宠物的语气说话，可爱、温暖、偶尔撒娇
2. 回答简短自然 (1-3句话)
3. 可以表达对主人的关心、想吃零食、想出去玩等
4. 加入"汪汪"、"喵喵"等拟声词
```

### 7. PostgREST 直连

以下 API 由 Supabase PostgREST 自动生成（受 RLS 保护），**无需编写任何代码**：

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/rest/v1/t_pet?select=*,t_pet_photo(*)` | 宠物列表 + 照片 |
| POST | `/rest/v1/t_pet` | 创建宠物档案 |
| PATCH | `/rest/v1/t_pet?id=eq.1` | 更新宠物信息 |
| GET | `/rest/v1/t_report_emotion?order=f_created_at.desc` | 历史情绪报告 |
| GET | `/rest/v1/t_report_health?order=f_created_at.desc` | 历史健康报告 |
| GET | `/rest/v1/t_product_spu?select=*,t_product_spu_i18n(*)` | 商品列表 + 多语言 |
| GET | `/rest/v1/t_hospital?select=*,t_doctor(*)` | 医院列表 + 医生 |
| POST | `/rest/v1/t_cart` | 添加到购物车 |
| GET | `/rest/v1/t_order?select=*,t_order_item(*)` | 订单列表 + 订单项 |

**认证 Header：**

```
apikey: <supabase-anon-key>
Authorization: Bearer <jwt-token>
Prefer: return=representation
```

---

## 数据库

### 表关系

数据库 DDL 位于 `../database/` 目录，共 15 个 SQL 文件 + 1 个入口脚本。加载顺序：

```
00_extensions → 01_enums → 02_rbac_users
  ├─ 03_pet_profile
  │   ├─ 04_ai_reports → 06_share_interpretation
  │   ├─ 05_chat_comments
  │   ├─ 12_healthcare
  │   └─ 13_welfare
  ├─ 07_cms
  ├─ 08_subscription
  ├─ 09_ecommerce
  ├─ 10_iot
  └─ 11_agent
→ 99_indexes_views
```

### RLS 策略

所有用户表启用了行级安全（Row Level Security）。核心规则：

- **t_pet**：用户只能读写自己的宠物
- **t_report_***：用户只能读自己的报告，写入由 service_role 的 Edge Function 完成
- **t_chat_history**：用户只能访问自己的会话
- **t_product_spu / t_hospital / t_banner**：所有人可读（公开参考数据）
- **t_cart / t_order**：用户只能操作自己的购物车和订单

详见 `supabase/migrations/20260618_rls_policies.sql`。

### 配额系统

| feature_code | 默认限额 | 周期 | 说明 |
|---|---|---|---|
| emotion_report | 3次/天 | 1天 | 情绪解读 |
| health_report | 3次/天 | 1天 | 健康监测 |
| risk_report | 1次/天 | 1天 | 风险评估 |
| personality_report | 1次/天 | 1天 | 性格分析 |
| chat | 无限 | — | AI 聊天 |

配额检查在 Edge Function 中执行：`checkQuota()` → 发 AI 请求 → `recordUsage()`。

---

## 环境变量

所有变量通过 `supabase secrets set` 设置：

| 变量 | 必填 | 说明 | 示例 |
|---|---|---|---|
| `SUPABASE_URL` | 是 | Supabase 项目 URL | `https://abcdefg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | service_role key（自动注入，无需手动设置） | — |
| `WECHAT_APPID` | 是 | 微信小程序 AppID | `wx67bdea24d2893ced` |
| `WECHAT_SECRET` | 是 | 微信小程序 AppSecret | — |
| `AI_API_KEY` | 是 | AI API Key（OpenAI 或兼容） | `sk-...` |
| `AI_BASE_URL` | 否 | AI API 地址 | `https://api.openai.com/v1` (默认) |
| `AI_MODEL` | 否 | 模型名 | `gpt-4o-mini` (默认) |
| `STORAGE_BUCKET` | 否 | Storage 桶名 | `petchat-assets` (默认) |

### 换用国产大模型

将以下三个变量改为国产 API 即可（兼容 OpenAI 接口格式）：

```bash
supabase secrets set \
  AI_BASE_URL=https://api.deepseek.com/v1 \
  AI_MODEL=deepseek-chat \
  AI_API_KEY=sk-XXXX
```

支持的通义千问、文心一言、GLM 等只要提供 OpenAI 兼容接口即可。

---

## 公共模块 (_shared)

所有 Edge Function 共享的模块，避免重复代码：

### cors.ts

```typescript
// 统一 CORS 头 (微信小程序需要)
corsHeaders
corsResponse(body, status)
```

### errors.ts

```typescript
// 业务错误类
class AppError { code, message, status }
// 快捷错误响应
errorResponse(code, message, status)
// 预定义错误
ERR.UNAUTHORIZED / ERR.FORBIDDEN / ERR.QUOTA_EXCEEDED / ERR.AI_FAILED ...
```

### auth.ts

```typescript
// 从 Authorization header 解析 JWT，返回 t_user.f_id
verifyJWT(req: Request): Promise<AuthUser>
// 微信 code → openid → Supabase JWT
exchangeWechatCode(wxCode, userInfo): Promise<{ token, user }>
// service_role client (绕过 RLS)
getServiceClient()
```

### db.ts

```typescript
// 检查配额 → 配额不足抛出 QUOTA_EXCEEDED
checkQuota(userId, featureCode): Promise<number>
// 记录使用量
recordUsage(userId, featureCode, reportId?)
// 获取最新 prompt 模板
getPrompt(code, lang): Promise<string>
// 填充模板变量 {{varName}}
fillPrompt(template, vars): string
```

### ai.ts

```typescript
// 非流式 AI 调用
aiChat(messages, options?): Promise<string>
// 流式 AI 调用
aiChatStream(messages, callbacks, options?): Promise<string>
// JSON 安全解析 (自动去 markdown fences)
parseAIJson<T>(raw: string): T
```

---

## 开发指南

### 新增一个 Edge Function

```bash
# 1. 创建目录
mkdir -p supabase/functions/my-function

# 2. 创建 index.ts
cat > supabase/functions/my-function/index.ts << 'EOF'
import { corsResponse } from "../_shared/cors.ts";
import { verifyJWT } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  try {
    const user = await verifyJWT(req);
    // 你的业务逻辑...
    return corsResponse({ ok: true });
  } catch (err) {
    return corsResponse({ error: err.message }, 500);
  }
});
EOF

# 3. 本地测试
supabase functions serve --no-verify-jwt

# 4. 部署
supabase functions deploy my-function --project-ref <ref>
```

### 本地调试

```bash
# 启动本地函数服务
supabase functions serve --no-verify-jwt

# 测试认证接口
curl -X POST http://localhost:54321/functions/v1/wechat-auth \
  -H "Content-Type: application/json" \
  -d '{"code":"test-code"}'

# 模拟带 JWT 的请求
curl -X POST http://localhost:54321/functions/v1/emotion-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-test-jwt>" \
  -d '{"petId":1,"question":"测试","divSystem":"liuyao","numbers":["1","2","3","4","5","6"],"reportType":"emotion"}'
```

### 日志查看

```bash
# 生产环境日志 (Supabase Dashboard)
# 进入 Functions → 选择函数 → Logs 标签

# 本地开发日志直接输出到终端
```

### 代码规范

- 所有 Edge Function 必须处理 OPTIONS 预检请求
- 所有响应使用 `corsResponse()` 包装
- 错误统一用 `AppError` 抛出，由顶层 catch 统一处理
- AI 调用必须 try-catch，失败返回 `ERR.AI_FAILED`
- 写数据库前必须先校验 JWT + 配额

---

## 故障排查

### 微信登录失败

```
症状: POST /wechat-auth 返回 401
原因: WECHAT_APPID 或 WECHAT_SECRET 不正确
检查: supabase secrets list --project-ref <ref>
```

### AI 报告生成失败

```
症状: 返回 "AI 服务暂时不可用"
原因: AI_API_KEY 无效或余额不足
检查: 在 Supabase Dashboard → Functions → Logs 查看详细错误
```

### 配额不生效

```
症状: 可以无限生成报告
原因: t_feature_quota 表未正确初始化
修复: 执行 seed.sql 中的 INSERT 语句
检查: SELECT * FROM t_feature_quota WHERE f_is_active = true;
```

### RLS 导致读不到数据

```
症状: GET /rest/v1/t_pet 返回空数组
原因: 用户未登录或 JWT 过期
检查:
  1. Header 中是否携带 Authorization: Bearer <token>
  2. token 是否过期
  3. t_user 表中 f_public_id 是否匹配 auth.uid()
```

### 图片上传 413

```
症状: 上传大图返回 413
原因: 超过文件大小限制
修复: storage.buckets 表中 file_size_limit 默认为 10MB
      如需调整: UPDATE storage.buckets SET file_size_limit = 20971520 WHERE id = 'petchat-assets';
```

### CORS 错误

```
症状: 微信开发者工具报跨域错误
原因: OPTIONS 预检未正确处理
检查: 每个 Edge Function 必须有 OPTIONS handler
```

---

**维护者**: PetChat Platform Team  
**最后更新**: 2026-06-18
