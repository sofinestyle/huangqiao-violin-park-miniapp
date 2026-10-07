# SKU-1 测试计划

隔离原则：所有写操作临时SQLite+隔离媒体；记录共享库hash，不启动共享服务迁移。测试帐号随机凭据不输出；截图不含密码/Token/真实客户资料。

Foundation：simple创建编辑；10/20/12/50组合；51拒绝、4维拒绝、21启用值拒绝；空维/重名大小写、UUID和归属、完整组合、码格式/大小写唯一；价格null/0/450/480/非法；图库继承/独立/非法URL/MIME；改名ID稳定、增维保留10ID、停用恢复、单SKU停用、模式转换合法非法；旧写拒绝、公开投影只读、version409、事务全回滚；admin/content/reception/anonymous；Migration空库/旧库/重启幂等/安全rollback、Backup/Restore；安全reset保护与重复seed；50SKU保存读取计时。

先完整npm test、npm run build、npm run typecheck、25原件、diff check；Foundation失败不进入Admin矩阵。现有产品写测试迁至新契约，保留原媒体/权限/下架断言，不放宽旧写保护以迁就测试。

Browser：使用真实编译Admin+临时HTTP服务、Chrome Playwright；无模拟业务成功。simple、10SKU、增维20、值停用/恢复/改名ID与code，批量450/单行480/0/null，批量图库/独立上传、批量启停/单行无效、模式转换、错误定位、50SKU打开保存、忙碌/上传防重复、1280/1440/1728、8菜单回归及login/logout。保存前旧版10条规格截图；保存新版7类截图及before/after；开发旧产品可读提示。游客最低回归：build/typecheck及旧列表/详情消费新投影，无正式游客代码改动。

验收不以截图替代API/DB断言；报告每层Passed/Failed/Skipped及未执行生产/微信真机/完整SKU-2能力。最终仅READY FOR HUMAN ACCEPTANCE或NOT READY。
