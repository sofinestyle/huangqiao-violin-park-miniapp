# 部署实施建议与发布流程

本文件只有两个建议实施阶段，均未启动。当前仅审计文档允许提交推送；GitHub push不等于部署授权。

## 1. Local / Staging / Production

推荐三环境PG同主版本、同初始Schema/迁移链，固定驱动版本。Local先隔离测试库；Staging独立云环境和合成资料；Production新空应用库与正式人工录入，不复制SQLite测试库。SQLite原库、媒体和受保护原件保留，迁移结束后归档，禁止双写权威体系。

正式PG自带平台auth/storage等系统对象，“空库”指本项目业务Schema为空，绝不是DROP DATABASE清除平台对象。SQLite的13表不能理解为PG整个实例只应存在13表。

## 2. Deployment Phase 1：PostgreSQL + Server + Storage适配

批准后先建立DCR/PG契约，冻结表类型、并发锁顺序、应用与迁移角色、存储补偿、错误映射和API兼容方式；再实施标准pg异步访问层、PG初始Migration、生产环境校验、私有媒体适配、账号初始化和安全配置。

包含：所有Service/HTTP/helper/audit的await、JSON/NUMERIC/BIGINT/时间序列化、预约容量及Content删除竞态、幂等、最后管理员；保留SKU稳定身份与50组合上限。生产不自动Seed/建管理员；正式isTest规则受环境控制，不把开发资料批量改false。建立镜像、同源Admin路由配置和最小日志/健康。备份恢复工具与PG/对象联合清单同步设计。

阶段验收：本地真实PG空库/幂等Migration/失败回滚；全部原测试迁移与新并发两连接测试；Schema约束、SKU1/2、CD、ABI回归；PG权限入口测试；对象适配与补偿隔离测试；构建/类型检查/原件校验。不能用SQLite继续通过代替PG通过。

实际云资源开通须另行批准环境、地域、套餐与预算；本阶段技术建议不授予自动采购权。若DDL/私网/Storage能力无法满足冻结规则，提出具体CR而非偷偷重写业务。

## 3. Deployment Phase 2：Staging验证 + 正式初始化 + 微信发布准备

先在获批上海Staging验证：标准pg私网/TLS/DDL路径、至少两个容器实例并发容量、部署重叠连接预算、限流、Cookie/CSRF、自动REST绕过防护、上传/播放Range、PG+对象恢复、日志告警与真实微信身份。小程序体验版指向Staging，以合成资料跑预约人工确认、SKU咨询、教学播放完整闭环；Admin八页与媒体/SKU历史保持。记录实际费用和冷启动/超时，不用本地证据替代。

通过后经人工批准正式初始化：

1. 创建独立Production PG模式环境，保留平台系统Schema；执行已验证的PG初始Migration及后续获批迁移。
2. Seed关闭、开发身份关闭、后台首次管理员由一次性安全任务创建；不给运行实例高权限DDL凭据。
3. 审核必要site配置与品牌素材，不复制测试手机号、价格、统计；正式产品/Options/SKU/媒体由工作人员录入和审核发布，维持展示咨询/人工确认定位。
4. 确认正式微信AppID/Secret、HTTPS/合法域名、隐私及运营资料、备份计划和责任人；域名/备案/平台审核条件由公司账号核实，不在本次审计代办。
5. 只在正式配置的体验验证通过后提交微信审核；审核与发布仍人工。未获批准不得用自动化把main直接变为正式公开版本。

本阶段不要求先把SQLite搬到PG再清理；本地Reset继续只用于临时测试，不适用于Production。Production初始化不包含测试content/SKU/bookings/consultations/slots/changes/media/audit/visitors/session/idempotency导入。

## 4. 最简流水线

`GitHub main → 测试 → 构建 → Server候选版本 → Admin候选产物 → 小程序体验上传 → 人工验收/审核/发布`。

| 步骤 | 可自动化 | 人工控制 |
| --- | --- | --- |
| CI | 锁文件安装、PG临时库测试、类型检查、Build、原件/敏感文件扫描 | 失败不部署 |
| 制品 | 固定commit构建Server镜像、Admin dist、小程序产物；保存摘要/清单 | 生产配置与依赖版本审阅 |
| Schema | 检查迁移状态/差异、Staging自动演练 | Production迁移及备份确认，独立迁移身份 |
| Server | 上传候选/健康/烟测/有限流量 | 批准后推广，不随每次push无门禁上线 |
| Admin | 静态产物版本发布与缓存刷新 | 与Server契约一致，同源路由/Cookie验证 |
| 微信 | 获准后可自动上传体验包、生成测试说明 | 企业负责人真机验收、提交审核、正式发布 |

只有通过测试才构建发布；Secret用CI受保护环境变量，不放日志或工件。当前仓库没有现成生产工作流，本轮未新增。CloudBase[现有服务迁移](https://docs.cloudbase.net/run/best-practice/migration)支持无状态容器和标准输出，不能把平台能力当项目已配置完成。

## 5. 回滚

- Server：保留上一版本镜像/配置清单，健康或业务失败切回流量；在途请求和重复提交由幂等保护，先核对Schema向后兼容。[CloudBase灰度](https://docs.cloudbase.net/run/deploy/deploy/gray-release)。
- Admin：切回上个静态版本，保留旧hash文件避免缓存HTML引用404；API不能要求同步刷新才可用。
- Database：优先向前修复/兼容扩展；破坏性down不得跟代码回滚自动执行。迁移破坏时由备份恢复到新库、评估恢复点后新增数据，再人工切换；不能为回退代码丢掉已提交预约/咨询。
- 小程序：按微信平台允许的版本处置/修复发布流程执行，不能承诺像容器即时回滚；已安装旧客户端不会立即消失，Server须维持发布窗口协议兼容。实际微信回退能力待企业账号核对。
- Media：保留稳定media ID/key和上一版访问契约，不随Server/Content回滚删除对象；带时效链接/缓存若未来采用须纳入回滚测试。

## 6. 上线前放行证据

| 门槛 | 本次状态 |
| --- | --- |
| 架构/SQL/13表/安全/媒体/备份审计 | 已完成只读分析 |
| PG运行与两连接/多实例并发 | 未执行 |
| CloudBase DDL角色、内网/TLS/存储/路由 | 未执行，无环境 |
| PG/对象联合恢复演练、RPO/RTO | 未执行 |
| 正式微信身份、手机、HTTPS | 未执行 |
| 套餐购买页、实际资格/额度/账单 | 未执行，仅官方公开资料 |
| 正式资料、管理员、运营/隐私批准 | 未执行 |
| 生产部署/微信上传审核发布 | 未执行 |

审计完成不等于可直接上线；正式实施无需再拆成多个小Phase，但上述放行点不能因只分两阶段而省略。
