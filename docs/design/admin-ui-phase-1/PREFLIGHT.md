# Admin UI Phase 1 实施前核查与白名单

日期：2026年10月7日；操作：Codex。本轮实施已经由用户明确批准，最终视觉仍待人工验收。

## 正式基准

首次既有工作检查点：68d329b33b2cb882970010a290f8dd03bd283021，129个审查文件。来源为DEC047—056：品牌设计/实施、首页标题例外、乐器抽屉试点、登录视觉及制琴工匠图片。新文件116个，按文本、图像、Word与设计验收材料分类核查；无构建目录、日志、凭据或运行Mock。历史HTML中的状态示意为独立设计稿，不导入后台运行路径。Git按明确文件清单暂存，未使用git add -A。

上传期间另一聊天产生DEC057欧洲工匠背景；已读取其用户明确指令核实来源。自动审批曾拒绝补充提交，随后本聊天用户明确批准这4个文件独立提交与推送。补充基准：73c6dd9564eb14e4a737759f2e88a7fc674871c5。另一聊天已结束；本地main、origin/main及GitHub main逐一核对一致，git status --porcelain为空。

此前源码、登录图片与历史原件完整保留。本轮Baseline → Phase 1之间的Diff才是正式验收范围。基准构建/TypeScript通过，25份原件通过，57项隔离测试通过。沙箱内首次HTTP测试因listen EPERM失败，经授权在可绑定本机端口的环境重跑全部通过，没有修改业务代码。

## 技术栈与现状

React 19.2 / Vite 7.1.7 / 原生CSS；没有组件库或全后台Token体系。App.jsx负责状态导航、权限过滤、公共外壳和工作台；Content.jsx负责六内容视图及原有非模态维护抽屉；ui.jsx自建Icon/Field/Drawer/ErrorBox/Loading/Status。styles.css为全局旧样式，instrument-pilot.css是已有局部试点，login.css是已确认登录页。

工作台overview接口只有四类汇总；内容岗位不返回接待统计。列表无分类/状态筛选、批量选择、更新时间列；维护/预览是同一抽屉操作。保留真实字段及权限，不新增通知、筛选、批量、数据字段或危险操作。日期来自系统时间并按Asia/Shanghai呈现，不使用示意日期。

## 修改白名单

- admin/src/App.jsx：公共Layout/Sidebar/Header及原有工作台入口。
- admin/src/Content.jsx：内容Header/Tab/Toolbar显示、乐器列表与复用现有新增草稿入口；ContentEditor业务保存及媒体处理冻结。
- admin/src/AdminUI.jsx：独立纯展示图标、账号菜单、Metric Card。
- admin/src/AdminOverview.jsx：原overview数据的工作台展示，复用原状态导航。
- admin/src/admin-phase-1.css：仅admin-shell及受控页面作用域，不改styles.css、login.css、instrument-pilot.css。
- docs/ADMIN_DESIGN_SYSTEM.md：独立后台规范，先检查无等效文件。
- docs/决策与变更记录.md、docs/待确认事项.md、docs/验收清单.md：本轮授权、人工待验及实际验证记录。
- docs/design-reference/admin-target-v1.png：用户原图逐字节副本。
- docs/design/admin-ui-phase-1/：本轮基准、截图、验证及验收证据。

禁止：server、shared、数据库、API、鉴权、权限、业务状态机、预约/场次/咨询/媒体/审计逻辑、游客端、公共业务组件、登录页、原始资料、依赖/框架迁移。其他后台页面主体不改，仅公共外壳统一及逐页回归。

## 验证计划

实际Chrome/Playwright检查登录→四指标→待办/快捷入口→乐器Tab/搜索/刷新/新增草稿/维护预览→全部Sidebar→退出，至少1280/1440/1728；另在隔离持久服务验证实际新增、保存、发布与下架。Loading/Error采用请求延迟/中断明确标记故障验证，截图不冒充真实业务闭环。以1440为母版比较目标，Design QA结论仅READY FOR HUMAN REVIEW。

Browser plugin not available：使用已安装Chrome及捆绑Playwright；不安装浏览器或项目依赖。Safari、真机、正式云端与完整读屏未预先承诺已执行。工作台可选照片暂不实施：现有素材缺少充分实拍真实性及正式使用依据。
