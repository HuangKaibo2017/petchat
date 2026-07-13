# 更懂它 (Gengdongta) — 微信小程序

> 宠物智能养护平台 · 懂宠物，更懂你

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | 微信小程序原生 | 基础库 ≥ 3.3.4 |
| 语言 | JavaScript (ES6+) | — |
| 样式 | WXSS | 语义化类名 |
| 后端 | Node.js + Express | `backend/src/server.js` |
| 数据库 | Supabase PostgreSQL | 15 模块，90 张表，已部署 |
| AI | Coze (扣子) 智能体 | 情绪 / 健康 / 风险 / 聊天 / 体质 / 医疗 |
| 存储 | Supabase Storage | 头像 / 图片上传 |
| Edge Functions | Supabase Deno | 与 Express 并行 |

---

## 架构

```
微信小程序 (WX)
  │  wx.request()
  ▼
Express 后端 (server.js)
  │  pg (node-postgres)
  ▼
Supabase PostgreSQL
  db.dlvgbwyvxjdggxpddpod.supabase.co:5432
```

- 微信小程序 → `baseUrl` → Express → `pg` → Supabase
- 不经过 Edge Functions（直接后端连接数据库）

---

## 项目结构

```
wechat/
├── app.js / app.json / app.wxss    # 入口、路由、全局样式
├── components/                     # 6 个全局组件
│   ├── authorize/                  # 微信授权弹窗
│   ├── empty-state/                # 空状态占位
│   ├── loading/                    # 加载动画
│   ├── nav-bar/                    # 自定义导航栏
│   ├── pet-card/                   # 宠物选择卡片
│   └── report-card/                # 报告卡片
├── pages/                          # 30 个页面
│   ├── index/                      # 首页
│   ├── emotion/ + report/          # 情绪解读
│   ├── health/ + report/           # 健康监测
│   ├── risk/ + report/             # 风险评估
│   ├── medical/ + detail/          # 医疗科普
│   ├── chat/ + list/               # 宠物聊天
│   ├── shop/ + detail/cart/checkout/  # 商城
│   ├── hospitals/ + detail/        # 合作医院
│   ├── favorites/                  # 收藏
│   └── mine/ + register/pets/history/orders/settings/
└── utils/
    ├── api.js                      # API 封装（字段映射 f_ ↔ camelCase）
    ├── mock.js                     # Mock 数据（离线调试）
    └── util.js                     # 通用工具
```

---

## API 端点

统一前缀 `{baseUrl}`，默认 `http://localhost:8001`，生产 `https://petchat.life`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/wechat-auth` | 微信登录 |
| GET | `/api/pets` | 宠物列表 |
| POST | `/api/pets` | 添加宠物 |
| PUT | `/api/pets/:id` | 更新宠物 |
| DELETE | `/api/pets/:id` | 删除宠物 |
| POST | `/emotion-report` | 情绪解读报告 |
| POST | `/health-report` | 健康监测报告 |
| POST | `/risk-report` | 风险评估报告 |
| POST | `/api/medical/guide` | 医疗科普 |
| GET | `/api/reports?type=` | 历史报告 |
| GET | `/api/reports/:id` | 报告详情 |
| GET | `/chat/sessions` | 会话列表 |
| POST | `/chat/sessions` | 创建会话 |
| GET | `/chat/messages?sessionId=` | 消息历史 |
| POST | `/chat/send-json` | 发送消息 |
| GET | `/api/products?category=` | 商品列表 |
| GET | `/api/products/:id` | 商品详情 |
| POST | `/api/orders` | 创建订单 |
| GET | `/api/hospitals` | 医院列表 |
| GET | `/api/hospitals/:id` | 医院详情 |
| POST | `/api/favorites` | 收藏/取消 |
| GET | `/api/favorites` | 收藏列表 |
| POST | `/api/upload` | 文件上传 |

---

## 数据库

Supabase PostgreSQL — 90 张业务表，按模块分层：

| 模块 | 文件 | 表 |
|------|------|-----|
| 扩展 | `00_extensions.sql` | pgroonga, pgcrypto |
| 枚举 | `01_enums.sql` | t_lang, t_status, t_gender 等 20 张 |
| 用户 | `02_rbac_users.sql` | t_user, t_role 等 5 张 |
| 宠物 | `03_pet_profile.sql` | t_pet, t_pet_photo |
| AI 报告 | `04_ai_reports.sql` | t_report_emotion/health/risk/constitution/consultation 等 |
| 聊天 | `05_chat_comments.sql` | t_chat_history, t_comment |
| 分享 | `06_share_interpretation.sql` | t_share_record, t_interpretation_voice |
| 运营 | `07_cms.sql` | t_banner, t_activity 等 |
| 订阅 | `08_subscription.sql` | t_plan, t_user_subscription 等 |
| 电商 | `09_ecommerce.sql` | t_product_spu/sku, t_cart, t_order, t_order_item 等 |
| IoT | `10_iot.sql` | t_user_device 等 |
| 代理 | `11_agent.sql` | t_agent_application 等 |
| 医疗 | `12_healthcare.sql` | t_hospital, t_doctor, t_appointment |
| 公益 | `13_welfare.sql` | t_rescue_request, t_adoption 等 |
| 索引 | `99_indexes_views.sql` | 跨模块视图与索引 |

字段命名规范：数据库使用 `f_` 前缀（如 `f_name`, `f_created_at`），前端 `api.js` 做 `f_` ↔ camelCase 互转。

---

## 开发

### 环境要求

- 微信开发者工具（最新稳定版）
- Node.js ≥ 18
- Supabase 项目（已配置，见 `.env.local`）

### 本地启动

```bash
# 启动后端
cd backend/src
node server.js                    # http://localhost:8001

# 打开微信开发者工具
# 导入 wechat/ 目录
# AppID: wx67bdea24d2893ced
# 勾选 "不校验合法域名"
```

### DEBUG 模式

`wechat/utils/api.js` 设置 `DEBUG = true` 可离线运行，数据来自 `mock.js`。

---

## 配置

| 文件 | 用途 |
|------|------|
| `wechat/app.js` | `globalData.baseUrl` |
| `.env.local` | `SUPABASE_DB_URL` + LLM/Coze 密钥 (gitignored) |
| `.env.dev` | 公开配置模板 (可提交) |

---

## 已知问题

1. **收藏** — `t_favorite` 表暂未创建，返回空数据
2. **上传** — `/api/upload` 为 stub，未对接 Supabase Storage
3. **支付** — 结算仅 toast 模拟
4. **搜索** — 全局搜索显示"开发中"
5. **流式聊天** — Express 暂不支持 SSE
6. **购物车** — 仅存 localStorage，不跨端同步
