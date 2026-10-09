# 黄桥乐器文化产业园微信小程序

当前版本为**可运行的本地开发版本**：微信原生 TypeScript 小程序、独立 React 网页后台和持久业务服务同期实现。可以在微信开发者工具模拟器中联调，通过后台维护内容和处理真实保存的测试申请。运行时使用PostgreSQL；本地Development旧开发资料现已恢复，CloudBase Staging可通过统一网关只读对比。正式资料、真实接待、微信真机与Production上线仍须独立验收。

项目目录为 `/Users/aaron/Documents/huangqiao-app`，使用用户已确认的 Documents 位置。需求依据为原《黄桥乐器文化产业园微信小程序需求说明_V1.0_细化稿.docx》及后续用户指令；旧 HTML 仅作视觉参考，冲突以新版需求为准。DOCX、HTML 和23张原始图片全部保留并校验。原教学条目、提琴、文创均为测试资料，正式资料由管理员后续维护和上传。

## 范围与当前能力

底部导航固定为 **首页、乐器、文创、研学、我的**；教学从首页进入。18个注册页面复用产品详情、个人/团体表单及记录详情结构。乐器和文创只展示、咨询、线下成交，栏目列表图片按1∶1显示；没有购物车、支付、物流或库存扣减。研学申请保存后为待确认，由工作人员联系、确认场次、登记到访和完成接待；取消及改期保留原安排直到人工处理。

研学栏目新增“研学报名”：工作人员在场次管理中填写已成团活动并发布，游客查看日期、时段、套餐、集合地点和剩余名额后申请跟团。提交不占名额，人工确认后计入；系统外已成团人数也计入总人数上限。满员活动显示不可报名，暂停或下架后停止新增跟团申请，历史记录保留。当前操作与规则见[CR002](docs/需求变更_CR002.md)。

后台提供工作台、内容维护、场次、预约、咨询、素材库、账号权限和审计。乐器与文创分开维护；乐器包括提琴、吉他、尤克里里、口琴、其他五类。内容页直接上传内容及规格图片，教学页直接上传视频、预览并发布；素材库用于复用与关联核查。内容可保存草稿、预览、发布、下架；视频实际上传、持久保存，并支持分段读取。工作人员分为管理、内容和接待角色，名单导出另行授权。接口实现记录归属、幂等提交、版本冲突检查、容量事务和历史快照，业务数据不存入浏览器临时演示列表。

研学页按已发布资料显示套餐图片、标题、时长、年龄、分项介绍和亲子/单人参考价，直接进入预约表单；参考价缺失时显示“请咨询”。普通/团体申请可自行填写可选意向时间段，跟团沿用活动固定时段。页面按用户附件展示产业统计、预约提示和联系人，但展示批准不等于数字已外部核验、自动优惠或收费规则已实现；申请不计算费用，不生成支付订单。正式资料及运营参数仍按待确认事项审核。

人工反馈变更见[CR001](docs/需求变更_CR001.md)与[CR002](docs/需求变更_CR002.md)。界面已按正式展示要求去除固定测试提示，开发环境和资料性质保持如上，不表示已上线。

2026年10月1日用户报告CR002人工验收通过，对应功能版本`e172de4`；已补记验收并下架独立联调活动，保留场次和操作记录。真机、正式身份、云环境及上线验收仍按现有边界推进。

## 当前 UI/UX 阶段（2026年10月3日）

首页已按人工确认基线 `c927ce6` 保留。其余游客页面已按逐轮指令完成导览、乐器/文创、研学、预约与跟团、教学及“我的”优化，视觉优化版本为 `3fb90fb`；其后完成文档同步，并按用户要求清理无入口的旧点位详情和未注册模板日志页，详见[页面清理记录](docs/页面使用检查与清理_2026-10-03.md)。用户表示“以上已基本完成修改”，本轮转入文档审查与GitHub同步；这不是微信真机或正式上线验收结论。

当前入口请查阅[优化后功能与页面说明](docs/优化后功能与页面说明.md)、[操作说明](docs/本地开发与操作说明.md)、[文档审查与验证汇总](docs/文档审查与优化交付_2026-10-03.md)及[验收清单](docs/验收清单.md)。早期[Design System](docs/DESIGN_SYSTEM.md)和[UI实施计划](docs/UI_UX_REFACTOR_PLAN.md)保留提案历史，页首补充当前状态；具体批准以[决策记录](docs/决策与变更记录.md)为准，未批准范围不自动放开。

GitHub同步代码、文档及已归档验证证据；本机数据库、后台上传素材、凭据和备份不会随Git推送。换电脑后需要单独按备份恢复流程迁移，不能将新克隆仓库视为具有当前后台的全部内容。仓库同步不等于微信上传、云部署或发布。

## 本地Development启动（2026年10月9日更新）

本机已恢复独立PostgreSQL开发实例、旧开发公开资料及本地媒体。打开终端执行 `cd /Users/aaron/Documents/huangqiao-app`，然后执行 `npm run dev` 并保持终端运行。该命令自动启动本地PG、核对现有Migration并启动API和本地后台；无需填写DATABASE_URL。只启动API可用 `npm run dev:server`。本机已安装Node与PostgreSQL 18.4；新电脑首次需安装依赖与PG，Git不包含恢复的数据或凭据。

实际开发数据库为 `127.0.0.1:55433/hq_development`，运行用户 `hq_dev`、Schema `app`；API为 `http://127.0.0.1:8787`，仅绑定回环。原Docker模板的55432端口目前由既有测试实例占用，本次使用独立55433，未修改或停止该实例。非敏感配置单点在 `scripts/local-development/settings.json`；密码自动生成于被Git忽略的权限600本地文件。任何Staging/Production、远程数据库或CloudBase配置都会阻止本地启动。恢复后不创建管理员，不沿用旧管理员密码。

旧SQLite只供离线只读恢复工具使用，API永远读取PostgreSQL。首次明确恢复使用 `npm run dev:recover`，日常不需要重跑；只导入指定内容、关联媒体和兼容SKU，拒绝覆盖已编辑数据，不导入身份或业务历史，也不上传云端。启动命令不会自动导入或重置内容。媒体副本在 `.local/development-runtime/uploads`，原SQLite、`.local/uploads`及`images`完整保留。负责人操作和对比说明见 [LOCAL_DEVELOPMENT_RECOVERY.md](LOCAL_DEVELOPMENT_RECOVERY.md)。

微信开发者工具导入`miniprogram/`；执行一次`npm run mini:prepare`准备Development / Staging编译模式，负责人以后通过顶部下拉菜单切换，并在“我的”页核对环境。单点配置与操作见[MINIAPP_ENVIRONMENT_SWITCH.md](MINIAPP_ENVIRONMENT_SWITCH.md)。`npm run build:mini`生成独立Development包；`APP_ENV=staging MINI_APPID=<已确认AppID> npm run build:mini`生成Staging包，使用同一SSOT网关。Production未批准，构建与release API均阻断；MINI_API_BASE不能覆盖SSOT。手机不能访问电脑回环地址，微信编译/真机、上传和发布仍是独立步骤。

## 验证与备份恢复

```sh
npm run build
npm run build:mini
TEST_DATABASE_URL=<专用本机hq_test_数据库连接> npm test
npm run verify:originals
npm run backup -- backups/manual-001
```

测试通过真实PG随机Schema运行，要求回环地址及`hq_test_`数据库；备份恢复测试创建并删除独立临时测试数据库，需要仅在测试实例授予CREATEDB能力。生产应用账号不需要此权限。

备份使用匹配服务器版本的`pg_dump`，同一快照保存DB及媒体manifest，包含记录数、Migration校验和、对象大小/SHA-256。`PREVIOUS_BACKUP`可指定已验证备份，复用相同对象而不重新下载，生成独立可恢复集合。恢复需`RESTORE_DATABASE_URL`指向**新建空数据库**，`RESTORE_CONFIRM=new-empty-target`后执行`npm run restore -- <备份目录> <新媒体目录>`；非空目标被拒绝，恢复后旧Session失效。

SQLite只读开发归档工具：`node scripts/archive-sqlite.mjs <旧数据目录> <新归档目录> <基准CommitSHA>`。原SQLite Migration移至`scripts/legacy-sqlite/`保留历史；不能用于PG。完整运行配置、备份策略、真实验证及CloudBase后续门槛见[Deployment Phase 1验收](docs/deployment/phase-1/ACCEPTANCE.md)。

## 项目结构与文档

- `miniprogram/`：微信工程及原生页面，原用户模板已单独提交保留。
- `admin/`：工作人员网页后台，React + Vite；构建输出在忽略版本管理的 `admin/dist/`。
- `server/`：Node HTTP、PostgreSQL异步事务、身份权限、Local/CloudBase Storage与备份服务。
- `shared/`：业务状态名称；`tests/`：业务、HTTP、权限、并发和恢复测试。
- `docs/`：[开发计划](docs/开发计划.md)、[待确认事项](docs/待确认事项.md)、[验收清单](docs/验收清单.md)、[技术评估](docs/技术评估.md)、[操作说明](docs/本地开发与操作说明.md)、[初版交付与验证](docs/开发交付与验证_2026-10-01.md)、[CR001修改](docs/需求变更_CR001.md)、[当前CR002跟团报名](docs/需求变更_CR002.md)、[设计核对](docs/design/设计规则与核对.md)、[决策记录](docs/决策与变更记录.md)。

当前批准架构为微信原生、Node容器、PostgreSQL、CloudBase私有Storage和独立静态Admin；本轮仅完成适配和本机验证。云资源、HTTPS、真实微信身份、费用/配额和生产发布须按Phase 2清单另行验证。
