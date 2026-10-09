# Mini Program Environment Switch Phase 1 — 验收

日期：2026-10-09（Asia/Shanghai）；操作者：Codex。工程基准2028524；先前用户验收文件经另行确认单独提交bb58b87；环境代码独立提交。**最终：NOT READY**。环境切换工程已完成，不能宣称“真实本地旧资料与云端资料可完整对比”：本地8787服务没有运行，Staging首页资料缺失。

## 实施与安全

- 唯一API配置：`miniprogram/miniprogram/environment-settings.ts`，Development为既有127.0.0.1:8787，Staging为用户指定网关，Production=null/enabled=false。
- 开发工具顶部选择Development/Staging编译模式，query.miniEnvironment在启动时解析并固定；不修改源码URL、不从缓存推断环境。private编译条件由`npm run mini:prepare`一次性准备，保留用户原模式及安全设置。当前已实际安装两个模式。
- develop默认Development，允许两种明确选择；trial固定Staging并隐藏标识；release及未知版本禁止请求。Production构建无条件拒绝，任意MINI_API_BASE覆盖也拒绝。
- wx.request仅lib/api.ts；媒体/视频/SKU图片均取同一Origin。两个环境的token缓存键独立，旧共享键不复用；401仅移除当前环境token。协议、微信身份验证与业务流程保持。
- “我的”新增仅开发版可见的状态组件；其他页面仍可从工具顶部查看所选模式，Console显示实际Origin。未改首页、五导航、商品比例、服务端、Admin、Storage、网关、数据库配置、Schema或Migration。
- 原生调试发现微信不能直接require普通JSON模块，已改为原生TS配置并实际重新编译通过；没有以最初仅Type Check通过冒充原生成功。

## 实际验证矩阵

原生环境：微信开发者工具Stable 2.02.2608070、基础库3.17.3、HUAWEI Mate 60 Pro模拟器；源项目miniprogram/，envVersion实际返回develop。先选Staging再选Development，实际query与app API元数据吻合；最终留在安全的Development模式。此次沿用该源项目开始前urlCheck=false，不修改证书/合法域名设置；此条件不代表平台合法域名或真机发布通过。

|项目|Development|Staging|
|---|---|---|
|编译模式/环境标识|通过：DEV · 本地|通过：STAGING · 云端|
|API实际目标|通过：127.0.0.1:8787|通过：指定CloudBase网关|
|原生 /api/health|失败：连接拒绝，API未运行|通过：HTTP200，ok=true，database=true，environment=staging|
|首页|失败：服务连接失败|失败：没有已发布site，提示“首页内容暂未发布，请稍后再试”|
|乐器/提琴|失败：服务连接失败|通过：L2初学者实木小提琴，1条，云端UUID及媒体Origin匹配|
|文创|失败：服务连接失败|通过请求/既有空态：0条；不称资料齐全|
|研学|失败：服务连接失败|通过：琴韵初体验，1条|
|教学|失败：服务连接失败|通过：L12视频内容1条；本轮未重新验视频播放|
|点位导览|失败：服务连接失败|通过：城市客厅、音乐生态湖、产业园·中小企业集聚区、绿岛·智能环保表面处理中心，4条UUID与顺序符合迁移验收|
|我的|通过页面和DEV标识、未登录状态|通过页面和STAGING标识、未登录状态|
|两环境真实数据差异|未通过：本地数据读不到，无法完成实际资料差分|云端来源已验证，不能替代本地读取|

结构化记录：[Development](evidence/development-native.json)、[Staging](evidence/staging-native.json)。截图：[DEV标识](screenshots/development-mine.png)、[STAGING标识](screenshots/staging-mine.png)、[Staging导览](screenshots/staging-tour.png)、[Staging首页缺资料](screenshots/staging-index.png)。截图已实际查看，标识清晰，原有登录/记录/联系入口及五导航保持。

运行时例外：Staging七页检查没有JavaScript异常，首页为现有受控内容缺失错误；Development的六个公开内容页均为真实网络失败。控制台有基础库灰度、热重载及既有域名校验跳过提示，不当作正式环境通过。

|工程检查|结果|
|---|---|
|环境/身份缓存/请求Origin/正式版阻断/构建覆盖/模式准备测试|通过：tests/miniapp-environment.test.mjs，10项|
|既有页面路由检查|通过：2项；合计12项，0失败/0跳过|
|npm run build / Type Check|通过；Admin仅执行既有构建，无源码修改|
|Development与Staging隔离包|通过生成与Type Check；build输出不进Git；不是正式包发布|
|Production构建及localhost/任意Origin负例|通过：被拒绝，未生成Production包；为工程测试，不是实际Production运行|
|25份原始文件大小/SHA-256|通过；不重写原件基线|
|git diff --check与冻结文件范围|通过；首页、app.json、公共导航、server/admin/shared保持|
|全套数据库相关业务测试|未执行：未配置专用TEST_DATABASE_URL；本轮没有创建数据库/迁移来补造验证|
|真实登录、预约/咨询写入、真机/trial/release|未执行：本轮只读环境切换验证；版本防护以自动测试模拟envVersion验证|

未产生云资源/采购费用，没有上传/删除云对象，没有读写正式数据，没有继续迁移。当前旧开发资料仍在原SQLite，API切换不会转换它；既有本地运行配置需由负责人恢复或另行处理。首页资料、文创资料与微信合法域名为独立验收条件，不在本轮追加处理。
