# 小程序环境切换操作说明

当前阶段：Phase 1；Production未启用。**切换只是改变小程序连接的API，不会迁移资料、修改数据库配置或改变数据库结构。**

## 查看与切换（项目负责人）

1. 在微信开发者工具打开本项目的 `miniprogram` 文件夹。
2. 点击顶部“普通编译”或当前模式名称右侧的下拉箭头。
3. 选择 **Development · 本地** 或 **Staging · 云端**，等待编译完成。模式会从“我的”页启动，无需修改任何源码或URL。
4. 在“我的”页确认显示 **DEV · 本地** 或 **STAGING · 云端**，再点击底部导航查看各栏目。其他栏目期间顶部编译模式仍可查看；详细API目标也会输出在开发工具 Console。
5. 每次换环境必须重新编译。页面返回、修改地址参数、清除登录缓存都不会在当前运行过程中切换目标。不要把“预览/上传”当作环境切换。

|环境|连接位置|资料来源与注意事项|
|---|---|---|
|Development|`http://127.0.0.1:8787`|本机127.0.0.1:55433的hq_development PostgreSQL。旧开发资料已选择性恢复；先运行npm run dev并保持运行。手机不能使用电脑的127.0.0.1，API不直接读取SQLite。|
|Staging|`https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com`|CloudBase Staging PostgreSQL，由云端API读取；与本地资料独立。提交业务申请会写Staging，应仅进行已批准的测试。|
|Production|未配置、禁止启用|无正式域名，不连接正式数据。|

目前本机已准备好两个编译选项。新电脑或选项未出现时，让开发人员执行一次 `npm run mini:prepare`，再重新打开项目；该命令保留已有编译模式、个人设置及安全设置，不关闭合法域名或证书校验。后续负责人只用下拉菜单。

Development默认本地；体验版（trial）固定Staging并隐藏调试标识；正式版（release）当前直接阻止API访问。两个环境分别保存登录身份；首次使用新缓存键需要重新登录，不能把本地登录当作云端登录。

## 当前已知验收条件

2026年10月9日本地运行恢复已完成，操作见[LOCAL_DEVELOPMENT_RECOVERY.md](LOCAL_DEVELOPMENT_RECOVERY.md)：npm run dev自动启动本地PG/API，本地首页、4点位、8乐器、20文创、5已发布套餐、2已发布教学和“我的”已实际显示。Staging仍缺少首页site资料，首页提示未发布，文创列表为空；这是云端资料现状，本次没有补录云资料。历史Phase 1的NOT READY记录保留，当前本地/云端对比结论见新的恢复验收。

Staging合法域名尚未完成微信平台配置，本机验证沿用原有“不校验”开发设置；本次切换脚本不修改该设置。其他电脑若被域名校验阻断，应由负责人处理合法域名配置或另行批准隔离调试，不能将跳过校验用于上线验收。

## 上线Production前

必须另行批准正式环境、真实正式API域名、平台合法域名及正式数据政策；随后由开发人员实施独立Production构建与release防护验收。本阶段不能通过改参数、设置APP_ENV=production或填写MINI_API_BASE绕过禁止启用规则。完成真实微信身份、真机、读写隔离、异常及上线审核后再发布；不直接删除当前防护。

技术配置唯一来源：`miniprogram/miniprogram/environment-settings.ts`；构建只写环境选择器，不重复写域名。验收证据见 [Phase 1验收](docs/deployment/miniapp-environment-phase-1/ACCEPTANCE.md)。
