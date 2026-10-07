# SKU-1 数据模型

批准依据及转换规则见DCR。Product仍是content；data包含variantModelVersion:2、variantMode、options，与原code/category/brand/series/description/images/priceMode/price/priceNote/isTest并存；无新content物理列。specs不再持久保存于新模型。

options=[{id:UUID,name:string,sort:int,enabled:boolean,values:[{id:UUID,label:string,sort:int,enabled:boolean}]}]。维度名产品内、值标签维内Trim+大小写不敏感唯一；ID不随标签改名。历史定义不能省略删除。

product_skus：id TEXT PK NOT NULL；product_id TEXT NOT NULL FK content.id；sku_code TEXT COLLATE NOCASE UNIQUE NOT NULL（Trim、字符与长度CHECK）；option_values TEXT JSON object；combination_key TEXT NOT NULL；reference_price REAL NULL CHECK 0..1e7；images TEXT JSON array；enabled INTEGER CHECK IN(0,1)；sort_order INTEGER CHECK 0..10000；disable_reason TEXT manual/structure/空；created_at、updated_at TEXT NOT NULL。UNIQUE(product_id,combination_key)，product_id索引。

组合key=JSON.stringify(Object.entries(option_values).sort按optionId)，无标签/index/业务编码。simple={}/[]。所有SKU含停用记录均保留唯一组合；不允许两套历史身份。前端只用临时组合key定位未保存行，正式SKU ID服务端产生。

schema保证PK/FK/码及组合唯一/基本类型；Service额外校验Option/value存在、同产品归属、完整选择、当前结构、启停、数量、价格有限、图片存在/MIME。产品与SKU使用同一事务和content.version，无新版本系统。单SKU差异说明/库存/全局属性系统本期不增加。

价格与图继承是读取计算，不把产品图库物理复制入SKU。raw reference_price可保留但公开inquiry输出不返回有效价；Admin始终能维护raw值。Product Code无唯一约束仍为已知限制。
