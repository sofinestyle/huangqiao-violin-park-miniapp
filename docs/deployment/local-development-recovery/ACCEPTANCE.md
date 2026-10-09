# Local Development Recovery 验收

结论：**READY FOR LOCAL/STAGING DATA COMPARISON**。2026年10月9日，Codex在本机实际恢复并验证；该结论只覆盖负责人使用微信开发者工具对比公开开发资料，不代表正式资料、业务写入、真机或Production验收。

## 实际运行与数据

PG：127.0.0.1:55433 / hq_development / app，运行用户hq_dev。原55432测试实例保留。API：http://127.0.0.1:8787；`npm run dev`自动准备本机PG与API，无需手填DATABASE_URL，重启已通过；服务仍运行，微信工具已恢复Development并停在可读首页。原始审计见[AUDIT](AUDIT.md)，负责人操作见[启动说明](../../../LOCAL_DEVELOPMENT_RECOVERY.md)。

当前项目Migration成功建立本地Schema，重复核对通过；未改Schema/Migration文件。57内容、15关联媒体、10兼容SKU已恢复。所有content.isTest=true；媒体/SKU依关联的Test内容和manifest追溯。目标accounts、sessions、audit、idempotency、visitors、bookings、consultations、changes、slots全为0；migrations仅项目自身生成v1，不导入源历史。没有继承旧账号/密码。

|真实微信页面|Development|Staging|结果|
|---|---|---|---|
|首页|site及企业介绍、背景、入口正常；旧4点位加载|缺site，显示“首页内容暂未发布”|本地通过；云端资料缺失按实记录|
|点位导览|spot-1～4，4条|迁移UUID，4条，顺序与名称匹配|通过|
|乐器|8条，包含L1/L201|1条L2|通过，来源明显不同|
|文创|20条|0条空态|通过，来源明显不同|
|研学|5条已发布套餐|1条套餐|通过|
|教学|2条已发布视频|1条L12视频|本地列表及两视频实际播放通过；云端列表通过|
|我的|DEV · 本地，未登录|STAGING · 云端，未登录|通过，不验证旧记录或认证|

Native环境为develop；工具Stable2.02.2608070、基础库3.17.3。两个环境均由顶部真实编译菜单切换；小程序实际API Base、wx.request健康响应、Page真实数据和截图一致，无Mock替代。健康：Development200/ok=true/database=true/environment=development；Staging200/ok=true/database=true/environment=staging。

截图分别见evidence/development-*.png及staging-*.png；实际数据见[本地Native](evidence/development-native.json)、[云端Native](evidence/staging-native.json)。首页count=2表示首页展示的推荐套餐，不代表全部5条；“我的”环境标签由原生截图核对，组件查询未读出标签时记录native-screenshot，不伪造组件值。企业介绍已实际出现在site对应首页截图中。

## 媒体与安全隔离

15关联媒体中11图片/4视频：9图片及2已发布视频HTTP200、大小/SHA256与原件一致，两视频Range206；4归档专用对象返回410，符合既有公开规则。23静态业务图片HTTP200/Hash一致。两条旧视频在微信模拟器实际播放，playTime分别0.211842和0.194667、playing=true、playbackError=false；见[播放证据](evidence/video-native.json)。14条缺视频旧草稿保持草稿，未伪造或自动发布。

隔离 **PASS**：真实PG连接查询为127.0.0.1:55433/hq_development、hq_dev、app；Runtime角色五项高权限全false。实际API网络连接仅回环PG55433和本地HTTP，见[隔离证据](evidence/isolation.json)。本地DATABASE_URL与CloudBase Staging连接目标不同；未读取或输出Staging数据库凭据。启动负例证明172.17.0.13、Staging、Production、huangqiao-media桶和CloudBase Provider均在准备服务前被拒绝，见[启动保护](evidence/startup-guards.json)。连接URL覆盖参数也被拒绝。

本次云操作仅GET既有公开API；未连接云端PG、未上传或管理云存储、未进行云端Migration、部署或生产操作。Staging公开内容7条、四点位保持，浏览前后公开内容Hash相同：0b48acfb56c57003b107886047820cf3c3eaffb63343ff426ba6cf5c6dc3bfd4。该指纹只证明公开读取内容未变，不冒充云端整库审计。19原上传对象Hash均保持、SQLiteHash保持、25业务原件通过。

## 工程验证和限制

200项自动测试通过，0失败/0跳过，使用独立本机hq_test_recovery随机Schema；不写开发业务库或Staging。新增5项覆盖远程/云/Production拒绝、mediaId视频关联、允许列表与Test标记、文件Hash/符号链接、幂等/精确子集续跑/拒绝覆盖、晚期SKU失败回滚和排除表保护。现有权限测试由无密码trust假设调整为随机测试密码，适配本机SCRAM认证，不修改真实业务权限。初次并发测试遇到cleanup锁超时及原无密码假设；修正测试密码后按test-concurrency=1运行全套通过，未放松本机认证。

Build（含TypeScript）、25原件、diff检查通过；npm run dev实际停止/重新启动后健康和首页再次通过。重复恢复复用数据；导入过程只补缺失且完全匹配允许计划的行，发现人工修改/额外记录立即停止，不更新、删除或覆盖。

未执行：真实微信登录、预约/咨询提交、旧认证恢复、真机/trial/release、云端教学视频播放及正式发布；不属于本次浏览恢复授权。旧模型仅供浏览，不承诺其旧规格已转换成现代SKU或可以提交咨询。Staging首页/文创资料缺失保留，负责人可在两个环境观察此差异，本次不补云端数据。HTTP图片及原开发工具“不校验”警告仍属于本机调试条件，未更改设置，不计为合法域名上线验收。Production继续禁用。

证据中不含DATABASE_URL密码、AppSecret、真实访客/预约信息；本地数据、凭据及视频文件不进入Git。任务完成后停止，不继续业务迁移。
