# Old Spec Consumers

扫描范围：整个仓库的一方源码、脚本、测试；排除node_modules、构建产物、原件、历史验收文档和二进制图片。关键词：`.specs`、`spec`、`selectedSpec`、`specIndex`。2026-10-07完成核对。

**Remaining Consumers = 0：新版游客产品选择和新版产品咨询对旧规格身份的正式依赖为零。** Public不再输出specs，Admin新模型不生成specs投影；不代表历史数据或测试样本中删除了所有spec文字。

|位置|剩余用途|权威写入/正式规格选择|
|---|---|---|
|Mini lib/product-sku.ts、pages/product、pages/consult|只使用Options ID、Value ID、SKU ID；无selectedSpec/specIndex/spec query|新SKU模型|
|shared/consultation-display.mjs；Mini lib/consultation-display.ts|旧咨询snapshot.spec只读fallback；新snapshot.sku优先，包括simple空label|否，明确历史兼容|
|server/service.mjs|旧字段白名单清理、媒体引用旧资料防漏检查；新SKU写入删除specs，旧payload被拒；非产品咨询保留空spec兼容结构|不用于产品SKU身份|
|server/product-sku.mjs|检测specs旧写并拒绝|安全保护，不是消费者|
|admin/src/Content.jsx|提交前从表单中剔除旧specs|不写回|
|server/media.mjs|Admin usedBy读取旧开发specs图片，避免错标未关联；Public不据此授权|内部历史引用|
|server/content-migration.mjs|既有Migration2修改旧开发文案，保持历史Migration不变|历史迁移|
|server/seed.mjs；data展示稿数据|原开发Seed保留测试specs；产品介绍中的材料参数也名为spec；isTest=true，HQ_SEED_MODE=none可关闭|非正式测试数据，未转换共享库|
|tests/product-sku-helper、round1、product-sku及fixture|旧开发fixture按测试目的构建新SKU，旧写拒绝/旧数据可读断言|隔离测试|
|tests/sku2-*、scripts/sku2-e2e.mjs|构造旧咨询验证fallback；断言Public specs缺失和咨询URL无spec|隔离测试|
|scripts/native-check.cjs|已去除index/spec URL，改为selectedSkuId；写测试要求显式隔离项目参数|新SKU|
|scripts/product-sku-browser、content-delete-browser|解构丢弃旧specs避免旧写|隔离回归|
|admin instrument-pilot.css的spec-heading|历史样式类名，无规格数据读取|不是数据消费者|

旧开发商品仍可读取名称/图片，但没有新SKU时禁止产品咨询，不智能迁移或伪造SKU。正式初始化前将按另行确认的清理方案重新录入，不保留长期双模型权威写入。
