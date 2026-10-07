# CloudBase目标架构、环境与成本

日期2026-10-08；基线见01。本文件是技术建议，不是资源开通、套餐购买或上线验收。未登录云控制台，实际账号资格/实例参数未核实。

## 1. 明确推荐

| 对象 | 结论 | 理由和前提 |
| --- | --- | --- |
| CloudBase PostgreSQL | YES | 适合关系约束与业务事务，使用标准pg；须完成同步改异步、锁协议和DDL路径验证 |
| CloudBase云托管Node | YES | 保留现有HTTP/Service与流式媒体逻辑；改无状态容器、外置持久化 |
| CloudBase云存储 | YES | 文件与PG元数据分离，私有桶，Node控制公开授权 |
| CloudBase静态托管Admin | YES | Vite产物可独立发布；统一HTTPS域名路由解决Cookie及相对API |
| wx.request | YES | 当前契约与鉴权可复用，测试/迁移成本较低 |
| 本阶段改callContainer | NO | 不是接PG的前提，另引入关联环境和调用适配；保留为以后有用量证据的优化候选 |

目标优先**上海PG模式**。官方地域能力表列上海PG支持云托管、新加坡PG不支持；不能把新加坡选项当同等替代。[地域能力表](https://cloud.tencent.com/document/product/876/127357)。PG模式只能新建，既有传统环境不能直接改为PG；微信云开发入口暂不支持创建PG，未来应在腾讯云CloudBase入口选择，不能据此要求小程序直连数据库。[环境说明](https://docs.cloudbase.net/quick-start/env-overview)。

```text
原生微信小程序 ── wx.request / HTTPS ──┐
                                    ▼
统一HTTPS入口：/api/* → Node云托管 → pg连接池 → PG应用Schema
             /admin/* → 静态托管        └── 私有PG Storage桶
                    ▲                    Node代理授权读取/Range
                React Admin
```

所有预约、咨询、SKU、权限、审计、幂等、状态机仍经Node。PG环境自动提供的PostgREST/Storage能力不能绕过该业务入口。平台auth/storage系统表与本项目accounts/visitors/sessions/media不是同一模型，不替换现有角色与会话。

## 2. 容器化差距

当前Node版本要求>=22.13.0；推荐固定受支持且通过项目测试的Node镜像，构建锁文件一致。镜像只含Server/shared/必要品牌资源及运行依赖，不含.local、backups、测试密钥、源DOCX和开发数据；不运行Vite开发服务器。实际生产启动命令可继续node server/index.mjs，先完成配置校验与适配。

必须修改：APP_ENV只准development的硬拦截；云端HOST=0.0.0.0；PORT读取/范围校验；业务数据不再落HQ_DATA_DIR；HQ_SEED_MODE=none并在production拒绝development；LOCAL_DEV_AUTH=0且生产默认关闭；去除启动自动建账号/写密码文件；Service的isTest强制规则改为环境受控；优雅退出连接池。

官方[服务开发规范](https://docs.cloudbase.net/run/develop/developing-guide)要求监听平台PORT并保持无状态；[容器排障](https://docs.cloudbase.net/recipes/connect-ai-mcp-server-cloud-run)明确127.0.0.1绑定导致容器外不可达。配置建议BIND_HOST作为应用变量，开发默认127.0.0.1，staging/production明确0.0.0.0；不假设端口一定80、3000或9000。

CloudBase也提供HTTP云函数，但本项目已存在完整Node服务及上传/Range传输，选择云托管可减少运行时差异；并不声称容器是唯一方案。不要因短时费用优惠同时改成大量云函数。

## 3. 三环境配置设计（新增变量均为建议，尚未创建）

| 配置 | Local | Staging | Production | 机密 |
| --- | --- | --- | --- | --- |
| APP_ENV | development | staging | production | 否 |
| DATABASE_URL | 本地PG专库 | staging私网PG | production私网PG | 是 |
| CLOUDBASE_ENV_ID / REGION | 空或专用测试环境 | 独立上海环境 | 独立上海环境 | ID非密钥 |
| STORAGE_BUCKET / backend | 本地适配或专用测试桶 | 私有测试桶 | 私有正式桶 | Key/服务凭据机密 |
| WX_APPID / WX_APPSECRET | 明确测试配置 | 获授权微信身份 | 正式主体身份 | Secret只在Server |
| BIND_HOST / PORT | 127.0.0.1/本地端口 | 0.0.0.0/平台PORT | 同左 | 否 |
| HQ_SEED_MODE | 显式development或none | none；隔离fixture另行导入 | none，拒绝测试Seed | 否 |
| LOCAL_DEV_AUTH | 显式1才启用 | 0，用真实测试微信身份 | 0，启动强制校验 | 否 |
| HQ_DATA_DIR | 旧SQLite归档/临时文件 | 仅有界临时缓存 | 仅有界临时缓存 | 不放持久业务数据 |
| Mini API_BASE / IDENTITY_MODE | 本地URL/development | staging HTTPS/wechat | production HTTPS/wechat | 非密钥 |
| Admin API/BASE、ALLOWED_ORIGINS | Vite代理 | 同源/admin/、精确来源 | 同源/admin/、精确来源 | 非密钥 |
| LOG_LEVEL | debug但仍脱敏 | info | info/warn | 不记录请求体/凭据 |
| PG池与超时、Storage凭据 | 环境专属 | 环境专属 | 环境专属 | 凭据机密 |

不将Server秘密做成VITE_*或打进小程序。生产缺失必要配置直接失败，不回退本地SQLite/开发身份。migration runner与业务运行身份分离，备份身份只读；不得共用高权限API Key做日常SQL。

## 4. wx.request 与 callContainer

| 项目 | wx.request | wx.cloud.callContainer |
| --- | --- | --- |
| 改动 | 保留lib/api.ts、Bearer和幂等头；调整环境配置 | 云初始化、env/service、响应/错误/超时/头适配 |
| 域名 | 真实HTTPS及微信服务器域名配置；媒体下载/播放域名也核对 | 官方说明调用无需服务器域名，但需要小程序与环境关联 |
| 网络/成本 | 标准公网HTTP，计入适用出流量 | 微信私有链路优势；不等于数据库/容器/媒体都免费 |
| 身份 | 现有wx.login→jscode2session→应用Session | 不自动替换应用鉴权；腾讯云侧云托管不能假设有微信侧的openid注入 |
| 调试和迁移 | HTTP工具、原测试、其他平台易复用 | 需验证CloudBase绑定/共享、微信运行时 |
| 图片/视频 | 现有URL/Range适配直接 | JSON调用不自动替换image/video的HTTPS URL或Range链路 |

推荐继续wx.request。官方[小程序访问说明](https://docs.cloudbase.net/run/develop/access/mini)区分关联环境、私有链路与微信侧openid能力；[公网访问](https://docs.cloudbase.net/run/deploy/networking/public)说明公网入口仍需应用鉴权。项目还需Admin和媒体HTTP入口，改callContainer不能省去全部HTTPS治理。微信网络官方页面本轮读取失败，具体域名数量/证书/基础库限制不作为已核实数值，实施前按公司平台与真机复核。

## 5. Admin同源方案

推荐同一自有HTTPS域名：/admin/→静态产物；/api/→Node并透传完整路径；/assets/→审核后的品牌公共素材路径。官方[HTTP网关](https://docs.cloudbase.net/service/introduce)支持云托管/Hosting资源路由及路径透传，未来staging必须实际验证该组合，不认为上传静态文件即连通API。

保持hq_admin HttpOnly/SameSite=Strict，云端添加Secure；退出同Cookie属性清除。当前CSRF来源仅允许localhost，必须改成环境显式Origin白名单，保留X-HQ-Action；不把CORS开成*。Vite开发proxy不进入dist，必须有正式路由。

当前页面导航是App组件useState，不是客户端history路由；刷新回工作台属于既有行为，不新增路由重构。托管目录保留/admin/与资源前缀，入口缓存短或no-cache、带hash静态资源长缓存、API与受控媒体no-store；发布时保留上一版hash资源。Node目前给HTML设置CSP，静态拆分后须在托管/网关重建CSP、nosniff、frame-ancestors等安全头。独立域名备用方案需全面改fetch/XHR/CSV/图片预览、credentials include、精确CORS和Cookie同站策略，成本更高，首期不选。

## 6. 免费/成本核查

核查日2026-10-08，以下来自公开资料，不代表账号已获得资格或报价已锁定。

| 项目 | 已核实 | 不作承诺 |
| --- | --- | --- |
| 免费体验 | 官方定价列每账号1环境、3000点/月、需手动续期；不能加购/按量 | 不等于两个永久免费环境或整套生产免费 |
| PG | 按CPU与存储计量；共享实例以活跃时间窗口计量 | 空库也可能有系统存储消耗；持续连接/健康查询会影响活跃，实测 |
| 云托管 | 按CPU/内存/流量消耗；上海支持 | 免费环境实际可开通规格、固定IP/私网、冷启动需控制台核对；不能套旧微信云托管活动额度 |
| 云存储 | 请求、存储、CDN等计量，共享点池 | 没有为本项目单独核定免费GB/播放次数 |
| 静态托管 | 支持构建产物；容量与流量纳入相应计费 | 旧配额制“1GB”等不自动套到新PG资源点环境 |
| 正式使用 | 付费套餐+超额使用预算 | 无访问量/视频数据，不能给固定月总价 |

[当前定价](https://www.cloudbase.net/pricing)列个人版19.9元/月（限时）、标准版199元/月等。详细[资源点规则](https://cloud.tencent.com/document/product/876/127357)特别注明免费体验环境在小程序发布后到期调整为发布后第15天；不能把“可续6个月”当正式上线持续免费。以实际入口、地域、购买页为准。

[PG用量说明](https://docs.cloudbase.net/database/postgresql/database-management)区分共享实际用量与独享配置时长；[云托管计费](https://docs.cloudbase.net/run/faq/fee)区分微信云托管与CloudBase环境。网上旧函数框架计费/旧配额表与当前资源点有差异，以当前环境账单规则复核，未确认项列为开通前门槛，不编造独立永久免费配额。

成本模型：环境套餐＋超过点池的PG/Node/存储/网关/静态流量＋备份/日志＋域名与必要证书/运营人工；视频代理还增加Node带宽/并发占用。先记录真实文件大小、观看时长和访问量，设置余额、错误率和异常流量告警，再批准超额策略。

## 7. 环境与本地数据库选择

推荐Local PostgreSQL + 独立CloudBase Staging PG + 独立Production PG。Mac本地可用固定主版本容器或受控本地服务，只监听回环、专用数据卷、独立测试库；云上主版本以实际实例核实，开发/CI跟随，不直接把官方页面示例版本当已选版本。本轮不安装。

SQLite保留为只读历史开发档案/回退取证，迁移完成后不继续维护Dev SQLite/Prod PG双写双方言。仅本地SQLite仍会造成锁、JSON、约束、类型差异；双数据库长期验证成本高。正式PG从空应用Schema初始化，不先复制测试SQLite。

只有一个免费资格时：先本地PG+一个staging体验环境；需要云托管/网络能力不在体验范围则批准小额付费staging；正式另建付费production。若预算不能长期双环境，staging按需保留/缩容并独立数据，发布前恢复验证；不得用生产库当测试库或为省钱反复把同一环境改名冒充隔离。体验版小程序构建指向staging，正式构建指向production；若同AppID须域名/令牌缓存按环境隔离，不跨库复制Session。
