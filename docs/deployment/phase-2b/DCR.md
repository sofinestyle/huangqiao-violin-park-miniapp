# Deployment Phase 2B — Direct Video Upload

状态：Approved for Implementation。确认人：用户；2026-10-09。依据本轮完整 Direct Video Upload 指令。基准 main 8f3e90fd03ec7b2a04e27a9775e24efa351a4bcd，开始 clean，与 GitHub 一致。DCR先于业务代码。

## 官方契约核查

2026-10-09读取官方 PG Storage OpenAPI：
https://docs.cloudbase.net/openapi/storage.v1.postgres.openapi.yaml
https://docs.cloudbase.net/http-api/storage-pg/获取预签名上传链接
https://docs.cloudbase.net/api-reference/webv3-pg/storage

POST /v1/storages/object/upload/sign/{bucketId}/{objectName}，Bearer服务端API Key、x-upsert:false；返回url/fullURL/token。官方描述默认60秒有效。PUT同路径携token使用二进制Body上传，不使用服务端Authorization。请求Schema没有列出expiresIn参数，因此不自造TTL参数；读取官方返回JWT的exp仅用于检查到期上限与展示，不自行签发/修改JWT，实际签名验证由CloudBase完成。超过5分钟/缺少有效exp/域名或对象路径不符均失败关闭。

## 批准范围

仅视频转直传，MP4/WebM，64MiB。图片保留既有POST /api/admin/media。新增同源POST /api/admin/media/video-uploads、POST /api/admin/media/video-uploads/:id/complete、GET同路径任务状态。id/objectKey均Server随机生成；请求不允许自定义Bucket/objectKey/远端URL。私有桶保持，不开放匿名写。Browser仅得到官方单对象短期URL，不得到服务端Key或Cookie跨域传递。

## 持久任务与完整性

复用现有idempotency表的独立route命名空间；owner=工作人员ID，key=任务UUID，response保存任务状态、服务器生成的文件元信息，不保存签名URL或token。NO MIGRATION。签名签发前保存任务，进程退出仍可清理。任务状态：pending/verifying/done/failed/expired；完成请求只接受任务ID，不信任客户端Storage结果。

异步worker在本机进程运行并持久租约，验证下载不保持长数据库事务。远端HEAD检查类型和实际长度；GET流式计算SHA-256、检查总长度和视频文件头，保留现有media.sha256能力。完成时事务重查账号权限、写media+media.upload审计+任务结果，重复完成/查询幂等。失败不登记素材。请求中仅调度验证并返回202，小请求轮询结果，避免HTTP Gateway等待整个视频校验。

任务租约超过Storage超时；进程重启或多副本恢复重试。过期或失败的未登记对象在签名最长有效期加上传缓冲期后删除，删除失败保留任务供后续重试。禁止扫描删除其它对象或历史素材；已登记对象永不被任务清理。定期清理依赖至少一个服务实例运行，缩容至零时下次启动恢复；本轮不改云实例配置。

## 白名单与冻结

server/storage/index.mjs；新增server/video-uploads.mjs；server/http.mjs、index.mjs；admin/src/api.js（仅上传协议）；必要测试、部署文档及两份治理记录。不改Schema、001、游客端、内容发布状态机、图片协议或网关路由。新增connect-src精确Storage origin以允许直传；同源业务API及登录继续保持。静态托管若另设CSP须同步允许该origin。

## 验收

隔离本机PG+Storage HTTP替身验证权限、类型/大小/Key、签名TTL/URL、不存在/损坏对象、SHA、幂等/并发、Storage异常、权限撤销、进程恢复与孤儿清理、图片回归；全部Node、Build、Type Check、25原件。云端35.7MB、CORS、签名过期/防覆盖、公开视频Range为重新部署后的人工验收，本轮不操作云资源。

## 实施细化

任务10分钟登记期限，15分钟起清理、每小时复查迟到对象；租约5分钟、调度15秒、每轮4任务。保留任务记录便于故障恢复，不在本阶段设计长期归档。LocalStorage开发环境才允许保留原本地视频路径，CloudBase异常不回退代理。官方凭据没有独立size/MIME绑定参数，应用完成时再次拒绝违规对象并清理，不宣称Storage上传入口已有64MiB单token限制。实际云端签名/CORS/防覆盖须部署后验证，失败时不放松TTL/域名/路径检查。
