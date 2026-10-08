# Transaction Rules

READ COMMITTED；统一次序：幂等/账号策略锁 → content按ID → slots按ID → booking/consultation → changes → audit。锁前获取关系后须锁内重读；关系改变安全失败并要求重试，不能倒序追加锁。

Content更新/删除FOR UPDATE；所有历史引用创建方FOR SHARE锁对应content后重查发布/结构。删除再次检查状态/version/引用，SKU与content删除+审计原子，不删除历史咨询/预约/媒体。

容量操作先锁目标及原slot FOR UPDATE，再重读booking/version、SUM已确认/完成/未到访人数+external_count。跨场次按ID锁；所有容量增减/外部人数/容量调整同协议。

幂等用owner/route/key事务advisory lock + 复合PK；锁后查fingerprint，业务写和响应同事务。相同key不同body409。咨询读取SKU/生成不可变快照同事务，引用产品锁与SKU保存互斥。

最后管理员使用固定账号策略锁，禁止并发停用造成无管理员。序列化/死锁给安全重试错误，不在结果不明时自动重复非幂等写。网络/文件上传在DB事务外，metadata+audit原子并补偿对象失败。
