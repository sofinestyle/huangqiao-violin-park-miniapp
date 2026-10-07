# 当前真实模型与数据证据

审计日期：2026-10-07。代码基准：`c351092da1cc99f49a91a67f4ad62124dcf5e716`，分支 `main`，开始时工作区 clean。本文中的“事实”来自该版本源码和本地只读查询；“建议”不是已批准业务规则。本阶段只新增本目录审计文档。

## 1. 结论与证据入口

**当前规格是 `content.data` JSON 内的 `specs[]` 子结构，不是独立数据库实体，也不是具备稳定身份的 SKU。** 实际字段名是 `description`，不是需求举例中的 `params`；没有 `variants` 表。产品编码和规格名称不是同一概念。

主要证据：[数据库定义](../../server/db.mjs)、[Service](../../server/service.mjs) 第7—104、313—327行、[后台 ContentEditor](../../admin/src/Content.jsx)、[共享状态](../../shared/status.mjs)、[只读统计与实际表定义](AUDIT_EVIDENCE.json)。后两份分析见 [录入与消费链路](02-DATA_FLOW.md)、[候选模型](03-OPTION_SKU_OPTIONS.md)。

## 2. 表、约束与索引

| 对象 | 当前真实结构 | 关系与约束 |
|---|---|---|
| `content` | `id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'draft', sort INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL` | 所有内容共用；产品为 `kind='product'`。当前只有主键索引，没有产品编码唯一索引、SKU索引、JSON结构 CHECK 或规格外键 |
| `media` | `id, filename, mime, size, sha256, stored_name, rights, duration, created_at` | 独立媒体记录，id主键；产品与规格通过JSON URL引用，未建关联表或媒体外键 |
| `consultations` | `id, owner, snapshot, request, state, assignee, followups, public_note, version, created_at, updated_at` | owner关联游客、assignee关联账号；snapshot/request为JSON文本。没有product/spec/SKU外键；有owner索引与主键 |
| `audit` | `id, actor, action, object, detail, created_at` | 内容对象ID与操作摘要；不是规格版本库。现有三个审计查询索引不提供SKU约束 |
| `migrations` | 已应用版本1、2、3、4 | 建表、内容提示文案迁移、跟团场次支持、审计索引；没有规格结构化迁移 |

精确SQL、PRAGMA索引与外键结果在证据JSON。`data` 的合法结构主要由Service校验，而非SQLite强制。`publicContent()`将JSON字段展开到API返回对象顶层，因此API看到 `specs` 不等于数据库有 `specs` 列。

## 3. 实际结构与字段层级

以下为结构示意，数值不是正式商品资料：

```text
content
  id / kind=product / name / state / sort / version / created_at / updated_at
  data(JSON)
    code / category / series / brand / description
    images: ["/assets/…", "/api/media/<id>"]
    priceMode: inquiry | reference
    price? / priceNote? / isTest
    specs: [{name, description, price?, images?}, ...]
```

| 字段 | 当前层级和用途 | 建议层级与重复判断 |
|---|---|---|
| id、kind、name | Content；产品身份、类型、名称 | Product；不因规格变化更换产品ID |
| code | 产品JSON自由文本产品编码；当前无唯一约束 | Product Code，独立于SKU Code；未来是否统一唯一需DCR |
| category | 产品，五类乐器或gift | Product；不拿颜色、尺寸当分类 |
| brand、series | 产品，品牌/系列；文创series兼作分类文字 | Product；未来外部分类映射另议 |
| description | 产品简介、材料、工艺、配套等混合自由文本 | 共性信息留Product；可另议结构化共性参数，不强制本轮拆字段 |
| images | 产品图库，第一张用于列表封面 | Product Gallery；无独立“主图/详情图”字段 |
| priceMode、price、priceNote | 产品报价模式、参考价与说明 | Product默认报价策略；SKU只保存必要差价/覆盖值 |
| specs[].name | 规格自由文本名称，咨询以该字符串匹配 | Legacy名称保留；新规格由Option值组合展示，身份改用SKU ID |
| specs[].description | “规格参数”自由文本 | Legacy说明原样保留；差异说明归SKU，共性说明仍归Product |
| specs[].price | 可选规格参考价 | SKU可选覆盖；空值语义须明确，见价格审计 |
| specs[].images | 可选图片URL数组 | SKU覆盖图库；空图库继承产品图库 |
| state | 产品整体draft/published/archived | 产品发布状态保留；建议SKU另设enabled，不替代发布状态 |
| sort、version | 产品排序与乐观并发版本 | Product；SKU建议独立排序，整产品事务版本仍可复用 |
| isTest | 内部开发资料标记 | 原样保留；不能因迁移升级为正式资料 |
| specs的数组位置 | 规格显示顺序、Admin编辑定位 | 建议稳定ID与显式sort_order分离 |

没有正式 `size / color / option / attribute / sku_code / enabled / stock` 规格字段；没有库存、订单、线上成交模型。服务端未剔除规格对象的未知键，但这不等于已有稳定ID协议：当前表单、消费者、校验均未使用这些键。

**共性参数核查：** 当前8个乐器中7个产品description含面板/背板/工艺等词；36个规格description中35个为空，1个为“3年自然风干欧洲木材”，没有规格description含面板/背板/指板/工艺这些词。因此不能声称当前库已经大规模重复保存共性参数。事实是自由文本结构允许重复录入；用户所述维护负担与多维扩展风险成立，当前重复数据规模未被证实。

## 4. 校验边界与价格

Service第29—104行：产品名称非空，最长120字；产品JSON序列化长度最多50,000个JavaScript字符（不是50KB字节承诺）。最多50条规格，名称最长80字、description最长3,000字；规格名允许空字符串和重复值。产品及每条规格图库分别最多12张。图片须符合静态资源或媒体URL格式，上传媒体还校验存在且为image MIME。

产品reference模式要求有限数值参考价，范围0—10,000,000；inquiry模式无该必填要求。规格price可缺省/null，否则须有限number且同样范围；JSON保存数值，非分单位整数模型。前端number输入step=0.01不等于服务端限制两位小数。产品价格输入清空时 `Number('')` 可形成0；规格空价转换为null。0与未填不可互换。

没有币种字段；界面以 `¥` 显示，不能据此声称数据库已经显式采用CNY或已支持多币种。参考价只展示，不用于购物车、库存、支付或结算。当前产品主价按priceMode显示；选中规格有price时额外显示“此规格参考价”，**不替换产品主价，且该规格价显示未受priceMode控制**。新模型若统一价格继承/隐藏逻辑，属于待批准的语义调整，不能暗中当作无差异迁移。

## 5. 只读开发数据统计

采集时间：2026-10-07 12:55:53（Asia/Shanghai）。范围 `.local/huangqiao.sqlite` 中全部产品，含草稿/下架，使用SQLite URI `mode=ro`、`PRAGMA query_only=ON`和只读事务；未调用会建表/迁移的应用 `openDatabase()`。未读取账号、会话、客户咨询正文或个人信息。所有28个产品均 `isTest=true`，**仅开发/测试数据，不代表正式商品目录**。

| 指标 | 乐器 | 文创 | 合计 |
|---|---:|---:|---:|
| 产品数 | 8 | 20 | 28 |
| 有规格产品 | 8 | 20 | 28 |
| 无规格产品 | 0 | 0 | 0 |
| 单规格产品 | 1 | 20 | 21 |
| 多规格产品 | 7 | 0 | 7 |
| 规格总数 | 36 | 20 | 56 |
| 单产品最大规格数 | 5 | 1 | 5 |
| 已发布/已下架 | 7 / 1 | 20 / 0 | 27 / 1 |
| 规格description为空 | 35 | 20 | 55 |
| 独立规格价 | 0 | 0 | 0 |
| 自有规格图片的规格 | 1 | 0 | 1 |
| 未配独立规格图片 | 35 | 20 | 55 |

乐器类别为7个提琴、1个已下架吉他；规格名样例为1/8、1/4、1/2、3/4、4/4、示例规格。没有空名或同产品重名的现有记录，但服务端允许这些情况。乐器产品参考价样例L201=450；文创价格样例15、18、20、24、26、29、38、48，均为开发值。乐器7条inquiry、1条reference，文创1条inquiry、19条reference。

共29个产品图片引用、1个规格图片引用，合计30次引用、6个不同URL；其中4次引用上传媒体、26次引用静态资源。上传媒体引用缺失记录数为0；本次没有逐文件读取图片或验证静态资源文件存在/图片质量，不能将“媒体记录存在”报告为全部图片可用。数据库及WAL采样前后SHA-256一致，见证据JSON。
