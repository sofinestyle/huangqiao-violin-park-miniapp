# SKU-2 Consultation Spec

产品提交：POST /api/visitor/consultations，Authorization原游客身份，Idempotency-Key原8—100字符规则。

```json
{"contentId":"product-id","skuId":"sku-id","contactName":"合成访客","phone":"13800000000","message":"希望了解所选规格","source":"乐器产品详情","consent":true}
```

新产品快照（服务端生成）：

```json
{"id":"product-id","name":"合成小提琴","code":"QA","category":"violin","version":3,"sku":{"id":"sku-id","code":"QA-001","specLabel":"4/4 / 棕色","options":[{"optionId":"o-size","optionName":"尺寸","valueId":"v-full","valueLabel":"4/4"},{"optionId":"o-color","optionName":"颜色","valueId":"v-brown","valueLabel":"棕色"}],"referencePrice":450}}
```

referencePrice只记录提交时有效参考价，不代表成交；inquiry=null；无图库复制。产品及SKU查验和INSERT与幂等记录位于同一BEGIN IMMEDIATE。重复同键同payload返回原记录；同键不同payload409；后续改名/改码/改价/停用不会修改snapshot。

错误：400 SKU_REQUIRED；404 SKU_NOT_FOUND；400 SKU_PRODUCT_MISMATCH；409 SKU_UNAVAILABLE；404 PRODUCT_UNAVAILABLE。请求规格文字/价格/码均不作为权威。普通服务或lesson/package/spot咨询保留原行为，无SKU。无contentId传skuId拒绝。

Admin仅在新snapshot.sku存在时显示规格组合及SKU编码、参考价上下文；旧snapshot.spec fallback。游客记录响应对sku裁剪为specLabel/referencePrice，界面只展示产品及可读规格。历史兼容显示函数Admin/shared与Mini TS保持同契约测试；不改CSV字段、权限或咨询状态机。创建成功沿{id,state,message}不额外暴露快照。
