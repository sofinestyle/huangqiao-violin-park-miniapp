# Deployment Phase 2B — Direct Video Upload 验收与部署

结论（2026-10-09 治理收口）：用户已确认 Staging 真实视频直传、complete、校验/media 登记、后台预览及关联成功。Phase 2B 治理与最小权限回归已完成，READY FOR PHASE 2C；这不等于 Production 部署或正式发布批准。

## 基准与范围

Baseline：8f3e90fd03ec7b2a04e27a9775e24efa351a4bcd，main，与GitHub一致且clean后开始。Phase 2B 实现提交：94467e1951151b8f868f1b02763b1ac2e2a97a72。本次治理收口以该提交为基准，不修改上传业务代码。

Root Cause：用户及此前浏览器实测确认，35,722,048 bytes/video/mp4 经 POST /api/admin/media 在入口链路返回413，未达到64MiB应用限制，也不是超时。本轮使视频二进制绕过业务HTTP Gateway/Run入口；只向业务API发送小型JSON。无需提高该HTTP Gateway的413限制；不调整网关路由。图片仍走原接口。

官方依据：
- [PG Storage预签名上传](https://docs.cloudbase.net/http-api/storage-pg/获取预签名上传链接)
- [官方OpenAPI原始契约](https://docs.cloudbase.net/openapi/storage.v1.postgres.openapi.yaml)
- [PG Web SDK Storage](https://docs.cloudbase.net/api-reference/webv3-pg/storage)

采用官方POST签名、PUT上传；没有自行生成签名协议、没有绕过PG Storage直写底层COS。

## API

|接口|请求|返回|
|---|---|---|
|POST /api/admin/media/video-uploads|filename、mime、size、rights；不允许objectKey/bucket/url|201：id、uploadUrl、uploadExpiresAt、expiresAt、method=PUT|
|POST /api/admin/media/video-uploads/:id/complete|空对象 `{}`|202：state=verifying；重复已完成任务200及同一media|
|GET /api/admin/media/video-uploads/:id|无Body|200：任务状态；done包含标准media结果，失败包含中文error/code|

仅admin/content、当前会话所属任务可以操作。reception=403、anonymous=401、非所属任务=404。新增API沿用同源Cookie、X-HQ-Action与Origin校验。完成请求不接受客户端提交的Hash、远端URL、类型或成功结论。旧POST /media保留兼容，云端新版Admin不会再将视频发送到旧入口。

本地LocalStorage独立开发环境返回transport=local-proxy，继续本地原视频上传；CloudBase签名失败绝不自动回退大文件代理。

## 安全、完整性和清理

- Server生成UUID对象Key，MP4/WebM专用扩展名。官方签名x-upsert=false，不允许覆盖；精确匹配Storage origin、Bucket及对象路径。
- 官方文档默认60秒，当前OpenAPI未列出可设置有效期的Body参数，故不自造expiresIn。检查官方JWT exp在当前时刻5秒至签发起5分钟内；缺失、过期或超长有效期全部拒绝。这里只检查返回凭据范围，不自行签名或代替CloudBase验证JWT。
- Browser只接收单对象短期URL；无service-role/server API Key，无跨域Admin Cookie。任务数据库和应用日志不保存签名URL/token。浏览器Network中短期URL仍属敏感凭据，分享HAR前必须脱敏。
- 应用授权前检查64MiB；官方签名契约没有暴露每个token独立绑定size/MIME的参数，因此不声称能在Storage入口阻止恶意客户端上传超出声明的对象。完成后强制HEAD类型/长度、流式GET实际长度/文件头/SHA-256校验，不符合者不能登记或发布，并进入清理。Bucket仍私有、100MB限制不改；未授权者不能获取签名。
- Hash由Server流式下载计算，客户端不可信；没有将35MB视频放回业务上传请求。代价是一次Storage读取及相应流量/CPU，保持原media.sha256备份校验能力。
- 写media、media.upload审计、幂等结果在同一事务中；事务最终重查账号权限。不新增Audit action、Schema或Migration。
- 上传任务10分钟内完成登记；后台验证租约5分钟，单Storage请求120秒超时，15秒轮询调度、每轮最多4项。进程退出/副本竞争后按持久租约恢复。
- 签发后15分钟起清理未登记对象；只清理持久任务记录里的Server Key，始终检查media，保护已登记对象。失败重试、成功清理后每小时复查以捕捉迟到请求。不清理已有业务媒体。
- 清理需要实例获得运行时间；缩容到零时不会按时执行，下次运行恢复。任务历史暂保留，无自动删除记录；长期任务保留/归档策略是后续运维项，不冒充已完成。

## 部署运行手册（Staging 已由用户完成，本次治理不重部署）

1. huangqiao-api从本次main提交重新构建/发布Staging。无需Migration；沿用业务数据库账号，不需要root密码。仍使用现有STORAGE_PROVIDER=cloudbase、CLOUDBASE_ENV_ID=huangqiao-staging-d2d1dj1bb4ad90、CLOUDBASE_BUCKET=huangqiao-media及服务端已有CLOUDBASE_SERVICE_ROLE_KEY；不增加前端密钥变量。
2. Admin从同一提交重新构建并发布到当前静态托管位置，保持同源/api/admin/。必须同时更新Admin和Server；仅更新Server不会改变旧Admin的视频代理请求。
3. 若静态托管额外设置CSP，将connect-src增加精确origin：`https://huangqiao-staging-d2d1dj1bb4ad90.api.tcloudbasegateway.com`。Node托管Admin的CSP已自动加入该origin。保持现有API同源配置。
4. 用浏览器检查Storage PUT的CORS预检：当前Admin origin应能调用官方签名PUT，Content-Type允许video/mp4/video/webm。若被CloudBase安全域名/跨域策略拦截，只按平台官方配置允许当前Admin域名；不得开放匿名桶写、不得改为公开桶或把服务端Key放前端。实际 Staging 修复位置和结果见下方收口记录；Production 使用自身获批的精确 Admin 来源，不复制开发域名或使用通配来源。
5. 检查Staging实例有运行时间处理校验和清理。缩容为零时只承诺恢复处理，不承诺15分钟准点清理；需要固定清理时效时由运维确认实例运行策略，本轮未修改计费/实例配置。

## 验收检查清单（已确认范围见收口记录，其余不自动标记完成）

1. 使用L1201.mp4（35,722,048 bytes/video/mp4）在教学内容上传，填现有视频授权说明。Network应依次看到小型授权POST、直达Storage的PUT、小型complete POST和状态GET；不再出现35MB POST /api/admin/media。
2. 授权URL仅短期单对象；检查实际exp和x-upsert=false约束，用隔离测试对象确认过期拒绝、修改对象路径拒绝、同URL不能覆盖已存在对象。若云端契约与文档不符，停止验收，不放宽安全检查。
3. 只有完成校验后出现已关联视频；media.size=35722048，media.sha256等于原文件本地SHA-256，rights保留，media.upload审计仅一条；同一complete重复请求仍返回同一media。
4. 预览可播放、可拖动，保存教学草稿后正确关联，正式发布沿用已有审批/业务动作。另查小图上传保持原路径正常。
5. 使用隔离测试任务检验不存在对象、类型/大小不符、无权限/会话失效，均无错误media登记；中途取消后私有孤儿对象由清理任务删除。勿拿正式媒体做破坏性验证。
6. 检查私有性：未关联/未发布视频普通游客不可访问，发布后的原有Range播放正常。此播放回归属于待人工执行项，本轮没有改播放API。

禁止把隔离替身通过写成真实 CloudBase 验收通过。以下真实成功结论来自用户本轮确认；本次治理不重新上传、部署或修改任何云端配置/数据。


## 2026-10-09 Staging 实测与治理收口

确认人：用户（项目负责人）；确认依据：本轮“Staging真实验证已完成：视频授权成功、Storage PUT成功、complete成功、视频校验及media登记成功、后台视频预览/关联成功”，以及“该权限已在真实Staging执行并验证”。Codex 本轮只更新治理材料及隔离自动测试，没有重新执行云端上传或授权。

- 文件：L1201.mp4，35,722,048 bytes，约 35.7 MB / 34.07 MiB，video/mp4。
- 环境：huangqiao-staging；API/Admin 部署版本 94467e1951151b8f868f1b02763b1ac2e2a97a72；私有逻辑桶 huangqiao-media。
- 真实闭环：申请授权 → Storage PUT → complete → Server 视频校验与 media 登记 → Admin 预览及关联，用户确认通过。成功任务 ID、成功响应原文和本地/远端 SHA 对照未随本次确认提供，不补造截图、日志或哈希。
- CORS 修复：CloudBase → HTTP 网关 → 跨域设置，增加安全来源域名 `huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com`，保留此前两个安全来源。完整 Admin Origin 为 `https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com`。未开放匿名上传、未改公开桶、未将服务端密钥放前端。
- CORS 后故障：此前只读审计看到授权 201、Storage PUT 200、complete 500，任务 pending；Storage size/MIME 正确，media/audit 尚未登记。实查 huangqiao_app 有 idempotency SELECT/INSERT，但表级及 response 列 UPDATE 均为 false。complete 在更新任务状态前失败，尚未进入远端校验。
- 权限修复：保留 SELECT/INSERT，仅增加 `GRANT UPDATE (response) ON TABLE app.idempotency TO huangqiao_app;`。用户确认已在真实 Staging 执行并验证成功。不扩大为整表 UPDATE，不使用 ALL PRIVILEGES。完整 Staging/Production 运行账号清单见 [最小权限 SSOT](../phase-2a/MIGRATION_RUNTIME_FIX.md)。
- HTTP Gateway 413：无需调整。视频主体直接 PUT Storage，授权/complete/task 仍仅传输小型 JSON；图片路径不变。
- 权限清单的自动化约束：新测试直接提取 SSOT SQL，在隔离 PG 中创建随机命名的 huangqiao_app 等效最小权限 LOGIN 角色，无 superuser/owner/继承授权，运行真实业务 Service、Hash、media/audit 事务及清理流程。Storage 为合成替身，不称为本轮再次云端实测。

本轮未改变 Schema、001 Migration、API、上传实现、CloudBase 配置、共享/正式数据。Production 尚未部署；真实云端签名过期/防覆盖、失败补偿时效、多副本/缩容、匿名及 Range/微信真机等未被用户本次成功确认覆盖的检查，仍保留待验，不扩大验收结论。
