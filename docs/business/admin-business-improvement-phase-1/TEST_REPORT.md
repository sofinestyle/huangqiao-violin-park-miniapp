# Admin Business Improvement Phase 1 — TEST REPORT

日期2026-10-07，操作者Codex；正式Diff基准6181efab945a5ed792f97ba00b9b6b21eee6fe30，视觉基准344bf440ce52d2932f91c2375b51be752cb5bc22。Node26.3.1 / SQLite / React19.2 / Vite7.1.7；实际Chrome154.0.8037.99，时区Asia/Shanghai，1440×900母版；1280/1728桌面另检账号与审计布局。Browser plugin not available，使用已存在Playwright运行时，未安装新依赖。

## 结果与可重跑命令

`npm test`：71/71 PASS，Failed0、Skipped0。原有57项完全保留；新增14项（13业务/安全/分页/映射 + 1Migration）。`node scripts/admin-business-check.mjs`：9/9实际浏览器自动检查组PASS，Failed0、Skipped0。合计80个执行单元，明确区分71个Node测试与9组浏览器场景，不把场景内断言重复计数。外部Playwright可用PLAYWRIGHT_MODULE指向安装位置；浏览器脚本先要求已运行`npm run build`。

`npm run build`、`npm run typecheck`、`python3 scripts/verify_originals.py`、`git diff --check`：PASS；原件25份大小/SHA-256一致。全后台8菜单、Login/Logout、Dashboard/Content/Sessions/Reservations/Consultations/Media/Accounts/Audit、Sidebar均PASS；完整JSON阅读、真实CSV下载、状态与表单实际渲染通过，无白屏或框架覆盖层。

## 逐项自动覆盖

| ABI | Node/HTTP/SQL覆盖 | 实际浏览器覆盖 | 结果 |
|---|---|---|---|
| 01 | pending/following的assign/followup/close合法；closed三动作409且记录不变 | closed无三按钮，联系/历史保留；pending/following按钮保留 | PASS |
| 02 | 预约q/state/unassigned/enrollment、咨询q/state/unassigned，组合/空/无筛选；结果ID与真实列表逐一一致；BOM/CSV列/CRLF/公式转义保留；admin/content/reception/anonymous与独立授权/撤权 | 两列表真实筛选、请求参数检查、实际文件下载并检查ID | PASS |
| 03 | active true/false/省略默认true、非法类型拒绝；停用登录/有效会话拒绝，启用后可登录且旧会话不复活 | 默认勾选→取消→真实POST→列表停用；原生非法账号名称校验 | PASS |
| 04 | 密码变化和角色变化删除多个目标sessions；停用/启用旧会话无效；canExport-only/角色重排/no-op保留；授权即时决定CSV403/200；最后管理员拒绝 | 沿用账号真实保存，安全矩阵在真实HTTP测试覆盖 | PASS |
| 05 | 服务端真实成功/重名失败供浏览器验证，未Mock结果 | 请求gate延迟后X/Escape/背景/账号入口/Sidebar/用户菜单均不离开，两个额外submit仅产生1次PUT；aria-busy/保存中Disabled；真实失败保留/报错/重试，成功关闭、焦点返回 | PASS |
| 06 | 1225条总日志/1205条合成记录；完整25页每个ID恰好一次，时间/id倒序稳定；20/50/100；from/to inclusive、actor/action精确、组合/空/超页/默认/旧数组；非法/重复/过大/反向参数400；admin-only options；三索引EXPLAIN及Migration回滚/重跑/日志保留 | 50→20、前后页/范围/total，真实筛选actor/action/时间，原生输入转UTC、反向错误、重置、第二页截图 | PASS |
| 07 | 主要已知中文，普通及Object原型同名未知raw fallback，不修改映射 | 中文及raw同时显示，中文选项提交raw，未知显示raw，完整JSON与数据库值保持 | PASS |

## 安全矩阵

| 身份 | Audit / options / Accounts | CSV | 原角色范围 |
|---|---|---|---|
| admin | 200 | canExport=true才200，false403 | 管理角色不变 |
| content | 403 | 即使canExport=true仍403 | 内容权限不扩大 |
| reception | 403 | canExport=true200，false403 | 原接待权限保留 |
| anonymous | 401 | 401 | 无后台访问 |

密码规则仍12—256字符+scrypt。密码重置/roles实质变化/active变化会话失效，启用不恢复旧会话；canExport单独变化会话仍有效，但每个请求从accounts即时读取新授权，测试grant/revoke真实CSV结果变化。未发现权限扩大。账号创建/编辑字段、角色定义、最后一个active管理员保护不变。

## 写隔离

临时目录`os.tmpdir()/admin-business-*`，临时SQLite文件`isolated.sqlite`，原openDatabase/seed/Service/HTTP及编译admin。联系人和手机号均为固定合成资料、密码由randomUUID运行时生成；未读或修改真实管理员，不使用真实客户、共享数据库或正式审计。测试结束关闭HTTP/DB并删除临时目录。

**共享业务数据影响 = NO**。浏览器记录写请求均指向随机本机临时服务；证据JSON只保留路径/方法，无Cookie/Token/密码。延迟通过route.continue送原服务，业务成功和失败都来自真实服务。重名测试引发原UNIQUE失败及500为预期失败，不伪装成功；未登录me401、默认favicon404属于已解释资源响应，无JS运行时错误；HTML pattern v模式原问题已等价修复。

## 审计性能及分页

总1225条，其中1205条合成、20条真实隔离业务/迁移日志。pageSize50，最后第25页25条；全部ID对照SQL稳定排序，无重复或遗漏。下列为同机单次SQL查询（包含COUNT与有界SELECT），不是生产延迟承诺：

| 查询 | 毫秒 | total | 返回条数 |
|---|---:|---:|---:|
| 第一页 | 0.126 | 1225 | 50 |
| 中间第12页 | 0.127 | 1225 | 50 |
| 最后第25页 | 0.159 | 1225 | 25 |
| actor=synthetic-1 | 0.094 | 402 | 50 |
| action=booking.confirm | 0.095 | 607 | 50 |
| 2025-01-01T00:01:00Z至00:02:00Z | 0.111 | 183 | 50 |
| actor+action+上述时间 | 0.103 | 31 | 31 |

三类EXPLAIN使用audit_created_at_id/audit_actor_created_at_id/audit_action_created_at_id，无TEMP B-TREE。数据查询SQL LIMIT/OFFSET，total独立COUNT；不加载全部日志再前端分页。测试全量ID读取仅用于对照断言，不属于生产分页实现。没有发现此测试规模下明显异常退化；未进行百万级或并发压力测试。不同请求期间有新日志写入时OFFSET页可能移动，非跨请求快照；可刷新重新读取，未承诺历史快照式分页。

## Migration与未执行

独立004-admin-audit-indexes，Commit12149a4fa5de460b62cc648603d4d3860d4bd9f4。新增三索引，无字段/数据变更；历史Migration不动。新库/既有日志保留、重复apply、rollback、再apply全部PASS。仅临时库应用，未将迁移写入共享或生产库。

未执行Safari/Firefox/Edge、生产环境及正式资料、微信真机、完整读屏/WCAG审计、极端/并发压力、共享开发库升级与其持续运行进程重启。当前共享开发服务若仍加载旧server模块，使用新审计接口前需受控重启；本轮通过临时服务验证新实现，不为验收写测试修改共享库。canExport按钮基于当前登录UI快照，授权变化后刷新/重新进入登录可同步按钮，服务器即时授权已经验证。
