# Test Plan

A必须真实PG通过：空库Schema/重复Migration/失败回滚、JSONB、FK/Unique/Check、Content+SKU/version、最后1名并发、咨询SKU快照、幂等并发、Audit。失败不进入B。

B保留所有旧业务断言，迁移135项Node基准到独立PG测试目标；新增10请求竞争末位、重复咨询/key、删除与引用竞争、权限变化、Storage替身和备份恢复。禁止测试连接共享开发库/云数据库，所有测试数据合成。

执行Build、Type Check、小程序编译、后台八页及SKU/CD/ABI/Media/CSV/50SKU/权限回归、25原件、diff check。区分真实PG、浏览器/开发者工具、Provider替身和未执行CloudBase/真机；不以截图代替业务测试。原测试不删除重要断言。
