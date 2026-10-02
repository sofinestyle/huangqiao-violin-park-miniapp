# 乐器产品统计与圆角留白调整

日期：2026年10月2日；基准：4277aed；实施前工作区clean；人工验收待执行。

依据本轮明确指令，首页显示动态数量“款／乐器产品”。原series统计是品类数，不能改名后继续作为产品款数；本轮新增仅首页本地stats.instruments，计算既有公开product中非gift且有category的条目数，保留原series与旧统计字段。当前测试资料为7款，不写死数字，不认定为正式宣传数据。API、数据库、后台、旧字段、其他业务TS不变。

导航顶部增加3px：组件本体与每项49→52px，顶部padding 3→6px，图标／文字／选中线尺寸和路由不变；首页及另四个tab页的底部预留49→52px。标注圆角为主视觉下方全宽浅色内容区域上角24px：局部home-content包裹后续内容，以负16px间距和顶部16px留白衔接，原图片及完整介绍未删除，快捷导航位置未改变。没有全局样式改动。

通过：微信官方自动化原生编译和390px渲染，首页显示7款乐器产品，实际查看两张原生区域截图，圆角可见、导航安全区背景连续、统计未被遮挡；TypeScript、25份原文件大小及SHA-256和diff格式通过。native-results.json与inspect.json保留运行数据；普通Page.$无法找到独立自定义tabBar为既有工具查询限制，不代表组件缺失。

未执行：其他三宽度、真机、五导航与其他入口实际点击／返回、Loading／Error／Empty本轮复测。导航组件事件及所有原页面业务路由不变，已有测试不当作本轮重新执行。

文件范围：首页index.ts／index.wxml／index.wxss、custom-tab-bar/index.wxss、四个其他tab页index.wxml的3px底部预留，以及本记录／决策追加／原生截图。截图：homepage-rounded-content-390.png、homepage-summary-nav-390.png。完成后停止，等待人工验收，不发布小程序。
