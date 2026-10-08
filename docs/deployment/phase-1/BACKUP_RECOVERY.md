# Backup Recovery

PG可靠逻辑快照与Storage对象清单使用同一backup ID；manifest包括schema版本、记录数量、object_key/size/sha256。只读快照对应不可变对象，不把跨存储操作说成ACID。

Restore默认新隔离目标，拒绝非空/运行中正式目标；恢复DB、对象、FK/哈希/SKU/预约/咨询/Audit检查，再应用验证；旧Session失效。本轮仅Local PG+Local Provider实际演练，CloudBase恢复留Phase 2。

策略可配置：数据库每3天、图片每周增量、备份30天轮换。云平台自动备份留Phase 2核实并保留；30天清理仅备份集且保留增量依赖，不能删业务记录。原SQLite做最终LEGACY DEVELOPMENT ARCHIVE，原文件不删除、不再作为默认运行库。

实际接口：`backupData({db,connectionString,storage},target,{previous})`。REPEATABLE READ导出pg_export_snapshot交给pg_dump自定义格式；同快照读取13表数量、Migration记录和对象清单。目录manifest version=2，PG dump和所有媒体哈希核验。previous相同对象经本地hash验证后硬链接（跨盘复制）复用，每套备份独立可恢复；删除旧集合不会断开新集合。

恢复通过pg_restore single-transaction进入预先创建的空数据库，拒绝任何已有用户表；目标媒体目录必须不存在。完整对象hash、13表数量及Migrationchecksum核对后撤销Session。若数据库恢复成功但对象/验证失败，明确将目标标为需隔离核查，不冒充恢复成功，不自动覆盖原业务库。

本机实际归档：`.local/legacy-archive-deployment-phase1/`，标记LEGACY DEVELOPMENT ARCHIVE；19份旧媒体经hash核验。工具只读原SQLite、生成在线一致快照；原库/WAL/媒体未清理，无数据导入PG。归档和凭据不进入Git。

应用备份调度尚未安装。`.env.example`给出3/7/30天策略；`backup-policy.mjs`输出dry-run到期清单，不自行删除。对象按immutable key增量复用，不自动清理源文件。云平台自动备份、异地加密、调度及实际保留能力留Phase 2核验；本轮未声称已运行云端定时任务。
