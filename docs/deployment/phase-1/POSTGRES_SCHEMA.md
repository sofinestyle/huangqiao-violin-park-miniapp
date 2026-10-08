# PostgreSQL Schema

独立pg/migrations/001_initial_schema.sql；13张业务/治理表，应用独立schema。TEXT业务ID，SKU稳定UUID格式由既有校验保护；所有PK显式NOT NULL；无危险CASCADE。

BOOLEAN用于active/can_export/paused/enabled；reference_price为NUMERIC（0..10000000，null继承）；created/updated等TIMESTAMPTZ；预约日期DATE、时间TIME；过期时间毫秒BIGINT。对API返回统一ISO/HH:mm/有限number。JSONB用于content.data、SKU关系/图片、slots结构、预约/咨询snapshot及预约request；其余无需路径查询的载荷用JSON。不机械新增关系表。

SKU Code trim后ASCII字母数字_-最多64，LOWER(C collation)唯一；product_id+combination_key唯一包含历史停用身份。FK保持现有关系与显式删除。迁移checksum、版本、事务锁和失败整体回滚；CloudBase高权限DDL通道在Phase 2验证，运行账号仅DML。
