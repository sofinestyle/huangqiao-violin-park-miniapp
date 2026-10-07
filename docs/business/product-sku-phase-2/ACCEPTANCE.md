# Product SKU Phase 2 Acceptance

**READY FOR HUMAN ACCEPTANCE**

正式Baseline：e7696e64b96db9d5bbe4e23291934160ae7ac762；Server Commit：26d64a9eec5296c5a358553909f05bdd81aafacb；Mini Program Commit为本文件所在交付提交（精确SHA在最终交付/Git历史）。本轮正式验收Diff：Baseline → Mini Program Commit。两个提交不合并、不修改旧验收历史；main正常推送，提交后核对本地/远端与clean状态。

## 完成范围

Public Options/SKU最小契约；按sort选择真实有效默认SKU和逐维可用性；唯一SKU解析；图片/参考价同步及inquiry裁剪；simple自动SKU；产品咨询要求skuId并重新校验；不可变产品+SKU+Option快照和参考价上下文；Admin及游客记录新旧显示；Public上传媒体依据当前有效引用授权；历史Admin引用保留；旧spec正式身份依赖0；受保护Reset dry-run及初始化准备。NO MIGRATION。

没有新增交易、库存、支付、购物车、ERP、角色或全局Option模型。SKU1稳定身份、50组合限制、Content Delete、业务状态机、媒体URL、CSV字段和后台视觉体系保持。

## 证据

[TEST_REPORT.md](TEST_REPORT.md)：135Node、14SKU1浏览器功能组、12CD组、11跨端闭环组及旧Admin兼容；八后台页、Build/Type Check、25原件、Backup Restore、权限/媒体及四手机宽度均通过。截图来自真实微信开发者工具及Chrome，全部合成隔离资料，无真实客户或Token。不是微信真机截图。

主要截图在screenshots/：01默认、02切换、03不可用、04图库、05参考价、06咨询摘要、07本人记录、08单规格、09后台详情、10三维、11文创、12过期规格、13旧咨询；另8张320/375/390/430布局证据。

## 人工重点

选择4/4棕色确认图价和咨询摘要一致；不可用组合无法选择；使用“重新选择规格”可进入稀疏组合；单规格不出现默认规格；后台停用后旧页面不能提交；后台改名/Code/价不改历史快照；Admin历史图片可见但仅停用SKU引用的上传图片Public不可读；核对四宽度触控、换行及信息密度。

## 初始化与未执行

Reset共享库实际执行：**NO**。共享开发数据删除：**NO**。测试期42受保护文件hash一致。**READY FOR DATA RESET**仅表示受保护隔离重建和dry-run准备已验证，不等于DATA RESET EXECUTED，不授权实际共享/正式清理。正式初始化依DATA_INIT_PLAN另行明确环境、备份与批准；未录入正式产品数据。

未执行真机、生产/正式微信环境、Safari/Firefox、完整无障碍及长期压力。旧开发商品无SKU不可咨询；静态品牌assets仍公开；旧咨询只读兼容保留。具体限制见TEST_REPORT，不将未授权工作标成已解决。

Product SKU Phase 2已完成，等待人工验收。未清空共享开发数据库，未录入正式产品数据，未执行生产部署或正式发布。完成提交推送后停止，不自动进入下一阶段。

本地8787服务已用HQ_SEED_MODE=none重启为交付接口，供人工验收。13张表重启前后逻辑内容完全一致；未执行共享库写测试、reset或Seed。
