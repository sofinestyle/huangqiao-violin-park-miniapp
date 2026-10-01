# CR001 核查证据

日期：2026年10月1日；操作者：Codex；环境：本机开发服务、React/Vite网页后台、微信开发者工具模拟器。原生截图显示的是模拟器，不是微信真机。测试内容为现有资料及本轮非商品/非教学联调样例，检查后已下架。代码基线44fcc89，最终修订版本查项目 `git log -1`。

| 文件 | 用途与事实边界 |
| --- | --- |
| [admin-desktop.png](admin-desktop.png) | 1280×720桌面后台，内容维护中乐器与文创独立入口，保留原L系列和人工替换的L201封面 |
| [admin-mobile-during-check.png](admin-mobile-during-check.png) | 375×812窄屏后台检查时截图，包含非商品联调样例；截图后的下架不改变该历史图 |
| [miniprogram-home.png](miniprogram-home.png) | 原生首页、六入口及五项固定导航，系统固定测试条已移除 |
| [miniprogram-instruments.png](miniprogram-instruments.png) | 五类品类筛选、原产品保留、搜索框裁切修复后的截图 |
| [native-remaining.json](native-remaining.json) | 16次实际点击跳转结果、场次起止时段和两秒视频播放至结束，无页面异常；与已通过的前段首页/乐器检查分段记录，不表示一次全量脚本成功 |
| [native-final.json](native-final.json) | 样例下架后最终五类与全部筛选结果；产品样例不再显示，视频旧详情无播放器且有不可用提示 |
| [archived-http.json](archived-http.json) | 产品/教学详情404、旧视频地址410，本机公开接口新请求结果 |

自动化业务回归 `npm test`：37通过、0失败、0跳过；`npm run build`后台构建和原生TypeScript检查通过；`npm run verify:originals`共25份原文件一致；`git diff --check`通过。界面验证用浏览器真实上传原图副本、产品规格图片及两秒MP4色块信号，保存发布后检查模拟器实际播放，再下架核查。没有购买资源、向微信上传代码或发布。

测试脚本见 `scripts/native-round1.cjs`。默认包含首页与乐器前段及剩余入口，`remaining`只执行后段；设置 `HQ_TEST_LESSON_ID`才检查指定已发布视频的播放和咨询入口。使用前应确认本地服务、工具服务端口及样例状态，不使用真实预约资料。现有本轮样例已下架，直接重放旧ID播放检查预期失败，不应为了自动化结果把样例长期保留为公开内容。

未执行：iOS/Android真机、真实微信身份、云部署、正式资料及经营参数批准、平台审核和发布。详情见[变更报告](../../需求变更_CR001.md)。
