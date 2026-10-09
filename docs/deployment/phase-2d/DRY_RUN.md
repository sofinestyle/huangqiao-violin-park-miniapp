# Phase 2D Dry-run

状态：Dry-run完成；本文件不代表执行成功。完整清单及逐规格映射见[dry-run.json](dry-run.json)。

来源：当前hq_development PostgreSQL；目标实时控制台只读快照。无SQLite查询。

|模块|记录|状态|关联资源（去重）|图片|视频|当前SKU|旧规格产品|
|---|---:|---|---:|---:|---:|---:|---:|
|site|1|{'published': 1}|2|2|0|0|0|
|spot|4|{'published': 4}|19|19|0|0|0|
|instrument|8|{'published': 8}|7|7|0|10|7|
|cultural|20|{'published': 20}|1|1|0|0|20|
|study|6|{'archived': 1, 'published': 5}|6|6|0|0|0|
|teaching|18|{'archived': 2, 'published': 2, 'draft': 14}|7|3|4|0|0|

site统计包含1个系统Logo；Logo不算业务media上传。各模块资源可能共享，不能相加作为上传总数。

|清单|数量|
|---|---:|
|APPROVED|33|
|ALREADY_MIGRATED|4|
|SKIPPED_VIDEO|18|
|MANUAL_REVIEW|2|
|CONFLICT|0|
|MEDIA_TO_UPLOAD|7|
|MEDIA_REUSE|3|
|SKIPPED_VIDEO_FILES|4|
|SKU|60|

APPROVED：site 1、instrument 7、cultural 20、study 5。ALREADY_MIGRATED：spot 4及19原有Guide媒体。SKIPPED_VIDEO：lesson 18、视频文件4。MANUAL_REVIEW：L201、Development版琴韵初体验。CONFLICT=0指无未解释、可执行内容冲突；同名套餐历史冲突已按用户决策转为待确认，不表示两版本相同。

MEDIA_TO_UPLOAD：7个唯一Hash；MEDIA_REUSE：3个目标已登记Guide图片，Guide的另外16个仍原位保护。workshop.jpg、wenchuang.jpg及873b92f3旧上传文件字节Hash相同，合并为1对象，不改变图片顺序；同批复用不重复上传。

源published会按既有规则在Staging公开展示；isTest=true是数据标识，不代表隐藏。研学验证样例保持archived；本轮不变更容量、年龄、价格或预约规则。

逐产品转换、固定UUID、SKU唯一编码、继承图库/独立图库、URL转换和所有排除内容均在JSON中明列。视频文件不进入上传目录。单品组合数L1=10，六个尺寸产品各5，文创各1，均≤50。

本机隔离PG验证：中途FK失败全部回滚、同计划重跑无重复、人工修改后拒绝。11个专项单元测试通过。现有19张Guide远端GET字节Hash通过；云对象与内容保护检查未发现不明冲突。

执行及两项site兼容校正的实际结果见[ACCEPTANCE.md](ACCEPTANCE.md)。当前dry-run.json为最终兼容映射；首次UUID计划另存dry-run-initial.json。系统Logo例外映射为当前已部署且原件Hash相同的静态资源。
