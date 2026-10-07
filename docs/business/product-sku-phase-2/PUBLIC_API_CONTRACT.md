# SKU-2 Public API Contract

GET /api/public/content 保持产品级列表，仅公开产品基本字段；GET /api/public/content/:id 产品详情增加以下明确结构（ID为示例）：

```json
{"id":"product-id","kind":"product","name":"合成小提琴","code":"QA","category":"violin","brand":"YorRay","series":"","description":"合成资料","images":["/assets/hero-violin.jpg"],"priceMode":"reference","price":450,"priceNote":"仅参考价","variantMode":"options","options":[{"id":"o-size","name":"尺寸","sort":0,"values":[{"id":"v-full","label":"4/4","sort":0}]}],"skus":[{"id":"sku-id","optionValues":{"o-size":"v-full"},"effectiveReferencePrice":0,"effectiveImages":["/assets/hero-violin.jpg"]}]}
```

simple: variantMode=simple, options=[], skus唯一{id,optionValues:{},effectiveReferencePrice,effectiveImages}。无可用SKU时skus=[]，产品资料仍返回。旧开发产品无正式模式则variantMode=null/options=[]/skus=[]，不可咨询；不伪造SKU。API不返回specs、SKU Code、raw reference_price、排序内部key、disable_reason、modelVersion或历史定义。产品分类/描述等白名单保留；列表无需Options/SKUs，不拆卡。

inquiry: 不返回price和priceNote，有效价null。reference: 有效价=SKU.reference_price??Product.price，0保持0。有效图=SKU.images非空则使用，否则Product.images。只返回当前有效enabled SKU，排序按Option/Value sort构成的组合顺序。

GET未发布产品沿CONTENT_UNAVAILABLE 404。POST /api/visitor/consultations 对产品强制skuId，这是经用户批准的开发期Breaking Change；specs公开退出亦属开发契约切换。非产品咨询、Admin Content写、CSV和其它API不变；新增错误code见CONSULTATION_SPEC。旧咨询读取兼容。
