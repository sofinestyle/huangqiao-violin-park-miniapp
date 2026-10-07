# Admin Business Improvement Phase 1 — DCR

状态：**Approved for Implementation**。批准人：用户；日期：2026-10-07；依据：本轮七项完整业务指令及“七项业务改进授权继续有效，必须先建立正式DCR”确认。本文先于实施代码建立。

视觉基准：344bf440ce52d2932f91c2375b51be752cb5bc22。正式实施基准：6181efab945a5ed792f97ba00b9b6b21eee6fe30；main 与 origin/main 一致且 clean。基准内仅有此前登录字体和 DEC062 治理记录，验收 Diff 为此基准至最终 Implementation Commit。

## 影响分析与批准规则

| 编号 | 问题及现状 | 批准目标 / 影响范围 | API / 数据库 / 安全 / 兼容性 |
|---|---|---|---|
| ABI-01 | closed 咨询仍有指派、跟进入口，服务端已拒绝 | Operations 只隐藏 closed 的处理区和操作 Footer，详情、历史、联系方式保留 | 无 API/Schema 变化；原服务端状态保护保留 |
| ABI-02 | export 未传列表筛选 | 列表与 CSV 共享 q/state/unassigned，预约额外 enrollment；全匹配范围导出，按钮“导出当前结果” | GET export 增加可选现有筛选参数，复用 adminRecords；无参数保持全量授权导出；字段/BOM/转义不变，canExport 与 reception 权限保留 |
| ABI-03 | createAccount 固定 active=1 | active 默认 true，布尔 false 创建停用账号；后续可启用 | 已有 active 列，不新增字段；新增响应 active 为兼容扩展；停用登录及认证原保护保留 |
| ABI-04 | PUT account 无条件删 session | 密码重置、角色集合实质变化、active 变化才删全部目标 admin sessions；canExport-only/no-op 不删 | 请求格式不变；每次认证重新读取当前数据库权限，canExport 立即生效；角色顺序变化不视为权限变化；密码重置即失效，最后管理员保护不变 |
| ABI-05 | 保存时 Drawer 可关闭、重复提交 | ref 同步提交锁，closeDisabled/aria-busy/保存中…，失败保留；禁用账号入口、Sidebar/用户菜单离开入口；保存完成恢复 | 仅受控账号忙碌状态传递 Accounts→App；不改变鉴权/路由/其他 Drawer；浏览器关闭使用 beforeunload 提示，不能宣称强制阻止浏览器退出 |
| ABI-06 | audit 无索引、最近500条数组 | SQL COUNT + LIMIT/OFFSET；page 默认1，pageSize 默认50且仅20/50/100；created_at DESC,id DESC；精确 actor/action；from/to 均 inclusive | 显式查询参数返回 {items,total,page,pageSize}；无参数保留旧数组结构，仍以50条有界返回并提供 X-Total-Count；新增 admin-only GET audit/options 返回真实 distinct actions/actors；非法参数400；时间须带时区 ISO8601，转 UTC，UI 用原生 datetime-local |
| ABI-07 | 原始 action 难阅读 | 集中显示映射；中文+原始代码；未知直接原始；筛选中文/raw API | 不修改数据库 action、历史记录或 JSON；只有展示变化 |

## Migration

实际表为 audit，目前没有 created_at/actor/action 查询索引。新增独立 004-admin-audit-indexes：三个索引 audit_created_at_id、audit_actor_created_at_id、audit_action_created_at_id，均后接 created_at DESC,id DESC。只新增索引和迁移版本记录，不新增列、不修改数据、历史 Migration 不动。启动自动幂等 apply；提供显式 rollback 仅删除该三个索引/版本4记录。测试空库、既有日志保留、重复启动、rollback/reapply、EXPLAIN 查询计划。Migration 单独 Commit，随后业务 Implementation Commit；不手工改生产数据库。

## 修改文件白名单

server/db.mjs；server/migrations/004-admin-audit-indexes.mjs；server/audit-query.mjs；server/security.mjs；server/http.mjs；admin/src/Operations.jsx；admin/src/Accounts.jsx；admin/src/Audit.jsx；admin/src/audit-actions.mjs；admin/src/App.jsx；admin/src/AdminUI.jsx；admin/src/admin-phase-2b.css；tests/admin-business*.mjs；scripts/admin-business-check.mjs；本目录文档/实际截图；docs/决策与变更记录.md、待确认事项.md、验收清单.md。必要扩展必须先记录理由。禁止顺带全后台视觉改造、游客端或状态机改造。

## 测试与隔离

原测试全量回归；新增 ABI 逐项服务/HTTP自动测试、账号忙碌实际浏览器自动测试；admin/content/reception/anonymous 权限矩阵、多个 session 失效、最后管理员、导出即时撤权。审计至少1200条合成日志，全部分页遍历、边界、组合筛选、非法参数、空结果、性能和 EXPLAIN。所有写测试使用临时 SQLite、随机合成账号密码、合成联系人，不访问共享业务库、真实管理员或真实客户。实际 Chrome 页面检查八个菜单、登录退出、运行时错误；六张证据截图不含凭据或隐私。Build、typecheck、25份原件校验。通过不代表生产/真机/人工验收。

## 回滚及冻结

回滚应用到 Pre-ABI Baseline 的另一个正常提交，不重写历史；索引可保留供旧版本使用，必要时由受控 rollback 删除索引。账号状态/权限修改的测试只发生在临时库，无正式业务数据要恢复。保持游客端、媒体业务、预约/场次/咨询状态机、角色、密码规则、CSV字段及审计历史不变。无未经批准 Breaking Change；旧 audit 无参数消费者仍得到数组，但最近窗口由500收敛至有界50，已明确记录此分页行为调整。禁止 force push/rebase/squash/amend。

## 实施验证补充（2026-10-07）

实际 Chrome 154 发现原账号 pattern 中短横线未按 HTML pattern 的 v 模式转义，导致原生格式校验失效并产生控制台错误。ABI-03/05 同一账号表单内作等价转义修复，允许字符和服务端规则均不变；增加非法名称原生校验验证，不扩大业务范围。
