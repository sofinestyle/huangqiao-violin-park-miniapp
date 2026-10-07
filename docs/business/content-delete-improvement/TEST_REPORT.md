# Content Delete & SKU Delete UX 测试报告

日期：2026-10-07；执行者：Codex。基准b4b95b5b3627c27360709590c32a13256fa05c78。真实React构建、Node HTTP/SQLite、Chrome。所有新增删除/写测试仅使用临时SQLite和隔离媒体目录，不使用共享开发库。

## 工程结果

原94项Node测试全部保留；新增15项，总109，Passed109、Failed0、Skipped0。`npm run build`、`npm run typecheck`、`npm test`、`git diff --check`与25份原件校验通过。NO MIGRATION，Database及历史Migration源文件未改；测试比较sqlite_master确认删除不改变Schema。

## 新增Node覆盖

| 测试组 | 实际验证 | 结果 |
|---|---|---|
| 5项安全删除 | 草稿乐器、下架乐器、草稿文创、无引用研学套餐、教学草稿成功；Product SKU同步删除；创建历史审计及删除审计保留 | PASS |
| 非法状态/类型 | published拒绝、site/spot不开放、不存在404、非法version400，无部分删除 | PASS |
| 咨询历史 | product/文创/lesson/package按snapshot.id识别，包括closed；原快照/记录不变，不泄露电话 | PASS |
| 场次引用 | slots.package_ids与enrollment.packageId分别阻止套餐删除，草稿场次也保留 | PASS |
| 预约引用 | snapshot.id、request.enrollment.packageId、request.slotId、request.enrollment.id、slot_id关联；历史取消预约仍保护 | PASS |
| 并发 | preflight后重新发布409；版本变化409；确认后新咨询、新场次、新预约重新检查拒绝 | PASS |
| 事务 | 模拟content.delete审计插入失败，Content和SKU删除一起回滚；原审计保持 | PASS |
| Media | Product A/B共图、独立SKU图片、套餐图片、教学图片/视频，usedBy逐项归零/保留其它引用，3份媒体记录及实际隔离文件保留 | PASS |
| HTTP权限 | admin/content删除200；reception403；anonymous401；引用409仅返回数量；不存在404 | PASS |
| 草稿与持久定义 | 未保存Option/Value物理移出本地结构，持久项enabled=false且不变更原输入对象 | PASS |
| 历史识别 | Trim及大小写不敏感同名检测，找回原Option/Value ID | PASS |

入口：tests/content-delete.test.mjs。原SKU Phase 1测试继续覆盖改名、10→20、值停用恢复、手动停用、simple/options、50组合、Version、事务及Media；未放宽原断言。游客现有列表/详情宿主兼容测试保留，不能视为微信原生或真机验证。

## 浏览器真实流程

Browser插件不可用，按frontend-testing-debugging使用项目既有Playwright和Chrome，无新增依赖。先构建，再运行`scripts/content-delete-browser.mjs`；全部使用独立临时数据库/上传路径和合成资料。

12组CD流程全部PASS：四Tab删除与成功刷新/发布禁用/取消；已知历史引用无可执行删除确认；确认后发布或新增咨询拦截；临时维度/值及临时候选移除；持久维度删除确认影响10项并取消编辑无写；Value删除影响5项、保留manual原因和差异资料；同名Value恢复原Value及10SKU ID；同名Option恢复原结构及参考价/图片；最后Value及最后Option保护；规格删除保存version409；Content删除忙碌防重复/Escape关闭保护；Audit中文/raw与八后台页。

SKU Phase 1浏览器回归另外14组PASS，包含10→20、改名、批量/图片/上传、模式、50SKU、version、busy、文创12SKU及八页/登录退出；另1条50SKU计时记录，不计作第15组功能测试。脚本只适配新删除/恢复入口并增加证据目录参数，原SKU-1截图未覆盖。

本轮截图1440×1100；SKU回归另测1280/1728。无JS运行时错误、无框架错误覆盖。预期网络错误为未登录me401、故意400/409、favicon404；完整日志保存在JSON，不将故意失败用例误报为运行故障。测试脚本初次出现异步列表等待、无障碍名称及URL类型定位问题，已修正后完整重跑；最终结果按成功完整运行计。

## UI和数据证据

01—07为用户要求截图；08补充恢复后10行和手动停用仍保持的结果，与07恢复提示形成前后证据。删除入口采用低饱和Danger文本，确认使用现有品牌体系；操作列局部加宽避免行高增加。规格确认默认聚焦取消，确认期间禁用相关控件与保存；保留单SKU启停术语。已删除定义折叠，不混入主要有效结构。

共享数据：实施前39份.local文件建立SHA-256核对（排除SQLite共享内存缓存）。最终38份文件一致，其中36份为非日志文件，包含数据库/WAL及媒体；唯一变化为运行中的Vite热更新日志admin-runtime.log，未提交。共享数据库删除内容=NO、共享业务数据影响=NO。所有原始业务文件25份一致。

## 未执行与范围限制

未执行Safari/Firefox、微信开发者工具原生渲染/真机、完整无障碍审计、长期压力测试、生产或共享库删除演练、共享开发服务重启、生产部署/正式发布。没有媒体清理、Content回收站、全局引用关系平台或SKU-2。

历史引用阻止物理删除属于批准行为；内容删除不可通过普通后台恢复。持久Option/Value删除为Soft Delete并保留身份；删除最后维度必须满足既有单规格转换条件。未来如新增Content关系字段，应扩展明确引用检查，当前检查以本次审查真实关系为准。
