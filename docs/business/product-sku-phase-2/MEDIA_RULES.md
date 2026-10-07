# SKU-2 Media Rules

/api/media/:id 的GET/HEAD及Range每次重新判断公开引用：Product published且自身images引用，或当前结构enabled SKU引用有效图；失效组合、停用值、停用SKU、下架产品不授权。任何其它合法发布引用仍可授权。默认Product图不因某SKU拥有独立图而失去产品级公开引用。

Admin /api/admin/media/:id/file沿content权限（admin/content），历史停用SKU可预览。usedBy保留全部Product/SKU历史引用；咨询快照不产生媒体授权。图片继承不复制URL入库或复制文件。没有自动媒体清理；静态assets作为原有公开品牌素材不进入媒体动态授权。

逐项测试A—F、Value软删除及结构不完整、共享图、视频、Range、权限；no-store防止新请求使用旧授权，已下载内容无法撤回。保留当前图片上传无需说明、视频需说明规则。
