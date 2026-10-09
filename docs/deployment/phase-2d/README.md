# Phase 2D 交付与执行边界

负责人查看结果：打开微信开发者工具的原小程序项目，选择顶部“Staging · 云端”编译模式。首页、乐器、文创、研学、品牌及点位已经有批准的测试资料；“我的”显示STAGING · 云端。切Development仍读取本机PG，不会修改或同步云数据。

完整结果见[ACCEPTANCE.md](ACCEPTANCE.md)。两项待确认完整保留在来源，未执行：L201旧规格附加说明的承接方式、Development“琴韵初体验”的新名称和编码。当前Staging原套餐和原L2不能被当作已迁入的对应Development产品。

## 工程工具

scripts/approved-business-dry-run.mjs只读本地PG，并消费操作者导出的Staging快照；不建立云连接或执行写入。scripts/business-migration/plan.mjs生成稳定目标身份、去重媒体及明确旧规格转换；sql.mjs只生成受保护的PG新增事务。系统site保留既有固定`site`身份；系统Logo只使用已核实与原件相同的部署静态资源。

本批私有工作文件位于被忽略的.local/approved-business-migration，包含来源快照、控制台快照、冻结计划、SQL和7份上传副本。来源固定hq_development/app，目标固定批准的Staging。重新规划需由操作者获取新证据并核对冲突，不能依赖旧快照无条件执行。身份、源Hash、人工现有行、Storage元数据或十张保护表发生变化，执行事务拒绝。

同一冻结计划的幂等、失败回滚、人工覆盖拒绝及/site协议兼容已在独立本地PG验证；没有为演示幂等而重复写云端。首次执行和两项仅限本批site的兼容校正历史分别保留，最终完整回读证明结果一致。当前材料不是Production或后续待确认数据的执行批准。

## 证据入口

- source-inventory.json、source-unchanged.json：当前PG数量与来源不变。
- dry-run.json：最终逐条内容/规格/URL映射；dry-run-initial.json：首次计划。
- execute-result.json、site-compatibility-result.json、logo-compatibility-result.json：实际云事务成功。
- protected-before/after.json、protected-before/after-logo.json、protected-comparison.json：逐行保护及明确时间边界。
- admin-login-protection-delta.json：迁移后正常后台登录的独立增量。
- upload-verification.json、post-verification.json：云图片字节回读、公开内容/价格/媒体验证及零孤儿。
- admin-acceptance.json、native-acceptance.json、evidence/：真实后台与原生模拟器验收。
- local-transaction-verification.json：隔离PG事务验证。

数据库运行文件、账号凭据、媒体副本、临时CSV/SQL均不进入Git。未改业务代码、Schema、云配置或Production；交付后停止。
