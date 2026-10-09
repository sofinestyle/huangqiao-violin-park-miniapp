# 开始前审计与恢复边界

时间：2026年10月9日；操作者：Codex；基准7809b9466ab4d6b098f5e60969f3b1671b8f0b45，开始main与origin/main一致、工作区clean。用户原文批准Local Development Runtime Recovery；不批准云端Migration、存储上传、Staging写入或Production。

现状：环境切换已正确选择127.0.0.1:8787，API未监听，微信工具报ERR_CONNECTION_REFUSED。Server已采用server/pg/database.mjs及当前pg/migrations/001_initial_schema.sql；旧SQLite不能作为Runtime。根.env不存在；.env.example/compose.yaml模板为127.0.0.1:55432、hq_development、hq_dev、app。55432实际为此前pg-phase1测试实例，不能冒充已有开发库或修改/关闭它。

本次独立开发实例：已核实55433未占用后，使用已安装Homebrew PostgreSQL18.4建立.local/development-runtime/pgdata，Host127.0.0.1，Port55433，Databasehq_development，Runtime Userhq_dev，Schemaapp。本机管理角色hq_local_admin只用于本地初始化/既有Migration及测试准备；API使用无超级用户、建库、建角色、复制或绕过RLS权限的hq_dev。没有修改当前Migration文件或正式Schema设计。

旧来源审计：SQLite允许内容57条（site1、spot4、乐器8、文创20、套餐6、教学18）；已发布分别1、4、8、20、5、2。原media19项完整，选取允许内容及SKU关联的15项（11图片、4视频）；静态业务图片23项存在，现有兼容SKU10条关联现代模型L1。旧模型JSON原样保留，仅强制isTest=true，不转换旧规格为新SKU；原state/sort/version/ID/时间保持。

仅离线只读读取content/media/product_skus，不读取或导入accounts密码、sessions、audit、idempotency、migrations、visitors、bookings、consultations、旧认证数据；额外不导入场次或预约变更。目标当前Migration版本1由项目Migration新生成，不来自SQLite历史。API不引用SQLite读取器；启动不会自动导入/Seed内容或创建管理员。

原SQLiteSHA256：34935a1e6f2934f4b1cacff68c8000e4e855a6620480b66595ce342b1786b792，恢复前后相同；19份旧上传对象大小与Hash均保持。媒体副本写独立本地目录，原images/DOCX/HTML25业务原件校验通过；没有上传CloudBase或修改huangqiao-media。开发数据与凭据被Git忽略。

实现范围为本地PG启动器、离线允许列表导入器、Development远程DB/云配置保护、回环API监听、必要测试与操作文档。小程序页面、Admin、业务协议、云端Storage/HTTP Gateway、正式Migration文件及Production配置没有修改。
