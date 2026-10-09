# Mini Program Environment Switch Phase 1 — 实施前审计

日期：2026-10-09（Asia/Shanghai）；操作者：Codex；基准：2028524da18ab6c2b174d26d94d40187f8eb7d2e，main。开始时已有 Phase 2C 验收文档及四张截图未提交，原位保留，单独处理，不混入环境代码提交。

|审计项|事实与证据|
|---|---|
|API Base 定义|`miniprogram/miniprogram/config.ts` 固定 API_BASE；`scripts/build-mini.mjs` 又有开发地址及 MINI_API_BASE 注入，存在双配置来源。|
|当前本地地址|`http://127.0.0.1:8787`，交叉确认 config.ts、server/config.mjs、.env.example、README；不是猜测端口。开始时该端口没有监听，项目没有 .env。|
|环境逻辑|源项目无 envVersion 判断，app.globalData 固定 local-development；构建脚本按 APP_ENV 生成独立配置。原 production 构建仅校验域名格式，未实现业务审批阻断。|
|统一请求|`miniprogram/miniprogram/lib/api.ts` 唯一 wx.request；媒体及视频也在此拼接 API_BASE。|
|微信版本判断|仓库微信类型声明：wx.getAccountInfoSync().miniProgram.envVersion 为 develop / trial / release；本地/Staging均可为develop，不能仅凭envVersion区分。官方文档：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/account-info/wx.getAccountInfoSync.html 。本轮网页工具未成功读取该文档，类型声明与实际原生返回值作为验证依据。|
|硬编码|本地地址仅在 config.ts、构建脚本；源小程序未使用 CloudBase域名；无页面直接 wx.request。|
|页面拼接|页面仅传 `/api/...` 路径，未直接拼接 Origin；媒体组装集中于 lib/api.ts。|
|身份与缓存|hq-visitor-token 为跨目标共享键，环境切换应隔离身份缓存，防止本地身份发送至Staging。|
|真实Staging|公开 /api/health HTTP200，ok/database=true、environment=staging；公开内容7条，4点位与迁移UUID吻合。没有site条目，文创为空。|
|本地旧资料|SQLite原文件保留；当前服务已要求PostgreSQL。未发现可直接运行的本地服务配置；不通过本次切换迁移或造数据。|
|微信域名校验|上轮验收记录表明Staging域名未配置合法域名；开发工具隔离验证可临时跳过，不能等同真机/上线验证。|

## 已授权实施方案

用户本轮明确授权小程序API环境单点配置、开发调试标识、验证、独立Commit及推main。采用微信开发工具自定义编译条件的 miniEnvironment 参数，Development默认本地，Staging固定指定网关；无需改源码URL。develop允许指定这两个目标；trial固定Staging，release与未知运行环境阻断。Production保留空配置并禁止构建。环境在一次启动期间固定；重新编译才切换，避免请求过程混合目标。登录协议保持 development / wechat 原逻辑，token按目标隔离。

白名单：小程序环境配置、app启动元数据、统一请求与媒体Origin、身份缓存引用、仅开发版状态组件、我的页组件注册/插入、开发工具编译条件、原生TS配置支持、小程序构建脚本、相关测试与文档。首页业务及布局、五导航、服务端、Admin、Storage、网关、PostgreSQL、Schema/Migration均保持。
