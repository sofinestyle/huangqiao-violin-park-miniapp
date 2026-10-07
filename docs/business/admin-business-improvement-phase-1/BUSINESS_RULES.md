# 批准业务规则

来源：2026-10-07 用户完整指令，状态 Approved for Implementation；Pre-ABI 6181efab945a5ed792f97ba00b9b6b21eee6fe30。

1. ABI-01：closed 咨询只读，pending/following 原合法动作不变，服务端保护保留。
2. ABI-02：CSV 复用真实列表筛选全部匹配记录；无筛选仍导出全部授权范围；canExport 独立控制。
3. ABI-03：创建 active=true/false 生效，默认 true；停用不可登录。
4. ABI-04：密码重置/角色集合/启用状态变化使所有目标会话失效；canExport-only/no-op 保留会话，权限实时读取。
5. ABI-05：保存中不能关闭、离开或重复提交；失败显示真实错误且保留 Drawer，成功沿原行为关闭刷新。
6. ABI-06：page/pageSize，默认50、允许20/50/100，时间 inclusive、精确 actor/action、SQL 分页、稳定倒序；三个索引 Migration；旧无参数数组兼容。
7. ABI-07：集中中文显示映射，同时原始代码；未知 raw fallback；筛选提交原始值，数据库不变。

七项以外冻结，Admin Design System v1.0 继续遵守。正式数据不用于写测试；不生产部署或发布。
