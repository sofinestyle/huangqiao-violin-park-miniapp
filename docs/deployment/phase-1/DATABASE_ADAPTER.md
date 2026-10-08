# Database Adapter

采用node-postgres pg Pool。最小query/one/maybeOne/many/execute/transaction；SQL使用$1参数，不模拟同步API。一个事务绑定一条client，嵌套业务沿用同一事务，外层await完成再COMMIT；失败ROLLBACK，最终release。

JSON入参明确序列化，pg出参直接对象；金额/BIGINT按安全范围转number，日期时间按契约处理。PG错误集中映射23505/23503/23514/40001/40P01，不向客户端输出SQL、表名或连接凭据。连接数/超时配置有限且校验，SIGTERM关闭池。
