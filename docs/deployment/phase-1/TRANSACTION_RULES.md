# Transaction Rules

READ COMMITTED；统一次序：幂等/账号策略锁 → content按ID → slots按ID → booking/consultation → changes → audit。锁前获取关系后须锁内重读；关系改变安全失败并要求重试，不能倒序追加锁。

Content更新/删除FOR UPDATE；所有历史引用创建方FOR SHARE锁对应content后重查发布/结构。删除再次检查状态/version/引用，SKU与content删除+审计原子，不删除历史咨询/预约/媒体。

容量操作先锁目标及原slot FOR UPDATE，再重读booking/version、SUM已确认/完成/未到访人数+external_count。跨场次按ID锁；所有容量增减/外部人数/容量调整同协议。

幂等用owner/route/key事务advisory lock + 复合PK；锁后查fingerprint，业务写和响应同事务。相同key不同body409。咨询读取SKU/生成不可变快照同事务，引用产品锁与SKU保存互斥。

最后管理员使用固定账号策略锁，禁止并发停用造成无管理员。序列化/死锁给安全重试错误，不在结果不明时自动重复非幂等写。网络/文件上传在DB事务外，metadata+audit原子并补偿对象失败。

实施补充：HTTP后台小请求通过固定`hq:accounts`事务策略锁串行化，锁后重新认证，保证账号停用/角色/密码/导出授权变更与后续请求一致。采用保守串行策略，当前小型运营规模不引入额外锁平台；后续有并发性能证据再细化。响应先缓冲，COMMIT成功后才发送，避免事务失败却已经返回成功。媒体上传流不持有数据库事务，上传后在metadata/audit事务内重新认证；媒体预览短事务鉴权后独立流式传输。审计count和分页使用同一SQL语句快照，即使在外层事务中也不会读到不一致总数。
