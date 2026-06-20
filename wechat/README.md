# 更懂它 (Gengdongta) — 微信小程序

> 宠物智能养护平台 · 懂宠物，更懂你

---

## 技术栈

| 层级 | 技术 | 版本/说明 |
|------|------|----------|
| 框架 | 微信小程序原生框架 | 基础库 ≥ 3.3.4 |
| 语言 | JavaScript (ES6+) | — |
| 样式 | WXSS (WeiXin Style Sheets) | 类 Tailwind 语义类名 |
| 后端 | Node.js + Express | `backend/server.js` |
| AI 引擎 | Coze (扣子) 智能体 | 情绪解读 / 健康监测 / 风险评估 / 聊天 |
| 数据库 (规划) | Supabase PostgreSQL | 15 个业务模块，75+ 张表 |
| Edge Functions | Supabase Deno | 6 个函数（与 Express 并行演进） |
| 对象存储 | Supabase Storage | 宠物头像 / 症状图片上传 |

---

## 项目结构

```
wechat/
├── app.js                    # 应用入口，全局数据，授权
├── app.json                  # 页面路由，TabBar，全局组件注册
├── app.wxss                  # 全局样式
├── project.config.json       # 微信开发者工具配置
├── sitemap.json              # 微信搜索索引规则
│
├── components/               # 全局组件 (6 个)
│   ├── authorize/            #   微信授权弹窗
│   ├── empty-state/          #   空状态占位
│   ├── loading/              #   加载动画
│   ├── nav-bar/              #   自定义导航栏
│   ├── pet-card/             #   宠物选择卡片
│   └── report-card/          #   报告卡片
│
├── pages/                    # 页面 (30 个页面)
│   ├── index/                # 🏠 首页 — Banner, 核心服务入口, 附近医院
│   ├── emotion/              # 🔮 宠物心声解读 — 六爻/梅花/大六壬/塔罗
│   │   └── report/           #   情绪解读报告详情
│   ├── health/               # 💊 健康监测 — 症状输入, 健康评估
│   │   └── report/           #   健康监测报告详情
│   ├── risk/                 # ⚡ 人宠风险评估 — 体质分析, 风险预警
│   │   └── report/           #   风险评估报告详情
│   ├── medical/              # 📋 医疗科普指南 — 症状咨询
│   │   └── detail/           #   科普指南详情
│   ├── chat/                 # 💬 宠物聊天 — 会话列表
│   │   └── list/             #   聊天界面 (流式对话)
│   ├── shop/                 # 🛒 商城 — 商品列表, 分类筛选
│   │   ├── detail/           #   商品详情
│   │   ├── cart/             #   购物车
│   │   └── checkout/         #   结算页
│   ├── hospitals/            # 🏥 合作医院 — 医院列表
│   │   └── detail/           #   医院详情 (电话/导航/预约)
│   ├── service/              # 🛠️ 服务聚合 — 医疗/保险/丢失/社区/新宠
│   ├── insurance/            # 🛡️ 宠物保险 — 险种列表
│   ├── community/            # 🌐 社区 — 活动, 动态流
│   │   └── post/             #   发布动态
│   ├── favorites/            # ❤️ 我的收藏
│   └── mine/                 # 👤 我的
│       ├── register/         #   注册 (主人信息 + 宠物信息)
│       ├── pets/             #   宠物列表
│       │   └── edit/         #   编辑/添加宠物
│       ├── history/          #   历史报告
│       ├── orders/           #   我的订单
│       ├── agent/            #   成为代理
│       └── settings/         #   设置 (缓存/退出)
│
└── utils/                    # 工具库
    ├── api.js                #   API 封装 (Express 后端)
    ├── mock.js               #   Mock 数据 (离线/降级)
    └── util.js               #   通用工具 (日期/防抖/限流/体质标签)
```

---

## 架构

```
┌─────────────────────────────────────────────┐
│              微信小程序 (WXML/WXSS/JS)        │
│                                             │
│  app.js → api.js → wx.request()             │
│                      │                      │
│             baseUrl: localhost:8001          │
└──────────────────────┼──────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           Express 后端 (server.js)            │
│                                              │
│  /api/emotion/report  ──→  Coze 情绪解读      │
│  /api/health/report   ──→  Coze 健康监测      │
│  /api/risk/report     ──→  Coze 风险评估      │
│  /api/medical/guide   ──→  Coze 医疗科普      │
│  /api/chat/send-json  ──→  Coze AI 聊天      │
│  /api/pets/*          ──→  内存 DB (CRUD)    │
│  /api/products/*      ──→  内存 DB (商品)     │
│  /api/hospitals/*     ──→  内存 DB (医院)     │
│  /api/favorites/*     ──→  内存 DB (收藏)     │
│  /api/upload          ──→  文件上传           │
└──────────────────────┼───────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   Coze 智能体 API          Supabase PostgreSQL
   (扣子/扣子平台)            (15 模块, 75+ 表)
```

### 上线架构规划

```
Mini Program ──→ https://api.gengdongta.com
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
     Express/Nginx            Supabase Edge
     反向代理                  Functions
          │                       │
          ▼                       ▼
     Coze 智能体            Supabase PostgreSQL
```

---

## 功能完成度

### ✅ 已完成

| 功能 | 状态 | 说明 |
|------|------|------|
| 首页 | ✅ | Banner, 宠物状态卡片, 核心服务网格, 附近医院 |
| 情绪解读 | ✅ | 完整流程：选宠物 → 输入问题 → 起卦 → Coze 生成报告 |
| 性格分析 | ✅ | 与情绪解读共用流程，路由到 Coze personality 项目 |
| 健康监测 | ✅ | 症状输入 → Coze 健康评估报告 |
| 风险评估 | ✅ | 关联健康报告 → 八字分析 → 人宠风险报告 |
| 宠物聊天 | ✅ | 会话管理, AI 对话, 流式占位渲染 |
| 商城列表 | ✅ | 分类筛选, 商品网格, 购物车 |
| 购物车 | ✅ | 增删查, 总价计算 |
| 结算 | ✅ | 地址选择, 下单 |
| 医院列表 | ✅ | 调用 API 加载医院数据 |
| 医院详情 | ✅ | 动态加载, 电话/导航 |
| 医疗科普 | ✅ | 症状咨询 → Coze 生成科普指南 |
| 收藏 | ✅ | 收藏/取消, 列表查看 |
| 注册 | ✅ | 主人信息 + 宠物信息表单 |
| 宠物管理 | ✅ | 添加/编辑/删除, API 同步 + 本地降级 |
| 历史报告 | ✅ | 按类型筛选, 详情跳转 |
| 我的页面 | ✅ | 宠物切换, 功能入口, 订单角标 |
| 设置 | ✅ | 语音/NFC 开关, 缓存管理, 退出登录 |
| 授权组件 | ✅ | 支持新版 getUserInfo + 旧版降级 |
| Mock 数据 | ✅ | DEBUG 模式下完整离线运行 |
| 本地持久化 | ✅ | 报告/宠物/收藏 localStorage 多端同步兜底 |

### 🟡 部分完成

| 功能 | 状态 | 说明 |
|------|------|------|
| 社区 | ⚠️ | 动态列表和发布页为静态 mock，无后端 |
| 保险 | ⚠️ | 险种列表展示，投保/理赔为占位 toast |
| 服务聚合 | ⚠️ | 导航跳转正常，丢失/救助为占位 |
| 订单 | ⚠️ | 创建订单已实现，订单列表为空壳 |
| 代理 | ⚠️ | 仅申请弹窗，无后端流程 |
| 商品详情 | ⚠️ | API 加载逻辑已实现，详情描述为通用模板 |
| 上传 | ⚠️ | Express 端为 stub（返回空 URL），Supabase 签名上传已实现未启用 |
| SSE 流式 | ⚠️ | api.js 已实现 SSE 解析，Express 暂不支持 |

### ❌ 未完成

| 功能 | 说明 |
|------|------|
| 搜索 | 全局搜索、商品搜索均显示"开发中" |
| 在线预约 | 医院预约显示"开发中" |
| 报告同步 | 医院端报告同步显示"开发中" |
| 设备绑定 | NFC/AI 盒子绑定显示"开发中" |
| 支付 | 结算页确认后仅 toast 模拟，无真实支付 |
| 消息推送 | 未集成微信订阅消息 |
| 语音输入 | 未启用 |
| 多语言 | 仅中文，数据库层面已预留 i18n |
| 单元测试 | 无 |
| E2E 测试 | 无 |

---

## API 端点

所有请求统一前缀 `{baseUrl}`，默认 `http://localhost:8001`。

### 报告类 (Coze 智能体)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/emotion/report` | 宠物情绪/性格解读 |
| POST | `/api/health/report` | 健康监测评估 |
| POST | `/api/risk/report` | 人宠风险评估 |
| POST | `/api/medical/guide` | 医疗科普指南 |
| GET | `/api/reports` | 历史报告列表 `?type=emotion\|health\|risk` |
| GET | `/api/reports/:id` | 报告详情 |

### 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat/sessions` | 会话列表 |
| POST | `/api/chat/sessions` | 创建会话 `{petId}` |
| GET | `/api/chat/sessions/:id/messages` | 消息历史 |
| POST | `/api/chat/send-json` | 发送消息 `{sessionId, message}` |

### 资源 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/pets` | 宠物列表 / 添加 |
| PUT/DELETE | `/api/pets/:id` | 更新 / 删除宠物 |
| GET | `/api/products` | 商品列表 `?category=` |
| GET | `/api/products/:id` | 商品详情 |
| POST | `/api/orders` | 创建订单 |
| GET | `/api/hospitals` | 医院列表 |
| GET | `/api/hospitals/:id` | 医院详情 |
| POST | `/api/favorites/toggle` | 收藏/取消 |
| GET | `/api/favorites` | 收藏列表 |
| POST | `/api/upload` | 文件上传 |

---

## 开发

### 环境要求

- 微信开发者工具 (最新稳定版)
- Node.js ≥ 18
- Coze 账号 + API Key + Project ID

### 本地启动

```bash
# 1. 启动后端
cd backend
cp ../.env.example ../.env.local  # 填入真实 Coze 密钥
npm install
npm start                          # http://localhost:8001

# 2. 打开微信开发者工具
# 导入项目 → 选择 wechat/ 目录
# 填写 AppID: wx67bdea24d2893ced
# 勾选 "不校验合法域名"
```

### DEBUG 模式

设置 `wechat/utils/api.js` 中 `DEBUG = true` 可完全离线运行，所有数据来自 `mock.js`。

---

## 配置

| 文件 | 用途 |
|------|------|
| `wechat/app.js` | `globalData.baseUrl` — 后端地址，上线时改为线上域名 |
| `wechat/project.config.json` | 微信项目配置 (AppID, 编译选项) |
| `wechat/sitemap.json` | 微信搜索索引白名单 |
| `backend/.env.local` | Coze API Key, Project IDs (gitignored) |
| `.env.example` | 配置模板 (可提交) |

---

## 已知问题

1. **Express 内存存储** — 后端重启数据丢失，生产需迁移到 Supabase
2. **上传为 stub** — `/api/upload` 返回空 URL，图片无法真实上传
3. **手机号校验** — 仅正则格式，未做短信验证码
4. **聊天滚动** — 已切换 scroll-view，在部分真机上平滑滚动有卡顿
5. **SSE 流式** — Express 暂不支持，等线上部署后启用 Supabase 流式端点
6. **报告双写** — localStorage + 后端 DB 两份数据，可能不一致
7. **购物车本地化** — 仅存 localStorage，登录后不同步

---

## 数据库 (规划)

Supabase PostgreSQL 已设计 15 个业务模块，75+ 张表：

| 模块 | 表数 | 说明 |
|------|------|------|
| 01_enums | 23 | 基础枚举 (语言/类型/状态) |
| 02_rbac_users | 5 | 用户/角色/权限 |
| 03_pet_profile | 2 | 宠物档案 |
| 04_ai_reports | 5 | AI 报告 (情绪/健康/风险/性格) + 提示词 |
| 05_chat | 2 | 聊天历史 + 评论 |
| 06_share | 2 | 分享记录 + 语音解读 |
| 07_cms | 3 | 内容管理 (Banner/活动/落地页) |
| 08_subscription | 6 | 订阅/支付/用量 |
| 09_ecommerce | 12 | 商品/SPU/SKU/购物车/订单/物流 |
| 10_iot | 3 | NFC 设备/同步 |
| 11_agent | 3 | 代理/收益 |
| 12_healthcare | 3 | 医院/医生/预约 |
| 13_welfare | 5 | 救助/领养/捐赠 |
| 99_indexes | — | 索引和视图 |

当前 Express 后端使用内存 mock 数据，Supabase schema 作为生产迁移目标。

---

## 部署清单

上线前需完成：

- [ ] `app.js` `baseUrl` → 线上域名
- [ ] 微信公众平台配置 `request 合法域名`
- [ ] Express 部署到服务器 (PM2 / Docker)
- [ ] Coze API Key 从环境变量注入
- [ ] Supabase 数据库初始化 (`_run_all.sql`)
- [ ] JWT 鉴权替代 demo token
- [ ] 上传切换到 Supabase Storage
- [ ] SSL 证书配置
