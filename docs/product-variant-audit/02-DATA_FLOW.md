# 当前录入、消费与关联链路

基准 `c351092da1cc99f49a91a67f4ad62124dcf5e716`。以下为源码审计事实，不代表本轮执行了写入或浏览器回归。

## 1. 新增、草稿、发布与维护

```mermaid
flowchart LR
 A[新增乐器/打开已有产品] --> B[ContentEditor整产品Form State]
 B --> C[输入/添加删除specs数组项]
 C --> D[价格转数字/携带version]
 D --> E[POST或PUT admin/content]
 E --> F[权限/结构/媒体/版本校验]
 F --> G[事务保存content.data完整JSON]
 G --> H[content.create/update审计]
```

1. [Content.jsx](../../admin/src/Content.jsx) 第9—40行：乐器Tab查询product/instrument，文创查询product/gift。新增草稿初始化 `specs:[],images:[],priceMode:'inquiry',state:'draft'`；乐器默认category=violin，文创=gift。打开已有产品先GET `/api/admin/content/:id`，将返回的展开对象装入form。
2. 同文件ContentEditor第54行起：输入更新整个form；新增规格追加 `{name:'',description:'',images:[]}`，最多50项。规格用 `key={i}`，更新通过索引匹配，删除通过索引过滤。**没有独立规格ID，没有专门的拖动/上下移排序操作**；保存JSON数组顺序决定展示顺序。删除规格会从当前JSON移除，后续新增不是可识别的同一实体恢复。
3. 上传中的规格删除被禁用；上传回调仍按该行索引关联，不应把索引升级为未来SKU身份。当前约束可减少上传时位置变化，不构成稳定ID。潜在React行状态复用风险仅为静态推断，本轮未复现。
4. 保存时剥离id/kind/name/state/sort/version，余项构成data；规格非空price转Number。新建POST `/api/admin/content`，已有PUT `/api/admin/content/:id`，携带当前version。状态选择draft/published/archived后使用同一“保存内容”，没有独立发布Endpoint。
5. [HTTP](../../server/http.mjs) 第98—105行鉴权并调用Service；[Service](../../server/service.mjs) 第29—104行检查content权限、产品类型、名称、JSON体量、价格、规格及媒体。更新须产品version一致，否则409。写入是整个data替换，产品version递增，在同一事务记录 `content.create` 或 `content.update`。
6. 审计摘要只有from/to发布状态和version；不是旧规格内容副本。没有独立规格修改历史。版本号可说明咨询发生时的产品版本，但不能仅凭版本号还原那一版所有参数。

前端业务操作忙碌/上传保护继续有效。本报告不建议改变内容权限、发布行为或把直接上传移回素材库。

## 2. 上传、引用与图库

[MediaUpload.jsx](../../admin/src/MediaUpload.jsx) 第9—24行：选择文件和权属说明后直接上传，XHR反馈进度；[media.mjs](../../server/media.mjs) 第20—47行校验类型/文件，生成媒体UUID并持久保存，返回 `/api/media/<id>` 及管理员预览地址。表单把URL放入产品或规格images数组，保存内容后关联生效。取消表单不自动删除已上传文件，素材仍可在库中复用。

产品/spec图片都是**URL数组**，不是二进制复制；上传URL内含mediaId，静态资源使用 `/assets/...`。同一URL可被多个规格共用，不要求上传10份文件。产品图库第一张作列表封面；规格有自有图库时整组优先，空/缺省则使用产品图库；不会把产品图库复制进每个规格。

素材库 `listMedia()` 第9—12行遍历content.data的mediaId、images、specs.images，usedBy只到内容级，不标明是哪条规格。[公开媒体判定](../../server/media.mjs) 第50—55行同样扫描这些路径：存在已发布内容引用才放行上传文件。该规则不适用于HTTP直接提供的静态 `/assets/` 文件。

**结构升级关键依赖：** 仅把SKU图片搬到新表会使当前扫描看不见引用，出现usedBy失真或公开访问410。SKU写入、关联查询、公开授权及停用可见性必须同时设计、测试；不能仅改Admin。

## 3. 游客端列表、详情与咨询

| 环节 | 当前真实行为 | 源码 |
|---|---|---|
| 乐器/文创列表 | 公共content接口；列表按产品分类/系列/名称编码筛选，封面和主价来自产品；没有SKU筛选 | [list-page.ts](../../miniprogram/miniprogram/lib/list-page.ts)、[api.ts](../../miniprogram/miniprogram/lib/api.ts) |
| 内容类型 | Content接口采用 `[key:string]:any`，没有正式Variant类型；decorate为产品及spec图片补API_BASE | api.ts 第2、23行 |
| 详情初始化 | 第一个规格默认选中；其图库为空则回退产品图库 | [detail-page.ts](../../miniprogram/miniprogram/lib/detail-page.ts) |
| 切换规格 | index作为选择值，展示完整自由文本name；WXML使用name作为key | [product/index.ts](../../miniprogram/miniprogram/pages/product/index.ts)、[WXML](../../miniprogram/miniprogram/pages/product/index.wxml) 第7行 |
| 图片与参数 | 随所选规格切换images和description；空规格图继承产品图 | 同上 |
| 价格 | 产品priceLabel保留，规格有price时另显示一行；没有计算交易金额 | 同上，价格边界详见01文档 |
| 打开咨询 | 把产品id与encodeURIComponent(spec.name)放入路由 | product/index.ts 第2行 |
| 提交咨询 | 重新读取产品，携带contentId、spec字符串、联系信息、来源和留言提交；鉴权和幂等机制复用 | [consult/index.ts](../../miniprogram/miniprogram/pages/consult/index.ts) |
| 服务端校验 | 产品须已发布；非空spec必须存在精确同名规格 | Service 第313—327行 |
| 保存与回看 | snapshot保存产品id/name/code/category、spec名称、产品version；后台详情及游客“我的”详情显示所选规格 | [Operations.jsx](../../admin/src/Operations.jsx) 第36行、[record/index.wxml](../../miniprogram/miniprogram/pages/record/index.wxml) |

后台可以知道当时提交的规格名称，但无法拿到独立SKU身份。重名时无法区分；名称改动与旧页面提交之间可能校验失败；已经保存的快照不会随产品改名自动改变。快照没有规格价格、图片、参数，也没有SKU ID。不能从历史名称可靠反推当前组合。

## 4. Seed、迁移、导入导出、测试

- [seed.mjs](../../server/seed.mjs)为7个提琴生成5个尺寸名，为20个文创生成单规格。不要混淆 [test-catalog.json](../../server/test-catalog.json) 的 `v.spec`：它是材料标签/文字对，seed把它拼入**产品description**，不是结构化尺寸/颜色Option。
- [content-migration.mjs](../../server/content-migration.mjs)只清除已知占位提示，保留自填内容；当前大量空description不能直接认定为丢失数据。本次未运行seed或migration。
- 搜索未发现产品/SKU批量导入导出业务Endpoint。`GET /api/admin/export` 在HTTP第156—162行导出预约/咨询授权范围记录；现有CSV列不含产品规格。不要借SKU项目改变既有CSV字段。
- [backup.mjs](../../server/backup.mjs)备份全SQLite及媒体文件，恢复到新空路径并清除会话。未来新增表会进入全库备份，但版本兼容及恢复校验仍须补测；本次没有执行备份或恢复。
- [round1.test.mjs](../../tests/round1.test.mjs)覆盖分类/发布隔离、文案迁移保留自填规格、规格图库素材关联。[business.test.mjs](../../tests/business.test.mjs)第95—101行覆盖咨询规格快照，第158行起覆盖独立规格图公开访问/非法URL/下架；[ABI fixture](../../tests/admin-business-fixture.mjs)创建含4/4名称的隔离咨询。现有测试不是SKU身份、组合差分或多维筛选测试。
- 本轮仅静态检查上述测试及其它内容、视频、点位、路由测试相关入口，**未执行测试、Build、浏览器/真机交互或性能基准**，未创建测试业务数据。不能把历史测试通过数当作本轮结果。

## 5. 全范围覆盖记录

| 用户要求范围 | 本次读取/核查证据 |
|---|---|
| Schema / Migration | db.mjs、content-migration.mjs、audit迁移模块、实际sqlite_master与migrations版本 |
| Service / HTTP | service.mjs、http.mjs，内容/咨询/媒体/CSV路径 |
| Shared model/constants | shared/status.mjs、游客lib/api.ts |
| Admin / ContentEditor / 新增编辑 | Content.jsx、api.js、UI状态和表单payload |
| 图片上传 / 素材关联 | MediaUpload.jsx、media.mjs、Media页面相关引用 |
| 游客列表 / 详情 | instruments、gifts、list-page、detail-page、product页面 |
| 咨询 / 历史 | consult、record、Operations、Service快照 |
| 审计 | content.create/update调用、audit结构/查询与动作标签 |
| Tests / Seed / Fixture | tests相关断言、seed、test-catalog、ABI fixture |
| 导入导出 | 全仓库搜索、http export、backup及scripts/backup |
| 治理文档 | AGENTS、需求原文提取、技术方案、CR001、决策/待确认、当前功能说明、验收清单、游客及Admin设计规范、UI实施计划 |

治理依据保持C06展示与咨询、C09测试资料、C10五类乐器、C12内容直接上传、C15产品图片原则；本次用户明确只允许审计文档，故不修改一般治理文件、DCR或设计规范。全文关键词搜索覆盖product/content/violin/variant(s)/spec/specification/sku/price/image/gallery/media/product detail及对应中文。
