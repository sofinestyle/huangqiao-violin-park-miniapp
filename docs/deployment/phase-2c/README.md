# Phase 2C.1 运行说明

本轮只实现工具和 Admin 静态资源修复。**未执行真实 Staging 导入、未上传云对象、未部署。** 不属于数据库 Schema Migration：NO MIGRATION。

## 静态资源

App.jsx 的登录页和 Sidebar 共用 `import yorrayLogo from '../../images/yorray-logo.png'`。根路径构建命令 `npx vite build admin --base=/`，Logo 为 `/assets/yorray-logo-CFmraOUS.png`；默认 `/admin/` 构建会由 Vite 加此前缀。不更改默认 base 或登录背景；删除 Vite `/assets` 业务代理，保留 `/api`。系统 Logo 只进入静态包，不上传 Storage。

Content.jsx 原 22 张固定业务图片候选全部移除。真实图片选项来自已有 media API 和本次上传结果，值为 `/api/media/<id>`；无素材时提示先上传并禁用添加按钮。已有旧内容字段保持原样，无法匹配素材库时明确提示替换；本轮不静默修改其他模块数据。原 images 文件保留，未复制进 Admin public/dist；19 张点位图片作为此次选择性来源。

## 来源与目标

`guide-manifest.json` 是唯一固定清单：四条 spot、19 张 JPG、每字段原始值、图片顺序、UUID、字节数和 SHA-256。SQLite 仅以 `readOnly:true` 打开，只 SELECT 白名单四条 content。测试用独立构造的 SQLite，CI 不依赖未提交的本地业务库。

目标仅 staging / postgres-i56vqlwu / app / huangqiao-staging-d2d1dj1bb4ad90 / huangqiao-media。目标 UUID 使用固定命名空间的 UUIDv5，已固化于清单；不是旧 media ID。Source→Target 对照见 [MAPPINGS.md](MAPPINGS.md)。content.kind=spot、version=1、isTest=true，原 published、sort、文字和 JSON 原样保留，仅 images 重写；created_at/updated_at 使用 manifest 批次规划时间，真实执行时间另记 journal。

**原 state=published，因此未来获批 execute 后将按现有规则公开展示。isTest=true 不是隐藏开关。** 地址为空仍为空；不补造坐标、营业时间或宣传事实。rights 保持空字符串；不伪造授权说明，不更改当前允许图片无说明的规则。

## 默认 dry-run

```sh
node scripts/migrate-guide.mjs --category=guide --dry-run
```

省略 `--dry-run` 仍为 dry-run。无目标连接时状态 SOURCE_READY_TARGET_UNCHECKED，不能当成 Staging 已核查。此次实际运行使用只读控制台快照：

```sh
node scripts/migrate-guide.mjs --category=guide --dry-run \
  --target-snapshot=docs/deployment/phase-2c/STAGING_CONFLICT_SNAPSHOT.json
```

快照必须匹配 manifest 指纹/目标环境并在24小时内，不允许 execute 使用快照。快照只证明指定时点；过期后需重新只读检查或在可达VPC的受控环境提供独立数据库连接。DRY_RUN.json 中 uploaded/inserted 均为0，projectedAfter为预计值而非实际已迁移。

## 后续获批 execute 的最小条件（本轮不执行）

通过受控任务/临时环境注入以下变量，**不在命令、Git、输出或本文填写真实密码**：

|变量|来源/值|
|---|---|
|APP_ENV|staging|
|PGSCHEMA|app|
|GUIDE_DATABASE_URL|VPC中目标PG专用连接；不是源SQLite，不自动回退Runtime DATABASE_URL|
|GUIDE_TARGET_HOST|独立明确填写且必须与上方连接host一致|
|CLOUDBASE_ENV_ID|huangqiao-staging-d2d1dj1bb4ad90|
|CLOUDBASE_BUCKET|huangqiao-media；逻辑私有桶，不是COS名称|
|CLOUDBASE_SERVICE_ROLE_KEY|现有服务端Storage授权，经安全注入，不传浏览器|

数据库只需要 app schema USAGE、app.content 和 app.media 的 SELECT/INSERT。工具不调用 migrate/seed，不需要建表、UPDATE、DELETE、序列或 audit 权限。可沿用已具备以上权限的业务身份，不需root；如用更窄专用身份由后续运维授权建立，本轮不创建角色/执行GRANT。Cloud Storage 沿用现有 Provider 的单对象 POST（x-upsert:false）、HEAD 与 GET；不直写COS、不开公网、不改桶/CORS。

正式执行须再次获得用户授权，在可达Staging VPC的受控机器运行，并具备固定manifest、原SQLite与19原件；不要把SQLite打入API Runtime。工具先验证current_database/current_schema与目标一致：

```sh
node scripts/migrate-guide.mjs --category=guide --execute \
  --confirm-manifest=14dfa0bbae30eec3959e0780e79b7505f5b6ea237ca57a48d02ab6ad4faf37ba
```

## 一致性、安全与失败处理

1. 验证所有源字段、文件存在性、JPEG文件头、size/hash，拒绝路径逃逸及符号链接。
2. 检查目标全部 spot、同名/同ID内容和同媒体ID/对象key。未知点位、人工修改、部分登记、字段不一致均停止，不覆盖。其他类别内容不变。
3. 逐张 HEAD+流式GET验证原对象；已存在且完全匹配则复用，缺失才上传，远端元数据/hash不一致停止。Storage 404之外的鉴权/连接等错误不当作缺失。已登记但对象缺失也停止，不偷偷重建。
4. 19张全部验证后开启SERIALIZABLE事务，取得批次advisory lock，再次核查目标；同事务 INSERT 19 media + 4 content并检查，任一失败整体回滚。不更新或删除任何既有记录。
5. 重跑完整匹配批次不重复上传/建记录。中途云上传失败可在修复后复用已验证对象。数据库提交结果不确定时先重新读取确认，禁止直接清理。
6. `.local/guide-migration/<manifest-hash>.jsonl` 为本地追加式日志，含执行时间、上传意图、验证和潜在孤儿清单；含锁目录阻止同机并行，不输出任何密钥。失败时保留全部19候选key以覆盖未知提交状态，并注明须人工核对；不自动删除。跨机器并发由不可覆盖上传、事务锁与冲突检查保守停止。
7. 云对象与PG没有分布式事务；失败可能留下无业务引用的对象，这是已显式记录的限制。日志损坏、文件/锁异常也停止；异常退出遗留锁须运维确认无运行实例后处理。

严格排除 accounts、sessions、audit、idempotency、migrations、visitors、bookings、changes、consultations、slots 等所有非content/media表；不导入认证、历史业务或任何密码。不删除本地数据。执行后的数量、内容值、媒体顺序、hash和对象数量需人工复核。
