# Staging后台入口同源修复验收

本轮结果：READY FOR STAGING ADMIN ACCEPTANCE。2026年10月11日，依据负责人明确批准，记录现状后修复并部署Admin静态版本006，完成负责人本人登录和Chrome只读页面验证。此结论只覆盖后台入口与即时读取，不代表闲置稳定性或Production上线通过。

## 现状与原因

基准Commit为efa48ab3e80a9c8922b9ce673b4d014126fd34bf。原webapps入口HTML正常，但/api/admin/me返回404、HTML NoSuchKey；统一网关同一路径返回正常匿名401 JSON。两入口当时HTML逐字节一致。网关已有根路径静态Admin与/api云托管路由，服务端ADMIN_ORIGIN也已经是统一网关。详细原始安全摘录见[BASELINE.json](BASELINE.json)。

webapps是当前静态入口，不能承接该API路径。延长超时或GET重试不能解决404。此前稳定性文档把网关根页描述为API镜像内旧Admin，本次实际路由与HTML比对证明当前根页是同一个静态Admin应用，故无需重部署API镜像。

## 修复与使用

原webapps网址继续可作为进入地址；仅在精确匹配其HTTPS Origin时，React挂载和API启动之前整页replace至固定统一网关根路径。推荐负责人直接收藏[Staging后台](https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com/)。地址栏切到统一网关后，登录和读取均在该域名内完成。

这是一项入口规范化修复，并未给webapps增加反向代理：直接访问webapps域名下/api仍不受支持。旧入口不承载登录，既有Cookie不跨域复制；如尚无统一网关登录会话，需要在那里正常登录。跳转目标固定，不接收next、query、hash或路径中的目标与凭据，不影响本地或其他域名。保留原credentials=same-origin、X-HQ-Action及服务端Origin校验，不新增CORS或放宽Cookie。

部署底稿为已核对的在线UI源码（95b7655）加已批准的20秒请求策略，再加入本轮main.jsx与staging-entry.mjs。没有把当前main其他尚未部署功能带入Staging。Admin由005升级006，BuildId 2608506429，实际SUCCESS；两域名HTML、JS、CSS和两张固定图片共10份逐字节匹配部署产物。CSS及固定图片沿用原版本。平台临时ZIP上传只用于Admin代码部署，不上传huangqiao-media。正常CLI上传等待曾中止，后使用同一官方代码ZIP上传及CreateCloudApp接口成功；一次参数大小写错误被拒绝，没有据此报告成功。

## 实际结果

| 验证 | 实际结果 |
| --- | --- |
| 未登录进入 | webapps整页进入统一网关；网关匿名me为401，登录页正常 |
| 登录 | 负责人在Chrome自行输入现有账号凭据；POST /api/admin/login 200，X-HQ-Action=1；未采集密码或Cookie值 |
| Cookie与再次进入 | hq_admin保持HttpOnly、Secure、SameSite=Strict、Path=/及网关域名；从webapps再次进入后me 200，会话保持 |
| 工作台、场次、预约、咨询 | 真实页面加载，工作台51内容；场次、预约、咨询正常空态 |
| 六类内容 | 乐器8、文创20、首页与企业1、研学套餐5、教学13、点位4；各表aria-busy=false且无错误提示 |
| 素材库、账号权限、操作记录 | 真实只读页面加载，分别79、1、当前页50条；未打开编辑或保存、上传、导出 |
| 读取请求 | 新鲜分段采集的19次JSON GET全部同源200、携带Cookie；37—433毫秒，实际重试0次 |
| CSRF负例 | 缺X-HQ-Action、外域Origin、旧webapps Origin各403，均未签发Cookie；在认证处理前拒绝 |
| Console | 验收窗口内错误与警告0条 |
| 测试与构建 | 11项针对性测试通过，Build、Type Check、25份原件大小与SHA256通过；本轮未重跑全部PostgreSQL测试 |
| API与隔离 | 在线API版本005、镜像、全部环境变量及配置语义保持；min1/max5、0.25CPU/0.5GiB；原始配置唯一差异为OpenAccessTypes列表顺序，集合不变 |
| 公开内容 | 前后SHA256均c6f9a9afcb81e68e40170ebc473bd8e908467e1c3604724a6df43abd87ccdcd1；不等同于全库审计 |

详见[脱敏验证记录](VERIFICATION.json)。跨文档跳转的CDP缓冲区报告truncated；保留的事件中旧webapps API请求为0、网关me为200，但不将其称为完整全程Network记录。代码入口测试证明跳转前不挂载Admin；真实地址栏及登录保持证明跳转生效。19次页面JSON GET证据没有截断。没有验证所有素材逐个播放或写入业务，本轮亦不需要借业务写入验收路由。

## 范围与后续

没有直接操作数据库、修改数据库配置/Schema/Migration、业务数据、API部署、Gateway路由或Production；公开内容指纹保持。正常登录按既有实现产生会话和登录审计，不能表述为整轮数据库完全零写入，也不能证明没有其他用户活动。仅部署既有Admin静态应用，无规格升级或新增常驻资源。

staging闲置验收自动化仍为PAUSED，未改其配置。60分钟闲置与隔夜首次访问继续未执行，由负责人后续人工安排；本轮活动不构成闲置验收，也不核算新的实际账单。Production、微信正式域名与真机、未部署教学类型及既有素材治理事项均不在本轮范围。

如需回退，本轮前005静态产物可恢复，但会重新暴露webapps入口API 404；优先使用已核对的统一网关网址。回退另行执行，不在本轮验收中操作。原始网络元数据、构建、临时代码凭证及工作台截图仅在Git忽略的.qa/staging-admin-routing；截图没有凭据。原有未跟踪视频封面资料保留且不提交，因此仅承诺已跟踪工作区clean。
