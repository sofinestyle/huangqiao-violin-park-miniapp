# Product SKU Phase 2 — DCR

状态：**Approved for Implementation**。确认人：用户；日期：2026-10-07；依据本轮完整SKU-2第1—110节。SKU-1和Content Delete均已由用户明确人工验收。正式Baseline：e7696e64b96db9d5bbe4e23291934160ae7ac762；main、origin/main、GitHub main一致，工作区clean。该基准包含人工验收后的图库、图片上传及素材库修复，不需Pre-SKU-2提交。

本DCR先于业务代码。内部一致性检查：不改变SKU稳定身份、Code规则、3维/20值/50组合上限、权限、参考价含义或咨询状态机；不需要额外重大决策。NO MIGRATION。

## 冻结实施规则

1. 公开产品白名单裁剪；详情返回variantMode、active options、唯一当前enabled skus。SKU仅id/optionValues/effectiveReferencePrice/effectiveImages。inquiry删除产品price、priceNote（可能含数值）且有效价null，不返回raw价格、SKU Code、combination_key、disable_reason、历史定义或modelVersion。列表仍Product级，不返回SKU矩阵。
2. 按Option.sort、Value.sort顺序生成当前组合，默认选择第一个真实enabled SKU；不依赖文字/index。完整选择精确唯一匹配，重复组合安全失败并记录错误。可用性按其余已选维度匹配enabled SKU；提供“重新选择规格”清空选择，防止稀疏组合在完整默认选择下无路可达。未选完整不能咨询。单规格自动唯一SKU且不显示默认规格。
3. 统一从selectedSku派生图片、参考价、咨询目标；图片继承计算在Server，切换轮播归零；null继承、0有效、inquiry无价。图库无任何图用已有空状态。无SKU显示产品基本资料，禁止产品咨询。
4. 产品咨询强制contentId+skuId，停止spec-only（当前为开发阶段，无已发布旧微信客户端这一用户前提）。保留原非产品/一般服务咨询，不要求不存在的SKU。传skuId却无产品或错误类型拒绝。Server同幂等事务内重新检查发布、归属、enabled、当前组合，不信任客户端规格/价格/Code。
5. 新snapshot保留原产品基本字段，新增sku{id,code,specLabel,options,referencePrice}，options包含提交时维度/值ID及名称；simple specLabel为空。referencePrice仅当时参考价上下文，inquiry=null，非成交价。不复制图库。历史snapshot.spec原样只读，不追填、不覆盖；游客响应裁去新SKU内部ID/Code，仅保留显示标签和参考价，后台可查完整快照。
6. SKU错误按code处理，过期SKU重新加载产品、选择新有效默认SKU并提示用户重新确认，不自动提交；保留联系人/留言/source及幂等键策略。产品下架阻止提交。
7. Public媒体仅published Product自身图库或当前enabled有效SKU独立图；历史/停用SKU仅内部usedBy和Admin预览可用。其它已发布合法引用仍可授权。保留URL、Range、no-store及权限，不删除媒体。
8. 停止Public specs输出；Admin新产品也不再产生投影，旧开发specs仅原始数据/内部引用保留，不作新写或咨询身份。旧开发产品保留可读基本资料，但没有SKU不可咨询，不自动转成新产品。
9. reset仅专用标记的临时development目录，拒绝共享/production/符号链接，增加dry-run及清理范围输出；正式初始化仅计划，不执行共享清理。启动默认仍供现有开发数据使用，提供显式HQ_SEED_MODE=none跳过测试seed供隔离初始化验证；不宣称生产配置已支持。

## 文件白名单

server/product-sku.mjs、public-product.mjs（新增最小公开投影/有效组合）、consultation-sku.mjs（新增校验快照）、service.mjs、media.mjs、index.mjs（仅seed显式开关）；shared/consultation-display.mjs；admin/src/Operations.jsx；小程序lib/api.ts、detail-page.ts（移除旧规格读取，保留其他详情）、product-sku.ts、consultation-display.ts及product/consult/record/records指定TS/WXML/WXSS；不改首页/五导航/其它业务页面。scripts/reset-sku-dev.mjs、native-check.cjs（旧规格测试入口退出）、新SKU-2验证脚本；tests相关fixture/协议断言/新增SKU-2测试；本目录、治理记录/待确认/验收清单。必要fixture改造仅将新创建产品咨询改用skuId，旧历史样本直接构造，不放松业务断言。

## 提交与切换

Commit A为Server/Public/咨询/媒体、DCR/契约及自动测试；Commit B为游客UI、Admin快照显示、实际原生/浏览器证据及最终回归。A/B均构建和Node测试通过；A是明确的新协议切换点，旧开发客户端产品咨询须升级后使用，不兼容spec-only。不重写旧历史，不部署、不清理共享数据。后台共享服务不用于写测试；原生测试复制小程序项目到临时目录并指向隔离端口。
