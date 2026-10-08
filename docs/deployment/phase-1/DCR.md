# Deployment Phase 1 DCR

状态：Approved for Implementation。批准人：用户；日期：2026-10-08。依据本轮两份Deployment Phase 1完整指令。Baseline：55542ba036f38eca0fc37636f1d1c05df2418f92，main、本地/远端一致且开始clean。本DCR先于业务代码。

批准标准pg/Pool、独立PG初始Schema、全Service异步、事务锁、Storage Provider、生产配置、备份恢复与本地PG验证。不是新业务；SKU稳定身份、3/20/50上限、参考价/图片继承、状态机、角色、容量、咨询历史与删除引用保护不变。不建设ORM，不保留正式SQLite/PG双轨。

先A：连接/Schema/Migration/访问层和Content+SKU、预约容量、咨询快照+幂等三链路。A通过方可B：剩余Service/HTTP/Media/账号/备份/运行配置/全部测试。A允许过渡模块，B完成后移除SQLite正式运行路径。A失败不进入B；不得用替身代替真实PG。

价格NUMERIC不增加小数位业务限制；JSON按审计用途选择JSONB/JSON；media存储名改object_key；正式PG不导入测试SQLite。content.isTest由环境控制：development/staging只允许测试资料；production拒绝isTest=true并保存false。禁止生产测试Seed/开发身份/自动管理员，第一管理员经受控命令创建。

媒体默认保留Node逐请求授权与Range代理。CloudBase私有签名URL可作为显式配置候选，但没有真实微信播放和撤销窗口证据前不作为默认；现有下架保护不放松。云端Provider仅接口替身验证，真实上传/视频/HTTPS留Phase 2。

白名单：server/、pg/、scripts/、tests/、package及锁文件、README、.env.example、Docker/Compose/部署模板、Admin API配置、小程序环境配置，以及本目录和必要治理记录。不得改Admin视觉、小程序SKU交互/首页/导航、原件或共享SQLite数据。测试限回环临时PG及隔离Storage；原SQLite最终归档进入忽略目录，原库不删除。

内部一致性检查：与批准业务规则一致。无新增业务决策，不需要中途再次批准；云资源和正式数据初始化仍未授权执行。
