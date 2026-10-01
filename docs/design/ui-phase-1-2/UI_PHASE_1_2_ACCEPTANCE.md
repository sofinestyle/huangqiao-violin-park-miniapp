# Homepage UI Phase 1.2 390px验收记录

2026年10月1日；结论：**READY FOR HUMAN REVIEW**，人工视觉验收待确认。本轮只做390px精修，不推倒重做已确认结构，不开展其他尺寸适配或Phase 2。

## 版本与授权衔接

任务开始实际HEAD为Phase 1的5c2ec2d52eb042a94033986ac46d19bc0232e5dd，工作区包含上轮尚未提交的Phase 1.1源码和证据。用户本轮明确对1.1的390px“有条件通过”并将其他尺寸移至后续。先按既有Git授权归档独立Phase 1.1提交 **382bd938b8cf2593f56e524631c2687a24a66505**，完整记录当时未执行项；不是补称上轮四宽度通过。随后确认main工作区clean，保存348份跟踪文件摘要，才开始Phase 1.2编辑。最终Phase 1.2提交消息为 `feat(ui): polish 390px homepage visual design`；SHA及推送结果以交付回复和Git日志核实，不把自引用SHA写入提交正文。

## 实际变更

只修改首页index.wxml和index.wxss：WXML仅两处入口图源、一个“详情”操作标签；WXSS仅Header、CTA、首页入口、故事细线、摄影轻暖覆盖、点位箭头、推荐开放排版、Footer与局部间距。Tag结构、事件/参数、条件/循环、Hero图/主体/尺寸/标题/辅助短句、故事全文、九个Section顺序不变。Token未改，历史@media窄屏规则原样保持。

六项整改归纳：①Header约缩10%Logo并优化留白/字重；②Hero CTA缩小视觉面和圆角、保留95×44热区；③乐器陈列替换重复Hero，教学换讲解照片，小图面积增15.6%；④Explore与两推荐只加轻暖UI层，统一点位小图/箭头；⑤推荐去白底商品卡边界，详情简化但整卡点击保留；⑥Story细线、Typography/Spacing微调和深胡桃木Footer克制收尾。详细素材选择见[ASSET_REVIEW.md](ASSET_REVIEW.md)。

## 390px实际证据与回归

原生机型iPhone 12/13 (Pro)，window390×671，screen390×844；主内容高1701.789px。原生单帧618×1334，完整拼接618×2697，方法见[screenshot-assembly.json](screenshot-assembly.json)。仅此390px执行本轮截图和点击，未采集其他宽度。

- [完整长图](homepage-after-390-full.png)，[精修前](homepage-before-390-full.png)，[TARGET vs CURRENT](target-current-full.png)，[前后对照](before-after-390.png)。
- 五局部：[01 Header＋Hero](390-01-header-hero.png)、[02 Services＋Story](390-02-services-story.png)、[03 Explore Hero](390-03-explore-hero.png)、[04 Spots＋Recommended](390-04-spots-recommended.png)、[05 Footer](390-05-footer.png)。

| 本轮检查 | 实际方法 | 结果 |
| --- | --- | --- |
| 微信原生编译/显示 | 官方miniprogram-automator launch原工程，原生前后及修正后截图 | 通过，捕获未记录exception |
| Hero CTA | Element.tap核对tour目标页 | 1/1通过 |
| 六Quick Services | Element.tap乐器/文创/研学/教学/导览/咨询，各核对路由 | 6/6通过 |
| Explore CTA | Element.tap核对tour目标页 | 1/1通过 |
| 四点位 | Element.tap逐项核对spot页与对应ID | 4/4通过 |
| 两推荐 | Element.tap逐项核对package页与对应ID | 2/2通过 |
| About | Element.tap核对about目标页，原完整intro在该页保持 | 1/1通过 |
| 点击尺寸/横向边界 | 原生量测15个主要目标，每项至少44×44px，在390px视口内 | 通过 |
| 静态补充 | npm run typecheck及git diff --check | 通过，不代替实际tap |
| 原件 | scripts/verify_originals.py，25份文件大小/SHA-256一致 | 通过 |
| 冻结 | 实施前348文件摘要逐项核对；只首页两源码改变，其余346份一致 | 通过 |

点击证据：[interaction-results.json](interaction-results.json)及click-*.png。15次均为本轮官方SDK Element.tap；不复制1.1测试结果，不包含API替代原生导航的计数，没有提交预约、咨询或登录资料。测量、冻结和纯色对比度见[verification-results.json](verification-results.json)。

## QA、未执行与限制

[DESIGN_QA.md](DESIGN_QA.md)重新比较TARGET与最终390px完整/五局部同板，并记录相邻缩略图重复的首轮发现、修正和同宽度复查。唯一交付结论READY FOR HUMAN REVIEW，不宣布最终视觉通过。母版视觉冻结需人工确认。

**未执行**：320/375/430截图与适配；真机、字体放大、屏幕阅读器、物理弱网、新一轮Loading/Error/Empty模拟、原生导航/返回人工补验、后台/登录/完整预约业务回归、微信上传/审核/发布。前两类尺寸由用户明确移至下一阶段；本轮其他页面只核对首页入口到达，不验收其完整业务。

限制：文创图仍复用手作活动，独立正式成品素材待补；教学图为现有乐器知识讲解，实际授课素材待补，不认定为新课程承诺。后台改变点位排序、图库长度或推荐封面需复核入口图的语义和裁切；未新增专用素材字段。首页摘要保持获准静态版本，About仍动态完整；后台intro变更需要同步维护。Shared基础rpx样式可能影响其他宽度，历史窄屏规则没有修改，未处理该影响。现有原生导航保持冻结，未因目标图调整。没有宣称运行期数据库字节不变或完整无障碍认证。

## 范围及版本完整性

AGENTS、Design System、Skill、原始照片/Logo、旧阶段证据、TS/JSON/全局WXSS、API/模型/后台/server/shared均保持原样，无新增依赖。新增内容只在本阶段证据目录。新增/变更文本认证格式扫描未发现疑似密钥，结果见[sensitive-scan-results.json](sensitive-scan-results.json)，不等同完整历史或截图OCR安全审计。独立提交后正常推送GitHub main，不force push、rebase、squash、amend或重写历史。

**390px等待人工视觉验收，尚未开始320/375/430px适配，未进入Phase 2。**
