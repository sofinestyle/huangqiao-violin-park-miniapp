# Deployment Phase 2B 测试报告

日期：2026-10-09。执行：Codex。本机Node 26.3.1/PostgreSQL 18.4；云端PG17.11未连接。数据库为仅loopback的hq_test_phase2b，每组随机隔离Schema自动清理；Storage使用明确标识的替身，文件为合成数据。没有读取.env内云密钥，也没有真实云上传。

## 原实现阶段自动化结果

原有154项 + 新增17项 = 171项；Passed 171 / Failed 0 / Skipped 0。完整命令：APP_ENV=development TEST_DATABASE_URL=<专用本机测试库> npm test。

|新增测试文件|数量|验证|
|---|---:|---|
|tests/direct-video.test.mjs|12|参数/MIME/64MiB；恶意Key/URL结果；owner权限；授权响应TTL/path/origin；不存在/大小/类型/文件头错误；流式SHA；事务回滚；审计；幂等并发；权限中途撤销；持久租约恢复；超时清理与重试；签名失败；WebM；HTTP权限与同源；35,722,048字节合成MP4|
|tests/direct-video-client.test.mjs|5|视频PUT直传且无服务端凭据；JSON完成与轮询；图片原路径；本地存储兼容；签名过期；非JSON 413真实错误；Server校验失败不得报告成功|

签名测试使用合成JWT检查范围与TTL，不声称替身具备CloudBase的真实密码学签名验证能力。伪造客户端结果不能完成登记；官方token真假与过期执行由CloudBase负责，真实云端验证待人工执行。

## 现有回归

全部原有154项重新执行通过：业务/权限、SKU1/2、删除/恢复、媒体、图片无授权说明、视频封面、咨询/预约、审计、PG Migration/Runtime、备份恢复等。备份恢复仅临时数据库和隔离文件。

npm run build：PASS（Admin Vite + Mini TypeScript）。
npm run typecheck：PASS。
npm run verify:originals：PASS，25份原件大小/SHA-256一致。
git diff --check：PASS。

## 原实现阶段未执行/限制（当前状态以下方更新为准）

- 真实CloudBase签名TTL/防覆盖/CORS/PUT/HEAD/GET及35.7MB视频上传。
- Staging重新部署、云端恢复/多副本/缩容运行策略、清理时效。
- 实际浏览器端到端上传、公开视频播放/Range、微信真机。本轮前端协议自动测试运行于Node的XHR/fetch替身，不称为浏览器实测。
- Docker镜像构建及Production部署。
- 长期任务表规模/持续并发压力；当前每轮最多4任务，未更改Schema/索引。

共享开发/云端业务数据影响：NO。工程测试通过；真实Staging验收待执行，见ACCEPTANCE.md。


## 2026-10-09 Governance Closeout

基准 94467e1951151b8f868f1b02763b1ac2e2a97a72。用户已确认真实 Staging 35.7MB 视频授权、PUT、complete、校验/media 登记、后台预览及关联成功，并确认 response 列 UPDATE 已授权；详情见 ACCEPTANCE.md。该事实是用户确认，本轮没有重复云上传/部署/授权。

新增 `tests/direct-video-permissions.test.mjs` 三项真实 PG 最小权限测试，直接执行 Production/Staging 文档的 GRANT 代码块（仅替换隔离库/schema/随机角色名）：

1. ACL：SELECT/INSERT 和 response UPDATE 可用，表级 UPDATE 不可用；角色非 superuser/owner/继承高权限，不能更新 owner/fingerprint、删除/清空任务、修改 media/audit/migrations 或建表。
2. 故障复现：只在隔离库撤销 response UPDATE，complete 抛出 PostgreSQL 42501；任务 pending，media/upload audit 均为 0。
3. 最小权限完整流程：授权、complete、worker 租约/校验、SHA-256、media 与 identity audit INSERT、任务 done；重复提交幂等；过期孤儿清理、已登记媒体保留。

测试环境：全新本机 PostgreSQL 18.4 cluster，127.0.0.1:55439，hq_test_closeout，Node 26.3.1；守卫拒绝云端/共享路径，不读取 .env。每组随机 schema 和临时低权限角色，结束清理。Storage 使用合成替身。不是云 PG 17.11 自动化结果。

验证结果：原有 171 项 + 新增 3 项 = **174 Passed / 0 Failed / 0 Skipped / 0 Cancelled**。命令：`APP_ENV=development TEST_DATABASE_URL=<专用本机隔离库> npm test`。

- `npm run build`：PASS（Admin Vite + Mini Type Check）。
- `npm run typecheck`：PASS。
- `npm run verify:originals`：25 份原件 PASS。
- `git diff --check`：PASS。
- 上传业务源码、Schema、001 Migration：相对基准无变更。
- 本轮未连接或修改 CloudBase/Production，未新增 Migration，未重新上传真实文件。

结论：**READY FOR PHASE 2C**，仅表示本阶段治理收口完成；本轮不实施 Phase 2C。
