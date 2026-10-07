# Product SKU Phase 1 — DCR

状态：**Approved for Implementation**。批准人：用户；日期：2026-10-07；依据：用户SKU-1完整1—116节指令，已批准RECOMMEND B及本阶段业务规则。本文件先于业务代码建立。

基准：235f864dfcfb213fa1ae1b03935adec6356d194e；main、GitHub main一致；开始工作区clean；25份原件通过。此次最新明确授权替代审计中的长期legacy、人工映射及多阶段建议；只实施SKU-1，SKU-2冻结。

## 契约冻结与内部一致性检查

是否存在需要额外业务决策事项：**NO**。不增加库存、交易、角色、价格业务含义、全局Option平台，不改变50组合上限，不清空共享开发库，不改游客端正式代码，不建长期Legacy体系。普通技术选择如下，详见DATA_MODEL/API_CONTRACT/ADMIN_SPEC/TEST_PLAN。

1. 产品data增加variantModelVersion=2、variantMode=simple/options、options数组；SKU独立表，正式保存不写specs；旧产品只读开发提示，拒绝旧写，无人工迁移编辑器。
2. Option/Value使用统一UUID v4策略（客户端crypto.randomUUID与服务器校验），产品内ID唯一不可移属；新SKU ID仅服务端randomUUID，客户端新行不提供ID。正式响应回填。
3. SKU Code Trim后匹配 `[A-Za-z0-9_-]{1,64}`；SQLite NOCASE全局唯一，停用也占用编码。建议值SKU-加UUID短标识，与标签无关；保存后不重算。Product Code保持原状，缺少唯一约束仅记录风险。
4. Option名称/Value标签Trim、1—40字符；同产品维度名称及同维值标签大小写不敏感不重复（含停用项）；保留ID，不以标签为身份。排序整数0—10000。
5. 最多3个当前启用维度，每维20个启用值，候选笛卡尔积最多50（停用个别SKU不能绕过50组合保护）；options至少1启用维且每维至少1启用值。退役维度/值保留，最多100维记录/每维200值历史的技术请求保护，不扩大当前业务上限。
6. combination_key由服务器按Option ID排序后的ID对JSON生成，product_id+key永久唯一，包含停用组合。simple内部key为[]。同组合恢复原ID。移除的维度/值不物理删除，省略已存在定义请求拒绝，要求enabled=false。
7. 新增维度属于一对多扩展：经Admin确认，将每个原组合的SKU身份与资料绑定新增维度排序第一启用值，其余新建；原10变20时保留10个ID、另增10。不把同一个ID分配给两个组合。移除维度产生的新结构不自动合并旧SKU；旧组合停用保留，新组合新建；恢复原结构按精确key优先找回。该技术规则解决增加维度身份保留要求，不是DELETE ALL。
8. simple→options确认后原SKU复用于首组合；options→simple仅恰好1个启用SKU时允许确认转换并保留其身份，其他停用历史保留。若已有另一个历史simple身份占用固定key，拒绝自动合并并给出明确提示，需恢复原身份后转换。
9. value恢复按原组合找回SKU，默认恢复受该值停用影响的组合；单行此前手动停用仍保留（记录disable_reason=manual/structure）。simple唯一当前SKU必须启用；options全停用允许但警告，不改产品发布。
10. reference_price null继承产品price，0有效；范围沿现有0—1e7有限数。inquiry不暴露有效参考价，reference才有effectiveReferencePrice。不引入币种/成交价。
11. images空继承product images，非空覆盖，最多12URL，复用现MediaUpload。内部usedBy读取SKU，包括停用历史；最小public桥接仅已发布产品启用且有效组合的SKU引用，最终公开策略验收留SKU-2。
12. POST/PUT content整产品事务及version不变；新增SKU只接收无id行；已有SKU必须属于本产品；服务端重新计算diff。审计沿content.create/update增加SKU新增/修改/停用计数，不新增action。
13. public动态specs投影名称按维度/值顺序以“ / ”连接，simple“默认规格”，只投影当前启用组合；description为空，price仅reference时有效价，images为SKU覆盖数组。该投影只读不落库；旧咨询仍以名称提交，不升级skuId协议。
14. Migration005仅建表/索引/版本；不改旧content和业务数据。rollback仅允许SKU表空且无v2产品时执行，防止数据丢失。
15. 开发重建脚本仅接受临时目录下带专用标记的隔离环境，拒绝共享.local/符号链接/非development，不在启动自动reset。新Seed用独立函数生成A—E五组合场景，isTest=true；旧seed仅过渡读取样本，不智能拆旧规格。

## 修改白名单

server/db.mjs；server/migrations/005-product-sku-foundation.mjs；server/product-sku.mjs；server/service.mjs；server/media.mjs；server/http.mjs（仅SKU错误定位字段）；server/sku-seed.mjs；shared/sku-model.mjs；scripts/reset-sku-dev.mjs；tests/product-sku*.mjs；tests/round1.test.mjs与business.test.mjs（改用新产品写契约，原断言保留）；admin/src/Content.jsx、SkuEditor.jsx、sku-editor.css、api.js（错误定位）；scripts/product-sku-browser.mjs；本目录；docs/决策与变更记录.md、待确认事项.md、验收清单.md。若额外必要文件先补理由。游客源码及其它后台主体禁止修改。

## 分阶段提交与验证

Commit A：DCR/模型/契约、Migration/Service/API/媒体内部引用、隔离Seed/reset、Foundation测试。完整npm test/build/typecheck及原件校验通过才提交，再进入Admin实现。Commit B：矩阵/批量/图片/确认交互、浏览器及截图、验收报告。每个提交可启动，A阶段旧Admin仍显示但旧写明确拒绝，B完成新编辑器。禁止force push/rebase/squash/amend历史。最终推main，核对clean及远端。

所有写测试在临时SQLite与隔离媒体目录；不启动共享库的迁移/seed，不清空共享数据。备份恢复在隔离环境实际执行。Browser插件/skill不可用，按前端测试skill使用现有Playwright+Chrome，不安装依赖。

SKU-2遗留：逐维选择、skuId咨询、SKU快照、价格/图片联动、Public媒体完整授权、旧投影退出、开发数据清理及正式初始化准备。SKU-1不报告这些完成。
