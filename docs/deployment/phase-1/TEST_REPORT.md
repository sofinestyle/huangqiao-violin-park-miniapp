# Deployment Phase 1 Test Report

## Checkpoint A — PASS

2026-10-08，Mac本地PostgreSQL18.4独立回环55432，hq_test_phase1库，每组随机test_ Schema并清理；从未连接共享SQLite/云库。5组Node集成测试全部通过，Failed0/Skipped0。

覆盖：13表空库、重复Migration/checksum、DDL失败回滚、JSONB、FK/Unique/Check、10SKU/0价格/稳定ID、并发Version Conflict、晚期audit失败整体回滚、10独立请求最后1名（1成功9CAPACITY_FULL）、10同key咨询（1记录）、不同body冲突、SKU不可变快照。测试文件tests/pg-foundation.test.mjs。

Build含Admin Vite及小程序Type Check通过；25份原件大小/SHA一致；git diff --check通过。生产依赖npm audit --omit=dev为0漏洞；安装时全依赖提示11项（开发工具链待分类处理，不执行force升级）。

A为受控中间版本：PG Foundation三链路单独验证，旧入口尚未全量切换；不得据A宣布生产运行已迁移。A通过后才进入B，B需移除正式SQLite路径和迁移全部原测试。

## Checkpoint B

未完成，尚未放行。真实CloudBase上传/PG/微信播放/HTTPS均未执行；本轮不创建云资源。
