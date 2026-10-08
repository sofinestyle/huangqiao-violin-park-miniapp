# CloudBase Phase 2 Checklist

状态：READY FOR CLOUDBASE STAGING（表示适配准备就绪，不代表已创建环境或已完成云端验收）。以下均须在另行授权的Phase 2执行。

1. 确认公司账号、区域、计费/额度、Staging与Production隔离及PG实例类型；不得把共享PG低频测试能力当作生产容量保证。
2. 创建Staging PG，配置网络/TLS/证书、最小应用角色与独立迁移角色，限制数据库连接数。
3. 对新的Staging Schema运行001初始Migration，核对13表、checksum、JSONB/NUMERIC/BOOLEAN、全部唯一/FK/检查约束。
4. 建私有CloudBase PG Storage Bucket，禁止匿名绕过Service访问；服务角色Key只注入Node。核对环境的真实HTTP API版本和返回字段。
5. 构建Docker镜像（本机无Docker，尚未执行镜像build），云托管注入PORT/数据库/Storage/微信/ADMIN_ORIGIN，不打包任何本地业务资料；验证非root及优雅退出。
6. 验证/api/health与数据库故障503、日志无凭据、容器副本连接预算、备份工具PG版本匹配。现有登录失败限制为单进程计数，多实例前须配置和验证网关共享限流，不把本机限制视为跨实例保护。
7. 同源HTTPS提供Admin静态与/api（或反向代理同源），确认Secure/HttpOnly/Strict Cookie、Origin防护及生产禁止devAuth/seed/autoadmin。
8. 显式初始化Staging账号及isTest资料，运行全量角色、预约容量、幂等、SKU/version、Content Delete/历史引用闭环。
9. 实测Cloud Storage图/视频上传，失败补偿、HEAD/Range/206/416、拖动、超时、中断、大小与成本。停用SKU/下架产品后公开访问拒绝，Admin历史仍可预览。
10. 配置HTTPS/API域名、微信AppID/AppSecret与request/upload/download合法域名；生成明确staging小程序包，进行开发者工具及真机实际视频/身份测试，禁止模拟成功代替。
11. PG+私有对象备份并恢复到新Staging目标，核验manifest、hash、13表数量、Migration、SKU、历史咨询/预约、Session撤销；结合平台自动备份确定3天DB/每周对象增量/30天备份保留、异地加密与告警。
12. 完成Staging验收后，另行批准Production资源、新空Schema、正式admin、正式资料及媒体录入；不能导入开发Seed当正式资料。
13. Production HTTPS、微信真机、备份恢复与权限人工验收后，才另行执行微信审核/发布。

未创建CloudBase Staging/Production，未购买资源，未执行生产部署，未上传/发布微信代码，未清理共享开发业务库。
