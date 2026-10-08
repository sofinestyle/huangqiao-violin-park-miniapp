# Deployment Phase 1 Test Report

环境：2026-10-08；Node26.3.1；PostgreSQL18.4；本机专用cluster端口55432、hq_test_phase1数据库；每个fixture使用随机test_ Schema，恢复创建独立hq_test_restore_数据库，结束清理测试目标。未接触共享SQLite业务写入。主验收Baseline：55542ba036f38eca0fc37636f1d1c05df2418f92。

## Checkpoint A（先验收再B）

Foundation 8c50b2d6af120de75ee889aaae5d97431f8c555e。真实PG5组：13表/重复Migration/JSONB/FK/Check/事务回滚；Content+10SKU身份/0价格/并发version；10请求争最后1名额仅1成功；并发相同幂等咨询只1条且快照不变；编码大小写/组合唯一及失败DDL回滚/迁移校验和保护。5通过、0失败、0跳过。Build/Type Check/25原件通过后独立提交A，才进入B。

## Checkpoint B 自动化

最终Node共147项：原有135项迁移为真实PG（保留业务断言，SQLite专用迁移/PRAGMA/恢复断言改成PG等价验证）；A新增5项；B新增7项。Passed147、Failed0、Skipped0、Cancelled0。测试不使用同步数据库模拟器。测试脚本的命名路径仅用于随机PG Schema生命周期，不是SQLite适配器。

| 范围 | 实际覆盖 | 结果 |
|---|---|---|
| Database | 初始化、重复校验、JSONB、DATE/TIME、金额null/0、BOOLEAN、稳定排序、约束、SQL失败回滚 | PASS |
| 容量/并发 | 两个独立Worker连接争容量；10并发最后名额；跨场次、系统外人数、取消/改期、version | PASS |
| 幂等 | 相同key相同payload10并发1条咨询；不同payload409；失败不保存响应 | PASS |
| 引用删除 | 4类内容、published保护、咨询/场次/预约快照关联、删除与新咨询并发10轮、SKU不孤立 | PASS |
| SKU | simple/10/20/12/50、改名/恢复原ID、code大小写唯一、无效组合、0/null价格和图库继承 | PASS |
| 权限/账号 | admin/content/reception/anonymous/本人访客，停用/角色/密码/导出变化，锁后重新认证，并发停用阻止后续写 | PASS |
| HTTP生产边界 | HTTPS Origin限制、Secure/HttpOnly Cookie、devAuth关闭、Health、禁止测试内容写生产 | PASS（本地配置验证） |
| Media | 图/视频签名/大小/Range/HEAD、SKU公开A—F、停用历史Admin、DB失败补偿对象 | PASS（Local） |
| CloudBase Provider | 私有认证、POST二进制、HEAD、Range、签名时长、redirect/error、Key校验 | PASS（明确fetch替身；非真实云） |
| Audit/CSV | 保留action+中文、导出公式保护、授权范围、1223条分页/过滤、同时间id稳定排序、单SQL快照 | PASS |
| Backup/Restore | pg_dump导出一致快照、新空PG恢复、对象hash/数量、旧Session撤销、损坏/非空拒绝、增量复用且删旧集后仍可恢复 | PASS |
| Reset/Seed | development+回环hq_test_+临时目录标记、symlink拒绝、dry-run不改变、isTest、repeatSeed | PASS |

性能为本机机制证据，不作云容量承诺：审计1223条，SQL只返回20/50/100分页，首/中/尾和actor/action/time组合均返回正确total；本次观测亚毫秒至数毫秒级。50SKU Public Detail100次、三维选择100次均无明显异常；浏览器50SKU打开保存通过。详细时长随并发和机器变化，不承诺固定指标。

## 实际界面与微信模拟器

Browser plugin not available；按frontend-testing-debugging使用现有Playwright+Chrome154.0.8037.99。没有新装浏览器依赖。全部使用独立PG、隔离uploads及合成账号/联系资料；未Mock业务保存成功。

- Admin9组：登录/退出、终态咨询、CSV、active、保存忙碌/真实冲突重试、分页/action、八页Sidebar及1280/1440/1728；0运行时错误。重复用户名现在由PG错误映射返回409（原500），浏览器测试将其明确作为预期失败。
- CD12组：四类删除、历史引用、并发发布/新引用、Option/Value删除恢复、原SKU ID/价格/图片/manual原因保留、version/busy、审计、八页；0运行时错误。
- SKU15组：simple、10→20、删除/恢复、批量价/图库、真实本地图上传、50上限、version、12SKU文创、三桌面宽度；行高60px。新Seed已结构化，旧读保护使用明确独立legacy fixture，未退回旧写模型。
- 微信开发者工具实际原生12组证据：390px iPhone12/13(Pro)模拟器、SDK3.17.3；Admin创建发布10SKU→游客列表→选择4/4棕色→480参考价/独立图→提交skuId咨询→后台SKU快照→我的历史记录；simple、20三维、12文创、过期SKU拒绝刷新、旧spec历史、改码改价快照、50SKU、八后台页。0异常。不是浏览器宿主渲染，不是微信真机。

四份原始JSON证据位于browser/admin、browser/delete、browser/sku、browser/native，合计36张实际截图。截图人工查看了原生规格选择与后台咨询详情，显示与合成SKU一致；未改Admin视觉或小程序页面。

## 构建与安全核查

Admin Build、Mini Type Check、build:mini隔离开发环境包、微信原生编译/模拟器、25份原件SHA-256/大小、git diff --check均PASS。server正式源码无node:sqlite、prepare、PRAGMA或BEGIN IMMEDIATE。SQLite原始Migration原样转历史目录，原库只读归档19媒体，未清理。

生产依赖npm audit --omit=dev为0风险。本轮安装时完整依赖检查报告已有开发工具链11项（6moderate/2high/3critical）；未盲目force升级，需在不改变SDK/构建行为前提下另行评估，不能当作生产运行依赖漏洞已修复。

## 未执行

真实CloudBase PG/Storage/签名URL/视频、云托管与HTTPS、正式微信身份/真机、Staging/Production、发布均未执行。Docker CLI不可用，镜像构建留云托管门槛；本机运行入口实测不能替代镜像验证。本轮未重复320/375/430微信尺寸（无游客UI改动）；未执行Safari、完整无障碍、大型压力测试。未安装云定时备份或真正执行30天清理，仅提供策略/dry-run和可复用独立增量集合。所有限制不以替身或截图冒充真实云能力。
