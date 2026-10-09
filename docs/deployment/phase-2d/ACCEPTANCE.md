# Approved Business Migration Result

结论：**PARTIAL PASS**。33条无歧义业务内容、60条SKU、7张唯一新图片已进入指定Staging并完成真实验收；L201及Development版“琴韵初体验”未执行，来源完整保留。操作者：Codex；人工授权及套餐决策：本会话项目负责人；日期：2026-10-09；代码基准：6d28ceaa4b2eb966729c230d6bcfce1c5c12b7d9。

Development Source：127.0.0.1:55433 / hq_development / app，运行角色hq_dev，API 127.0.0.1:8787。只读当前PostgreSQL的content、media、product_skus，未查询SQLite。迁移前后来源Hash均为5c06e8618db3f84da50198796ad641016f922277ac5d3030632c3a32adb284a9，见[source-unchanged.json](source-unchanged.json)。

Staging Target：huangqiao-staging-d2d1dj1bb4ad90 / postgres-i56vqlwu / app；Run huangqiao-api；逻辑私有桶huangqiao-media。公开API为https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com。没有连接Production或修改Schema、Migration、角色权限、桶权限、Gateway、Run部署、业务协议及页面代码。

## Source Inventory

|模块|记录|状态|关联资源|图片|视频|新版SKU|旧规格产品|
|---|---:|---|---:|---:|---:|---:|---:|
|site|1|发布1|2|2|0|0|0|
|spot|4|发布4|19|19|0|0|0|
|instrument|8|发布8|7|7|0|10|7|
|cultural|20|发布20|1|1|0|0|20|
|study|6|发布5、下架1|6|6|0|0|0|
|teaching|18|发布2、草稿14、下架2|7|3|4|0|0|

总计57条内容、15条已登记媒体、10条新版SKU，与本地恢复结果一致。模块间存在共享资源，不能相加作为上传总数；site包含1个系统Logo。完整实时盘点见[source-inventory.json](source-inventory.json)。

## Dry Run

APPROVED：33；ALREADY_MIGRATED：4条Guide；SKIPPED_VIDEO：18条教学内容、4个视频文件；MANUAL_REVIEW：2；CONFLICT：0个未解释冲突；MEDIA_TO_UPLOAD：7；MEDIA_REUSE：3。

同名套餐冲突已按人工决策转为待确认，不表示两版本相同。逐条清单、原规格、目标Option/Value/SKU及URL映射见[dry-run.json](dry-run.json)。首次事务Hash与后续兼容校正的最终映射Hash分别留存，未重写执行历史。

## Migration

|模块|本次执行|保留或待确认|Staging最终数量|
|---|---:|---|---:|
|site|1条整体内容|已发布；固定site身份与原系统Logo引用兼容|1|
|spot|0|原4条/19图片逐项不变|4|
|instrument|7条、40SKU|L201暂不写；原Staging L2及10SKU不变|8|
|cultural|20条、20SKU|保留标题、分类、价格、顺序和状态|20|
|study|5条|新增4发布、1下架；原套餐不变；Development同名版暂不写|6（5发布、1下架）|
|teaching|0|18条来源内容及4视频文件排除；原Staging L12视频不变|1|

首次单个PG事务仅新增content/media/product_skus，成功结果见[execute-result.json](execute-result.json)。141条最终业务表记录逐项回读并比对：content40、media31、product_skus70；原有7条内容、24条媒体、10条SKU未被覆盖。全部迁入内容继续isTest=true，既有发布规则正常适用；Test不表示隐藏或正式上线批准。

验收发现并在本批新建site内完成两项兼容校正：首先，详情接口既有固定/site请求要求site ID为`site`，因此仅将新建site的UUID改为该单例ID；其次，旧系统Logo路径在统一网关失效，校正为当前已部署静态地址/assets/yorray-logo-CFmraOUS.png。该Logo与images/yorray-logo.png字节Hash完全相同，不上传、不建立业务media。两次校正均完整匹配全部40条content后才更新本批site，并在事务内保护十张表；没有修改原有人工内容或API。见[site校正](site-compatibility-result.json)、[Logo校正](logo-compatibility-result.json)、[系统原件证据](system-asset-verification.json)。

L1保持尺寸×颜色10组合及原SKU编码、参考价和独立图片；L301/L501/L701/L901/L1101/L1201只将明确的5尺寸映射为当前SKU-2，不创造颜色、材质或附加价格；20文创“默认规格”转换为单规格，各1SKU。空SKU价格与图库按现有规则继承，咨询报价不新增金额，单品组合均不超过50。

## Media

上传7张唯一新图片；复用3张已经登记的Guide图片；原19张Guide图片全部保持；4视频文件跳过；最终失败0、孤儿对象0、缺失对象0。Storage对象数24→31，与app.media 31条逐项对应。

7张新图均通过CloudBase控制台上传到逻辑桶，并通过控制台下载回读，与本地源大小/SHA-256匹配，见[upload-verification.json](upload-verification.json)。没有直接操作COS。去重仅合并相同字节；workshop.jpg、wenchuang.jpg及原上传副本共用一个对象，内容引用顺序保持。

30张最终图片的公开/api/media请求全部200，字节Hash匹配，系统Logo静态请求也200；39条发布内容详情全部200，SKU有效价格/独立及继承图库匹配。见[post-verification.json](post-verification.json)。未下载或新增Staging原有视频。

## Protected Data

|表|迁移基线行数|首次新增及site ID校正后|原有行、主键、关键字段、逐行Hash/表Hash|
|---|---:|---:|---|
|accounts|1|1|相同|
|sessions|2|2|相同|
|audit|12|12|相同|
|idempotency|4|4|相同|
|migrations|1|1|相同|
|visitors|0|0|相同|
|bookings|0|0|相同|
|changes|0|0|相同|
|consultations|0|0|相同|
|slots|0|0|相同|

证据包括表名、行数、主键、安全关键字段、每行完整记录Hash及表Hash，Session/幂等识别值再次摘要，不导出凭据。见[迁移前](protected-before.json)、[迁移后](protected-after.json)、[逐行比较](protected-comparison.json)。

初始只读观察期间，3条原有过期视频上传任务的Hash变化；发生于Execute之前，关键清理字段与既有后台清理机制一致。初始快照另存[protected-initial.json](protected-initial.json)，未将该变化掩盖为迁移成功。紧邻Execute基线、事务内前后及回读的保护检查通过。

迁移之后，真实后台验收登录正常新增1条account.login审计和1个会话，旧行全部不变，见[独立登录增量](admin-login-protection-delta.json)。随后Logo兼容事务在新基线（audit13/session3）前后逐行不变，见[校正前](protected-before-logo.json)、[校正后](protected-after-logo.json)。这两条正常登录记录不是Development认证历史导入；不能将整轮观察期误报为所有表始终完全不变。

## Admin Verification

真实统一网关后台已登录，工作台内容记录40。六类列表数量、标题、编码、排序、状态和封面核对；预览L1独立SKU图片、L301转换尺寸、文创单规格、site整体资料、原“琴韵初体验”、新增套餐及下架样例。全部只读预览，没有点击保存、上传、删除或提交业务。后台图片以实际完成加载为准，不将刚挂载的未完成状态当失败或成功。证据见[admin-acceptance.json](admin-acceptance.json)及[evidence](evidence)。

## Mini Program Verification

微信开发者工具Stable2.02.2608070/基础库3.17.3，真实Staging编译条件与API来源核对。首页、企业、品牌、点位导览、乐器、文创、研学、教学和我的共9页面读取通过；首页不再显示“暂未发布”。乐器8（本次7+原L2）、文创20、研学5公开、点位4、教学仅原有1条。

27条本次产品详情的60个SKU通过实际按钮选择，核对选中身份、价格、咨询可用、图库顺序、独立与继承规则；4条新增发布套餐详情通过。site兼容校正后重验受影响页面。未发生未捕获运行时异常，已验公开内容和图片均无404。首次自动化SKU读取早于渲染导致断言失败，增加真实状态等待后复验通过，没有修改产品逻辑。见[native-acceptance.json](native-acceptance.json)及页面截图。

Staging与Development仍有明确差异：Development为L201、编码01/5岁以上/2小时套餐；Staging保留原L2及编码0001/6岁以上/3小时套餐。没有把名称或数量相近误报为同一数据。

## Manual Review Required

1. **L201普及实木小提琴（violin-L201）**：4/4旧规格包含“3年自然风干欧洲木材”，当前SKU字段不能无损承接该附加说明。其余尺寸虽明确，也不拆分或丢弃该说明；整产品未写入，来源完整保留。
2. **Development“琴韵初体验”（package-1，编码01）**：与Staging原0001版本的年龄、时长、图片、介绍不同。负责人明确“两个版本都保留，待另行明确Development版本的新名称和编码”；Staging原版不变，Development版等待新名称/编码后另行处理。本轮不自动起名或生成编码。

## Non-migrated Data

没有导入accounts密码、sessions、audit/idempotency/migrations历史、visitors、bookings、changes、consultations、slots、旧认证及本地运行/数据库配置。全部18教学内容、4个视频文件及联调测试信号排除。未改来源业务、原始25份文件、云Schema、业务代码或Production。

## Tests and Limits

11项专项单元测试通过；独立本地PG测试库验证中途失败原子回滚、同一冻结计划重跑不重复、人工修改拒绝及现有/site公开Service兼容。Admin Build、Mini Program Type Check、25原件Hash、diff检查通过。本轮没有重复声明前次200项回归为新执行结果。

真实后台和微信开发者工具浏览验收通过；没有验收微信真机、Production、预约/咨询写入、正式业务规则或正式素材授权。上传、静态字段兼容校正和资料展示均只属于已授权Staging/Test范围。

## Final Status

**PARTIAL PASS**：无歧义批准数据全部成功，两条MANUAL_REVIEW等待独立业务确认。完成本轮后停止，不继续迁移待确认内容、Production正式化或微信发布。
