# Environment Configuration

实际入口使用`configuration()`，明确development/staging/production；DATABASE_URL必填，PGSCHEMA默认app、PGPOOL_MAX默认10（1—50），PORT默认8787。容器绑定0.0.0.0。查询15秒、锁5秒、事务闲置20秒；连接池5秒建立、30秒闲置。数据库凭据仅服务端，云端TLS/CA连接参数在真实环境中验证，禁止将“不校验证书”作为默认解决方案。

| 配置 | development | staging / production |
|---|---|---|
| LOCAL_DEV_AUTH | 默认false，显式true | 强制false |
| HQ_SEED_MODE | 默认none，可development | 强制none |
| STORAGE_PROVIDER | local或cloudbase | 必须cloudbase |
| ADMIN_ORIGIN | 本机开发来源白名单 | 单个精确HTTPS Origin |
| isTest新写 | true | staging=true；production=false且拒绝true |
| Cookie | HttpOnly / SameSite=Strict | 再加Secure |

启动不迁移、不自动建立账号。显式`db:migrate`；首个admin由`account:create`读取服务端BOOTSTRAP_PASSWORD创建且写审计，不输出密码，已有账号禁止Bootstrap。正式配置中WX_APPID/AppSecret、CloudBase服务角色Key由Secret/环境注入，不进入前端、日志或Git。

Admin采用同源API：静态文件由Node提供或由HTTPS反向代理保持同源。`VITE_ADMIN_API_BASE`默认`/api/admin/`，只允许同源该路径；媒体/CSV沿用同源。不得设置`Access-Control-Allow-Origin:*`搭配Admin Cookie；公网媒体无凭据跨域仅在Service通过发布授权后允许。

`build:mini`拷贝到build/mini-<环境>，仅注入公开API Origin和identityMode；staging/production必须提供MINI_APPID与HTTPS API，且切换wechat，缺少URL拒绝构建。源开发工程保持原设置，发布前须选择生成的正确环境包。原生编译验证独立记录，不把tsc称作微信上传。

Dockerfile为Node22多阶段构建、非root运行、健康检查；不打包.local/backups/secrets/.env。compose仅本机PG18。当前主机无Docker，未执行镜像构建；Node运行入口及容器端口/环境逻辑在本机实测，镜像构建及云端注入列Phase 2门槛。
