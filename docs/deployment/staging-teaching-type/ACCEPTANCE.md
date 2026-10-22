# Staging教学类型API最小修复

日期：2026-10-22。操作者：Codex。授权人：本会话项目负责人。

当前状态：**DEPLOYED — PENDING OWNER CLASSIFICATION/SAVE ACCEPTANCE**。负责人恢复既有CloudBase CLI登录后，任务2423855部署API008，已确认正常、100%流量。仅两份运行文件覆盖；环境变量与核对的服务配置未变，内容和媒体指纹未变。负责人可开始先一条、再逐项分类保存。云端实际保存验收仍未执行，不以本地测试冒充。

## 授权与边界

负责人批准仅更新现有Staging API，补齐teachingType保存和校验，保留Cookie、CSRF及现有视频播放格式；不自动修改13条教学内容，不修改Production，不上传、提审或发布小程序。闲置验收自动化保持暂停。

## 只读诊断与基线

2026-10-22 09:18至09:22实查Staging PostgreSQL的app.content：13条教学均为published、type=video，data中全部不存在teachingType及category键；data为JSONB，content表无自定义触发器。公开API返回同一组13条及相同版本。不能据此还原每条记录过去是否曾在后台选过分类。

Admin当前huangqiao-admin-staging-007（2026-10-20 13:40:02）已有五类选项及data.teachingType提交逻辑。API当前huangqiao-api-007（2026-10-21 22:20:08，100%流量）；既有部署元数据和API003实际构建日志表明镜像来自2026-10-09构建，分类保存支持晚于它，于2026-10-10提交6eb2575加入。旧API白名单不包含teachingType，会过滤该字段。当前仓库已有所需修正，无需再重写相同业务逻辑。

2026-10-22 09:26:43+08数据库只读部署前指纹：content 51条，MD5 a344ef468edd284a5071d606968dd016；media 79条，MD5 37680273d0d06147cba0c437dbac2cfd。13条教学的type均为video，全部尚无teachingType。指纹用于比较前后记录，不含密码、连接字符串、会话或媒体文件。

## 最小部署产物

使用deployment/staging-teaching-type/Dockerfile继承原API镜像的固定digest；构建时先核对原foundation.mjs的SHA-256，不匹配则构建失败。仅覆盖以下两份运行时文件：

- server/pg/foundation.mjs：相对原版本仅增加类型定义导入、teachingType白名单和五项有效值/格式校验。
- shared/teaching-types.mjs：复用已经批准的类型定义。

server/http.mjs、server/security.mjs、Admin静态文件、数据库与Migration、存储实现和其他运行文件均继承原镜像。无依赖安装或升级，不覆盖CMD、ENTRYPOINT、USER、环境变量或实例配置。

执行node scripts/prepare-staging-teaching-api.mjs仅生成build下约9KB的API代码覆盖包，不部署。包内只有Dockerfile、上述两文件及不含凭据的manifest；不含整个工作区、原件、个人资料、小程序包、数据库或环境文件。

| teachingType | 标签 | 原有格式约束 |
|---|---|---|
| unboxing | 开箱教学 | video |
| product_video | 产品视频 | video |
| violin_course | 提琴课程 | course |
| article | 图文教学 | article |
| other | 其他 | 保留现有article/video/course |

API不自动转换格式，不按标题猜测分类；旧视频没有teachingType时仍兼容。将视频选为“提琴课程”或“图文教学”涉及现有Admin格式切换，不属于本次API变更；负责人应按既有内容格式选择，不以改标签代替格式决策。

## 实际测试

| 项目 | 结果 |
|---|---|
| 全量本地测试 | PASS，235项，无跳过；仅使用本机专用hq_test_数据库，结束后删除 |
| 新增HTTP链路回归 | PASS；合成账号登录，Cookie属性、CSRF/未登录拦截，五类创建、已有视频PUT重分类、PG持久值、后台重新读取、公开详情及列表一致 |
| 原有视频保护 | PASS；非法类型/格式不匹配、缺失视频、无效时长拒绝且记录不变；旧视频可维护；分类保存后type保持video |
| 原始API源码＋两文件覆盖 | PASS；独立复跑同一HTTP/PG用例，确认适配原版本运行文件 |
| 覆盖包边界 | PASS；固定父镜像digest、原文件校验、仅两文件COPY、无启动/环境配置覆盖、禁止覆盖已有输出目录 |
| Build、Type Check | PASS |
| 原件校验 | PASS，25份大小及SHA-256不变 |
| 云端部署与部署后配置比较 | PASS；API008正常、100%流量；全部环境变量及核对的端口、实例、网络、卷、构建与启动配置不变 |
| 云端内容与媒体记录保护 | PASS；部署后09:33:17+08复查，51条content与79条media的完整行指纹、13条教学版本和video格式均与部署前一致 |
| 云端健康与公开内容 | PASS；health 200/staging，六类公开内容GET均200，51条公开内容与部署前逐字节一致 |
| 云端媒体 | PASS；13条教学的视频Range均206且读取1024字节；抽查4张业务图片Range均206 |
| 云端安全负例 | PASS；无X-HQ-Action 403、外站Origin 403、无Cookie 401；请求在业务保存之前被拒绝 |
| 云端保存分类 | 未执行；明确留给负责人，不以本地合成测试冒充云端实际保存 |

## 后续执行与人工验收

已恢复既有CLI登录，重新读取原Staging API007配置后，以package方式仅更新现有huangqiao-api，Items为空，不提交环境或实例配置修改。任务2423855、构建2609140789已完成；新版本huangqiao-api-008，新镜像tag为huangqiao-api-008-20261022093051，digest为sha256:dae4986644a1026746af37702e99be1acd6446677da4559dcc2a42344253631a。构建通过固定父镜像与原文件校验、两文件COPY及语法检查。API008为normal/100%流量，仍0.25CPU/0.5GiB、min1/max5。全部环境变量逐值比较一致；服务端口、网络、卷、启动和构建等所选配置一致。数据库前后完整content/media行指纹一致，13条教学全部保留原video、版本和无分类状态。

现在由负责人先在后台为一条内容选择合适类型并保存，关闭后重新打开确认值仍在，再由公开API和小程序核对标签、筛选、图片、视频播放及拖动。该人工保存会产生正常业务更新和审计，须由负责人操作；其余12条随后逐项确认。不执行数据Migration。

## 安全事件与未完成项

本轮读取历史本机临时部署文件时，曾误将敏感配置带入工具输出。原始文件未加入本次提交，后续检查仅允许脱敏摘要；涉及的数据库凭据及存储服务凭据应通过安全入口轮换。本轮未擅自轮换或扩大权限，此事项不能写为已经处理。

既有未提交UI/CDN工作及用户video-covers资料保留，不能把本次独立提交描述为整个工作区clean。代码推送也会同步此前本地教学页提交37ba918，但没有上传小程序代码包。七页面原生/手机及视频实际拖动本轮未重做；六类公开API与媒体Range检查不能替代手机人工验收。此次没有重新登录云端Admin、保存教学、修改媒体文件或部署Admin。
