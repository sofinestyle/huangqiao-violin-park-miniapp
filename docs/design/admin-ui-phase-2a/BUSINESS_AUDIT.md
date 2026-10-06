# Phase 2A 实施前业务结构审计与白名单

日期：2026年10月7日；依据：用户本轮完整两份指令、当前源码与业务文档。已核对本地main、origin/main及GitHub main均为b6339129600f0c29869c222e44f038b9a2b6d59b，起始工作区clean；无新worktree。该版本已获用户明确人工视觉批准，Admin Design System v1.0正式成为后台SSOT。

读取：AGENTS、Admin Design System、Phase 1验收、游客端Design System/UI计划/项目Skill、当前功能说明、Operations/App/ui/API、shared状态、server/http/service/security及直接相关business/enrollment/preferred-time/round1测试。历史游客端/首页冻结继续保护；最新后台Phase 2A明确授权优先，不扩大到其他阶段。

## 三页现状（先审计，后修改代码）

| 审计项 | 场次管理 | 研学预约 | 咨询管理 |
| --- | --- | --- | --- |
| 1 入口 | Sidebar slots，工作台配置场次 | Sidebar bookings，工作台指标/待办 | Sidebar consultations，工作台指标/待办 |
| 2 角色 | admin/reception | admin/reception | admin/reception |
| 3 数据 | GET slots、packages | GET bookings?q/state/unassigned/enrollment、staff、slots；单条GET bookings/id | GET consultations?q/state/unassigned、staff、slots；单条GET consultations/id |
| 4 列表 | 日期/活动、时段、人数上限、系统外、系统已确认、剩余、跟团发布、接待状态、操作 | 编号、套餐/团队、意向日期、headcount、状态、负责人、操作 | 编号、关联内容/来源、联系人、提交日期、状态、负责人、操作 |
| 5 搜索/筛选 | 无，只有刷新 | q检索编号/联系人/手机号/团队/跟团活动名；state；仅未指派；仅跟团报名 | q检索编号/联系人/手机号；state；仅未指派 |
| 6 状态 | enrollment draft/published/archived显示未发布/已发布/已下架；paused/remaining现有表达式显示已暂停/可申请/已满员；无已结束/关闭新状态 | BOOKING_STATES：待确认、已确认待到访、已完成、已取消、无法接待、未到访 | CONSULTATION_STATES：待处理、跟进中、已结束 |
| 7 动作 | 新增、编辑/发布、保存、刷新 | 查看、指派、跟进、确认、无法接待、到访、完成、未到访、取消、批准/不予变更、授权导出 | 查看、指派、跟进、结束、授权导出 |
| 8 Drawer/Modal | 非模态Drawer，无Modal | 非模态Drawer，无Modal | 非模态Drawer，无Modal |
| 9 创建/编辑 | 原生date/time，容量、系统外人数、套餐、内部说明、报名信息、暂停勾选；原save执行POST/PUT | 由游客创建，后台原act POST action/version/note/slotId/assignee及changeId；读取最新版本后处理 | 由游客创建，后台原act POST assign/followup/close；无后台新建 |
| 10 权限 | permit reception；有效接待身份 | permit reception；名单导出须独立canExport | permit reception；名单导出须独立canExport |
| 11 空状态 | 尚未配置场次 | 无记录/筛选无结果；原仅跟团筛选未纳入空文案判断 | 无记录/筛选无结果 |
| 12 Loading | useRemote与原Loading | useRemote与原Loading | useRemote与原Loading |
| 13 Error | 列表remote.error及保存error；刷新重试 | 列表/详情读取/原act错误；刷新重试 | 列表/详情读取/原act错误；刷新重试 |
| 14 危险操作 | 原表单暂停/恢复、报名发布/下架；事务/版本/容量/关联校验 | 原拒绝/取消/未到访/变更结果；状态、说明、版本及容量校验；没有前端确认弹窗 | 原结束咨询；说明、版本和closed终态校验；没有前端确认弹窗 |
| 15 关联 | 套餐与小程序跟团、已确认接待/系统外人数、容量、审计 | 套餐快照、跟团场次、游客个人记录、变更、容量、负责人、审计 | 内容/规格快照、游客个人记录、负责人、跟进日志、审计 |

## 事实与业务保护判断

场次API已有package_ids，packages请求已存在；预约API已有request.contactName及成人/儿童数。为回答“什么套餐/谁预约”，允许在既有工作人员页面组合这些已有字段；不添加接口或模型，不新增列表完整手机号。完整联系电话及备注继续留在原有详情范围，不改变脱敏/岗位规则。咨询列表可显示已有message的短摘要，完整文本继续详情阅读；不扩大到Dashboard或其他页面。

场次状态不能因为日期过往而自动新增“已结束”。列表保留意向日期语义，不将其误写为已确认接待日期。预约待确认不锁定容量；系统外人数、系统已确认、总人数上限均保留，不能把申请量当占用人数。日期/时间保留原raw date/time与toLocaleDateString/toLocaleString处理，不调整业务时区。

原关闭咨询仍显示指派/跟进控件，服务端拒绝closed后的修改；不在视觉任务修复状态控制。原危险动作没有前端二次确认弹窗，原保护是服务端合法状态/必填说明/版本/事务；本轮不新增流程。负责人或套餐辅助请求的错误目前未独立呈现，记录为原有展示限制，不据此修改请求策略。上述事项不是本轮发现必须修改业务的阻断问题，也不宣称已解决。

## 实施白名单与公共影响

- admin/src/App.jsx：只让三个目标页自行呈现Page Header，现有Sidebar/Header/menu/权限/登录及其他挂载原样。
- admin/src/Operations.jsx：三页展示分组、类名、按钮层级、原数据展示；所有状态控制、处理函数、请求、payload、校验保留。复用既有Drawer可选焦点能力，仍非模态。
- admin/src/admin-phase-2a.css：新增严格.ops-page/.ops-drawer命名空间，引用Phase 1 token，不改其数值。
- docs/ADMIN_DESIGN_SYSTEM.md：只记录用户人工批准与SSOT状态，不重新设计规则。
- docs/决策与变更记录.md、docs/待确认事项.md、docs/验收清单.md：授权、实际证据及待人工验收。
- docs/design/admin-ui-phase-2a/：审计、基准、实际截图、脱敏验证、独立验收文档。

保护：Phase 1 CSS/AdminUI/AdminOverview/Content/login/ui、素材库/账号/审计主体、游客端、Server、Shared、API、数据库、数据/权限/状态机、依赖、原件。只因本次Page Header隐藏旧重复标题，不改公共外壳视觉；局部CSS不能命中Phase 1或其他页。实施后用AST核查处理函数/事件/条件，全部既有测试，隔离实际写操作及Phase 1重新截图比较。

## 验证与证据边界

1280/1440/1728实际Chrome。目标三页及其Drawer截图全部使用独立临时SQLite、原Service/HTTP和明确合成测试资料，不截取当前共享库个人资料。保留真实数据来源与保存/状态机制，成功截图不使用route.fulfill Mock。故障注入仅用于Loading/Error验证并明确标记。Phase 1回归使用当前真实服务，只有原无个人资料的工作台/乐器页面，比较已批准b633912截图与源码/计算样式。
