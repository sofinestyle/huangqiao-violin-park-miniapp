# 正式候选本地适配验收

日期：2026-10-22；操作者：Codex；授权人：本会话项目负责人。基准ce95ecce43fb14157b78bce322189288510308a3，目标AppID wx5dee6ef3087366c0。授权仅限正式构建、后台保存规则和旧测试入口隔离的本地适配、平台资料核对、测试及独立提交推main。不切换云端，不写业务数据，不上传、提审或发布。

## 当前范围与实现

1. Production API候选为https://admin.yorray.com，SSOT的enabled仍为false。Development/Staging运行保持；普通项目、启动参数和旧缓存不能选入Production，普通包的release仍拒绝访问。显式production目标仅允许trial/release，令牌命名空间独立；只有未来另行批准启用后才允许访问正式API。正式候选不提供develop调试入口，也不显示调试标识。
2. 本地准备命令：`APP_ENV=production npm run build:mini -- --prepare-production`。生成build/mini-production，启用JS压缩和合法域名校验、清空开发编译条件，并输出PREPARATION_ONLY.json，记录运行开关关闭、上传/提审/发布未批准。该命令不调用微信上传或云端部署。生成本地准备包不等于可联网正式包。
3. Admin从已认证的login/me响应取得服务端environment，按环境创建草稿；未知环境拒绝保存。正式草稿isTest=false，开发/测试草稿isTest=true。编辑遇到不匹配标记时拒绝，且在自动视频封面上传之前检查，避免失败保存产生额外媒体。API继续拒绝错误标记，并检查原记录，旧测试记录不能通过普通编辑自动转正。未批量调整现有51条记录、未重新分类教学或清理咨询。
4. production服务对除GET健康检查外的/api/请求校验实际HTTP Host，必须匹配配置的HTTPS ADMIN_ORIGIN；不接受X-Forwarded-Host、Forwarded或客户端自报environment作为放行依据。旧默认域名、localhost入口在认证/业务处理前返回403/PRODUCTION_ENTRY_REQUIRED，含登录和媒体；Staging不启用此限制。健康检查保留供内部就绪探测。
5. 入口限制是阻止普通旧客户端误用的防护，不是对小程序版本或运行环境的可信证明，不能替代身份认证、授权或网关安全边界。未来切换前必须实测CloudBase是否保留自定义域名Host、是否存在其他旁路；代理不保留Host时应先验证可信入口方案，不得简单信任可伪造转发头或取消防护。本轮未部署，线上旧包访问并未因本地代码修改而被实际停用。
6. Cookie的HttpOnly/Secure/SameSite=Strict/Path、唯一Admin Origin及X-HQ-Action检查保持。普通API20秒、GET最多一次重试、写入不自动重试和视频协议保持。

## 测试与证据

所有业务写入测试只在现有127.0.0.1专用hq_test数据库的随机隔离Schema中执行，并自动清理；不使用本地开发业务库或CloudBase连接。新增真实HTTP/PG回归覆盖：正式新建及编辑、后台环境元信息、未知环境/错误标记拒绝、旧记录不自动转正、旧入口写入前拒绝、伪造转发头无效、健康例外、Cookie属性、缺失Cookie/CSRF头及错误Origin。小程序覆盖正式开关关闭、未来批准启用的内存模拟trial/release、目标域名及令牌隔离，模拟不冒充微信真机验证。

历史Staging教学两文件部署脚本保持原digest和源码哈希锁定；新Production源码触发OVERLAY_SOURCE_CHANGED，回归明确验证拒绝且不产生包，防止旧部署脚本夹带本轮改动。未更新其固定哈希。

最终测试结果见本文件后续“收尾结果”。原始日志仅存忽略目录.qa/production-local-2026-10-22，不包含连接凭据。此前Staging体验版0.1.0-stg.1022的七页面、登录、图片和视频播放/拖动由负责人最新回复确认通过，属于人工结果，不能替代本轮未来正式候选验收。

## 微信资料与后续事项

详见[平台核对清单](PLATFORM_CHECKLIST.md)。负责人确认2026-10-03完成微信认证，未提供有效期；小程序备案处于管局审核中、尚未通过；现有类目景区服务、乐器、工艺品、办公/文具；隐私指引状态尚未明确。公众平台浏览器已被站点安全策略拒绝，本轮不重试或绕过，不将待确认项写为通过。

后续转正需另行批准：保留原库/原媒体下的限定环境标记处理、1处旧Logo业务/assets路径治理、现有1条咨询用途判断、有效备份和恢复证据、网关Host及旧入口实测、admin.yorray.com的request/downloadFile白名单、正式候选新包及iOS/Android验证、受控业务闭环、人工60分钟/隔夜首访、套餐配额与续费核对。闲置自动化继续暂停。不为了本次准备新购环境、数据库、存储、域名或CDN。

线上Admin/API后续需按同一窗口配套更新：新Admin连接缺少environment的旧API时应安全拒绝内容保存，不能回退为默认测试/正式标记。切换后优先回退兼容制品，不能覆盖或删除新增业务记录。

## 收尾结果

- 以Git暂存区导出干净的build/production-local-validation验证副本，不含既有未提交图片优化、DEC081或用户封面资料；未另建Git worktree或改变项目根目录。
- 干净拟提交源：239项全量测试通过，失败/跳过0；Build、Type Check通过；25份原件大小及SHA-256全部一致。工作区另有前轮测试改动，不用其240项总数冒充此次提交的测试数。
- 本地正式准备包生成于该验证副本下的build/mini-production，JS已生成，目标AppID正确、minified/urlCheck均true，运行开关false。本轮未调用微信官方preview/upload；没有新的微信服务器包体积或正式候选手机验收结果。
- Cookie/CSRF、正式保存、旧入口及转发头负例为本机真实HTTP和原生PostgreSQL隔离测试；未来启用条件在内存模拟中测试，不代表真实Production已运行。
- 当前状态：LOCAL PREPARATION PASS；PLATFORM CHECK PARTIAL；NOT READY FOR CLOUD PROMOTION / WECHAT AUDIT。小程序备案待管局通过，隐私指引待明确，类目适配及认证有效期待核。线上Staging继续原状，Production未启用；本轮未执行云端调用、业务库连接、数据标记调整或任何发布。
- 本轮只提交上述适配、测试和治理记录，保留原有WIP，不宣称整个工作区clean。历史Staging体验版及其人工验收保持，不重新上传或撤销。
