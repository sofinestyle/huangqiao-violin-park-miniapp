# Storage Architecture

统一LocalStorage/CloudBaseStorage接口put/read/metadata/delete；业务授权在Media Service，Provider不判断角色/环境。object_key使用系统生成不可变身份，不保存签名URL。PG只存元数据，文件不入数据库。

Local Provider保留开发方便，CloudBase Provider使用官方PG Storage支持接口，私有Bucket；配置缺失失败，不回退公开桶。默认受控代理Range/HEAD，保留200/206/416、MIME、取消和大小限制。CloudBase通过受控替身测请求/签名/错误；不冒充真实云验证。

内容删除不删除共享media；历史SKU仍计Admin usedBy；Public只认已发布且有效当前引用。上传失败只补偿本次对象，不扫描删除历史素材。PG+对象联合manifest供备份恢复。

实现依据：[CloudBase PG Storage HTTP API](https://docs.cloudbase.net/en/http-api/storage-pg/pg-storage-api)、[官方OpenAPI定义](https://docs.cloudbase.net/openapi/en/storage.v1.postgres.openapi.yaml)。使用`https://<env>.api.tcloudbasegateway.com/v1/storages/object/<bucket>/<object>`：POST二进制上传、GET/Range、HEAD元数据、DELETE补偿；签名接口`object/sign`，有效期1—300秒。服务角色Key只由Node注入Authorization，阻止redirect，错误不带云响应原文/凭据。签名能力经过接口替身验证，业务默认仍为Node逐次授权代理，不改变媒体URL或游客端消费。

上传限制保持64MB，验证MIME、容器头、声明/实际长度和原视频说明；先临时流式落盘计算hash，再写Provider，随后PG metadata+audit事务。失败补偿只删除本次新对象；若数据库连接结果不确定则保留对象并仅记录mediaId待人工核查，不误删已提交文件。云端短暂本地spool不是持久媒体存储。CloudBase真实大视频、Range、带宽、超时与失败清理尚待Phase 2。
