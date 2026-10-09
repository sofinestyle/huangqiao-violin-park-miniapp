# Mini Program Static Asset Fix

日期：2026年10月10日。操作者：Codex；环境：本机微信开发者工具Stable 2.02.2608070、基础库3.17.3；Development与CloudBase Staging。范围：固定图片兼容、全量源码审计、只读业务图片核查及测试；不迁业务、不上传云存储、不改数据库、Admin、Gateway、环境切换或Production。

## Root Cause与修复

研学页原先通过 `mediaUrl('/assets/workshop.jpg')` 将固定设计图片拼接到当前API地址。本地服务存在该文件，Staging网关对应地址返回404 NoSuchKey；此事实不代表数据库或API业务异常。

现在使用 `/assets/images/workshop.jpg` 小程序包内路径，实际文件为 `miniprogram/miniprogram/assets/images/workshop.jpg`；外层project.config的miniprogramRoot指向内层目录。副本来自受保护的images/workshop.jpg，未改尺寸、压缩、裁剪、名称或原件。两种环境引用完全相同，不执行mediaUrl或wx.request。页面WXML/WXSS与覆盖渐变、文字、图片显示方式均保持原设计。

原件与包内副本SHA-256均为 `f8ea3ec0a74436e222b158247997d89de152495e330f69ed02b11e269080624f`；Development/Staging隔离构建中的图片Hash也相同。图片1152×1536，657,075 bytes（641.7KiB），新增仅此1份固定图。未创建media记录，未上传huangqiao-media、未增加云端/assets路由或静态托管。

## 全量审计

详见 [A/B/C/D逐项清单](AUDIT.md)、[逐行机器清单](SOURCE_AUDIT.json)、[公开业务旧地址清单](BUSINESS_ASSET_REFERENCES.json)。94份实际运行源码全部扫描并人工复核。固定资源62处引用、26个文件；业务图片/视频绑定14处；历史未使用图片2份；3处环境配置/安全判断已解释，无无法判断的外部资源。修复后固定资源缺失、通过API拼接的固定图片、未解释外部地址均为0。包内/assets路径本身合法，不应一律当作服务器资源删除。

Development公开40条内容中仍有51处旧/assets业务引用；Staging公开39条中只剩site.images.0的既有哈希Logo静态引用。教学视频、SKU、点位等业务素材不复制进代码包，现有/api/media处理不变。检查只覆盖公开快照，不冒充后台未发布业务素材全量审核。两个无源码引用的旧品牌图保留，不擅自删除。

## 包体积与待批准方案

静态图片源文件总和从3,030,810增至3,687,885 bytes，增长657,075 bytes。去掉未引用的两份历史图后，实际被源码引用的固定图片仍从2,249,295增至2,906,370 bytes（约2.77MiB）。其中既有品牌图hero-user-v3.jpg为1,516,765 bytes，company-reference.jpg为353,371 bytes；包体积风险在本次新增前已存在。

运行目录源文件测量（排除TS/map/.DS_Store）为3,799,213 bytes；这些数值是文件统计，不是微信官方压缩/上传包体积。项目目前没有分包，ignoreUploadUnusedFiles=true不足以消除被引用图片的体积风险。参考[微信官方分包规则](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html)，需按主包2MiB预算继续处理；本轮官方页面抓取不可用，未执行预览上传或正式发布来取得平台实际包大小，不能宣称已通过上传包体积校验。

已向项目负责人提出“静态资源分包保留原图，并做必要包配置和加载调整”的选择问题，尚未收到答复。本轮不自行大量复制其他图片、不压缩已确认视觉、不改变路由或采用云Storage/CDN。建议下一步在明确批准后评估品牌页/非Tab页面分包及资源布局；不可直接假定主包页面能够任意引用普通分包资源，须验证加载与引用规则。研学与底部导航行为保持。

## 微信开发者工具真实验证

使用真实顶部Development·本地/Staging·云端编译模式切换，由实际App读取环境SSOT；原生界面点击导航，官方自动化SDK仅只读获取当前页面、图片src、wx.getImageInfo和截图，未替换API、未注入假数据。

| 页面 | Development | Staging |
|---|---|---|
| 首页 | 正常、API媒体抽样解码成功 | 正常、API媒体抽样解码成功 |
| 乐器（含提琴） | 8条、无加载错误、API媒体成功 | 8条、无加载错误、API媒体成功 |
| 文创 | 20条、无加载错误 | 20条、无加载错误、API媒体成功 |
| 研学 | 5条、包内背景正常 | 5条、包内背景正常、API媒体成功 |
| 教学 | 2条、无加载错误、API媒体成功 | 1条、无加载错误、API媒体成功 |
| 点位导览 | 4条、无加载错误 | 4条、无加载错误、API媒体成功 |
| 我的 | 未登录页与DEV标识正常 | 未登录页与STAGING标识正常 |

两个研学背景实际wx.getImageInfo均成功，1152×1536/JPEG。视觉截图：[Development](development-study.png)、[Staging](staging-study.png)；背景主体、裁切、圆角、渐变、标题与布局一致。业务列表不同属真实环境资料差异。[逐页运行证据](NATIVE_PAGE_CHECKS.json)保留真实路径与图片读取结果，无认证凭据。

Staging研学Network清空后打开，旧 `/assets/workshop.jpg` 筛选为0/1条；唯一可见业务请求为content?kind=package，200。两环境固定背景均使用包内路径，源码及真实图片src证明该固定背景不发HTTP /assets请求。Development重新编译后同地址筛选为3/51条缓存记录，200，来自保留的旧业务封面；**整个Development页面“Network无旧地址”的字面验收项未通过**，不能以固定背景修复冒充业务旧地址全部消除。

两环境重新编译后的研学Console错误数均为0，未见固定/assets的404；存在工具基础库/域名校验等已有开发警告。验证中本地API一度停止，首次乐器读取失败；按现有npm run dev:server恢复后重新验证8条乐器通过，失败历史已区分。命令行Node到Staging曾ECONNRESET，真实wx.request成功；不将命令行传输失败解释为云端API故障。

原生Staging/api/health为200，ok/database=true，environment=staging。公开39条内容只读前后SHA-256均 `e486b71b3bd545d1972ead1be238ba1c545cd5622039f61a2bcc9994c301bf8d`，见[只读核查](STAGING_READ_ONLY_CHECK.json)。这是公开内容指纹，不是全库或云对象Hash；本轮没有数据库或存储写操作。未执行微信真机、认证/预约写入、云教学视频播放或生产发布。

## 自动验证与交付状态

完整测试215项通过、0失败/跳过；两个固定资源回归检查通过。Build、Type Check、Development/Staging隔离小程序构建及25份受保护原件大小/SHA-256校验通过。原生开发工具实际编译与两环境浏览通过，不代表平台上传大小或真机已验证。

固定研学背景兼容修复完成。最终 **NOT READY**：包体积方案尚待批准并验证；保留本地业务封面与“整个页面Network没有旧workshop地址”的字面要求冲突，该项没有通过。授权范围内的修复独立提交并按用户要求推送main；此前教学分类调整保留独立提交，既有迁移验收提交作为祖先随main推送，不并入本次静态修复提交。最终SHA与远程一致性以交付回复为准。
