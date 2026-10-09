# Deployment Phase 2C.1 验收记录

日期：2026-10-09。Baseline：1cd0be50ffb89e9199c4ec8585799f44753a8fe7（开始前main clean，与GitHub一致）。操作者：Codex。范围：工具实现与静态修复；不包含真实Staging execute或部署。

## 修改与证据

- admin/src/App.jsx：两处Logo正式import原始图片。
- admin/src/Content.jsx：移除22个固定业务图片候选，改用media；空库提示；旧保存字段不静默改写。
- admin/vite.config.js：移除旧/assets代理，避免干扰构建Logo；/api代理与默认base不变。
- scripts/migrate-guide.mjs、scripts/guide-migration/core.mjs：固定scope、默认dry-run、目标确认、只读源、原子登记、幂等、孤儿日志。
- tests/admin-static-assets.test.mjs、tests/guide-migration.test.mjs：11项新增测试。
- docs/deployment/phase-2c/：DCR、manifest、映射、说明、快照、dry-run、验收和截图；决策记录/待确认同步。

## 静态验证

默认/admin/和根路径/构建均通过。`assets/yorray-logo-CFmraOUS.png` 与原件字节完全一致，HTTP 200、image/png。Chrome实测登录页和隔离Sidebar currentSrc均为hash资源，complete=true、naturalWidth=315、naturalHeight=140。登录背景仍为原 login-luthier-european-v4-BMkbYrBX.png。没有把19点位或其余固定业务图片打入Admin构建。

登录页证据：[login-logo.png](screenshots/login-logo.png)。Sidebar：[sidebar-logo-isolated.png](screenshots/sidebar-logo-isolated.png)。Sidebar及内容编辑使用仅本机GET的合成UI数据服务；**不代表真实认证或Staging部署验收**。空media时“暂无可用图片，请先上传”Disabled，未上传/保存内容。

## 真实 source dry-run / Staging只读检查

已运行 `node scripts/migrate-guide.mjs --category=guide --dry-run`，来源4条/19图，2,479,011 bytes全部hash匹配。

2026-10-09 10:00:08（上海）在已登录CloudBase SQL编辑器执行单条SELECT，同时检查 app.content 全部spot/目标ID/同名、app.media目标ID/key和storage.objects目标key，结果无冲突。原content=3、media=5，匹配行均空。见[只读快照](STAGING_CONFLICT_SNAPSHOT.json)。未读取认证或客户业务表、未输出密钥。

使用该快照再次运行真实源dry-run，结果 [DRY_RUN.json](DRY_RUN.json)：DRY_RUN_READY；uploaded=0，inserted.content=0，inserted.media=0；获批执行后的预计数量为content=7、media=24（非已执行结果）。目标未写，云对象未上传。完整4/19对应见[MAPPINGS.md](MAPPINGS.md)。

## 自动化验证

运行环境：Node 26.3.1、本机临时PostgreSQL 18.4，专用localhost:55440/hq_test_guide及随机schema；隔离构造SQLite和Storage替身。未连接本地共享PG/共享上传目录或真实云端进行写测试。

原174项 + 新11项 = **185 Passed / 0 Failed / 0 Skipped**。新覆盖：

1. 根路径Admin实际构建、原Logo字节一致、HTTP200、两处引用、无固定业务/assets候选。
2. 固定4条/19图、UUID、JSON保留、顺序和URL映射。
3. CLI默认dry-run、category/mode/target保护。
4. dry-run不上传不写库、来源SQLite文件hash不变。
5. 隔离PG实际登记、重跑0新增/0上传，排除表全量内容前后相同。
6. 人工修改、未知同名/ID/key、部分批次停止。
7. 缺失或hash变化图片在上传前停止。
8. 源内容变化、符号链接拒绝。
9. 第4次云上传失败不写任何DB业务行，记录孤儿候选，修复后复用前三对象。
10. content插入故障使19media全回滚，重试复用全部19对象。
11. 远端MIME/hash冲突拒绝覆盖、已登记对象消失不虚报成功。

Build PASS；Type Check PASS；25份原件大小/SHA-256 PASS；git diff --check PASS。构建、临时数据库及UI替身不进入Git。

## 限制与下一步

真实CloudBase HEAD/GET/POST导入及4点位公开展示未执行；既有Storage Provider沿用，经隔离替身验证不冒充真实云上传。Staging PG17.11实际写事务/权限和云端源文件传入流程，需在下一轮显式授权execute后验证。本轮无账号/Schema/Migration/权限/Cloud配置变化；没有清理孤儿或迁移其他类别。Admin需重新构建部署后才修复线上Logo，本轮未部署。

**READY FOR GUIDE MIGRATION**：指工具和本次来源/目标预检就绪，非真实迁移完成。执行前必须重新实时核查目标和Storage，保留审批与运行日志；人工修改或源文件变化即停止。
