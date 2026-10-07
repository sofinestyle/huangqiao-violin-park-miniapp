# Admin Business Improvement Phase 1 — ACCEPTANCE

状态：**READY FOR HUMAN ACCEPTANCE**，工程/隔离验证已完成，等待人工验收。未执行生产部署或正式发布，未进入下一阶段。

## 基准与正式Diff

- Admin UI V1.0 Baseline：344bf440ce52d2932f91c2375b51be752cb5bc22。
- Pre-ABI Baseline：6181efab945a5ed792f97ba00b9b6b21eee6fe30，原登录黑体及DEC062三份记录单独提交并推送后，main与origin/main一致、clean。
- Migration Commit：12149a4fa5de460b62cc648603d4d3860d4bd9f4；DCR先于代码建立并随独立Migration保存。
- Implementation Commit：承载本文件的`feat(admin): implement seven approved business improvements`提交；完整SHA在最终交付及Git中记录，避免自引用SHA。
- 正式验收仅计算`git diff 6181efab945a5ed792f97ba00b9b6b21eee6fe30 <Implementation Commit>`，包含独立Migration及业务实现；此前登录字体变化不混入。

## 七项完成

ABI-01 closed咨询不再有指派/跟进/结束入口，原服务端拒绝、详情/联系方式/历史不变。ABI-02 CSV共享列表筛选且全匹配范围导出，独立权限与CSV格式保留。ABI-03创建active真实生效。ABI-04按密码/角色集合/active实质变化撤销目标全部会话，canExport-only实时授权且不撤销。ABI-05同步ref防重、忙碌禁关闭/离开、保存中/aria-busy、失败保留真实错误/重试、成功原关闭刷新及焦点返回。ABI-06 SQL分页和过滤、真实distinct选项、稳定排序/total与三索引。ABI-07集中中文+原action展示、未知raw fallback及raw筛选。

## API及兼容边界

| Endpoint | 变化 | 兼容性 |
|---|---|---|
| GET /api/admin/export | 原kind加可选q/state/unassigned/enrollment（enrollment只在预约UI出现）；复用列表语义 | Backward Compatible；无筛选全部授权记录，原CSV字段/BOM/转义不动 |
| POST /api/admin/accounts | active省略默认true，布尔值生效；响应附带active | Backward Compatible扩展/批准缺陷修复 |
| PUT /api/admin/accounts/:id | 请求/响应原格式；实质敏感变化才撤销会话 | 批准行为修正，不新增角色/权限 |
| GET /api/admin/audit | page默认1,pageSize默认50/仅20,50,100,max100；from/to带时区ISO转UTC并inclusive；actor/action精确；排序created_at DESC,id DESC | 显式参数返回{items,total,page,pageSize}；无参数保留旧数组与X-Total-Count，窗口变为有界50，明确的分页行为调整；仅Admin消费者同步升级，无未经批准结构Breaking Change |
| GET /api/admin/audit/options | 新增，admin-only；{actions:[raw],actors:[{id,name}]}来自真实distinct | 新增兼容Endpoint |

分页示例：`GET /api/admin/audit?page=2&pageSize=20&action=booking.confirm&from=2025-01-01T00%3A01%3A00.000Z&to=2025-01-01T00%3A02%3A00.000Z`返回`{items:[原id/actor/action/object/detail/created_at/actor_name],total:91,page:2,pageSize:20}`（91为此次合成数据结果，非正式数据）。actor可附带精确ID；重复/未知参数、非法page/pageSize、坏时间/反向范围、过长actor/action均400。

## 文件范围

server：db新增Migration调用，004独立索引及rollback，audit-query分页/选项，security创建active，http账号会话/CSV/audit。
Admin：Operations终态和导出；Accounts忙碌和原生pattern等价转义；App/AdminUI仅账号保存离开保护；独立Audit和集中audit-actions；admin-phase-2b.css仅必要审计控件，使用原v1.0 tokens。
测试：两份新*.test.mjs、临时真实服务fixture、scripts/admin-business-check.mjs。
治理：本目录DCR/BUSINESS_RULES/TEST_REPORT/ACCEPTANCE、两份验证JSON、六张实际截图、DEC063对应三份治理记录。

## 工程 / Design QA / 冻结

Build、Type Check、71 Node测试、9浏览器检查组、25原件、八后台菜单及登录退出PASS；见[测试报告](TEST_REPORT.md)、[浏览器原始证据](browser-verification.json)、[性能证据](performance-verification.json)。代码Diff确认游客端、原Service状态机、媒体实现、角色/密码规则、CSV字段定义、原历史Migration、原57项测试及视觉SSOT不变。只追加索引/迁移版本记录，不改历史审计行/action。没有为了视觉添加字段、状态、筛选类型或权限。

实际检查1440母版及1280/1728账号/审计：原暖白/深棕/系统无衬线、Sidebar/Header/表格与Drawer规则延续；新筛选/分页继承原控件和focus；咨询已结束详情清楚只读；中文动作保留raw、JSON不省略。没有重新设计后台或进入UI新阶段。自动检查只提交人工验收，不代替人工作出最终视觉/业务批准。

## 实际截图

1. [closed咨询](01-consultation-closed.png)：只读联系方式/历史，无三项操作。
2. [预约筛选及导出](02-reservation-filtered-export.png)：搜索+待确认+未指派+跟团；实际下载独立断言。
3. [创建停用账号](03-account-create-disabled.png)：默认勾选取消，随机合成密码遮蔽。
4. [保存中](04-account-saving.png)：保存中、X/Sidebar/用户/重复提交保护。
5. [审计筛选分页](05-audit-filter-pagination.png)：1440宽全页面，含筛选和第二页范围21—40/91。
6. [中文action及raw/JSON](06-audit-action-label.png)。

## 隔离、安全与限制

全部写测试临时SQLite/上传目录，随机本地服务、合成客户/账号，未修改真实管理员、共享业务库或正式审计。**共享业务数据影响 = NO**。权限矩阵未发现扩大。测试仅Chrome，不含生产/正式资料/微信真机/完整无障碍/极端压力/共享库迁移。活跃新增日志时跨请求OFFSET页可移动；distinct元数据随真实actor/action集合增长；账号重名仍沿原500真实错误处理；canExport按钮UI快照需刷新同步，服务端权限立即生效。共享服务未重启/迁移，新后端通过临时服务实际验证；正式接入/升级属于后续受控启动，不宣称已部署。

## Git与停止边界

main正常提交推送，不force/rebase/squash/amend；最终Local HEAD/origin/main/GitHub main及clean结果在交付工具输出核实。Admin Business Improvement Phase 1七项批准业务改进已完成，等待人工验收。未执行生产部署或正式发布；本轮停止，不自动进入下一阶段。
