# 媒体与云存储审计

结论：YES，推荐PG保存业务媒体元数据、CloudBase PG Storage私有桶保存文件；继续用Node的media ID接口授权。不将图片/视频二进制入PG，不开放桶公共读来绕过SKU/发布状态。

## 当前事实

依据server/media.mjs、public-product.mjs、product-sku.mjs和http.mjs：上传只准content/admin；JPEG/PNG/MP4/WebM、64MiB上限、content-length、基本魔数、流式SHA-256；随机文件名防覆盖。图片rights可空，视频仍要求说明。上传media.duration初始NULL，教学发布时长来自content.data.duration；不能声称已有服务端完整媒体探测/转码。

media表保存id/filename/mime/size/sha256/stored_name/rights/duration/created_at。usedBy每次动态扫描content与全部SKU图片，不是持久字段，历史停用SKU仍算关联。当前读引用扫描有全表与逐产品查询，异步迁移先批量取数再本地匹配，避免请求内串行N+1。

| 路径 | 当前权限/行为 | 云存储适配 |
| --- | --- | --- |
| POST /api/admin/media | Cookie+角色+CSRF，原始文件流；上传不等于发布 | 保留入口，Server向私有对象存储流式/分段上传；不让游客直接写桶 |
| GET/HEAD /api/media/:id | published内容直接引用，或published产品当前enabled SKU引用才允许；否则410 | 每次新请求从PG重新判定，再认证读取对象 |
| GET/HEAD /api/admin/media/:id/file | 有效后台Cookie+content权限 | 历史停用SKU/草稿可预览，禁止公开缓存 |
| /assets/* | 已有images目录静态品牌/参考图公开 | 审核后的品牌资源随构建/公开静态资源托管；不要把私有上传混入此路径 |

已下载字节不能撤回；当前正在传输的流不因下架立即中断，这一边界云化后要保留说明。授权重新核对发生在每次新请求。

## 对象Key和一致性

建议每环境独立bucket，key如`media/<media-id>.<ext>`，由Server生成且不可复用覆盖。现有stored_name可作为对象key字段继续使用（由环境存储适配器解释），无须为视觉名称重命名所有引用；若以后支持多bucket再通过正式Migration扩展，不在本轮改字段。业务数组仍存/api/media/id，API/快照不保存短期签名URL。

上传顺序：验证身份/大小/头→上传隔离对象并计算SHA→完成对象验证→PG事务写media+audit→返回业务media ID。对象存储与业务PG不能假装一个ACID事务；失败删除本次未关联的临时对象，补偿失败进入可追踪孤儿清单，不能自动扫删历史共享素材。客户端断线、网关超时、对象完成但DB失败、DB已提交但响应丢失都需专项测试。

SHA-256继续保存真实内容摘要，不把ETag当SHA；filename仅显示，不作为对象路径；rights原语义不变；duration继续保持当前业务契约，服务端探测/格式兼容校验列生产化待办，不承诺已完成。不要默认扩张64MiB，需要验证网关上限与最长上传/播放超时后再批准。

CloudBase PG模式还有平台storage.objects等元数据，不能直接SQL插入它来替代文件上传。采用官方Storage API/SDK；项目media与平台对象清单通过bucket/key对应，应用账号与平台服务凭据分离。[PG存储差异](https://docs.cloudbase.net/storage/pg/faq)。

## Range与播放方案

**首期推荐Node受控代理Range。** 保持既有URL/发布撤销语义，Node鉴权后把Range/HEAD传给私有Storage认证下载接口，流式转发200/206/416、Content-Range、Content-Length、Accept-Ranges/MIME。关闭代理缓冲，不将整段视频载入内存；用户取消即终止上游请求。CloudBase官方CLI的[PG对象下载](https://docs.cloudbase.net/cli-v1/storage)已有Range/HEAD参数，但本项目真实容器→Storage→微信播放仍未实测。

签名URL是后续性能候选：Node确认权限后生成短期URL，减少视频经过Node的计算/流量。但链接有效期内可能继续访问已下架媒体，且客户端缓存、过期续签、拖动重试、域名和日志泄露要处理；不能默认它具有当前“每次请求重新鉴权”语义。官方[访问方式](https://docs.cloudbase.net/storage/pg/serving)确认签名URL存在有效期。首期不为节省流量静默降低下架保护，真有需要再明确撤销窗口。

## 删除、usedBy与权限验收

内容安全删除仍不删media或文件。结构删除/停用SKU继续保留图片引用；Admin usedBy包含历史，Public只认当前有效引用。同一文件被另一个published有效产品使用时仍可公开。以后独立媒体清理要先全引用检查并有单独批准。

必测：published+当前SKU独图允许；停用唯一引用拒绝；产品继承图允许；archived产品拒绝；另一有效引用保留；历史Admin图允许；匿名访问桶/Storage API被拒绝；越权上传/预览拒绝；Range头非法/后缀/越界/HEAD/取消/冷启动/慢网；上传补偿；hash对照；usedBy全种类；对象与PG联合恢复。以上为待实施验证，不是本轮已通过。
