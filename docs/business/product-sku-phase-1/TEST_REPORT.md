# Product SKU Phase 1 测试报告

日期：2026-10-07；执行者：Codex。基准235f864dfcfb213fa1ae1b03935adec6356d194e；Foundation c2e98eb6248206802f12319746fc7f01b5dbfb15。环境：本机macOS、Node内置SQLite、真实HTTP、编译后的React Admin、Chrome（版本见browser-verification.json）。所有写测试均使用临时SQLite和隔离媒体，未连接共享业务库执行迁移或写入。

## 工程门槛

Foundation提交前：原71+新增22=93项Node测试全通过；build、typecheck、25原件、diff check通过，才开始Admin阶段。最终：原71+新增23=94项Node测试，Passed94、Failed0、Skipped0；新增23包括22项Foundation和1项游客端兼容宿主测试。`npm run build`（Vite正式构建及小程序TS检查）、`npm run typecheck`、`npm test`、`python3 scripts/verify_originals.py`、`git diff --check`通过。

既有business/round1测试只将产品写入fixture改用新契约，原权限/媒体/上下架断言继续执行。没有降低旧写拒绝以迁就旧测试。首轮浏览器检查暴露的Drawer宽度、底部遮挡和文创编辑样式已修复，最终完整运行成功；未把修复前结果作为通过证据。

## 自动测试覆盖

主证据：tests/product-sku.test.mjs、tests/product-sku-helper.mjs、tests/product-sku-mini.test.mjs；基础结果foundation-verification.json，最终结果final-verification.json。

| 层级 | 实际断言 | 结果 |
|---|---|---|
| 模式/容量 | simple创建编辑；10/20/12/50 SKU创建读取保存；51、4维、21启用值、无维度、空值拒绝 | PASS |
| 名称与ID | Trim、大小写重名、重复/非法UUID；未知、不完整、重复组合及其它产品SKU身份拒绝 | PASS |
| SKU编码 | 全局Trim后大小写冲突；空、非法字符、65字符；停用不释放唯一性 | PASS |
| 稳定身份 | 维度/值改名排序ID与Code不变；增维10→20保留10ID及覆盖资料；值/维度停用恢复；单行停用独立 | PASS |
| 转换 | simple→options复用原身份；一个启用SKU合法回simple；多个启用拒绝 | PASS |
| 差异资料 | 批量450、单行480、0、null；批量启停；产品图库继承、独立图库；非法价格/类型/URL/MIME拒绝 | PASS |
| 原子/并发 | stale version返回409；触发器模拟后段数据库失败，Product/SKU/audit整体回滚 | PASS |
| API | 原GET/POST/PUT content契约；Admin含Options/SKUs；旧写400；公开动态specs不落库；inquiry隐藏参考价 | PASS |
| 权限 | admin/content可创建201；reception403；anonymous401，无角色扩权 | PASS |
| Migration | 空库、旧content库、新旧数据读取、重复启动/幂等、空表安全rollback再apply、非空rollback拒绝；FK/Code/组合唯一 | PASS |
| 媒体 | 独立与停用SKU均进入内部usedBy；无复制；最小已发布有效启用SKU公开桥接及既有公开回归 | PASS |
| Reset/Seed | 仅专用标记临时目录、拒绝非隔离/生产；重复reset与seed；5个isTest场景 | PASS |
| Backup/Restore | 临时SQLite实际备份恢复，新SKU行内容一致，FK正常 | PASS |
| 游客最低兼容 | 未改动的乐器列表/产品详情TS在宿主运行，以wx适配调用真实隔离HTTP；10条specs可读、选项索引事件/图库/参考价无报错 | PASS，非微信原生渲染 |

Migration/API/Media/Backup验证的JSON索引与断言范围见final-verification.json；源码为可重复执行证据，不提交临时库、上传文件、密码或Token。

## 浏览器实际运行

可重复命令：先`npm run build`，再`node scripts/product-sku-browser.mjs`。需本机Chrome及Playwright运行库；可通过PLAYWRIGHT_MODULE指定现有库，无新增依赖。Browser插件不可用，使用现有Playwright Chrome。实际运行14组功能检查，全部PASS；另有1条50SKU性能测量记录，不能混算为第15组功能测试。

覆盖：新建simple；新建5×2矩阵；增套装维10→20；值停用/恢复/改名；批量450及单行480/0/null；产品图库批量继承、棕色复用、实际文件上传且只产生一份媒体；批量启停/单行停用；SKU码冲突行定位；Option/Value重复定位；两种模式转换及先保存停用提示；50SKU打开保存/21—50提醒/60组合前端拒绝；真实version409；延迟真实请求检验保存防重与关闭保护；上传期间关闭/保存/重算禁用；文创12SKU保存；八菜单/旧产品提示/登录退出。

浏览器JS运行时错误0。预期网络错误包括未登录me401、故意非法400与冲突409；favicon404与业务无关，保留原始记录。未忽略其它API失败。1280/1440/1728未出现页面横向溢出，矩阵自身允许必要的局部滚动。具体时长、每组结果、截图与错误记录见browser-verification.json。

## 信息密度与视觉检查

旧10条规格与新5尺寸×2颜色共10SKU，均用合成数据。旧截图1440×1000，新截图1440×1100；比较指标为完整编辑滚动内容高度，不以截图裁切面积判断。旧scrollHeight9714px，新3030px，约减少68.8%；新规格区域1125.875px，矩阵行60px。20SKU使用同一Table滚动，无20套重复完整表单。

实际查看单规格、10/20矩阵、批量、图片、确认及错误截图；沿现有深胡桃木主操作/暖白/系统无衬线/浅横线，未重设计后台或修改Design System。金额0与继承、图库来源及启停可读；错误字段可聚焦。其它后台页面源文件与公共视觉SSOT无改动。此检查不替代人工视觉验收。

## 数据保护、限制与未执行

共享SQLite及WAL文件SHA-256与实施前一致；共享业务数据影响=NO。原件25份一致；所有种子isTest=true。正式价格与编码未经此次测试确认。

未执行Safari/Firefox、微信开发者工具原生渲染和微信真机、生产/共享库迁移、生产部署、正式业务资料、完整无障碍审计、长期压力测试。50SKU测试是开发环境功能/耗时测量，不是生产SLA。

SKU-2的游客逐维选择、skuId咨询、快照、价格/图片联动、完整公开媒体授权、兼容退出、数据清理与正式初始化均未执行。
