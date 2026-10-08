# Backup Recovery

PG可靠逻辑快照与Storage对象清单使用同一backup ID；manifest包括schema版本、记录数量、object_key/size/sha256。只读快照对应不可变对象，不把跨存储操作说成ACID。

Restore默认新隔离目标，拒绝非空/运行中正式目标；恢复DB、对象、FK/哈希/SKU/预约/咨询/Audit检查，再应用验证；旧Session失效。本轮仅Local PG+Local Provider实际演练，CloudBase恢复留Phase 2。

策略可配置：数据库每3天、图片每周增量、备份30天轮换。云平台自动备份留Phase 2核实并保留；30天清理仅备份集且保留增量依赖，不能删业务记录。原SQLite做最终LEGACY DEVELOPMENT ARCHIVE，原文件不删除、不再作为默认运行库。
