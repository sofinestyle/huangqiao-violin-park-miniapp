# Environment Configuration

APP_ENV明确development/staging/production；DATABASE_URL或PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD来自环境。生产无数据库配置直接失败。云端0.0.0.0+PORT，本地回环；数据库和存储凭据只Server。

开发身份仅development显式LOCAL_DEV_AUTH=1；staging/production禁止。生产拒绝测试Seed/自动管理员；独立account:create经安全输入初始化。ADMIN_ORIGIN精确HTTPS来源；HttpOnly/Strict/Secure Cookie，同源API优先。小程序只环境化API/身份，不改变SKU UI。

测试必须回环主机+专用测试库/schema标记，拒绝staging/production环境变量；Reset仅专用测试目标。Docker不打包.local/backups/uploads/Secrets；无任何真实CloudBase资源创建。
