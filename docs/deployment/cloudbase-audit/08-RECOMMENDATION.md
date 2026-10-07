# 最终推荐与审计结论

**推荐：上海CloudBase PG模式 + PostgreSQL标准pg连接 + CloudBase云托管Node + 私有云存储 + 同源HTTP网关下React Admin静态托管；小程序保留wx.request。** 三环境最终统一PG，SQLite保留归档。架构可行性来自源码分析和官方能力资料，尚未经过本项目云端实证，不是“可立即生产部署”。

日期：2026-10-08；Baseline：`7c5f12967f385e1b1d0bb76b2b6231d9b59c6629`；Branch main，开始clean、远端一致。仅新增本目录八份文档，独立审计Commit，正常推送main，不重写已验收历史。

## 结论与不能忽略的前提

| 项目 | 判断 | 主要依据/门槛 |
| --- | --- | --- |
| CloudBase PG | YES | 当前业务13表+JSON+SKU约束适合PG；标准事务；DDL受控通道须验证 |
| Node云托管 | YES | 保留Service边界；云端0.0.0.0/PORT、无状态、异步DB；上海支持而新加坡暂不支持 |
| 云存储 | YES | 私有对象+Node授权Range，不开放桶绕过published/enabled |
| Admin静态托管 | YES | Vite产物适合；正式同源路由/Cookie/CSP必须补齐 |
| wx.request | YES | 保留已实现API/Session，配置正式HTTPS和微信身份 |
| callContainer立即替换 | NO | 无必要为数据库迁移扩大调用链改造，平台私有链路优点可后续按用量评估 |
| SQLite直接上传生产 | NO | 新PG空业务Schema初始化；测试数据不进入正式环境 |
| Dev SQLite / Prod PG长期双轨 | NO | SQL/事务/类型差异造成双套维护和假通过 |

官方确认服务端可用[pg协议直连](https://docs.cloudbase.net/database/postgresql/connecting-to-postgresql)。当前源码最大障碍不是“表太多”，而是同步调用与SQLite串行写的隐含保障。产品资料强制isTest、APP_ENV硬拦截、默认Seed/开发身份、localhost Origin及非Secure Cookie也都必须生产化，不能只换连接字符串。

## 工作量（相对等级，不是工时承诺）

| 模块 | 等级 | 主要工作 |
| --- | --- | --- |
| Database | High | 13表新PG基线、JSON/布尔/金额/时间、SKU唯一、DDL权限、迁移及类型适配 |
| Server | High | 97处prepare、异步调用传播、tx client、跨入口锁/幂等/版本，启动生产化 |
| Media | High | 本地文件→私有对象、流式上传/Range、失败补偿、动态公开权限、联合恢复 |
| Mini Program | Medium | 环境化HTTPS、真实wx.login闭环、Token隔离、真机图/视频；不重做SKU UI |
| Admin | Medium | 静态托管/同源路由/安全头/Cookie、正式资料标记、八页回归 |
| Auth | Medium | 微信代码已有；upsert、生产禁开发、分布式限流、最小授权和账号初始化 |
| Backup | High | SQLite复制替换成PG/对象一致恢复点、调度/保留链/演练 |
| Deployment | Medium | 镜像、配置、两云环境、流水线/人工门禁/回滚 |
| Tests | High | 同步fixture改PG、两连接多实例竞争、云媒体/微信/恢复和全链路 |

最大风险排序：①容量与删除引用并发遗漏入口；②异步事务提前提交或混用pool client；③Node外的自动REST/公开桶绕过授权；④文件与DB恢复点不一致；⑤类型序列化改变价格/日期/历史快照。每项在02—07给出方案和必须验证的场景。

## 费用判断

免费体验适合能力核对，不是生产长期免费承诺。[官方定价](https://www.cloudbase.net/pricing)提供1个免费环境和3000点/月；付费套餐按实际购买页与超额规则预算。生产成本取决于Node常驻/扩容、PG活跃、视频带宽、备份与日志；不能承诺19.9元覆盖整套系统。地域/新旧计费页有差异，详见[03成本核查](03-CLOUDBASE_ARCHITECTURE.md)。本轮没有购买、没有产生云使用账单。

## 两个后续阶段

1. **Deployment Phase 1：PostgreSQL + Server + Storage适配。** DCR/契约→异步数据库/事务锁→媒体/生产安全→本地PG自动测试及容器制品。
2. **Deployment Phase 2：Staging验证 + 正式初始化 + 微信发布准备。** 获批资源后云端闭环/恢复/真机→空正式业务库建Schema/管理员→正式人工录入→人工审核发布门禁。

本次不给上述阶段自动执行授权，也不创建环境。

## 文档与验证

- [01 当前架构](01-CURRENT_ARCHITECTURE.md)：基线、运行配置、源码与本地健康事实。
- [02 SQLite→PG](02-SQLITE_TO_POSTGRESQL.md)：全13表及内部表DDL、索引、SQL扫描、JSON/约束、锁/异步/迁移/连接池。
- [03 CloudBase架构](03-CLOUDBASE_ARCHITECTURE.md)：YES/NO选型、地域、三环境、Admin/小程序路径、费用。
- [04 媒体](04-MEDIA_STORAGE.md)：私有存储、media ID、Range、权限与补偿。
- [05 身份安全](05-AUTH_AND_SECURITY.md)：微信真实链路、Cookie、RBAC、PG额外入口、健康/日志。
- [06 备份恢复](06-BACKUP_RECOVERY.md)：3天/每周/30天规则、改善建议、共同恢复点与演练。
- [07 部署计划](07-DEPLOYMENT_PLAN.md)：两个阶段、正式初始化、流水线和回滚。
- 本文件：结论、工作量及未执行边界。

实际检查：初始Git clean及远端HEAD、当前Schema只读查询、全仓关键词扫描、健康接口GET、25原件SHA校验、文档链接及diff检查。未运行Build/Node/微信/浏览器回归，因为仅增加文档；上一阶段测试通过不能当作PG迁移通过。未读取敏感凭据，未进行数据修改或备份恢复；未验证云端私网/DDL/资源限额/账单/正式微信/域名/真机。

本阶段仅完成部署架构审计，未修改业务代码，未创建CloudBase资源，未清理SQLite，未执行部署或微信发布。
