# Content Delete & SKU Delete UX — DCR

状态：**Approved for Implementation**。批准人：用户；日期：2026-10-07；依据本轮完整CD-01/CD-02第1—75节指令。基准：b4b95b5b3627c27360709590c32a13256fa05c78，main与GitHub main一致，开始工作区clean。本DCR先于业务代码。无需额外业务决策，不进入SKU-2。

## 引用审查事实

- Content五种kind：product（乐器/文创按category区分）、package、lesson、site、spot。只授权前三种，即四个业务Tab；site/spot拒绝删除。
- 咨询createConsultation接受product/lesson/package/spot，持久引用为consultations.snapshot.id；request只存联系资料和留言，不存contentId，不能按名称或spec判断。所有状态包含closed均阻止被引用内容物理删除。
- 场次真实表为slots，package_ids JSON数组、enrollment.packageId均引用套餐；暂停/报名草稿/下架场次仍是业务记录，不排除。
- 预约bookings.snapshot.id保存完整套餐快照；request.enrollment.packageId保留跟团套餐；request.slotId为意向场次、slot_id为确认后场次，两者均按关联slots检查套餐。所有历史状态计入。changes只引用booking_id，预约已受保护；不删除接待/变更。
- 当前Content允许字段没有其它Content ID关系，首页推荐为highlight及按kind查询，不持久引用特定教学ID。教学可被咨询引用，同样阻止。媒体为Content/SKU向共享media的出向引用，不是阻止删除的业务历史；删除内容不删除media记录或文件，listMedia每次实时计算usedBy。
- audit.object为文本，无到Content的级联外键；保留既有记录并新增content.delete。product_skus有FK但无删除级联，由Service显式删除，只有安全产品删除允许物理删除其SKU。

## CD-01 内容删除

1. product/package/lesson仅draft或archived允许；published返回409 CONTENT_DELETE_REQUIRES_UNPUBLISHED：“已发布内容不能删除，请先下架后再删除。”site/spot返回400 CONTENT_DELETE_UNSUPPORTED；不存在404 CONTENT_NOT_FOUND。
2. 新增GET /api/admin/content/:id/delete-check，沿content权限，返回id/kind/name/state/version/allowed/code/message/references，只有非敏感数量（consultations/sessions/bookings）。点击列表删除先检查；已知引用直接显示不可删除原因，不提供可执行确认按钮。此预检查不是最终授权依据。
3. 新增DELETE /api/admin/content/:id，JSON请求{version:正整数}。不信任kind/state。Service中permit后BEGIN IMMEDIATE，重新读取状态、当前引用，再核对version；引用409 CONTENT_DELETE_REFERENCED；版本409 VERSION_CONFLICT。新引用或重新发布不能绕过检查。未知/非法version400。
4. 有任何咨询、关联场次、预约历史即拒绝，返回类型/数量及真实中文原因，不返回客户/手机/记录详情。当前关系覆盖见上文；异常引用数据无法安全读取时失败关闭，不执行删除。
5. 安全删除产品显式先DELETE其SKU，再DELETE content并audit，全部同一事务；任何失败回滚。不得碰consultations/bookings/slots/changes/media或历史audit。
6. 删除成功200 {ok:true,id}沿既有JSON习惯，审计content.delete记录{id,kind,name,state}（删除前值）；audit-actions映射“删除内容”，raw保留。失败不写成功审计。
7. 四Tab保留“维护 / 预览”复合入口并增加小型Danger文本删除。published显示禁用“删除”及“请先下架”说明。确认采用本地轻量Modal（项目无通用Modal，复用现有色彩/按钮规范），按Tab明确删除对象，不用window.confirm。不可逆确认说明素材不自动删除，默认焦点取消；忙碌防重复/关闭。成功刷新当前列表并role=status提示，失败保留列表及具体原因。

## CD-02 规格删除UX

8. 当前有效维度/值主区只显示enabled=true；按钮“删除维度 / 删除规格值”。SKU行仍启用/停用，身份算法planSkus不改。
9. 首次打开返回的Option/Value ID集合区分持久项。未保存项从Form直接移除，临时候选同步移除；从未写Server的行无需历史。最后Value不允许变为空，提示删除维度。
10. 持久项删除采用enabled=false，确认显示所有受影响当前SKU组合数（包括手动停用行），保留历史身份、Code、价格、图片；结构退出由原diff实现，manual disabled不改原因。无新deleted字段。
11. 删除最后维度提示必须转simple；复用既有恰好1启用SKU、安全确认、先保存启停及历史simple组合冲突保护，不能留下options+0有效维度。没有持久维度的新编辑也遵守有效模式保护。
12. 添加新维度/值输入同名历史项（Trim/大小写不敏感）时，提示恢复；选择恢复移除未保存新占位、启用历史定义、原ID及组合身份复用，取消不新建重复定义。主区不混入已删除项。可保留轻量“已删除规格”入口便于直接恢复，不建复杂回收站。
13. 删除/恢复只修改当前Form，点击“保存内容”才整产品事务提交；关闭不保存无数据库变化。保留version409、3/20/50限制，改名逻辑和SKU手动启停不变。

## 工程范围与验证

NO MIGRATION。白名单：server/content-delete.mjs、service.mjs、http.mjs；admin/src/Content.jsx、ContentDeleteDialog.jsx、content-delete.css、SkuEditor.jsx、sku-editor.css、sku-delete.mjs、audit-actions.mjs；tests/content-delete*.mjs；scripts/content-delete-browser.mjs；scripts/product-sku-browser.mjs（只适配新删除/恢复入口和证据输出目录，不覆盖已验收旧截图）；本目录及治理三文档。必要调整先记录原因，不能扩到业务状态机/其它后台页/游客源码/账号/媒体物理清理。

测试覆盖四类安全删除、published/引用/权限/版本与晚到引用拒绝、SKU同事务清理/审计回滚、各媒体usedBy及文件保留；规格草稿移除/持久软删除/同名恢复/ID与差异资料/最后项保护/取消无写入/version409；全94既有Node测试及SKU浏览器回归，八后台页、Build/Type Check、25原件、diff check。真实Chrome、临时SQLite及媒体；Browser插件不可用，沿现有Playwright。保留7类实际截图、报告和JSON证据；共享SQLite/WAL/媒体文件前后hash核对。正常独立Commit推main，clean且三方HEAD一致才READY FOR HUMAN ACCEPTANCE，不部署。
