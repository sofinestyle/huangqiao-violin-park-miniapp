# 身份与安全审计

结论：应用层身份/角色可以保留，但当前是开发安全配置，尚不具备直接生产部署条件。未读取任何真实密钥或管理员密码，未登录云控制台或微信平台。

## 1. 微信身份：已有代码与未验证项

当前小程序lib/api.ts的wechat分支真实调用wx.login；Server /api/auth/wechat校验code，使用WX_APPID/WX_APPSECRET调用微信jscode2session（10秒超时），要求openid且无errcode，按唯一wechat_openid查询/新增visitor，再签发应用Bearer Session。返回的是应用随机Token，不向前端传AppSecret或session_key。这不是假openid Stub，但配置默认走development，实际GET /api/health显示devAuth=true。

生产化需要：公司正式AppID/Secret安全注入、HTTPS和微信域名配置、IDENTITY_MODE=wechat、LOCAL_DEV_AUTH强制0；缺失Secret应继续明确失败，不回退匿名开发身份。openid+visitor首次创建改原子upsert，避免pg异步并发同一openid造成唯一冲突。openid以AppID为作用域，staging/production库隔离；以后跨AppID需要独立决策，不能把同名字符串合并用户。

当前ensureIdentity只判断本地是否有Token；过期401会删除缓存，页面需重新建立身份的体验应在正式微信闭环核验。使用同AppID测试两个环境时要隔离Token缓存，防带错Token。微信验证网络调用在DB事务外，验证成功后短事务保存身份/Session；日志不得包含完整jscode2session URL（含Secret/code）。

## 2. 员工账号与会话

- security.mjs密码12—256字符，随机盐+scryptSync+timingSafeEqual；继续保留规则，不把迁移变成密码政策改造。并发登录下同步scrypt可能占事件循环，应测量并评估异步scrypt，不减弱参数。
- Session为随机32字节Token，数据库存SHA-256；Admin8小时、游客30天，过期毫秒时间。它们是既有开发参数，正式保留周期由业务核定，不能当法规要求。
- Admin每请求读取当前active/roles/canExport；角色/密码/启停变化清除后台Session；canExport按当前账号即时读取。迁移必须保持角色与资料导出边界。
- Cookie当前HttpOnly、SameSite=Strict、Path=/，无Secure；正式HTTPS新增Secure并同属性退出清除。不要改成前端localStorage保存后台Token。
- 写操作要求X-HQ-Action且Origin局限localhost；生产精确白名单，测试与正式隔离。保留缺Origin请求的处理政策并在网关测试，不以跨域配置替代授权。
- 登录失败限流是单进程Map，按socket.remoteAddress计数。在反向代理下可能所有人共用网关IP且多实例可绕过；生产需受信网关IP规则和共享限流/网关策略，禁止直接信任客户端伪造X-Forwarded-For。
- 当前启动/账号CLI写本地访问密码文件；正式改为独立初始化任务和安全交付，不在容器日志/镜像/静态产物存密码。

## 3. PG模式的额外入口风险

PG的auth schema及anon/authenticated/service_role不是本项目admin/content/reception。不能直接把工作人员账号迁到CloudBase Auth而不审查权限/会话契约。

优先独立应用schema，运行账号最小DML、迁移账号单独授权；业务表不向CloudBase匿名/已登录客户端GRANT，撤销PUBLIC的应用schema访问，检查默认权限及PostgREST暴露范围。启用适当RLS防御，不把广泛service_role密钥放前端；应用runtime若有BYPASSRLS仍须应用鉴权和最小GRANT。必须在staging直接调用自动REST入口验证无法读取客户、账号、审计或写SKU，而非只测Node403。

[PG身份与权限说明](https://docs.cloudbase.net/authentication-v2/auth/auth-pg)确认平台高权限角色可绕过RLS且DDL权限分层；本项目不需要客户端直连PG，故拒绝为“方便调试”开放anon业务表。Storage也使用私有桶和Server凭据，不让公开签名URL泄漏服务密钥。

数据库优先同地域内网/VPC；以实际连接控制台地址、路由、安全组与SSL要求为准，不能仅因“都在CloudBase”认定私网已通。禁止把PG5432对所有公网开放。本地只连本地PG，必要远程运维用受控网络通道。TLS应校验可信证书，不能照搬示例中的rejectUnauthorized:false作为默认生产安全配置。

## 4. 上线前必须完成的差距

| 项目 | 当前状态 | 必须完成/验收 |
| --- | --- | --- |
| APP_ENV / Seed / 开发身份 | 开发默认，可生成测试用户和内容 | production显式校验、Seed关闭、开发身份接口不可用 |
| isTest | Server强制true | 环境受控正式录入机制，拒绝测试Seed流入生产 |
| HTTPS / Origin / Cookie | 本地HTTP和localhost白名单 | 正式域名、TLS、安全Cookie、CSRF/跨站实测 |
| DB权限 | SQLite本地文件权限 | 私网+最小DML、迁移职责隔离、自动REST入口关闭业务访问 |
| 上传 | MIME/魔数/64MiB，本机持久目录 | 私有对象存储；超时、格式探测、安全失败、补偿；维持素材共享 |
| 错误日志 | console.error(e.message) | PG错误detail可能含敏感值，按错误码脱敏；不写SQL参数、联系方式、Cookie、签名链接 |
| API错误 | Fault安全文案，其他500 | 不回传数据库结构/连接信息；保留既有业务code |
| 密钥 | 模板只有空值，未读实际Secret | 环境机密注入、权限与轮换、不得写VITE_*或包内 |
| 备份 | 本地600权限manifest | 加密/访问控制、不同故障域、过期策略与恢复演练 |

## 5. 健康、日志与最小监控

当前/api/health无DB查询、暴露devAuth/uploadLimit等开发信息；改为最小就绪结果，限时SELECT 1并验证必要Schema版本就绪，成功200失败503，不返回URL、密码、环境变量或详细栈。可分轻量存活与就绪端点，避免数据库短暂失败触发无限重启。CloudBase探针支持方式按实际服务设置验证，不能假设平台自动读取/api/health。

标准输出结构化记录：requestId、路由模板（不含查询敏感参数）、状态码、耗时、业务错误码、依赖失败类型。业务审计仍存PG，平台访问日志不能替代。最低告警：持续5xx、微信换码失败、DB池耗尽/锁超时、上传/Range失败、就绪失败、备份超期、异常流量和预算余额。采样成功请求、限制日志保留，避免运营资料进入日志。

CloudBase[云托管监控](https://docs.cloudbase.net/run/introduction)提供容器日志、资源/请求监控与CLS对接；应用仍须输出可关联且脱敏的错误，配置责任人/告警渠道并演练。不新建复杂APM。健康查询与长期连接可能影响PG共享实例计量，探测频率应兼顾可用性和实测成本，不能为了省点数取消健康验证。

本轮没有正式微信登录、安全渗透或多实例权限实测；以上均是明确上线门槛。
