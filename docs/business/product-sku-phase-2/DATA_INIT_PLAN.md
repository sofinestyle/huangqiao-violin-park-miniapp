# SKU-2 Data Init Plan

本阶段仅准备与隔离验证。共享开发库Reset实际执行：**NO**。READY FOR DATA RESET仅表示受保护隔离流程已验证，不授权共享/正式清理。上线清理仍需明确目标环境、负责人、备份和批准。

A. 保留Schema、migrations版本1—5及必要系统配置。SQLite表：content、product_skus、accounts、visitors、sessions、slots、bookings、changes、consultations、idempotency、media、audit、migrations。正式管理员通过现有create-account安全机制新建，密码不入Git；旧测试账号/Session不能沿用。content中site属于配置和业务文案混合，先审核导出必要配置，不能原样复制测试统计/电话/价格。

B. 未来获批清理顺序：停止写入；备份；失效sessions/idempotency；changes→bookings→consultations→slots→product_skus→测试content；测试visitor/account；测试media和测试audit按明确记录处置。SQLite整库备份保持原证据，不级联猜测。不得把未经确认的真实资料混入此清单。

C. 媒体：按备份manifest逐文件校验；只有明确测试且没有需保留引用的上传文件才可随未来获批清理移除。项目images/原件/品牌assets全部保留；共享素材不得按文件名猜测删除。

D. reset-sku-dev只允许development、专用临时目录和标记，拒绝共享.local/生产/符号链接；--dry-run列清范围不写，--confirm-reset才执行临时重建。此脚本用于开发样本，不能作为正式初始化脚本。测试Seed isTest=true；正式环境不导入测试seed。HQ_SEED_MODE=none用于跳过启动测试Seed，保留系统建表/迁移和账号机制；当前server仍仅支持development，不因开关而宣称生产架构完成。

E. 执行前使用backupData备份SQLite+media（含hashmanifest），恢复至新隔离目录演练；不覆盖原库。保留版本与操作人/时间。正式清理脚本/实际路径需要未来另行批准。

F. 执行后验证：Schema/Migration正确、FK/quick_check、无测试业务数据/旧Session；管理员权限正确；人工录入正式产品/Options/SKU/媒体并逐条发布审核；无自动测试商品；可公开图片/咨询/记录闭环；备份恢复验证。正式价格、产品资料、媒体版权、微信账号/域名不由此阶段测试确认。

隔离启动验证补充：HQ_SEED_MODE=none的新库保留既有Schema Migration的审计，不把系统迁移审计当作测试业务清理。Migration2是原开发文案迁移，关闭Seed时空库无该旧文案，不为凑版本号写入假记录；核心Migration5存在且可幂等启动。当前Admin新产品默认isTest=true；正式录入准备必须在获批初始化环境中明确正式标记的导入/审核机制，不能直接把测试Seed或默认开发录入当成正式商品。
