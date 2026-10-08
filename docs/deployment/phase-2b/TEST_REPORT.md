# Deployment Phase 2B 测试报告

日期：2026-10-09。执行：Codex。本机Node 26.3.1/PostgreSQL 18.4；云端PG17.11未连接。数据库为仅loopback的hq_test_phase2b，每组随机隔离Schema自动清理；Storage使用明确标识的替身，文件为合成数据。没有读取.env内云密钥，也没有真实云上传。

## 自动化结果

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

## 未执行/限制

- 真实CloudBase签名TTL/防覆盖/CORS/PUT/HEAD/GET及35.7MB视频上传。
- Staging重新部署、云端恢复/多副本/缩容运行策略、清理时效。
- 实际浏览器端到端上传、公开视频播放/Range、微信真机。本轮前端协议自动测试运行于Node的XHR/fetch替身，不称为浏览器实测。
- Docker镜像构建及Production部署。
- 长期任务表规模/持续并发压力；当前每轮最多4任务，未更改Schema/索引。

共享开发/云端业务数据影响：NO。工程测试通过；真实Staging验收待执行，见ACCEPTANCE.md。
