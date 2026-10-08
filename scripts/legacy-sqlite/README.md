# SQLite historical source

仅供历史实现追溯，不属于正式运行时；不构成双数据库适配器。原 Migration 原样移至 migrations/，不重写已验收历史。database-original.mjs.txt 与 backup-original.mjs.txt 保留原始源码，不作为可执行入口。

唯一当前可执行旧库工具为 `node scripts/archive-sqlite.mjs <旧目录> <新归档目录> <基准CommitSHA>`，只读原库并生成一致性归档及媒体哈希清单；不删除原库、不导入PG。正式Migration见 pg/migrations/。
