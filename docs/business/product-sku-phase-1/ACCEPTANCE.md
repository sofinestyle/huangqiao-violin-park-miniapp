# Product SKU Phase 1 验收

结论：**READY FOR HUMAN ACCEPTANCE**。仅工程自检完成，等待人工验收，未进入SKU-2；未清空共享开发数据库；未执行生产部署或正式发布。

## 版本与范围

Baseline：235f864dfcfb213fa1ae1b03935adec6356d194e。DCR/Foundation：c2e98eb6248206802f12319746fc7f01b5dbfb15。Admin Matrix为包含本文件的`feat(admin): add structured SKU matrix and acceptance evidence`提交；确切SHA由交付消息及Git日志提供，避免文档自引用SHA。Migration005随Foundation，没有额外Migration Commit。正式验收Diff：Baseline→Admin Matrix。main正常提交/推送，不重写历史。

Foundation包含先行DCR/模型/API契约/测试计划，Migration、SKU服务、Content事务、媒体引用、隔离reset/seed及22项新测试。Admin提交包含Content集成、SkuEditor/局部CSS、API错误定位、实际浏览器脚本与截图、游客最低兼容测试、报告及治理同步。完整文件清单见final-verification.json。

## 完成行为

- 产品保持原Content及Product Code；data新增v2、simple/options和产品级Options；独立product_skus保存稳定UUID、业务编码、ID组合、参考价、图片、启停、排序及时间。不新增全局Option平台。
- 3维/20启用值/50候选组合前后端校验；21—50提醒，超过50禁止生成保存。命名1—40字符，大小写不敏感重复拒绝；SKU Code1—64字母数字短横线下划线，Trim、NOCASE全局唯一。
- 新增默认simple；多规格轻量矩阵、选择批量改价/清价继承/启停/产品图库；单SKU展开图片并直接上传。保存内容统一提交，事务/version/错误定位、上传与保存防重入保护保留。
- Option/Value及SKU ID改名不变，Code不自动变化；停用保留历史、恢复找回身份。新增维度原组合绑定新维度首个值，10→20保留原10身份，其余新建。单行手动停用不因值恢复而意外启用。
- Product参考价边界不变；SKU null继承，0有效。inquiry公开返回隐藏价格，reference才有有效参考价。图库空数组继承，不复制文件。
- API沿既有content读写，整产品与SKU差分/审计同事务。旧写明确拒绝；动态specs只读投影维度标签用“ / ”组合，simple“默认规格”。旧产品可读提示，不能继续使用旧规格编辑器保存。
- 素材usedBy包含SKU及停用历史；Public只有最小开发兼容桥接，完整规则留SKU-2。审计仍content.create/update，detail增加SKU计数，不新增低价值action。

## 验证与证据

[测试报告](TEST_REPORT.md)：最终94/94 Node测试、14/14浏览器功能组；Build/Type Check/25原件/diff check通过。Migration/API/媒体/备份恢复/权限/并发/50边界均有自动断言，JSON见[最终验证](final-verification.json)和[浏览器验证](browser-verification.json)。全后台8页无JS运行时错误；未修改游客源码，现有列表/详情最低宿主回归通过。

实际截图：[单规格](01-simple-product.png)、[10SKU](02-options-editor-10-sku.png)、[20SKU](03-options-editor-20-sku.png)、[批量](04-sku-batch-toolbar.png)、[图片](05-sku-image-editor.png)、[停用确认](06-option-disable-confirm.png)、[错误定位](07-sku-validation-error.png)、[1280](10-sku-1280.png)、[1728](10-sku-1728.png)、[旧10规格](before-spec-editor.png)、[新矩阵](after-sku-matrix.png)。全部为真实运行页/隔离合成数据，不是AI效果图。10SKU行高60px，完整编辑内容9714→3030px，减少约68.8%。

## 已知限制

1. 旧测试产品只读，未映射56条旧自由规格，未清理共享库；工作人员需新建v2产品或在专用隔离环境重建测试数据。
2. 多规格转单规格前须将启停结果先保存，只允许1个启用SKU；若历史simple身份另占固定组合键，明确拒绝自动合并，须恢复原身份后转换。
3. Product Code原本无全局唯一约束，继续保留；SKU Code有独立唯一约束。
4. 参考价/图库的旧specs投影为短期只读桥接，旧游客选择仍是名称/index，不能视为正式SKU身份链路完成。
5. 退役定义技术保护上限100维/每维200值不等同Active业务上限；不提供长期旧模型或无限历史维度平台。
6. 50SKU有开发环境实测，未提供生产压力或跨浏览器保证。未建设全局草稿/离开未保存保护系统。

## 冻结与后续

预约/场次/咨询状态机、账号角色与密码、审计分页和历史数据、CSV字段与导出、Admin Design System v1.0、游客导航及其它页面保持。未新增支付、订单、购物车、库存、ERP或独立站。原件/共享库hash一致。

SKU-2待办：逐维Option选择、skuId咨询、SKU快照、价格联动、图片联动、Public媒体完整授权、旧spec兼容退出、正式测试数据清理、正式产品资料初始化准备。未执行项目详见测试报告，未将未授权事项标为已完成。

人工重点：审查模型/转换身份、10/20行维护效率、批量与继承语义、停用恢复、Code稳定、实际截图及数据库唯一约束。等待人工结论，不自动进入下一阶段。
