# Mini Program Package Size & Static Asset Closeout

核查日期：2026年10月10日；操作者：Codex；基准95b76558fe65e282207d6631075e6f4a14e87743。范围仅小程序包结构、静态资源、编译兼容及只读验证；不修改Staging、CloudBase、业务数据或Production。

## 官方当前规则

当日直接读取微信官方文档。主包和单个分包上限均2M，总包上限30M；服务商代开发的小程序总包上限20M。两种身份下本项目均满足总量限制，不据此推定账号身份。[微信官方分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)。

分包按root目录划分，目录之外的文件进入主包，tabBar页面必须在主包。包内图片等资源参与代码包体积；本次官方工具导出的resourceSize和真实预览结果也证明图片计入体积。普通分包可以引用主包及自身JS、模板、资源，不能直接引用其他分包；主包直接依赖分包资源不可作为本方案前提。[微信官方使用分包](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html)。

独立分包可单独启动，但不能直接依赖主包/其他分包，app.wxss对它无效，App对象也不保证已初始化；异步化有官方例外。本项目使用共享App、API环境配置、模板、导航和样式，因此选普通分包，不引入独立分包或分包异步化。[微信官方独立分包](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/independent.html)。

## 真实体积与最小方案

微信开发者工具Stable 2.02.2608070，实际CLI preview编译并由微信服务端检查。基准失败：错误80051，source size 3745KB exceed max limit 2MB。该结果来自实际预览而非源码目录求和。

实施前已向用户说明：品牌介绍及两张固定设计图进入普通分包，保留/pages/brand/index原路径；五个tabBar与其他页面保持主包。root为pages/brand，pages为index，主包17页、品牌分包1页。原导航和API业务逻辑未改。两张未引用历史大图hero.jpg（330,589字节）和hero-detail-v2.jpg（450,926字节）只排除上传，原文件保留。

workshop.jpg为657,075字节（641.7KiB），当前直接用于主包研学tabBar页面，保留/assets/images/workshop.jpg。同一包内路径适用于两个环境。微信没有单独规定该图片必须在主包；若将它移入分包，需要新增加载/跨包资源处理。本次主包已留足余量，不新增该复杂度，不压缩或修改原件。

真实预览暴露原ES2020可选链未被服务端接受：调整TypeScript目标至ES2015并开启官方语法转换；隔离build:mini明确生成JS、避免重复TS插件。清除可重新生成的compile缓存后，原生源码项目和隔离Staging构建均preview成功。未清理storage/auth/session缓存，未改合法域名校验或登录凭据。preview不是提交审核或正式发布；无真机验收声明。

|实际包|原生项目字节|原生项目MiB|隔离Staging构建字节|
|---|---:|---:|---:|
|主包|1,223,098|1.166|1,231,099|
|品牌普通分包|1,880,942|1.794|1,881,677|
|总包|3,104,040|2.960|3,112,776|

SOURCE_PREVIEW_SIZE.json和PREVIEW_SIZE.json为官方工具原始输出。以下分类来自已成功预览的隔离Staging构建之“代码依赖分析”导出（COMPILED_ANALYSIS.json，120个纳入文件），不是整个源码目录。TS已编译为JS。文件分类合计与最终预览包之间存在编译/封装差异，单列呈现，不冒充逐文件最终封装后的字节数。原生TS插件与隔离tsc构建的输出大小略不同，真实包限制以各自preview输出为准。

|构建分类（字节）|主包|品牌分包|合计|
|---|---:|---:|---:|
|JS|53,864|2,436|56,300|
|TS（不上传）|0|0|0|
|WXML|53,175|3,798|56,973|
|WXSS|46,567|4,660|51,227|
|固定图片|1,036,234|1,870,136|2,906,370|
|其他（JSON）|3,018|226|3,244|
|纳入文件合计|1,192,858|1,881,256|3,074,114|
|编译/封装差异|38,241|421|38,662|
|实际预览包|1,231,099|1,881,677|3,112,776|

## Top 20最大纳入文件

|文件|字节|归属|
|---|---:|---|
|pages/brand/assets/hero-user-v3.jpg|1,516,765|品牌分包|
|assets/images/workshop.jpg|657,075|主包|
|pages/brand/assets/company-reference.jpg|353,371|品牌分包|
|assets/home-nav/violin.png|73,514|主包|
|assets/home-nav/map.png|65,835|主包|
|assets/home-nav/consult.png|64,914|主包|
|assets/home-nav/teaching.png|60,516|主包|
|assets/home-nav/brand.png|55,474|主包|
|assets/yorray-logo.png|14,516|主包|
|pages/study/index.wxss|8,480|主包|
|pages/index/index.wxss|7,645|主包|
|pages/study/index.wxml|6,515|主包|
|lib/api.js|5,942|主包|
|app.wxss|5,809|主包|
|pages/index/index.wxml|5,451|主包|
|assets/study/group.png|4,895|主包|
|pages/mine/index.wxss|4,890|主包|
|pages/consult/index.js|4,685|主包|
|pages/brand/index.wxss|4,660|品牌分包|
|pages/product/index.wxml|4,546|主包|

## 26项固定资源分类

A：当前方案主包必需；B：研学分包；C：提琴分包；D：文创分包；E：其他业务分包；F：需压缩优化；G：业务素材不打包。A共24项，E共2项；B/C/D/F/G均0项。A中的研学背景和图标服务主包tabBar，当前预算内无需拆出。F不是“所有大图都必须压缩”，本轮没有需要压缩才能合规的资源。E中的品牌照片为经确认的页面固定视觉，不是后台产品/套餐素材。

|包内路径|字节|分类|处置|
|---|---:|---|---|
|/assets/home-nav/brand.png|55,474|A|主包|
|/assets/home-nav/consult.png|64,914|A|主包|
|/assets/home-nav/map.png|65,835|A|主包|
|/assets/home-nav/teaching.png|60,516|A|主包|
|/assets/home-nav/violin.png|73,514|A|主包|
|/assets/images/workshop.jpg|657,075|A|主包|
|/assets/study/gift.png|1,483|A|主包|
|/assets/study/group.png|4,895|A|主包|
|/assets/study/mentor.png|3,892|A|主包|
|/assets/study/shield.png|3,392|A|主包|
|/assets/tab-icons/gift-active.png|1,921|A|主包|
|/assets/tab-icons/gift-gold.png|2,214|A|主包|
|/assets/tab-icons/gift-muted.png|2,035|A|主包|
|/assets/tab-icons/group-gold.png|3,007|A|主包|
|/assets/tab-icons/home-active.png|1,502|A|主包|
|/assets/tab-icons/home-muted.png|1,690|A|主包|
|/assets/tab-icons/instrument-active.png|3,133|A|主包|
|/assets/tab-icons/instrument-gold.png|3,573|A|主包|
|/assets/tab-icons/instrument-muted.png|3,456|A|主包|
|/assets/tab-icons/mine-active.png|1,669|A|主包|
|/assets/tab-icons/mine-muted.png|1,812|A|主包|
|/assets/tab-icons/study-active.png|2,224|A|主包|
|/assets/tab-icons/study-muted.png|2,492|A|主包|
|/assets/yorray-logo.png|14,516|A|主包|
|/pages/brand/assets/company-reference.jpg|353,371|E|品牌普通分包|
|/pages/brand/assets/hero-user-v3.jpg|1,516,765|E|品牌普通分包|

固定图片总计2,906,370字节；主包1,036,234字节，品牌分包1,870,136字节。最大资源hero-user-v3.jpg为1,516,765字节，已进入品牌分包。图片字节总量不变；原件25份Hash不变。两张未引用大图排除上传，未删除。业务图片不进入小程序包。

## Legacy与Staging阻断

Development公开内容40条、51处旧业务/assets地址，继续作为Legacy Development Data保留，未复制进小程序、未上传Staging、不得作为Production静态素材。将来迁移任何相关业务内容时，必须转换为huangqiao-media及/api/media/<id>，不得直接沿用旧地址。Development Legacy本身是否Production阻断：NO。

Staging匿名公开内容39条，旧/assets业务引用1处：site:site.images.0 = /assets/yorray-logo-CFmraOUS.png。它在目前七页面访问中没有生成旧HTTP请求，但数据字段仍旧，不能据此认定兼容完成。本轮按用户要求将此项列为上线阻断，不改业务数据、不上传媒体。57处业务/api/media字段引用保留。扫描范围是公开已发布内容，未使用管理员身份穷举未发布草稿；草稿若以后纳入候选应重复检查。公开内容前后SHA-256相同，不能以此冒充全部云库历史/私有表审计。

## 真实页面验证

Development与Staging分别在原生工具切换编译模式并浏览首页、乐器、文创、研学、教学、点位导览、我的，另验证品牌分包首次进入和返回tabBar。页面数据与截图见相应development-/staging-文件；所有可读取页面loading=false、error为空，“我的”仅验证未登录界面，不进行身份或业务写入。

|页面|Development|Staging|
|---|---|---|
|首页|旧site正常|云端site正常|
|乐器|8条|8条|
|文创|20条|20条|
|研学|5条；固定背景正常|5条；固定背景正常|
|教学|2条旧内容|1条云端内容|
|点位导览|4条旧内容|4条已迁移点位|
|我的|DEV标识、未登录展示|STAGING标识、未登录展示|
|品牌分包|两图片无失败|两图片无失败|

两个环境26项固定图片均由wx.getImageInfo成功解码（development-fixed-images.json、staging-fixed-images.json），研学背景均1152×1536；品牌heroFailed/buildingFailed均false。Staging一轮页面Network过滤网关+/assets/为0/202请求，网关+/api/media/为33/202，显示200；调试器Errors为0。包内资源在模拟器由自己的本机调试端口加载，不属于Development API的8787 /assets路由；不得混淆模拟器内部HTTP与业务服务器依赖。Development旧业务封面仍允许使用本地/assets，此项未宣称归零。

两环境均可比较；教学数量2对1及同名套餐年龄/时长差异仍可区分，未更改数据来源规则。固定资源无404。Staging数据存在上述1项地址阻断，不能宣称“正式候选业务无旧/assets依赖”。新增隔离构建在缺少已配置合法域名的临时项目中出现请求限制，未关闭安全校验；原生项目页面验证与服务端预览包检查分别记录，不将预览成功冒充已完成真机网络验收。

## 测试与结论

官方原生与隔离Staging预览体积检查PASS；完整217项测试通过，失败0。Build、Type Check、25份原件校验通过；新增分包资源依赖、路由/tabBar及实际编译环境保护回归。无API协议、数据库、Admin源码、Storage、HTTP Gateway、业务页面功能或Production变更。

本次包体积问题已关闭；由于Staging仍有1处旧业务/assets字段，最终NOT READY。下一步仅可在另行授权业务内容维护时处理该字段，然后重新核查；本轮停止，不继续迁移或Production正式化。
