# Storage Architecture

统一LocalStorage/CloudBaseStorage接口put/read/metadata/delete；业务授权在Media Service，Provider不判断角色/环境。object_key使用系统生成不可变身份，不保存签名URL。PG只存元数据，文件不入数据库。

Local Provider保留开发方便，CloudBase Provider使用官方PG Storage支持接口，私有Bucket；配置缺失失败，不回退公开桶。默认受控代理Range/HEAD，保留200/206/416、MIME、取消和大小限制。CloudBase通过受控替身测请求/签名/错误；不冒充真实云验证。

内容删除不删除共享media；历史SKU仍计Admin usedBy；Public只认已发布且有效当前引用。上传失败只补偿本次对象，不扫描删除历史素材。PG+对象联合manifest供备份恢复。
