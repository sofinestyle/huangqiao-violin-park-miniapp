# 目标AppID统一及验收

日期：2026-10-21（北京时间）；操作者：Codex；开始提交6757601036458e6a6b7953af01fd8c19d5328bc2。

结论：项目、Development和Staging构建均已统一为wx5dee6ef3087366c0，并增加错误AppID覆盖阻断。代码检查通过，目标AppID原生运行已确认；真实登录与七页面云端读取没有通过，当前NOT READY。没有上传、preview、提审或发布，不将本地分析冒充微信服务器最终代码包检查。

## 授权、基线与实际改动

负责人明确以wx5dee6ef3087366c0为目标，要求统一配置、核对服务端微信登录及合法域名、重新验证登录/七页面/体积，保留原件、不改业务数据、不输出密钥、本轮不上传/提审/发布。负责人随后允许仅产生验收身份及登录会话；不授权预约、咨询、内容或其他业务写入。本轮没有执行云配置、密钥设置/重置、数据库或媒体变更，Production继续关闭。

开始时项目及旧build/mini-staging均为wx5bf0160bd4262e24，存在此前图片优化及治理文档未提交工作。基线保存于Git忽略的.qa/appid-alignment-2026-10-21；保护用户视频封面目录及全部原件。既有图片优化不是本轮新增改图。

| 文件 | 本轮修改 |
|---|---|
| miniprogram/project.config.json | 仅AppID改为目标，保留原有设置和未提交图片优化配置 |
| scripts/build-mini.mjs | 项目配置为唯一AppID来源，两种环境均继承；兼容MINI_APPID但不允许其与项目不一致，在覆盖输出前拒绝错误目标 |
| tests/mini-package.test.mjs、tests/miniapp-environment.test.mjs | 验证两个构建AppID一致、错误旧AppID被拒绝且旧产物不被覆盖，保留Production阻止回归 |
| MINIAPP_ENVIRONMENT_SWITCH.md | 更新当前构建方式，不再要求手工填写独立AppID |
| Production方案及治理记录 | 更正当前AppID，保留历史旧AppID验收事实，记录未完成项 |

源项目private配置无AppID覆盖；个人urlCheck=false为既有设置，本轮未修改。隔离候选build/mini-staging使用urlCheck=true，本轮所有原生云端验证均在校验开启下执行。当前临时构建目录不提交。

## 服务端登录配置：未满足

只读查询CloudBase现有huangqiao-api服务版本列表及100%流量的huangqiao-api-006，版本EnvParams中APP_ENV=staging、LOCAL_DEV_AUTH=false，未配置WX_APPID或WX_APPSECRET。详见[脱敏核对](SERVER_LOGIN_CHECK.json)。没有输出数据库连接、密钥、微信code、OpenID或登录Token；原始云返回经权限600的Git忽略临时文件解析，脱敏完成后本轮临时原始文件已删除，未提交。

server/http.mjs的/api/auth/wechat需要WX_APPID及WX_APPSECRET，再调用微信jscode2session；缺少时返回WECHAT_NOT_CONFIGURED，验证通过后才写访客及会话。当前Dockerfile未声明微信凭据、启动命令不加载.env，但本轮没有进入容器查看process.env，故不把“版本声明未配置”冒充容器全量凭据审计。未获得可验证的匹配凭据，不能报告服务端登录配置通过。

下一步需要在准确服务版本的安全环境变量中配置目标AppID及其配套AppSecret，核对真实wx.login后端换取身份；不重置旧小程序密钥，不在聊天/源码/前端/日志中传递Secret。本轮只核对，不代填或部署服务端。

## 合法域名及原生页面：失败证据

原生账号信息实际返回AppID=wx5dee6ef3087366c0、envVersion=develop，API目标为现有Staging统一网关。原生Console显示业务网关不在request合法域名列表，显示的列表仅https://tcb-api.tencentcloudapi.com；各业务GET实际返回request:fail url not in domain list，未取得HTTP响应。该失败不重试，实际每个页面逻辑读请求均仅一次。

| 页面 | 本轮原生实际结果 |
|---|---|
| 首页 | FAIL：云端内容被合法域名校验阻断，0统计是错误空状态，不是数据库清空 |
| 乐器 | FAIL：同上 |
| 文创 | FAIL：同上 |
| 研学 | FAIL：同上；页面整体验收不能用固定背景存在替代 |
| 教学 | FAIL：同上 |
| 点位导览 | FAIL：同上 |
| 我的 | 未登录界面可打开；真实登录FAIL |
| 品牌分包（补查） | 动态企业内容同样被阻断，未计为通过 |

详见[NATIVE_PAGES.json](NATIVE_PAGES.json)。原生截图留在忽略目录，不包含真实预约或个人资料。本机自动化第一次受测试重建刷新影响，另一次登录回调等待不充分；这些辅助运行不作为通过依据。完成重建后重测各路由，并单独在已稳定的真实“我的”页点击登录完成[LOGIN.json](LOGIN.json)记录：登录尝试实际调用/api/auth/wechat，仍被域名校验拒绝；未登录成功，没有其他写请求。HTTP未发出，因此未产生本轮验收身份或会话，不能因负责人允许写会话就声称已完成登录。

尝试只读打开mp.weixin.qq.com核对平台最新配置时，被浏览器站点安全策略拒绝，未发起用户审批或自动审批。停止该入口，没有采用其他浏览器、CDP或权限绕过。因此域名列表证据来自目标AppID下开发者工具当前同步值，平台最新配置及刷新后状态尚未独立确认；不把缓存值冒充平台即时全量审计。

需管理员在正确AppID的开发设置中核对request合法域名：

`https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com`

本轮不修改平台列表。确认后刷新开发工具域名信息、保持校验开启重新编译；若平台不接受默认网关域名，另行落实备案/HTTPS齐备的自定义API域名，不猜测api.yorray.com已经开通。admin.yorray.com是后台入口，不能仅配置它就认为小程序业务网关已获放行。

公开图片/视频样本均通过/api/media返回200，最终Origin与上述API相同，无外部媒体重定向，支持Range。当前源码也由Node读取私有存储并返回媒体流。downloadFile、视频及将来CDN的实际客户端访问仍须复验，不能把服务端内部Storage域名直接当作客户端必需域名。

## API及媒体的只读诊断

普通HTTPS健康检查200、ok=true、database=true、environment=staging；公开内容200，51条（套餐5、教学13、产品28、site1、点位4）。图片/视频样本HEAD均200，见[公开诊断](PUBLIC_READ_ONLY.json)和[媒体域名](MEDIA_DOMAIN_CHECK.json)。这些仅证明服务与样本可直接访问，不替代微信合法域名、登录或七页面验收，不涉及数据库写入。没有用普通GET冒充原生成功。

## 包体积：本地官方分析完成，服务器终检未执行

微信开发者工具Stable 2.02.2608080识别项目名称“黄桥琴旅”、目标AppID正确、当前发布状态未发布；实际使用“代码依赖分析”导出，121个纳入文件，无依赖代码文件0。数据见[官方导出](COMPILED_ANALYSIS.json)和[分类汇总](PACKAGE_SIZE.json)，不是源目录总大小。

| 项目 | 实际本地分析字节 | 约KiB |
|---|---:|---:|
| 主包 | 728054 | 711.0 |
| 品牌分包 | 382041 | 373.1 |
| 总体 | 1110095 | 1084.1 |
| 代码合计 | 172321 | 168.3 |
| 图片等资源合计 | 937774 | 915.8 |

本地分析主包低于工具此前1.5M质量提示阈值；图片资源累计仍高于此前200K优化提示，不能报告所有代码质量提示已通过。本轮不继续降低图片分辨率或推进CDN。工具界面四舍五入显示主包711KB、分包374KB、总体1.06MB。上次预览3045KB为2026-10-12历史值，未作为本轮结果。正式preview会将候选发送微信服务器；按本轮不上传约束未执行，其封装后的最终体积和服务器限制检查仍未完成。

体积及230项测试基于当前工作区，包含此前尚未提交的图片优化。此次独立提交只包含AppID及必要构建/文档修改，不夹带此前优化源文件、原件或用户资料；不能把当前工作区体积直接写成GitHub该独立提交的制品大小。后续冻结上传候选必须先明确收口这些既有改动，再重新测量同一候选。

## 测试、隔离与未完成项

27项专项PASS；完整230项PASS、0失败/0跳过，使用既有本机127.0.0.1:55433的专用hq_test_business_migration及随机测试Schema，不连接开发业务库或Staging库；仅在隔离测试中进行测试数据写入/清理。初次未指定TEST_DATABASE_URL时相关用例按保护拒绝运行，随后指定既有隔离库完整重跑通过，不能以初次结果宣称完整通过。Build/Type Check PASS，25份原件大小及SHA-256一致。

未完成项：安全配置并核实目标AppID配套服务端凭据；平台最新合法域名确认与同步后原生重测；真实微信登录与七页面/媒体验收；iOS/Android真机；冻结候选的微信服务器最终包体积。Production转正尚未实施，release保护保持；不在本轮启用Production、迁移数据、修改业务或后台安全配置。

最终：**NOT READY FOR UPLOAD / WECHAT AUDIT。** 项目AppID统一完成；云端登录配置和合法域名仍阻断，不能据230项本机测试通过宣布上线可用。闲置自动化保持暂停。
