# 本地开发资料恢复与对比

2026年10月9日：本机 Development 已恢复。旧资料只用于开发与对比，不是正式数据迁移；小程序通过API读取本机PostgreSQL，运行时不使用SQLite。

## 日常启动

1. 打开Mac“终端”，复制以下两行执行：

```sh
cd /Users/aaron/Documents/huangqiao-app
npm run dev
```

2. 看到“业务服务已启动，端口8787，环境development”后，保持终端运行。命令会自动启动本机PostgreSQL和API，无需填写数据库地址或密码；同时启动本地后台，如已有本项目后台则复用。只需要API时可用 `npm run dev:server`。
3. 微信开发者工具打开本项目的 `miniprogram`，顶部编译模式选择 **Development · 本地**。在“我的”页核对 **DEV · 本地**，再进入首页和其他栏目。
4. 选择 **Staging · 云端**并等待重新编译，在“我的”页核对 **STAGING · 云端**后查看云端资料。无需修改源码URL；Development服务可以保持运行。

关闭开发服务：在启动终端按 `Control+C`。本机PG会保留运行及数据，下一次仍用同一命令启动API。若提示8787占用，先关闭原开发终端，不要重复启动；程序不会强行关闭别的进程。若两个编译选项缺失，执行一次 `npm run mini:prepare`并重新打开项目。

## 连接什么资料

|项目|Development · 本地|Staging · 云端|
|---|---|---|
|API|http://127.0.0.1:8787|https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com|
|数据库|本机PG：127.0.0.1:55433 / hq_development / app|既有CloudBase Staging PostgreSQL，由云API读取|
|首页|已恢复企业资料及旧首页|当前缺少已发布site，显示“首页内容暂未发布”|
|乐器|8条，包括L1、L201|1条：L2|
|文创|20条|0条，显示空态|
|研学|5条已发布套餐|1条已发布套餐|
|教学|2条已发布旧视频可播放|1条：L12视频|
|点位|4条旧ID spot-1～spot-4|4条迁移UUID；名称与本地相同|
|我的|本地标识，未登录|云端标识，未登录|

数据数量和资料缺失是真实环境差异；切换环境不复制资料、不修改数据库连接配置，也不改变Schema。对比期间只浏览，避免提交预约、咨询或上传素材。本次恢复没有导入账号、密码或旧业务记录，因此旧后台账号不能用于新库，“我的”不会显示旧申请。

## 恢复范围与保护

已经恢复57条业务内容、15项关联媒体、10条现有兼容SKU。保留原发布/草稿/归档状态；14条没有视频文件的旧教学草稿不会在公开页面显示，归档内容的专用媒体继续返回410。旧模型资料保留用于浏览，不把旧规格转换为新SKU；无当前兼容SKU的产品仍受现有咨询防护限制。

原 `.local/huangqiao.sqlite`、`.local/uploads`和`images`完整保留。媒体副本位于 `.local/development-runtime/uploads`，只由本地API提供，不上传云存储。恢复内容均标为Test；媒体和SKU通过所关联的Test内容及本地恢复清单追溯，不新增正式Schema字段。

首次离线恢复命令为 `npm run dev:recover`，本机已执行，日常不需要再次执行。工具只向固定本机Development库补入允许的数据；重跑校验并复用相同数据，发现已编辑记录、异常文件或身份/历史表已有数据时停止，不覆盖用户修改。`npm run dev`只准备本地运行，不自动导入或重置业务数据。

## 技术人员维护与上线边界

非敏感本地配置唯一来源为 `scripts/local-development/settings.json`：Host 127.0.0.1、Port 55433、Database hq_development、User hq_dev、Schema app。原Docker模板端口55432由既有测试实例使用，本次独立实例使用55433；无需负责人更改端口。随机密码由程序生成于Git忽略、权限600的本地文件，不放入源码或文档。PG只监听回环，API也只绑定回环；Staging/Production、远程数据库、连接URL覆盖参数及CloudBase配置会阻止本地启动。

当前Mac已安装PostgreSQL 18.4及Node；新电脑须由开发人员安装这些依赖、执行npm ci，并单独恢复经授权的旧资料。Git不包含数据库、媒体副本或凭据。不要把本机文件复制到云配置，也不要用Staging DATABASE_URL启动本地命令。

Production继续未配置、禁用；正式域名、正式数据、身份、HTTPS/合法域名、真机和上线验收须另行批准。本次沿用已有微信开发工具本地调试设置，没有更改安全设置；HTTP图片警告不代表真机或发布验证通过。当前验收只覆盖本机模拟器及公开数据对比，未提交业务或执行正式发布。

完整证据见 [恢复验收](docs/deployment/local-development-recovery/ACCEPTANCE.md)。
