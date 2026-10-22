# 原地转正准备与验收

日期：2026-10-22。项目负责人批准：先核实备份、恢复和回退，再复用admin.yorray.com、现有PostgreSQL及媒体原地转正；不迁移或删除业务资料，不提审、不发布。基准865beb0964bb528d13087ca529bd21c12a793d5e。此前Staging体验版的人工通过不替代本轮正式候选验收。

## 现状与准确授权

云环境资源ID继续为huangqiao-staging-d2d1dj1bb4ad90，API服务huangqiao-api；资源名称不是运行环境的安全依据。当前在线API011使用已核对的API008不可变镜像，APP_ENV仍为staging，0.25CPU/0.5GiB、min1/max5，ADMIN_ORIGIN为https://admin.yorray.com。数据库postgres-i56vqlwu/app与huangqiao-media保持，不新建收费资源。

51条内容均已发布但isTest=true：企业资料1、点位4、乐器8、文创20、套餐5、教学13；另有70条SKU、79份媒体（328,168,761字节）、1条咨询。禁止借转正清理或覆盖业务信息。

负责人已批准[逐项写入清单](DATA_WRITE_PLAN.json)，指纹97836014a19f0209bc2b85361f385c0becf72f668e1bbda7ed10f48b4d5002f3。清单本身保持不可变，其AWAITING状态表示生成时状态；后续批准另行记录，不重写清单指纹。每条仅改isTest true→false、version加1、updated_at记录事务时间，并新增1条批次审计。真实验收最多2条访客身份新增/更新、2条访客会话、1条后台会话及1条登录审计；不写预约、咨询、SKU、媒体或其他业务字段。批准不取消备份与安全门槛。

批次模块只生成SQL，不连接云端；必须给出与不可变清单匹配的人工批准。数据库名、完整内容集合、每条原记录指纹及版本必须一致。对内容表加锁，单语句事务完成全部标记和审计；发现编辑、新增、重复执行或清单篡改即整体拒绝。不存在自动重试、自动回退标记或静默扩大清单。

## 备份、恢复与回退

详见[恢复与回退操作](RECOVERY.md)。云库单次只读SELECT取得13张应用表及列定义；数据库快照、Schema原件、含凭据的回退配置和媒体在本机加密，AES-256-GCM密钥单独保存在本机私有目录，不提交Git。数据库真实恢复在新建127.0.0.1:55433专用hq_test_promotion_restore_*数据库完成，13表全部一致，随后删除该隔离库；未向源库执行Migration、INSERT、UPDATE、DELETE或Schema变更。

首轮整文件媒体下载遇到curl18中途截断，不计作完整备份。随后通过范围读取完成79份全文件SHA-256校验；完整加密集328,168,761字节。12:55:41补取最新单次数据库快照，保留原快照；13表与79份媒体全部在新本机隔离库/目录真实恢复并逐项一致，图片200、视频Range206，演练库与解密文件已清理。未以部分备份或模拟资料替代恢复证据。

腾讯云DescribeBaseBackups和DescribeAvailableRecoveryTime均因AuthFailure.UnauthorizedOperation未取得记录；不代表没有自动备份，也不声称已验证平台物理备份、PITR或云实例恢复。本机应用级恢复不替代这些能力，离机副本与密钥异地保管亦未完成。

兼容回退新增显式HQ_READ_ONLY开关，默认关闭，非法值拒绝启动。开启时保持APP_ENV=production及正式入口限制；API写方法返回503/READ_ONLY_MAINTENANCE，微信及后台登录也暂停写会话；视频后台任务停用，避免后台删除/登记媒体。GET/HEAD、既有授权及健康检查保留，健康响应含readOnly=true及实际Host匹配布尔值canonicalEntry，不输出原始Host或凭据；可在维护阶段先核对自定义域名与旧域名，再决定转正。Cookie、CSRF及Origin校验保留。此为应用维护保护，不是数据库账号级只读策略。不得回滚到会重新开放测试入口或产生测试标记的旧API011，不用备份覆盖转正后新增资料。

API候选仅在已核对API008镜像digest上覆盖config、http、production-access、pg/foundation四个文件。打包工具不部署、不改云配置、不带数据库、凭据、媒体或整个工作区；旧教学两文件部署脚本保持原有哈希锁定。Admin沿用现有同源架构，按已认证服务端environment决定保存标记，未知环境拒绝保存；需与API配套更新。

## 域名与遗留静态资源

2026-10-22原生开发者工具连接目标AppID、urlCheck=true，直接GET https://admin.yorray.com/api/public/content返回request:fail url not in domain list。已请负责人保留原条目并补充admin.yorray.com的request/downloadFile白名单；未关闭校验，未将此前默认网关白名单通过视为正式域名通过。

纠正上一轮待处理项：site.images[0]的/assets/yorray-logo-CFmraOUS.png是既有固定系统Logo，不是待迁移业务图片。2026-10-09的logo-compatibility-result已经批准使用该静态地址且不新增媒体。本轮现网200、14,516字节、SHA-256与images/yorray-logo.png原件一致；首页背景读取site.images[1]。保留原关联与现有Admin构建的同一Logo，不上传huangqiao-media，不删除该字段；后续部署继续核对该固定资源200及哈希。不因此声称所有任意/assets业务引用都获正式批准。

## 当前实际结果

- 从Git暂存区导出干净候选源码验证：245项全量测试通过，失败/跳过0；Build、Type Check及25份原件大小/SHA-256全部通过。覆盖保存兼容、入口/Cookie/CSRF、维护保护、批准绑定、批次并发/重复拒绝、制品白名单和显式内部候选构建。使用真实本机HTTP/PostgreSQL与离线制品，不是云端转正或手机证据。
- 完整加密备份及真实应用级恢复PASS：13表361行、79份媒体328,168,761字节；最新备份快照2026-10-22 12:55:41（北京时间），manifest SHA-256为23f392d49e83715151c0cae98b19f5707164c69379050f3427d495f869ac9212。平台物理备份/PITR和离机副本未核实，不能合并称为完整灾备通过。
- 本轮受控云端配置及业务SQL写入0；APP_ENV仍staging、API011/原镜像及min1/max5保持，51条标记尚未执行，Admin未部署。只读比对发现既有上传后台任务更新了3条expired任务的调度字段，幂等行数17不变；其余12张应用表与原快照逐行一致。补取后13表恢复均一致，不能声称整个云库全程静止。
- API四文件候选ZIP17,540字节、SHA-256 8c71693b346a53c9a6b4a83dc67bb37beb8c2b14c0ac5d12049fe3588bc76ecf；Admin五个静态文件候选已构建。小程序只生成Production关闭开关的本地准备包，目标AppID正确、minified/urlCheck=true。显式--candidate-production必须在SSOT启用后才可构建内部验收包，仍不自动上传、提审或发布。当前未启用，未生成联网正式候选、执行新微信服务器包体积检查或手机七页面验收，不沿用旧Staging体验版结果。
- 微信小程序备案仍只有“管局审核中”的负责人信息；隐私指引已更新，具体内容/提审版本同步、类目适配及认证有效期待核。此阶段不提审、不发布。
- 闲置验收自动化不恢复；60分钟/隔夜首次访问仍待人工。保留既有未提交图片优化、文档WIP与用户video-covers资料，不承诺清空整个工作区。

状态：LOCAL PREPARATION / APPLICATION RESTORE PASS；CLOUD PROMOTION HELD；NOT READY FOR FORMAL CANDIDATE ACCEPTANCE。正式域名白名单尚未收到保存确认且原生检查失败，保持Staging，避免旧体验版被阻断而新候选无法连接。待白名单通过后，按恢复文档验证维护阶段真实Host/旧入口，才执行已有准确批准清单及配套部署、新候选手机验收。没有新建收费资源或升级套餐；备份读取消耗既有流量，不将其描述为实际零费用。
