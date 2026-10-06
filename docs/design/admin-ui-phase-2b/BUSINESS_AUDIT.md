# Phase 2B实施前业务审计（17项）

日期2026年10月7日；操作者Codex。Phase 2A.1独立Commit A为2776a58824c43fb5378a5843213c836dc3aacf4e，已正常推送main，Local==origin/main且工作区clean后才开始本文件及B实施。原起点57b9c8c，Phase 1人工视觉基准b633912。用户本轮明确授权B；SSOT v1.0规则、Sidebar/Header和已完成页面保持。

已读取AGENTS、规范、Phase 1/2A审计验收、游客治理Skill/设计文档，Media.jsx、Accounts.jsx（含Audit）、App、ui/API/MediaUpload、server/http/media/security、相关业务/媒体/权限/round1/video测试与当前功能说明。当前React19/Vite7/原生CSS，独立业务HTTP/SQLite；不迁框架/加UI依赖。

| 审计项 | 素材库 | 账号权限 | 操作记录 |
| --- | --- | --- | --- |
| 1 入口 | Sidebar media | Sidebar accounts | Sidebar audit |
| 2 用户角色 | admin或content | admin | admin |
| 3 数据来源 | GET media；受保护media/id/file | GET accounts；POST accounts；PUT accounts/id | GET audit，最近500条倒序 |
| 4 字段 | filename、mime、size、rights、usedBy(id/kind/name/state)、created_at；API还含id/sha256/duration，原UI不用后两者 | safeAccount：id、username、roles、active、canExport；无显示名/部门/电话/邮箱/登录或创建时间 | id、created_at、actor、actor_name、action、object、detail；无独立结果字段 |
| 5 搜索 | 无 | 无 | 无 |
| 6 筛选 | 无 | 无 | 无 |
| 7 状态 | 关联内容草稿/已发布/已下架，或尚未关联；不是媒体新状态 | 启用/停用，独立名单导出已授权/未授权 | 原action/detail，无自行推导成功/失败状态 |
| 8 操作 | 刷新素材、预览、关闭预览；无上传/删除/复制地址 | 新增账号、管理、保存；启停/角色/重设密码/导出授权在原表单保存 | 刷新；行内details“查看”JSON |
| 9 Drawer/Modal | 原页内预览section，图片/video controls；无Drawer/Modal | 原非模态Drawer；X/Escape关闭 | 原行内details；无Drawer/Modal |
| 10 创建/编辑 | 本页无；内容编辑原MediaUpload直接上传并关联 | username新建required pattern3—40；编辑disabled；password新建required min12，编辑空保留；角色至少一个由服务端验证 | 只读；日志由真实业务写入 |
| 11 权限 | permit content；文件鉴权；上传接口仍供内容维护，不增加素材库上传入口 | permit admin；三真实role；safeAccount不返回密码哈希；最后有效admin不能停用/去admin；改动清该账号会话 | permit admin，保留全部原detail |
| 12 Empty | 原无文件提示；错误期间不能冒充Empty | 原未独立呈现，可按真实loading/error/data完善展示 | 原暂无操作记录，加载/错误不能冒充Empty |
| 13 Loading | 原useRemote与Loading | useRemote已有loading但原无Loading显示 | useRemote已有loading但原无Loading显示 |
| 14 Error | 真实remote/error，video预览原onError；图片原无自定义onError | 列表remote.error；submit catch；原输入保留 | remote.error及原刷新 |
| 15 危险操作 | 无删除 | 原表单角色/启停/密码/导出授权保存；原无二次确认，不新增；closeDisabled未设，不改变 | 无删除/导出/写操作 |
| 16 审计关联 | 原media.upload记录filename/mime/size/hash；浏览/预览不新写审计 | 原account.create/update/login；update detail只有roles/active/canExport/passwordReset，无明文密码 | 显示原业务审计，JSON不改义/不隐藏 |
| 17 其他业务关系 | 内容图库、规格图库、视频mediaId关联；上传不发布；匿名只可读发布关联 | 岗位决定后台导航/接口；导出授权独立；停用/改密/权限变更后原会话失效 | 内容、媒体、接待、咨询及账号原关键行为；保留最近500条口径 |

## 范围与处理判断

素材维持六列表格和页内媒体预览，不强改Grid；图像contain、video原controls与源地址、MIME/大小/权属/关联原样。现有首帧在Content上传组件，不把素材库变为首帧生成器。文件名可两行视觉摘要，title及原预览完整标题可查看原完整名称；权属不裁切。原三种关联内容状态用SSOT Badge，不新建媒体状态或删除操作。

账号角色继续原正式中文映射admin系统管理员、content内容维护、reception接待/客服，不改映射或权限。新增/编辑状态和导出授权仍同一原submit；原密码12—256服务端规则及原minLength不改。危险信息清楚放在原表单附近，不造重置密码按钮或确认流程。safeAccount没有登录/创建时间，因此不新增列。

审计时间、操作者、原动作、对象、原JSON全部保留，不从action推断结果，不翻译成新业务含义，不新增筛选或导出。保留details原生Keyboard；JSON完整等宽换行显示，最多纵向滚动，不隐藏原内容。所有日期继续原toLocaleString('zh-CN')，不改业务时区。

已发现原限制：账号POST忽略form.active，创建总是启用（原控件仍可勾选）；编辑已有会话无条件失效；编辑Drawer保存忙碌仍能关闭；错误message重试前未清空。辅助映射未定义role时原行为不补新role；审计仅500条，无分页/查询；图片文件原无定制错误回调。上述不属于UI阶段授权业务修复，保留并记录，不修改冻结逻辑。

## 白名单（代码修改前）

- admin/src/Media.jsx、Accounts.jsx：三页局部展示及原交互层级，保留handlers/事件/约束/数据读取。
- admin/src/admin-phase-2b.css：严格admin-management命名空间，引用原Token。
- admin/src/App.jsx：只让media/accounts/audit自行显示Page Header，不改Sidebar/Header/Login/鉴权。
- docs/ADMIN_DESIGN_SYSTEM.md：只更新本轮授权/推广状态，不改规则。
- docs/决策与变更记录.md、待确认事项.md、验收清单.md；docs/design/admin-ui-phase-2b/证据。

保护：Operations及2A.1 CSS/全部阶段证据、Phase 1/ContentEditor/MediaUpload/video-cover、公共ui/styles、Server/Shared/API/Schema/密码/角色/审计机制、游客端/图片/依赖。前后保护文件Diff/处理AST、Build/57既有测试/原件/隔离HTTP真实媒体与账号动作验证；同库受控五页及三个原运营Drawer截图比对，保证B不改变已批准页面。

## 隔离与证据

账号、角色、密码、启停等写测试只用临时SQLite与临时合成账号，禁止修改真实管理员。媒体通过原上传接口或原Content编辑上传到临时目录，测试原图片与临时合成短视频，不更换正式素材。审计通过真实原业务动作产生，不直接造成功日志。截图不存密码/Token/真实个人资料；Empty/Loading/Error仅隔离数据/传输故障，业务成功不Mock。没有本页上传、删除、筛选、导出时标记不适用，不为验收添加功能。
