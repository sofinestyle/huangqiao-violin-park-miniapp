# 当前架构审计

审计日期：2026-10-08；执行者：Codex。依据本轮用户“只审计”指令；事实以当前源码和只读元数据为准，建议均未实施。

## 基线与范围

- Branch：main；HEAD / origin/main / GitHub main：`7c5f12967f385e1b1d0bb76b2b6231d9b59c6629`。开始工作区 clean；GitHub 通过 `git ls-remote origin refs/heads/main` 实际核对。
- 只新增本目录八份 Markdown。未修改业务代码、环境配置、AppID、Schema 或数据；未安装依赖、创建云资源、上传文件、部署或发布。
- 已读 AGENTS.md、当前 SKU-2 初始化/验收、前序治理与本地操作文档，并检查 Server、Admin、小程序、迁移、Seed、Reset、Backup 和测试源码。历史操作说明有旧规格/图片说明，不作为当前实现事实。
- SQLite 使用只读 URI `mode=ro` 检查 sqlite_master、索引和迁移版本，未调用会建表/迁移的 openDatabase。未读取账户密码、真实联系人、Token 或本机密钥文件。

## 当前运行与持久化

| 项目 | 实际实现 | 生产差距 |
| --- | --- | --- |
| SQLite | 默认 `.local/huangqiao.sqlite`；`HQ_DATA_DIR` 可改变根目录；node:sqlite DatabaseSync，WAL、FK ON、busy_timeout=5000 | 容器本地盘不能承载业务库；同步接口及全库写锁依赖须迁移 |
| 上传 | `.local/uploads`；media.stored_name 对应 UUID 文件名 | 云端改私有对象存储，保留 media ID/业务授权 |
| Server | `node server/index.mjs`，`npm run dev` 调用开发进程管理脚本；无 npm start | 生产启动/镜像与配置尚未建立 |
| 监听 | `PORT` 默认8787，固定127.0.0.1 | 云端须0.0.0.0和平台PORT |
| 环境保护 | APP_ENV若非development立即抛错；未设置时仍启动开发逻辑 | 不能仅设置production后直接部署 |
| Admin | React19.2、Vite7.1.7；`vite build admin` → admin/dist；base=/admin/ | 静态托管、HTTPS、同源API路由和安全响应头需配置 |
| Admin请求 | 相对/api/admin；fetch same-origin Cookie；上传/CSV/预览也有直接相对路径 | 不能仅改一个API_BASE就拆到跨域 |
| 游客 | 原生TS/WXML/WXSS；API_BASE=http://127.0.0.1:8787；wx.request | 正式HTTPS域名、环境构建与真机验证 |
| 身份 | IDENTITY_MODE=development；服务 devAuth 默认开启 | production必须拒绝开发身份，切wechat |
| 正式微信链路 | wx.login → /api/auth/wechat → jscode2session → openid绑定visitor →应用Session | 代码存在，非伪造openid Stub；真实账号/网络尚未验证 |
| 内容标记 | Service.saveContent拒绝isTest=false并强制true；Admin新建默认true | 正式人工录入目前仍不能形成正式标记，须受控生产化 |
| 健康检查 | 实际只读GET返回ok=true、local-development、devAuth=true、productionReady=false | 没有数据库就绪检查，不能当生产健康证明 |

Node最低版本声明 >=22.13.0。未来镜像固定经过测试的受支持Node版本及镜像摘要，不使用浮动latest。当前依赖仅React/ReactDOM及开发工具，未安装pg或CloudBase生产客户端；未发现既有Dockerfile/云部署工作流。

健康请求最初在受限网络中失败，放开本地只读访问后返回上述结果；未重启服务。该核查不等于业务回归。

## Migration、Seed、Reset、账号与备份

1. 当前共享开发库迁移记录为1、2、3、4、5。1在db.mjs创建基础表；2在content-migration.mjs修订旧开发默认文案，由Seed触发；3增加slots.external_count/enrollment；4审计索引；5product_skus。关闭Seed的新空库可只有1/3/4/5，不能为凑编号补写2。
2. `HQ_SEED_MODE` 默认development，none跳过测试Seed；server/seed.mjs从test-catalog.json生成isTest资料，sku-seed生成结构化合成产品。正式环境必须禁止自动Seed，不能沿用默认启动行为。
3. reset-sku-dev仅处理专用临时目录、专用标记、显式development；拒绝符号链接/共享路径，支持dry-run和确认开关。本轮未执行Reset；该脚本不能作为正式PG初始化工具。
4. 空accounts会自动建admin并把随机密码写到本地600权限文件；account:create也依赖SQLite、本地文件。正式建议一次性受控初始化任务，密码通过安全通道交付，服务启动不自动创建管理员。
5. backupData用VACUUM INTO生成一致SQLite快照，再按media清单复制文件和校验SHA；restoreData仅恢复新路径、校验FK/quick_check并清除Session。没有发现每3天/每周/30天的自动调度或轮换实现；用户本轮明确的周期是待实现要求。

## 审计覆盖及验证边界

源码重点：server/db.mjs、migrations/*、index.mjs、service.mjs、http.mjs、security.mjs、product-sku.mjs、public-product.mjs、consultation-sku.mjs、content-delete.mjs、media.mjs、audit-query.mjs、backup.mjs；scripts/{backup,restore,create-account,reset-sku-dev}.mjs；admin/src/{api.js,App.jsx,Content.jsx,Operations.jsx}；admin/vite.config.js；miniprogram/miniprogram/{config.ts,lib/api.ts}。

已执行：Git基线检查、源码/SQL扫描、只读Schema核对、健康GET、25份原件校验、官方资料查询。没有执行数据库迁移、PG连接、云媒体上传、正式微信登录、备份恢复演练或业务测试。本轮文档审计无代码变化，不重跑会创建隔离测试数据的135项测试；上一阶段结果见[SKU-2验收](../../business/product-sku-phase-2/ACCEPTANCE.md)，不能作为PG测试结果。

[数据库与SQL](02-SQLITE_TO_POSTGRESQL.md) · [云架构](03-CLOUDBASE_ARCHITECTURE.md) · [媒体](04-MEDIA_STORAGE.md) · [安全](05-AUTH_AND_SECURITY.md) · [备份](06-BACKUP_RECOVERY.md) · [部署](07-DEPLOYMENT_PLAN.md) · [推荐](08-RECOMMENDATION.md)
