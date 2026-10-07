# Product SKU Phase 2 Test Report

日期：2026-10-07；操作者：Codex；Baseline e7696e64b96db9d5bbe4e23291934160ae7ac762。Server Commit：26d64a9eec5296c5a358553909f05bdd81aafacb。Mini Program实现版本为本报告所在交付Commit，精确SHA见最终交付与Git历史。

## 环境与结果

macOS；Node内置测试、SQLite；Chrome 154.0.8037.99；微信开发者工具Stable 2.02.2608070、基础库3.17.3。全部写测试在临时SQLite、隔离uploads；微信使用临时项目副本和随机本地API端口，无wx请求Mock或WXML浏览器仿真。原小程序config和共享库不被测试改写。

|验证|结果|证据|
|---|---|---|
|全部Node|135 passed / 0 failed / 0 skipped；原111+SKU2新增24|npm test；sku2-server15、sku2-mini8、sku2-init1|
|Server独立提交A|126/126；Build、TS、25原件|SERVER_VERIFICATION.md|
|Admin Build + Mini Type Check|PASS|npm run build / npm run typecheck|
|Mini原生编译与交互|PASS，11功能组+1性能记录|e2e-verification.json；scripts/sku2-e2e.mjs|
|SKU1 Chrome回归|14功能组PASS+1性能记录|sku1-browser-regression.json|
|Content Delete Chrome|12/12功能组PASS|content-delete-browser-regression.json|
|旧咨询Admin实页|PASS|admin-history-verification.json|
|320/375/390/430|各两维+三维长标签，8/8 PASS；最小44px触控区，无横向溢出|native-viewports.json与layout截图|
|原件|25/25大小、SHA-256一致|scripts/verify_originals.py|
|共享保护|测试前后42个受保护文件hash一致，包括SQLite/WAL/媒体/本地凭据文件；不将hash或凭据入库|本次本地核验；无共享删除/写测试|
|diff check|PASS|git diff --check|

## SKU2新增自动测试覆盖

server15：Public白名单与Product级列表；simple/10/20/12；Option/Value sort；无历史/内部字段；null继承/0覆盖/inquiry产品和SKU价格裁剪；skuId必须/不存在/跨产品/停用/结构失效/产品下架；事务/幂等；改名、改码、改价后快照不变；旧咨询与一般服务；游客快照裁剪；媒体A—F及历史usedBy；anonymous/visitor/reception/content/admin权限；50SKU；Reset explicit-development/dry-run/符号链接；Backup/Restore与Migration5。

mini8：真实TypeScript helper及Page事件经HTTP连接隔离服务；排序默认/双向不可用/清空重选/唯一解析异常；simple/三维20/文创12/无SKU/稀疏组合；图片和价格原子切换、轮播归零、0、inquiry；skuId咨询/来源留言保留/同请求幂等/游客记录；后台停用后拒绝并刷新、不自动重提、保留表单；产品下架禁止提交；新旧快照helper一致；50SKU计算；每次进入咨询页新幂等键。

init1：HQ_SEED_MODE=none临时空库启动，无content/SKU/咨询/预约/场次/media测试数据，仅必要账号及既有schema.slot-enrollment.migrate审计；Schema/Migration5保留。没有改历史Migration，NO MIGRATION。

## 实际闭环

通过真实Chrome Admin新建并发布10SKU产品，配置无效组合、产品两张图、独立图、450继承/0/480覆盖；微信列表进入详情，默认真实有效SKU、1/8棕色disabled，选择4/4棕色后SKU/价格480/独立图库一致；填写合成联系信息提交，Server快照与后台详情、游客本人记录一致。另实际新建simple后咨询、20SKU三维、12SKU文创均完成咨询，50SKU加载并选择通过。

后台随后停用已打开页面SKU，原生提交得到预期409，页面刷新当前模型，保留填写内容且不自动再次创建。改名/改Code/改参考价后原咨询仍保留提交时快照。旧spec-only历史记录在原生记录和实际Admin详情可读，无undefined或空SKU技术字段。Admin八页Dashboard/Content/Sessions/Reservations/Consultations/Media/Accounts/Audit均打开；SKU1回归含50、10→20、改名、软删除恢复、manual停用、图库/价格、并发409、上传与保存锁；CD回归四类删除及历史/媒体/审计保护。

## 性能与视觉

开发环境单次：50SKU Public Detail连续100次读取37ms；Mini helper连续100次状态计算30ms；Chrome 50SKU打开+保存135ms；微信50SKU加载并逐维选择4450ms（含自动化等待和交互，非纯计算耗时）。无明显异常退化，非压力/SLA承诺。

实际渲染检查修正微信原生按钮默认宽度和样式优先级，规格Chip紧凑换行、品牌棕选中、disabled属性+文字+虚线。规格区位于核心信息和咨询入口之间；全图库轮播/导航未重设计。原生连续跨产品咨询暴露旧Page定义复用幂等键问题，修正onLoad生成新键，并增加独立回归；同页重试仍幂等。

原生工具记录1条预期SKU_UNAVAILABLE 409，不是未处理JS异常；exception事件0。存在既有本地HTTP/未验证合法域名提醒、灰度基础库及工具getSystemInfoSync/worker警告；图片实际显示。未把这些开发环境警告称作生产环境通过。Chrome无JS运行时错误，测试故意产生的权限/冲突错误按预期断言。

## 未执行与限制

未执行微信iOS/Android真机、正式微信登录/公网HTTPS域名、Safari/Firefox、完整无障碍、长期大规模压力、生产环境、正式数据、生产部署/发布。旧开发specs产品不自动迁移，无有效SKU时只读且不可咨询。静态assets为原有公开品牌资源，不适用上传媒体动态授权；已下载媒体无法撤回。正式初始化待明确环境和批准，当前脚本仅受保护隔离开发重建。

结果：READY FOR HUMAN ACCEPTANCE；工程和模拟器证据不能替代人工视觉/业务验收及上线验收。

## 本地验收服务

隔离测试结束后，仅重启已确认属于本仓库的127.0.0.1:8787本地服务，使当前代码供人工验收；显式HQ_SEED_MODE=none，不执行reset/测试Seed。重启前后只读比较13张SQLite表（全行内容哈希及数量）全部一致；Public GET已返回新SKU契约。数据库物理WAL/文件校验值可能随正常关闭检查点改变，因此上文42文件一致指测试期间，重启后的无业务修改以13表逻辑一致为证。没有生产部署。
