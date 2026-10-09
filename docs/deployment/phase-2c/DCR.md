# Deployment Phase 2C.1 — Approved for Implementation

确认人：用户。日期：2026-10-09。基准：1cd0be50ffb89e9199c4ec8585799f44753a8fe7，开始前 main clean 且与 GitHub 一致。

依据：本轮明确批准 Static Assets Fix + Guide Migration Tool；SQLite `.local/huangqiao.sqlite` 仅为选择性候选来源；仅四条 spot 和十九张 JPG；默认 dry-run；本轮禁止真实 Staging execute。

范围：App.jsx 两处 Logo 使用原 images/yorray-logo.png 的 Vite import；admin/vite.config.js 移除旧 /assets 本地业务代理（原代理也会拦截 root preview 的已打包 Logo）；Content.jsx 移除硬编码业务图库候选，保留既有历史字段而不静默替换；scripts/guide-migration、固定 manifest、隔离测试和治理文档。登录背景、原件、Server API、Schema/Migration、权限及上传业务冻结。

导入仅写目标 content/media，不读写认证与历史业务表，不调用会产生 audit/idempotency 的业务保存接口。使用现有 CloudBase PG Storage Provider，不直写 COS。工具单独运行，不接入 Runtime。固定 manifest 保存逐字段来源、目标 UUID、图片顺序/哈希和批次时间；任何来源变化均停止，清单更新需重新审查。目标 version=1，created_at/updated_at 使用固定 batchTime（批次规划时间，不伪称实际执行时间），实际执行时间在本地运行日志记录。

Staging 固定 isTest=true；保留原 published 状态，因此获批 execute 会使四条点位立即按现有公开规则可见。媒体和内容全部检查成功后在同一 PG 事务登记；云对象与 PG 不存在分布式事务，失败只记录潜在孤儿、不自动删除。重跑只读验证相同对象及记录，不重复上传或登记。人工修改、未知目标同名/同 ID/同对象 key、部分数据库记录均停止。

真实 Staging 只读冲突快照由当前控制台读取 content/media 生成，不读取凭据。快照 dry-run 是指定时点的检查，不能代替 execute 时的数据库重新检查和远端对象校验。没有获得数据库密钥不阻止离线工具实现，也不得在文档中保存密钥。
