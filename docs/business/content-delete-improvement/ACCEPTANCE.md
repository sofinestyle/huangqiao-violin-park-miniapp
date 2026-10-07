# Content Delete & SKU Delete UX 验收

状态：**READY FOR HUMAN ACCEPTANCE**，等待人工验收；不表示人工最终通过。

Baseline：b4b95b5b3627c27360709590c32a13256fa05c78。Implementation为包含本文件的`feat(admin): add safe content deletion and SKU delete UX`独立提交，确切SHA见Git记录与交付消息。main正常提交推送，不修改已验收历史。

## 已交付

CD-01：乐器/文创/研学套餐/教学内容列表保留“维护 / 预览”并增加删除；仅draft/archived可执行，published禁用且提示先下架。点击先读取服务端删除检查，已知引用直接呈现不能删除及原因；无引用才显示二次确认。DELETE事务重新检查当前状态、咨询、场次及预约引用，再检查version；成功同步删除安全产品的SKU，保留媒体、业务历史与audit，新增content.delete中文映射。失败保留列表并显示真实原因，成功刷新当前列表及轻量提示。

CD-02：Option/Value显示删除文案；未保存新定义直接移出本地Form，临时候选同步移除。已保存定义enabled=false退出当前结构，原SKU按原diff退役、历史价格/图片/Code/ID保留，manual原因不改。主区只显示有效定义，折叠入口可恢复；输入同名历史定义后提示恢复并采用原ID，不创建第二套身份。SKU行仍启用/停用。删除确认不即时写服务器；保存内容统一事务，取消编辑无写，version409继续保护。最后Value不能删空；最后Option需安全转simple，多个启用SKU先调整并保存。

NO MIGRATION；未增加deleted字段、角色、媒体清理或回收站。shared/sku-model.mjs身份算法、server/product-sku.mjs及Schema不变。

## API契约

- GET /api/admin/content/:id/delete-check：沿content权限，200返回{id,kind,name,state,version,allowed,code,message,references:{consultations,sessions,bookings}}。没有客户明细，预检查结果不替代DELETE二次检查。
- DELETE /api/admin/content/:id：JSON `{ "version": 1 }`（使用实际版本）；200 `{ "ok": true, "id": "实际ID" }`。400非法版本/不支持类型，401匿名，403权限，404 CONTENT_NOT_FOUND，409 CONTENT_DELETE_REQUIRES_UNPUBLISHED / CONTENT_DELETE_REFERENCED / VERSION_CONFLICT。引用错误带非敏感数量。
- 既有GET/POST/PUT兼容；Option/Value继续整产品PUT，无独立删除接口。错误响应新增可选references，旧客户端不受影响。Audit detail仅{id,kind,name,state}，原raw action保留。

## 测试和证据

[TEST_REPORT](TEST_REPORT.md)：原94+新增15=109项Node全部通过；12组CD浏览器+14组SKU回归全部通过；Build、Type Check、25原件、diff check通过。八后台页正常；原游客列表/详情宿主回归通过，原生/真机未执行。

[最终验证JSON](verification.json)、[CD浏览器JSON](browser-verification.json)、[SKU回归JSON](sku-regression.json)。原SKU回归截图留在临时测试目录，未覆盖原验收证据；本轮所需截图：

1. [内容删除入口](01-content-delete-action.png)
2. [内容删除确认](02-content-delete-confirm.png)
3. [引用阻止删除](03-content-delete-reference-blocked.png)
4. [维度删除入口及矩阵](04-option-delete.png)
5. [维度删除影响确认](05-option-delete-confirm.png)
6. [规格值删除影响确认](06-value-delete-confirm.png)
7. [输入同名历史值后的恢复提示](07-restore-historical-value.png)
8. [恢复原身份后的矩阵](08-restored-value-result.png)

## 人工重点与限制

重点验证按钮对应真实安全删除、引用失败原因、删除后usedBy变化且素材保留、取消不写库、同名恢复身份、manual停用不误启用、价格图片不丢失。存在历史引用时保持下架，无法删除是预期保护。首次维护旧specs产品仍采用SKU-1只读提示；本轮允许其在无引用且非发布时安全删除，不建设旧规格映射。

内容不能普通恢复；规格只有持久定义保留历史。没有进入SKU-2，无游客逐维选择/skuId咨询/完整Public媒体验收；未清理共享开发库或正式初始化。本轮未重启共享开发服务，功能验证与截图来自加载最新代码的隔离服务。未执行浏览器/设备与生产项目见测试报告。

共享开发数据库删除任何内容：**NO**。数据库/WAL及媒体哈希保持；开发热更新日志变化单独排除且不纳入Git。未删除真实业务数据、未执行生产部署或正式发布。完成正常推送和clean核对后停止，等待人工验收。
