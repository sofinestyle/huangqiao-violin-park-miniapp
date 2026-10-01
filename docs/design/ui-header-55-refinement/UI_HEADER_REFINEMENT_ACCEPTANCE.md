# 首页固定品牌栏微调记录

日期：2026年10月1日；操作者：Codex；基准：`4cb687d3779ade1867d11f301610d4c7a42b58dd`，实施前工作区干净。依据用户最新要求，仅调整Logo大小、园区名称字体及颜色，55px棕色品牌栏和滚动固定效果保持。

## 修改与验证

仅修改 `miniprogram/miniprogram/pages/index/index.wxss` 中 `.home-logo` 和 `.home-brand-name`：Logo规格由116×72rpx调整为139.2×86.4rpx，即原来的120%，保持原件及aspectFit。名称字体优先 `Microsoft YaHei` / `微软雅黑`，缺失时回退 `PingFang SC` / sans-serif；颜色由暖白改为从参考图文字区域取样的 `#E2C88F`，没有改全局Token或Design System。

390px微信原生编译及滚动检查通过。Logo由60×37px显示为72×44px；高度取整来自rpx换算，不是改变原图比例。品牌栏实测55px，在滚动0/450/1015px及回到顶部时top均为0；Logo和园区名称均完整容纳于栏内，右侧名称保持居中。文字对深胡桃木底色的纯色对比度约8.25∶1；未记录原生运行异常。

[原生检查](after-native.json)、[冻结核对](verification-results.json)及[Design QA](DESIGN_QA.md)记录实际结果。453份基准Git文件中仅首页WXSS变化，其余452份、完整WXML、业务文件、原始图片、需求、Skill、Design System及前轮证据未变；25份业务原件SHA-256/尺寸校验通过。

## 图片与边界

[改前](before-00.png)、[改后首屏](after-00.png)、[滚动至页尾](after-02.png)、[同图对照](header-comparison.png)、[品牌栏细节](header-after-detail.png)。这些为本轮390px原生截图；没有用旧截图替代新实现验证。

微软雅黑并非各手机系统都预装。已验证的是字体优先顺序及当前模拟器的无衬线呈现，不保证每台设备实际调用微软雅黑；未下载、嵌入或引入未经授权的字体文件。若未来必须在所有设备使用同一字体，须另核实可分发的授权字体资源及字体加载范围。

本轮未重复执行其他宽度、真机、字体放大、辅助功能、入口点击、五导航、返回及Loading/Error/Empty测试；前轮通过不冒充本轮复验。没有修改品牌栏定位/占位、WXML事件及路由，没有进入Phase 2或发布小程序。等待人工查看本次Logo、字体和黄色效果。
