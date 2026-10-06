# 黄桥乐器文化产业园 Admin Design System

版本：v1.0（已人工批准）；日期：2026年10月7日；状态：用户明确确认Phase 1通过人工视觉验收，本文件成为后台长期视觉SSOT。Phase 2A仅按本轮明确授权推广到场次管理、研学预约与咨询管理；不授权Phase 2B。

依据优先级：用户已确认[后台方向原图](design-reference/admin-target-v1.png) → 本轮Admin原则 → 游客端品牌色彩 → 现有后台业务结构。效果图数字、日期、宣传语、通知及筛选不作为业务依据。当前React/Vite/CSS与自建组件保留，不增加框架、字体依赖或UI库。游客端规范仍独立存在，不以后台规范覆盖。

## 1. Admin Design Philosophy

80%效率、15%品牌、5%文化装饰。工作台先回答“当前有什么需要处理”；列表先让运营人员识别对象、状态及操作。品牌棕、暖白与原YorRay共享，后台主体使用系统无衬线。极简意味着信息清楚、操作准确、低噪声，不采用官网Hero、沉浸叙事、毛玻璃、强渐变、重阴影或巨大标题。

## 2. Color System

Token作用域为`.admin-shell`，不改旧`:root`及登录页。代码源为[admin-phase-1.css](../admin/src/admin-phase-1.css)。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--admin-bg` | #F7F7F5 | 页面背景 |
| `--admin-surface` | #FFFFFF | 内容Surface |
| `--admin-text` | #27231F | 主信息 |
| `--admin-secondary` | #73706B | 辅助文字，不能继续降透明度 |
| `--admin-sidebar` | #2C211C | 深胡桃木侧栏 |
| `--admin-brand` | #49352B | 主按钮、选中文字、操作 |
| `--admin-gold` | #B79A68 | 仅3px选中指示线等小装饰，不作普通正文 |
| `--admin-border` | #E8E5E0 | 极浅结构边界，不独自承担交互辨识 |
| `--admin-hover` | #F1EEE9 | 按钮/菜单Hover及中性状态 |
| `--admin-focus` | #765637 | 可见Focus Ring |
| `--admin-success` / `--admin-success-bg` | #315F43 / #EAF3ED | 已发布、已完成 |
| `--admin-warning` / `--admin-warning-bg` | #8C6428 / #F7EEDF | 待确认、提醒 |
| `--admin-danger` / `--admin-danger-bg` | #8D3E32 / #FBEEEA | 已下架、失败、危险操作 |
| `--admin-info` / `--admin-info-bg` | #456270 / #EDF2F4 | 信息状态预留 |
| 控件边界 | #B7B0A7 | 输入/选择控件，较结构线清楚 |

主字/页面背景14.54∶1；辅助字/白底4.93∶1、辅助字/页面底4.60∶1；白字/主按钮11.49∶1；成功、危险文字与对应底色均高于6∶1，提醒约4.60∶1。实际核查数据见本轮verification.json；以上为纯色计算，不代表全站无障碍认证。

## 3. Typography

导航、表格、按钮、表单、数据、状态及说明均使用`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`。品牌名/页面标题可保留适度文化感，本轮操作页面标题采用现代无衬线，品牌通过原Logo及木棕体现。登录页按既有确认版本冻结，不顺带统一其衬线按钮。

## 4—6. Font Size / Font Weight / Line Height

| 角色 | 字号 | 字重 | 行高 |
| --- | --- | --- | --- |
| Page Title | 26px | 600 | 1.35 |
| Greeting | 20px | 500 | 1.4 |
| Section Title | 16px | 600 | 1.5 |
| Card Label | 14px | 500 | 1.5 |
| Metric Number | 34px | 600 | 1.35 |
| Body | 14px | 400—500 | 1.6 |
| Secondary | 13—14px | 400 | 1.5—1.6 |
| Caption | 12px | 400 | 1.6 |
| Button | 14px，表内13px | 500 | 1.5 |
| Table Header | 14px | 500 | 1.5 |
| Table Body | 14px | 400—500 | 1.5 |

数字使用系统字及tabular-nums，不使用宋体数字。12px只用于编码、附属说明等；主要数据和操作不能因为留白缩小。名称不固定高度裁掉，长名称允许自然换行。

## 7. Spacing

4px基准，序列4/8/12/16/20/24/32/40。页面左右32px，指标间16px，主区块间24px，Surface内部24px。非模态抽屉出现时为既有编辑区留空间，允许表内横向滚动。信息密度不以大量空白换“高级感”。

## 8. Border Radius

控件8px，图片6px，轻标签5px，表格容器10px，指标/面板12px。头像可圆形；不把所有区域做胶囊或16px以上圆角。

## 9. Border

结构线1px #E8E5E0；表格只保留极浅横线及容器边界，不设置竖线。输入边界#B7B0A7，以保证识别。Active同时有文字字重及细线，不仅靠颜色。

## 10. Shadow

指标卡0 2px 12px、3%胡桃木；普通Table无Shadow，普通面板只有轻Border。Dropdown 0 10px 32px、12%；抽屉-8px 0 24px、5%。不同时使用重Border与重Shadow。

## 11. Sidebar

Desktop宽220px；较窄桌面180px。品牌区原YorRay图、园区名及轻说明，菜单48px高、24px左右边距、14px字体及统一20px线性图标。保留八个菜单及原权限过滤。Active为8%白色透明底与左侧3px香槟金线，Hover为5%白色透明底。底部仅轻品牌名，不添加照片、未批准口号或复杂纹理。

## 12. Header

64px，浅暖底，无重边框。左侧现有栏目上下文，右侧当前真实用户名、首字母头像和下拉。账号操作使用原生按钮，支持Tab/Escape、点击外部关闭和焦点返回。退出复用原logout函数；无通知业务，不显示铃铛或虚构角色。

## 13. Page Header

主标题26px，说明14px；内容维护右侧主按钮按当前类别显示“新增乐器/文创/研学套餐/教学内容”等，调用同一既有草稿入口。工作台日期/问候来自系统时间与当前账号，按Asia/Shanghai动态呈现。待办是当前汇总，不伪称全部今日产生。

## 14. Metric Card

四列、间距16px、高度至少144px；Label14px、数字34px、说明13px；零值正常显示，接口未返回为“—”，加载为Skeleton。接待岗位外的字段继续不读取/不披露，用明确权限说明，不伪造0。有待确认仅小点和淡琥珀强调。指标操作为轻文字链接，不以整卡大按钮抢权重。

## 15. Button

Primary深胡桃木白字、40px高、8px圆角、9px/16px内边距；Secondary白底浅线。表内轻文字动作36px高，使用准确的既有“维护 / 预览”合并动作，不能在没有独立预览流程时拆成两按钮。Danger仅对应既有危险操作；本轮不新建删除/下架菜单。

## 16. Input

白底、8px圆角、40px最小高度、14px字体，Placeholder不低于辅助字对比。Label保留原嵌套语义，Focus 3px品牌棕；搜索组合控件在父容器显示完整Ring，不重复两圈。表单错误与上传行为继续由现有组件处理。

## 17. Select

沿用原生select及options，尺寸与Input一致。不得为效果图加入未实现的分类/状态筛选。账号和业务表单既有选项不增删；此规范不意味着其他页面Select已全部升级。

## 18. Tabs

保留六类别及顺序；无按钮卡，间距28px，Inactive辅助字；Active深字、600字重及2px品牌下划线。使用group与aria-pressed，原生按钮Tab/Enter/Space操作，未假称完整ARIA tablist箭头模式。

## 19. Table

Header44px；常规Row70px；封面46×46px，contain完整显示原图，6px圆角。名称14px主字、编码12px次级，类别100px、状态110px、排序72px、操作140px。名称占剩余宽度并换行，操作稳定；最小表宽720px，受控横向滚动，操作列在窄容器保持可见。只保留现有六列，无更新时间/勾选框/新排序功能。

## 20. Status Badge

12px字、3px/8pxPadding、5px圆角、小圆点与文字并存。已发布淡绿、草稿浅灰、已下架淡暖红；待确认淡琥珀、已完成低饱和绿为后续统一规范，不自动扩展其他页面状态逻辑。纯色点不能替代文字状态。

## 21. Empty State

无数据使用小图标、短标题和说明，无大型插画。真空列表有“新增乐器”CTA；检索无结果使用“清空搜索”，不得暗示系统无任何记录。加载失败不呈现“暂无内容”。真实空与检索空分别验证，隔离数据性质在证据中说明。

## 22. Loading

指标Skeleton轻脉动，列表保留原Loading文字及aria-busy；不修改请求/超时流程、不造成功状态。原useRemote的加载期间清空数据行为继续保留，列表错误/空状态不得盖过真实加载。Reduced Motion禁用动画。

## 23. Error

保留服务端真实错误消息，淡暖红小区域、role=alert。工作台/列表可复用原refresh重试；新增本地视觉重试入口不新增接口。不得将故障下的“—”或空表称为真实零数据。

## 24. Modal

规范预留：标题18px、内容14px、12px圆角、轻浮层Shadow，Header/内容/Footer清楚。保留现有Modal模型；本轮目标页面无Modal，不为设计体系创建未使用模态流程。

## 25. Drawer

保留既有非模态aside/dialog，不改为模态遮罩。乐器Desktop520px、≥1400时560px；原固定Header、可滚动正文及固定保存区保留；≤1100进入文档流，保证键盘背景可达。既有Escape、上传/保存忙碌保护及返回焦点继续有效。没有重新实现ContentEditor保存和媒体流程。

## 26. Toast

规范预留：短文案、低饱和状态色、轻Shadow、可读14px，状态需可辅助播报，不替代字段错误。当前无全局Toast，不新增消息系统，不把原保存关闭行为伪装成Toast能力。

## 27. Pagination

规范预留：40px控件、当前页同时有字重/边界、禁用有语义、明确条数口径。现有接口没有分页协议，本轮不新增分页。乐器“条数”为当前接口返回的可见列表/检索结果，不能宣称服务端总页数。

## 28. Dropdown Menu

账号菜单采用可复用UserMenu展示真实登录身份与唯一现有退出动作，220px最小宽、12px圆角、轻Shadow。使用常规按钮键盘顺序，非应用式role=menu，不虚构角色/设置。列表本轮没有低频业务Dropdown，不新增“⋯”无功能占位。

## 29. Hover / Active / Focus / Motion

按钮160ms颜色过渡、表格浅灰Hover、Sidebar低透明Hover/Active；3px清楚Focus，侧栏内部2px浅金Ring。只为装饰点/图标设置aria-hidden，Icon-only动作须可访问名称。prefers-reduced-motion下关闭Pulse与Transition。不增加弹跳、发光、长动画，未使用Modal/Drawer装饰进入动画。

## 30. Responsive Desktop Rules

1440母版；验证1280与1728，内容Surface最大1440px，超宽不无限拉伸。≥1101保持四指标及两主面板；≤1100使用双指标、面板单列与流式乐器抽屉。≤700仅提供现有导航兼容与可滚动操作，不宣称完成手机后台。长名称/长编码/较大排序需保留操作宽度；常规记录行高70px，长文本允许增高，不用裁切隐藏信息。

## 应用边界与推广

共享组件ui.jsx、styles.css、业务API与ContentEditor处理函数冻结。新AdminUI展示组件由Phase 1引用；旧业务页面主体继续原样，仅受公共外壳统一影响并需逐页回归。本规范中的Modal/Toast/Pagination等未使用组件是后续受控实施规范，不能报告已全面实现。Phase 2必须等待本轮人工确认及新的明确范围。
