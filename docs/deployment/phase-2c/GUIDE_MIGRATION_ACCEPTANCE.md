# Guide Migration Acceptance Closeout

日期：2026-10-09（Asia/Shanghai）。操作者：Codex。执行基准：`2028524da18ab6c2b174d26d94d40187f8eb7d2e`。本次仅只读核查、微信开发者工具本地验证及验收文档更新，没有重新迁移、回滚或修改业务数据。

## 最终判定

**PENDING；idempotency 归因 = NOT ENOUGH EVIDENCE。** 原迁移 4/4 点位、19/19 media、19/19 Storage 对象及 Admin 验证结果继续保留；本次补齐微信原生开发者工具验证。唯一验收阻断：迁移前只保留整表数量及指纹，缺少四条幂等记录逐行内容，也未取得当时的执行日志，因此不能严格重建字段差异及写入进程，不能升级为 PASS。

## 一、idempotency 只读归因

迁移前后均为 4 行；整表指纹从 `93c4d70c02aae73bd9ad63155bf8f5f351a84a999de5fd405521f4c4f29f6b31` 变为 `13147027ae79b7cafd31dd4e0f6ea8308655f5de3e43741e72a73d536d797372`。其余十二组排除/非迁移记录在原迁移前后数量、指纹一致。本次没有将指纹基线重写为当前值来消除差异。

### 已确认事实

通过 CloudBase SQL 编辑器只读查询，实际列仅为 `owner / route / key / fingerprint / response`，表中不存在顶层 `created_at`、`updated_at` 或 `state`。时间和状态位于 response JSON；四条 response 均无 updatedAt。以下为本次读取时的值，不冒充迁移前后逐字段差分。日期均为 2026-10-09，时区 +08。

|task id|state|createdAt|expiresAt|cleanupAt|nextCleanupAt|
|---|---|---|---|---|---|
|2e2f87d5-3a55-43ba-a74b-e88391f3f633|done|09:23:36.644|09:33:36.644|09:38:36.644|—|
|68a0ffb1-e1de-4d61-8269-b8f28b9fc03f|expired|08:51:58.514|09:01:58.514|09:06:58.514|13:34:50.809|
|e243d621-7ecd-44b6-9e8b-1b304ff2ef4b|expired|08:52:05.303|09:02:05.303|09:07:05.303|13:34:50.836|
|eaee386e-88fc-473e-b070-6ff106d0fd64|expired|09:04:50.489|09:14:50.489|09:19:50.489|13:34:50.830|

四条 route 均为 `admin:direct-video:v1`，文件均为 L1201.mp4、35,722,048 bytes、video/mp4；1 条 done，3 条 expired / UPLOAD_EXPIRED。四条 lease=null、leaseUntil=0。属于 Phase 2B 视频上传任务，非 Guide 任务。脱敏字段证据：[closeout-tasks.json](evidence/closeout-tasks.json)，未输出账号 owner、凭据或签名 URL。

### 代码及数据库路径

- `scripts/migrate-guide.mjs` 仅调用独立迁移 core、PG adapter、Storage provider；不导入或启动 `server/index.mjs`、HTTP Server 或视频 worker。
- `scripts/guide-migration/core.mjs` 的写事务只有本批 media/content INSERT；不存在 idempotency INSERT/UPDATE/DELETE，也不通过业务 HTTP API 导入。
- PG adapter 创建 Pool/事务，不隐式启动运行时或执行迁移。Storage 操作为逻辑桶对象上传及读取验证，不调用视频任务接口。
- 当前 app.content、app.media、app.idempotency 未发现自定义触发器或规则；当前数据库未观察到通过这些机制间接写 idempotency 的路径。
- 既有 `server/index.mjs` 在启动时及每 15 秒调用 video worker；`server/video-uploads.mjs` 的 writeTask 更新 idempotency.response，claim/finish 会修改 lease、leaseUntil、state、error/code、nextCleanupAt。expired 任务按 nextCleanupAt 每小时再次清理检查，done 任务跳过。
- 按当前代码从三条 nextCleanupAt 减一小时，得到 12:34:50.809/.836/.830，早于 Guide 实际执行的 12:46:15—12:46:29。这与视频后台清理机制相符，但属于由当前值及代码反推的时间，不是独立执行日志。迁移前证据文件的落盘时间也不能代替 SQL 执行时间。
- CloudBase Run 日志页面显示日志功能未开启。本轮未开启日志、未接受相关服务条款、未新增收费能力，无法补取历史 SQL/worker 执行明细。

### 尚不能确认

不能从单向整表 hash 还原：究竟哪条记录、哪些 response 字段、原值是什么、是否处于短暂 lease 状态，也不能证明迁移窗口内实际运行了哪个后台进程。可排除已审查迁移工具代码中的直接写入路径，当前触发器/规则路径也未发现；但不足以把整次历史变化判为 CONFIRMED UNRELATED。没有发现 MIGRATION RELATED 的直接证据。

最小补充证据：**迁移前四条 idempotency 原始逐行只读快照，或覆盖该时间窗口且能够识别执行者与修改字段的数据库审计日志**。后续当前值重复查询、重跑迁移或修改指纹都不能补回这一证据。

## 二、微信原生页面验收

实际使用微信开发者工具 Stable 2.02.2608070、基础库 3.17.4，导入隔离生成目录 `build/mini-staging`；API_BASE 为 `https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com`，身份模式 wechat。没有以浏览器宿主页面冒充原生小程序。

当前产品实际实现为 `pages/tour/index` 在同一原生页面依次展示四个完整点位介绍；没有四个独立详情路由。本次逐段打开/滚动查看四条点位，不声称访问了不存在的独立详情页。

|点位|顺序/排序|图片数|原生结果|
|---|---|---|---|
|城市客厅|01 / 80|5|文字、图片、tags、visitItems 正常|
|音乐生态湖|02 / 81|4|文字、图片、tags、visitItems 正常|
|产业园·中小企业集聚区|03 / 82|5|文字、图片、tags、visitItems 正常|
|绿岛·智能环保表面处理中心|04 / 83|5|文字、图片、tags、visitItems 正常|

从微信开发者工具 Network 导出本次实际 HAR，在本地核对：

- 公开 spot 请求 HTTP 200，4 条目标 UUID 顺序完全匹配 manifest。
- name、description、address、opening、visitNote、isTest、tags、visitItems 逐字段匹配；19 个图片 URL 顺序完全匹配映射。
- 19/19 图片均 HTTP 200、image/jpeg；HAR 中实际响应文件 SHA-256 **19/19 匹配批准原件**，没有 404。总捕获 32 个请求，无 HTTP >=400。
- 页面控制台未发现 JavaScript 运行时错误；存在基础库试用提示及临时跳过域名校验提示。导出 HAR 的系统保存框期间开发工具出现一次模拟器长时间无响应提示，关闭提示后滚动显示恢复正常；不将该工具提示隐瞒或等同为页面异常。
- 既有 swiper 在多图时 current=1，即初始展示第二张；数据数组仍保留原始图片顺序。这是现有页面行为，本次未修改，不能表述为默认从第一张开始。

结构化结果：[mini-native-verification.json](evidence/mini-native-verification.json)。HAR 保留在本机 `.local/guide-migration-evidence/mini-tour.har`，不将完整调试记录加入版本管理。

截图：[城市客厅](screenshots/mini-tour-city.png)、[音乐生态湖](screenshots/mini-tour-lake.png)、[产业园](screenshots/mini-tour-industry.png)、[绿岛](screenshots/mini-tour-green.png)。

### 临时校验与恢复

正常合法域名校验会阻断当前 Staging Origin。经用户本轮明确授权，仅对该隔离验证项目临时勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。验收后已取消勾选，界面复选框=0，项目本地配置 `setting.urlCheck=true`，见[恢复证据](evidence/domain-validation-restored.txt)（设置面板截图渲染不完整，采用原生可访问性状态及本地配置交叉核实）。未修改微信平台合法域名或任何云端配置。

因此本次原生页面验收通过的范围为：**经授权的开发者工具隔离测试条件下，真实 Staging 数据/图片加载和展示通过**。不代表合法域名生产配置已通过，也不代表微信真机、体验版或发布验收通过。恢复校验后仍需合法域名配置才能正常重新加载，不能当成已解决的上线事项。

## 三、安全及范围

本轮没有运行 migration execute/dry-run，没有 SQL UPDATE/DELETE/INSERT/GRANT，没有上传或删除云对象，没有修改账号、Schema、权限、云配置或业务代码，没有重部署/提交/推送。仅执行只读 SQL、公开页面 GET、原生本地验证及文档/证据保存；线上既有 worker 自主运行不等于本轮主动执行清理。

未重新运行全量自动测试或构建：本轮无业务代码修改，使用此前已生成的 Staging 隔离构建；本次实际执行原生验证、证据字段/hash核对、git diff --check（通过）及25份原件大小/SHA-256校验（全部通过）。原迁移已写入的数据及无本批孤儿对象结果继续保留，不重新执行来掩盖验收证据缺口。

**最终：PENDING。等待补齐 idempotency 历史归因证据后重新判定，不迁移其他模块。**
