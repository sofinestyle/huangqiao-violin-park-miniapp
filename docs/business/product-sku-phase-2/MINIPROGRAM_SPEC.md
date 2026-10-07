# SKU-2 Mini Program Spec

保持Product级列表及五导航；只产品详情增加动态维度Chip，不硬编码尺寸/颜色。按照sort显示，默认从有效SKU取第一项，单规格无多余规格控件。完整选择解析唯一SKU才启用咨询。无SKU、重复组合、模型不完整均失败关闭；无SKU仍可阅读产品。

控件使用系统无衬线、暖米白、品牌棕；至少44px点击高度，长标签换行，禁用有disabled属性和“暂不可选”文字，不能只灰色。提供清空选择，支持稀疏组合重新选择。选中态边界/填色克制，不增加购物车等功能。

selectedSku统一派生selectedSkuId、selectedOptionValues、galleryImages、displayReferencePrice/priceLabel及specLabel；每次SKU变化swiper current=0、图片错误复位。图片原图不改，保留现有1:1结构。咨询页显示当时待提交产品+可读组合；不展示UUID/Code。失效提交按code重新拉详情并选有效默认，保留填写内容、明显提示用户重新确认，再由用户主动提交。

原生截图至少八类；320/375/390/430检查2/3维长标签及按钮。微信开发者工具实际渲染和宿主TS测试分开记录，不能称真机。首页、共享导航及其它游客页面冻结，公共lib仅必要SKU类型/错误code/历史显示适配。
