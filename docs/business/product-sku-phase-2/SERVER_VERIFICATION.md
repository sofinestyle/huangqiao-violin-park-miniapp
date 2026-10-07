# Server阶段验证

基准e7696e6。DCR先于实现；服务端/public/咨询/媒体阶段126项Node（原111+新增15），126 Passed / 0 Failed / 0 Skipped。构建、Type Check、25原件、diff check通过。新增tests/sku2-server.test.mjs包含Public裁剪、simple/10/20/12、图价/0/inquiry、skuId校验、过期状态/结构、不可变快照、幂等/回滚、权限/本人隐私、媒体A—F、50SKU、Reset dry-run/符号链接、Backup/Restore。

50SKU产品100次公开详情读取总26ms（开发机本轮测量，无性能SLA）。自动化使用临时SQLite/媒体；共享库未运行迁移/seed/reset。

既有测试因Public字段裁剪，将后台写fixture读取改为Admin模型；旧读取迁移测试仍检验数据库内容不被覆盖。旧Public桥接宿主测试转为产品列表+新详情契约；详情事件的新版测试将在Mini提交补齐。未放宽权限/历史/事务断言。

该提交是开发期API切换边界，旧spec-only产品咨询不再可写；新版小程序在下一独立提交接入。本文件只声明Server工程结果，不声明原生或全阶段验收完成。
