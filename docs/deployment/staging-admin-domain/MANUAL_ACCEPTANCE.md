# admin.yorray.com 后台人工只读验收

编制日期：2026-10-20（北京时间）。适用范围：现有Staging后台。本文是操作清单，不是已通过的验收报告；实际结果由负责人执行后填写。预计首次检查约20—30分钟，遇到不熟悉的工具可标“未执行”。

## 1. 开始前

1. 使用刚才已登录hqadmin的同一个Chrome窗口和用户配置，不用无痕窗口，不退出账号、不清除Cookie、不重新登录。若会话已经过期，先停止并反馈；正常重新登录会产生会话及审计记录，不应称为数据库零写入。
2. 打开[Staging后台](https://admin.yorray.com/)，确认地址为HTTPS且没有证书警告。该域名目前连接Staging，不代表Production已启用。
3. 记录检查时间和Chrome版本（Chrome菜单 → 帮助 → 关于Google Chrome，查看即可）。不用升级、重装或重新授权。
4. 本轮不点新增、编辑、保存、发布、删除、上传、导出、确认预约、关闭咨询、账号启停或修改权限。只进入栏目及内容分类列表。不要通过“修改后不保存”测试页面。
5. 截图不得包含密码、Cookie的Value值、完整Cookie/Set-Cookie请求头、手机号、预约名单或儿童资料。最安全的回传方式是填写本文末尾模板。不要发HAR、Copy as cURL或完整请求头。

本次不检查闲置60分钟或隔夜表现，闲置验收自动化保持暂停；普通刷新不构成闲置首次访问验收。

## 2. 会话保持与同源请求

1. 在后台页签按Mac快捷键`⌥⌘I`打开开发者工具；Windows可按`F12`。选择“网络 / Network”，确保录制按钮为红色。
2. 勾选“保留日志 / Preserve log”；不修改网络限速、请求阻止、Cookie或安全设置。“Disable cache”保持原状态并记录，勿将本轮结果说成首次加载/缓存专项验收。
3. 清空Network请求列表。这里的清空仅清网络面板记录，不是清浏览数据或Cookie。
4. 按`⌘R`（Windows为`Ctrl+R`）刷新后台。预期仍显示已登录后台和hqadmin，不跳回登录页。
5. 在Network筛选框输入`/api/admin/`，找到请求路径为`/api/admin/me`、Method为GET的请求。点击该行，再看“标头 / Headers”。
6. 核对下表。请求Cookie只确认是否存在，不复制、不截图其值。

| 项目 | 预期 |
|---|---|
| Request URL | `https://admin.yorray.com/api/admin/me` |
| Request Method | GET |
| Status Code | 200 |
| Request Headers中的X-HQ-Action | 1 |
| hq_admin请求Cookie | 存在；只记有/无 |
| Response Headers中的Content-Type | 包含application/json |
| Response Headers中的Cache-Control | no-store |
| 刷新后的界面 | 仍为hqadmin的后台，不出现登录失效或服务异常 |

不要要求GET一定带Origin请求头；浏览器正常的同源GET可能不带它。X-HQ-Action出现在GET上只能证明客户端带了该头，不能单独证明CSRF保护生效，后面还有服务端负例。

Chrome的Network/Headers操作参考：[官方说明](https://developer.chrome.com/docs/devtools/network/reference)。

## 3. Cookie属性（只查看）

1. 在开发者工具顶部选择“应用 / Application”。看不到时点击顶部`»`展开更多面板。
2. 左侧进入“存储 / Storage → Cookies”，选择`https://admin.yorray.com`。
3. 在表格中找到名称为`hq_admin`的行，只看下面的属性。不要双击、修改或删除单元格；不要选“Clear site data”。

| 字段 | 预期 |
|---|---|
| Name | hq_admin |
| Domain | admin.yorray.com |
| Path | / |
| HttpOnly | 勾选/true |
| Secure | 勾选/true |
| SameSite | Strict |
| Expires / Max-Age | 有未来的到期时间，尚未过期 |

若之前的成功登录请求仍保留在Network中，可额外查看该请求Response Headers中的Set-Cookie：预期有`Max-Age=28800`（8小时），且没有`Domain=`属性，表示仅限签发主机。不必为补这一项退出或重新登录；没有保留登录请求就将“Max-Age/host-only”记为未执行。不能仅凭Cookies表中域名的显示方式宣称已验证host-only。

如果需要截图，请遮挡或裁掉Value列、下方Cookie值详情及完整Cookie/Set-Cookie头；不确定如何脱敏就只填属性结果。不要执行document.cookie或复制Cookie来验证HttpOnly。

Cookie面板位置与字段参考：[Chrome官方说明](https://developer.chrome.com/docs/devtools/application/cookies)。

## 4. CSRF拒绝验证（不带登录凭据，不执行业务写入）

这一步使用Mac自带“终端”，通过聚焦搜索输入“终端 / Terminal”打开。逐条复制下面三条命令，每次只运行一条。不要从浏览器复制已登录请求，不添加Cookie、密码、Authorization或自己的其他参数。

命令仅向`/api/admin/me`发送空POST。该路径的业务功能只有读取本人信息的GET，没有新增、保存或发布处理；当前服务端会在认证及业务处理之前进行CSRF检查。本轮不向login、logout、content、bookings等写入接口发送请求。若不方便使用终端，可跳过并填“未执行”，不要凭页面正常推断通过。

### C1：缺少X-HQ-Action

```sh
curl -sS -i --max-time 20 -X POST 'https://admin.yorray.com/api/admin/me' -H 'Content-Type: application/json' --data '{}'
```

预期：HTTP状态403，JSON包含`请求校验失败`。不应签发Set-Cookie。

### C2：带正确Action头，但Origin是外域

```sh
curl -sS -i --max-time 20 -X POST 'https://admin.yorray.com/api/admin/me' -H 'Content-Type: application/json' -H 'X-HQ-Action: 1' -H 'Origin: https://csrf-check.invalid' --data '{}'
```

预期：HTTP状态403，JSON包含`请求来源不允许`。不应签发Set-Cookie。Origin只是发送到Staging服务的校验头，这条命令不会访问csrf-check.invalid。

### C3：旧统一网关Origin也不得用于后台写请求

```sh
curl -sS -i --max-time 20 -X POST 'https://admin.yorray.com/api/admin/me' -H 'Content-Type: application/json' -H 'X-HQ-Action: 1' -H 'Origin: https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com' --data '{}'
```

预期：HTTP状态403，JSON包含`请求来源不允许`。不应签发Set-Cookie。

三项都只回传“状态码、错误文字、是否存在Set-Cookie”。HTTP/2或HTTP/1.1都可以，不要求协议版本一致。终端出现超时/证书/连接错误时记“未完成/失败”；不要加`-k`跳过证书检查。若收到200、401、404或其他非预期结果，记录后停止，不尝试真实写入。

这三项验证服务端拒绝规则，不是完整渗透测试，也没有验证合法写请求是否可成功保存。浏览器JavaScript不能任意伪造Origin，因此不要将命令改写为Console中的fetch。

## 5. 两个旧入口跳转

回到已登录的普通Chrome后台页签，保持Network的Preserve log勾选。每个入口分别执行以下步骤：清空Network列表 → 在地址栏完整打开旧入口 → 等待页面稳定 → 记录最终地址及后台登录态。

| 编号 | 旧入口 |
|---|---|
| R1 | [旧webapps后台](https://huangqiao-admin-staging-huangqiao-staging-d2d1dj1bb4ad90.webapps.tcloudbase.com/) |
| R2 | [旧统一网关根入口](https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com/) |

每个入口的预期：

1. 最终地址固定为`https://admin.yorray.com/`，没有循环、空白或证书警告。
2. 当前新域名会话未过期时，后台仍可正常显示；若回到登录页，记录为会话保持未通过，不输入密码继续测试。
3. Network筛选`/api/admin/`后，后台API请求应发送到admin.yorray.com，主要GET正常200；不应请求旧webapps域名的`/api/admin/`并出现404/NoSuchKey。
4. 旧入口的HTML、JS或图片先在旧域名加载属于正常现象；这里的入口跳转由前端执行，不能要求旧入口本身必须返回301/302。
5. 不把新域名会话仍可用解释成“Cookie已跨域复制”；Cookie不需要也不应复制到旧域名。

可补充在地址栏输入`http://admin.yorray.com/`：最终应为HTTPS且无证书告警。Chrome可能自身升级至HTTPS，仅凭地址栏不能断言服务器返回了哪种跳转状态码。

## 6. 后台八栏目、六类内容只读检查

回到`https://admin.yorray.com/`。Network保留`/api/admin/`筛选，逐项打开下表入口。每次等待读取结束，查看列表、分页或明确的空状态；不进入编辑表单，不点任何业务操作。

| 编号 | 入口 | 检查内容 |
|---|---|---|
| P1 | 工作台 | 统计卡片完成加载，没有异常提示 |
| P2 | 内容维护 | 能打开并切换下方六类内容列表 |
| P3 | 场次管理 | 列表或明确空状态正常 |
| P4 | 研学预约 | 列表或明确空状态正常，不打开个人详情 |
| P5 | 咨询管理 | 列表或明确空状态正常，不打开个人详情 |
| P6 | 素材库 | 列表与可见缩略图正常；不上传、下载或导出 |
| P7 | 账号权限 | 账号列表可读；不修改角色、密码或启停 |
| P8 | 操作记录 | 列表或明确空状态正常，不导出 |
| T1 | 内容维护 → 乐器 | 列表、名称及可见图片正常 |
| T2 | 内容维护 → 文创 | 列表、名称及可见图片正常 |
| T3 | 内容维护 → 首页与企业 | 资料列表正常 |
| T4 | 内容维护 → 研学套餐 | 列表、名称及可见图片正常 |
| T5 | 内容维护 → 教学内容 | 列表、类型及可见封面正常，不为检查下拉框进入编辑 |
| T6 | 内容维护 → 点位导览 | 列表、名称及可见图片正常 |

逐项记“通过/失败/未执行”和大致加载时间。公开内容及待办数量以实际页面为准，不要求等于旧截图；没有内容时，清晰的空状态也可以通过。若hqadmin看不到某个栏目，记录缺失，不自行修改权限。

在Network中检查各页面对应的后台API：应同源、返回JSON、主要GET为200；可见图片应能显示。若有401/403/404/5xx、一直加载、错误提示或图片失败，记下栏目、URL的域名+路径（省略敏感查询参数）、状态码及错误文字。失败后不要连续刷新；是否发生重试只记录实际观察，不凭请求行数猜测。

最后切到Console，看本轮新产生的红色错误。只回传与本站有关的脱敏错误文字；扩展自身错误单列，不直接归因于后台。不要截图预约、咨询、账号个人信息或操作记录明细。

## 7. 回传模板

把下面内容复制到聊天填写即可。不知道的填“未执行”，不要填写密码、Cookie值、手机号或名单。

```text
Staging后台人工验收
检查日期/时间（北京时间）：
Chrome版本：
是否沿用现有hqadmin登录：是/否

会话与同源：
刷新后仍登录：通过/失败/未执行
GET /api/admin/me：状态码__；域名__
X-HQ-Action=1：是/否/未执行
hq_admin请求Cookie存在：是/否/未执行（不填值）
Content-Type含JSON：是/否/未执行
Cache-Control=no-store：是/否/未执行

Cookie hq_admin：
Domain=admin.yorray.com：是/否/未执行
Path=/：是/否/未执行
HttpOnly：是/否/未执行
Secure：是/否/未执行
SameSite：__
到期时间仍在未来：是/否/未执行
Max-Age=28800、无Domain属性：通过/失败/未执行（仅登录响应仍可查看时填写）

CSRF：
C1 缺Action：状态__；错误__；Set-Cookie有/无/未执行
C2 外域Origin：状态__；错误__；Set-Cookie有/无/未执行
C3 旧网关Origin：状态__；错误__；Set-Cookie有/无/未执行

旧入口：
R1 webapps：最终地址__；仍登录是/否；旧域名后台API请求有/无/未执行
R2 统一网关：最终地址__；仍登录是/否；旧域名后台API请求有/无/未执行
HTTP最终进入HTTPS：通过/失败/未执行

只读栏目（填通过/失败/未执行，可附大致加载秒数）：
P1工作台__；P2内容维护__；P3场次管理__；P4研学预约__
P5咨询管理__；P6素材库__；P7账号权限__；P8操作记录__
T1乐器__；T2文创__；T3首页与企业__
T4研学套餐__；T5教学内容__；T6点位导览__

异常后台API：无/有（栏目、域名+路径、状态码，不含敏感参数）
图片异常：无/有（栏目与现象）
实际观察到的请求重试：0次/__次/未检查
Console本站红色错误：无/有（脱敏文字）
本轮是否误点业务操作：否/是（只描述操作，不发个人资料）
补充说明：
```

负责人回传后，由Codex把人工观察与已有工具证据分开归档，再判断本次Staging后台验收是否完成。未执行项不会自动算通过；本清单不扩大为Production、云端迁移、真实设备或闲置稳定性验收。
