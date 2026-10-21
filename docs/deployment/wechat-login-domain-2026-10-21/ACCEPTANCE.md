# Staging微信登录配置及域名托管验收

日期：2026-10-21（北京时间）；项目：/Users/aaron/Documents/huangqiao-app；源码基准516e1ff70e89ac893e95f8a9eec46d06c196b7c2。

结论：现有Staging API的目标AppID及AppSecret配置已部署，API007承接100%流量；合法域名由腾讯云微搭低代码托管，微信公众平台当前页面无法直接修改。原生登录、七页面的云端数据及媒体仍被域名校验阻断，当前NOT READY。AppSecret“已配置”不是“已验证匹配”；真实微信登录尚未通过。

## 1. 授权与范围

负责人明确要求继续解决登录及合法域名，以wx5dee6ef3087366c0配置现有API；AppSecret安全填写、不进入聊天或日志；Cookie/CSRF保持，不改业务数据或Production，不上传、提审、发布。此前已允许仅产生验收访客及会话，不包括预约、咨询或内容写入。负责人完成腾讯云CLI登录和本机密码页录入；最新截图明确显示服务器域名交由第三方托管，随后确认第三方为“腾讯云微搭低代码”。因此不能把口头“域名配置已完成”覆盖截图所证明的实际阻断。

未切换认证/托管方式，未取消微搭授权，未申请新付费资源，未修改数据库、Schema、业务数据或媒体。API部署由安全录入流程触发，未上传新镜像、Admin或小程序制品。Production及release保护保持；闲置自动化继续暂停。原件、历史图片优化、DEC081及用户视频封面资料保护，不夹带本轮提交。

## 2. 安全录入及真实部署

原API006未声明微信凭据，CloudBase CLI授权失效时操作停止。负责人恢复既有账号授权后，安全页在2026-10-21 22:15（北京时间）完成基线检查，22:20提交任务2421449；只读核对新版本API007及100%流量，最新部署记录状态normal。

| 项目 | 实际核对 |
|---|---|
| 环境 | huangqiao-staging-d2d1dj1bb4ad90，APP_ENV=staging |
| 服务 | huangqiao-api；006→007，100%流量 |
| AppID | wx5dee6ef3087366c0 |
| AppSecret | 已配置；不显示值、长度或摘要，不以存在性代替真实匹配验证 |
| 镜像 | 与API006相同，未构建新业务代码 |
| 唯一环境变量差异 | WX_APPID、WX_APPSECRET |
| 数据库及存储配置 | 与API006逐项语义相同，未改连接或对象空间 |
| 后台Origin | https://admin.yorray.com保持 |
| 测试身份/Seed | LOCAL_DEV_AUTH=false、HQ_SEED_MODE=none |
| 规格 | 0.25CPU/0.5GiB、min1/max5保持 |

详见[部署结果](APPLY_RESULT.json)、[当前版本](DEPLOYMENT_CURRENT.json)、[配置隔离](ISOLATION.json)。配置前后在进程内解析云端响应，仅输出白名单元数据、布尔值及键名；没有将EnvParams、数据库连接、AppSecret、微信code、OpenID或Token写入验收文件。

安全输入使用仅监听127.0.0.1的本机密码页、严格Host/Origin及随机CSRF校验，密码输入不保存、不缓存、不放在命令行参数；提交前重新检查Staging目标、原镜像和原规格，配置差异仅允许两个微信字段。Secret经stdin和进程内存传给已授权官方CloudBase CLI，原始返回不输出、不落日志。该CSRF机制只保护临时本机表单，没有替换或修改正式后台CSRF。录入服务完成后已关闭，不再接受密钥输入。

本轮未登录后台提取新Cookie；后台Cookie/CSRF按原镜像和ADMIN_ORIGIN不变核对，既有人工验收结论保持。另在专用本机测试库跑3项Cookie/来源校验/旧入口回归，全部通过，不冒充新线上Cookie浏览器验收。

## 3. 合法域名阻断及正确管理位置

负责人截图原文：“服务器域名已禁用”“服务器域名已托管给第三方，不能在此进行管理”。负责人确认托管方为腾讯云微搭低代码。该事实不表示API、DNS或数据库故障，也不能由运营者/开发者权限直接消除托管限制。

腾讯云官方文档于本轮读取，更新时间2026-09-10，说明扫码授权认证的小程序在云开发平台的小程序详情页配置服务域名及业务域名：[官方说明](https://cloud.tencent.com/document/product/1301/86886)。本轮优先保留既有托管关系，不执行文档中另一认证模式的切换、解绑、重置Secret、上传密钥或关闭IP白名单等操作。

工具可打开tcb.cloud.tencent.com的Staging概览，但微搭控制台console.cloud.tencent.com受到保存的浏览器站点拒绝规则阻断，未获访问授权。未改用其他浏览器、原始CDP、接口猜测、隐藏状态或其他绕过方式访问被拒绝页面。没有重复尝试微信公众平台受阻入口。微搭的实际详情表单与最新域名列表尚未由工具读取；不能报告已保存或配置已生效。

后续由负责人在微搭“小程序认证/我的小程序”的准确AppID详情中，将以下网关加入request及downloadFile服务域名，保留原有有效条目，再同步开发工具配置。入口名称以当前微搭界面为准；如没有入口或保存失败，应保留提示核查，不自动解除授权。

`https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com`

目前客户端使用wx.request访问公网网关，原生实际仍要求该地址通过域名校验；不能因页面写“云开发无需配置”就认定本项目的调用方式获豁免。未改成其他云调用协议，也未引入新API域名、反向代理或数据库方案。

## 4. API007后的原生重测

2026-10-21 22:28开始，微信开发者工具Stable 2.02.2608080；隔离候选build/mini-staging、AppID为wx5dee6ef3087366c0、envVersion=develop、运行目标staging、urlCheck=true。没有重建或修改源代码，避免与测试共享产物造成刷新；未执行preview/upload。逐页确认实际route后记录页面状态。

| 页面/功能 | 真实结果 |
|---|---|
| 首页 | FAIL：request:fail url not in domain list |
| 乐器 | FAIL：同上 |
| 文创 | FAIL：同上 |
| 研学 | FAIL：同上 |
| 教学 | FAIL：同上 |
| 点位导览 | FAIL：同上 |
| 我的 | 未登录界面可打开；登录FAIL |
| 品牌分包（补查） | 动态内容FAIL：同上 |
| 微信登录 | 实际点击登录，/api/auth/wechat调用在发出HTTP前被合法域名校验拒绝，未生成验收访客/会话 |
| 图片 | 原生wx.getImageInfo失败，下载目标不在合法域名列表 |
| 视频Range下载 | 原生wx.downloadFile失败，同一域名限制 |
| 视频播放/拖动 | 未执行：页面内容与原生媒体访问未具备条件 |

详见[脱敏原生证据](NATIVE_VERIFICATION.json)。每个页面逻辑读请求本轮只尝试一次，域名错误不自动重试；登录写入不自动重试。没有预约、咨询或其他写请求；未关闭域名或TLS校验。没有重置用户缓存或旧会话来模拟“新登录成功”。

## 5. 独立只读诊断、安全与原件

API007健康检查200、ok=true、database=true、environment=staging。公开内容51条，配置前后响应SHA-256相同；这是公开内容一致性证据，不是全库/私有表零变化审计。图片及视频样本均返回206，分别读取65536字节，Content-Range正确、最终Origin保持原网关，未上传任何媒体。[只读诊断](PUBLIC_AND_MEDIA_AFTER.json)不能替代微信原生访问或视频播放验收。

本轮针对变更运行本机Cookie/CSRF来源校验及旧入口3项测试，全部通过，专用127.0.0.1:55433/hq_test_business_migration随机Schema，不连接开发业务库、云库或真实Production。25份原件大小与SHA-256一致。前一轮230项、Build/Type Check和包体积证据仍按当时版本与含图片优化的工作区记录，本轮没有重跑或伪报为新的完整测试/体积结果。

当前未完成项：微搭服务域名保存及微信平台同步生效；校验开启时真实微信登录（含Secret配对验证）、七页面与媒体复验；视频播放/拖动及iOS/Android真机。小程序上传、提审、发布及Production转正未执行。

状态：**STAGING LOGIN CONFIG DEPLOYED / PENDING DELEGATED DOMAIN CONFIGURATION / NOT READY。** 本轮文档只记录实际部分完成与阻断，不将配置已部署写成登录或页面已通过。
