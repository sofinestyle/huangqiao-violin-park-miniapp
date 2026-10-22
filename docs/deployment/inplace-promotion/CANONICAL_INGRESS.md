# 正式入口隔离：真实代理边界

2026-10-22，负责人确认admin.yorray.com已加入目标AppID的request/downloadFile列表。刷新原生工具并启用urlCheck后，公开内容51条读取200、原图加载和视频Range下载206实际通过；此为域名与媒体验证，不是正式候选手机验收。

## 发现与处理

第一阶段只读API012实测：自有域名的canonicalEntry=true，默认网关普通请求false；但默认网关携带X-Forwarded-Host: admin.yorray.com后，后端实际Host被平台代理改写，canonicalEntry变成true。因此，虽然应用代码没有信任转发头，仅依赖回源Host仍不足以完成本环境的入口隔离。本轮未据此启用Production或修改内容标记。

平台VerifyHTTPServiceRoute对内置默认域名明确返回“system internal domain, manual creation or modification is not supported”。未直接修改该域名绕过限制，未为此删除系统路由或关闭Cookie/CSRF。

最小修正是在现有admin.yorray.com的/api路由使用OVERWRITE_IF_EXISTS_OR_ADD注入X-HQ-Gateway-Token，在API运行配置安全注入同一HQ_GATEWAY_TOKEN。该凭据为随机256位值，不属于微信AppSecret、用户会话或业务媒体；不进入小程序、Admin构建、Git或日志。回退资料以AES-256-GCM加密，保留于既有私有备份目录，密钥单独保管。响应头明确移除同名字段，业务响应不返回此值。

Production API同时要求实际Host符合ADMIN_ORIGIN及网关凭据恒定时间校验通过；缺失/非法配置禁止启动，缺失、错误、重复凭据与伪造转发头均不能单独放行。Development禁止配置此凭据。后台Cookie、Origin、X-HQ-Action校验与游客微信身份验证继续独立执行；网关凭据不替代登录和业务授权。

只读维护健康检查仅返回网关校验布尔值，不返回原始头或凭据。需要真实验证默认网关、两个直连CBR域名及其伪造头均不能取得有效入口；未通过不得转正。即使通过，也仅能称旧入口隔离，不能称对客户端版本或测试身份的可信证明；持有有效身份的人仍可能主动使用正式入口，不能依赖域名代替业务权限。

## 配置边界与回退

仅修改现有自有域名/api路由Extension，原/static根映射、API上游、路径透传、DNS、证书、Cookie、CSRF、缓存及资源规格保持。保留原域名两条路由，不新增路径或付费资源。官方预检的唯一FAIL为既有/api的ROUTE_CONFLICT；已核对其对应原路径，故调用ModifyHTTPServiceRoute更新原路径，不调用Create、不忽略其他失败项。实际更新后读取确认两个路径和上游保持、私有头为覆盖行为。接口依据见[腾讯云HTTP数据结构](https://cloud.tencent.com/document/product/876/34822)。

应用回退必须保留网关凭据及入口保护；不能直接回到仅Host校验或旧API011。出现异常优先维护只读，不反转内容标记或恢复覆盖业务数据。真实云端负例结果、最终部署和候选验收见本目录ACCEPTANCE及VERIFICATION，不能把上述本地回归写成云端隔离通过。

## 实际云端结果

API013阶段12次健康诊断：自有域名为有效入口，三个旧域名含伪造转发头和猜测凭据均无有效证明。API014 Production只读阶段43次请求通过，其中旧入口公开内容、登录、业务写入口和媒体36次均403/PRODUCTION_ENTRY_REQUIRED；自有域名读取、视频Range及维护/CSRF拒绝符合预期，响应无私有凭据头。API015保持同镜像、正式入口和凭据，完成批准标记后开放正常服务；Cookie与CSRF仍独立执行。

SQL管理接口的Role为可选参数，参见[ExecutePGSql官方定义](https://cloud.tencent.com/document/product/876/130469)。本轮显式应用Role只读预检失败、既有默认管理连接通过；未因此调整数据库权限。最终仍以精确SQL哈希和批准清单绑定执行，变更范围没有扩大。
