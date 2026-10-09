# Deployment Phase 2D — Approved DCR

确认人：项目负责人（本会话用户）；日期：2026-10-09。基准6d28ceaa4b2eb966729c230d6bcfce1c5c12b7d9，开始Local main、origin/main与GitHub main一致且工作区clean。

原文依据：用户完整指令“除教学视频内容外，当前Development中已有业务内容原则上全部保留，并迁移至CloudBase Staging”，并明确Dry-run无未解释冲突后“允许执行已批准、无歧义部分”。本轮允许当前本机PG业务内容和关联图片迁入指定Staging，新增离线规划工具、隔离验证与证据；不改Schema、Migration、API、业务页面、CloudBase权限、Gateway、Run部署或Production。

来源固定127.0.0.1:55433/hq_development/app，读取当前PG；旧Guide manifest仅用于识别已迁移目标，旧SQLite不是本轮来源。目标postgres-i56vqlwu/app，环境huangqiao-staging-d2d1dj1bb4ad90、逻辑私有桶huangqiao-media。

业务冲突处理：用户2026-10-09明确回复“两个版本都保留，待另行明确Development版本的新名称和编码”。Staging现有“琴韵初体验”保持原样，Development package-1不写入，列MANUAL_REVIEW。不是覆盖批准，也不自动起名。

规格转换：L1已有SKU-2按现模型；六条旧乐器明确尺寸映射尺寸Option→Value→SKU，顺序保持，不推测颜色、材质或附加费用；L201 4/4旧说明“3年自然风干欧洲木材”无当前SKU字段承接，完整保留在源及人工清单，暂不写入。20条文创只有空说明“默认规格”，对应SKU-2单规格，价格/图片/排序/业务资料保持。

安全范围：33条新增content、7条新media、60条SKU，全部isTest=true，archived保持。4条Guide/19图片、目标原有人工内容及SKU逐项保护，不写十张受保护表。先Hash去重与对象检查，再以单个受保护PG事务登记；首次新增事务仅INSERT；验收后两次精确匹配并保护的UPDATE只校正本批新建site单例ID和系统Logo静态引用，不触及人工原有内容。无DELETE、无云端DDL、无凭据导出。系统Logo使用当前已部署的同字节Vite静态地址，不上传、不注册业务media。旧/assets业务图全部改为/api/media，文件原件不动。

认证/Session、预约/咨询/场次/变更、账号密码、审计/幂等/Migration历史、18教学内容与4视频文件、本地运行配置全部排除。已有Staging L12视频不删除、不修改。
