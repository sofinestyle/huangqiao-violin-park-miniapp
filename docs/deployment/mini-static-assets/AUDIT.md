# 小程序静态资源全量审计

日期：2026年10月10日；范围：实际小程序根目录 miniprogram/miniprogram 的全部94份TS/WXML/WXSS/JSON源码。SDK typings、构建产物不作为业务源码；项目配置另行核对。检索 /assets、http(s)、127.0.0.1、localhost、images、src和WXSS url，并人工复核 uploads/static/public/mediaUrl/API拼接。完整逐行引用见 SOURCE_AUDIT.json。

A：62处固定资源引用（含重复、动态图标路径、同页背景绑定、内嵌SVG），26个实际文件；B：14处业务绑定；D：3处已解释的环境配置/保护判断，未解释资源为0。旧固定背景只有研学页1处通过mediaUrl拼接，现已消除；其余固定资源本来就是代码包路径。没有新增第二套环境图片配置。

## A 固定UI资源

| 包内路径 | 字节数 |
|---|---:|
| `/assets/brand/company-reference.jpg` | 353,371 |
| `/assets/brand/hero-user-v3.jpg` | 1,516,765 |
| `/assets/home-nav/brand.png` | 55,474 |
| `/assets/home-nav/consult.png` | 64,914 |
| `/assets/home-nav/map.png` | 65,835 |
| `/assets/home-nav/teaching.png` | 60,516 |
| `/assets/home-nav/violin.png` | 73,514 |
| `/assets/images/workshop.jpg` | 657,075 |
| `/assets/study/gift.png` | 1,483 |
| `/assets/study/group.png` | 4,895 |
| `/assets/study/mentor.png` | 3,892 |
| `/assets/study/shield.png` | 3,392 |
| `/assets/tab-icons/gift-active.png` | 1,921 |
| `/assets/tab-icons/gift-gold.png` | 2,214 |
| `/assets/tab-icons/gift-muted.png` | 2,035 |
| `/assets/tab-icons/group-gold.png` | 3,007 |
| `/assets/tab-icons/home-active.png` | 1,502 |
| `/assets/tab-icons/home-muted.png` | 1,690 |
| `/assets/tab-icons/instrument-active.png` | 3,133 |
| `/assets/tab-icons/instrument-gold.png` | 3,573 |
| `/assets/tab-icons/instrument-muted.png` | 3,456 |
| `/assets/tab-icons/mine-active.png` | 1,669 |
| `/assets/tab-icons/mine-muted.png` | 1,812 |
| `/assets/tab-icons/study-active.png` | 2,224 |
| `/assets/tab-icons/study-muted.png` | 2,492 |
| `/assets/yorray-logo.png` | 14,516 |

WXSS内嵌SVG不产生HTTP请求，不计入上述独立图片文件。源码同名 /assets 并不一定是服务器路由，须根据是否经过mediaUrl/API Base拼接区分。

## B 后台可维护业务绑定

| 源文件:行号 | 绑定 |
|---|---|
| `pages/enrollment/index.wxml:3` | `{{item.cover}}` |
| `pages/enrollments/index.wxml:6` | `{{item.cover}}` |
| `pages/gifts/index.wxml:7` | `{{item.cover}}` |
| `pages/index/index.wxml:10` | `{{site.images[1]}}` |
| `pages/index/index.wxml:41` | `{{spots[0].images[1] || spots[0].cover}}` |
| `pages/index/index.wxml:52` | `{{item.cover}}` |
| `pages/instruments/index.wxml:7` | `{{item.cover}}` |
| `pages/lesson/index.wxml:3` | `{{item.videoUrl}}` |
| `pages/lesson/index.wxml:3` | `{{item.cover}}` |
| `pages/package/index.wxml:7` | `{{item.cover}}` |
| `pages/product/index.wxml:7` | `{{item}}` |
| `pages/study/index.wxml:39` | `{{photo}}` |
| `pages/teaching/index.wxml:3` | `{{item.cover}}` |
| `pages/tour/index.wxml:13` | `{{photo}}` |

公开业务数据只读快照：Development40条内容、51处旧/assets引用、8处/api/media路径引用；Staging39条内容、1处旧/assets引用、57处/api/media路径引用。这里是字段出现次数，不是媒体唯一数量；不覆盖后台未发布内容。逐字段清单见 BUSINESS_ASSET_REFERENCES.json。下表均为B类，禁止本轮打包或修改。

| 环境 | 内容ID | 内容名称 | 字段 | 旧路径 |
|---|---|---|---|---|
| development | `site` | 黄桥乐器文化产业园 | `images.0` | `/assets/yorray-logo.png` |
| development | `violin-L301` | L301 | `images.0` | `/assets/hero-violin.jpg` |
| development | `violin-L501` | L501 | `images.0` | `/assets/hero-violin.jpg` |
| development | `violin-L701` | L701 | `images.0` | `/assets/hero-violin.jpg` |
| development | `violin-L901` | L901 | `images.0` | `/assets/hero-violin.jpg` |
| development | `violin-L1101` | L1101 | `images.0` | `/assets/hero-violin.jpg` |
| development | `violin-L1201` | L1201 | `images.0` | `/assets/hero-violin.jpg` |
| development | `gift-1` | 地图冰箱贴 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-2` | 古镇冰箱贴 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-3` | 音乐冰箱贴 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-4` | 亚克力拼图冰箱贴 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-5` | 纪念币 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-6` | 金属直尺 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-7` | 提琴书签 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-8` | 手机支架 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-9` | 帆布包 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-10` | 紫色提琴玩偶 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-11` | 琵琶玩偶 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-12` | 尤克里里玩偶 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-13` | 棕色小提琴玩偶 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-14` | 迷你乐器 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-15` | 提琴包挂 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-16` | 榉木笔筒夜灯 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-17` | 文创礼盒 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-18` | 1/64 木盒 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-19` | 1/64 纸盒 | `images.0` | `/assets/wenchuang.jpg` |
| development | `gift-20` | 小提琴紫砂壶 | `images.0` | `/assets/wenchuang.jpg` |
| development | `package-1` | 琴韵初体验 | `images.0` | `/assets/workshop.jpg` |
| development | `package-2` | 提琴匠心深度游 | `images.0` | `/assets/green.jpg` |
| development | `package-3` | 制琴工坊探秘 | `images.0` | `/assets/industry.jpg` |
| development | `package-4` | 提琴文化艺术营 | `images.0` | `/assets/city.jpg` |
| development | `package-5` | 小小制琴师·工序体验营 | `images.0` | `/assets/workshop.jpg` |
| development | `spot-1` | 城市客厅 | `images.0` | `/assets/city.jpg` |
| development | `spot-1` | 城市客厅 | `images.1` | `/assets/c1.jpg` |
| development | `spot-1` | 城市客厅 | `images.2` | `/assets/c2.jpg` |
| development | `spot-1` | 城市客厅 | `images.3` | `/assets/c3.jpg` |
| development | `spot-1` | 城市客厅 | `images.4` | `/assets/c4.jpg` |
| development | `spot-2` | 音乐生态湖 | `images.0` | `/assets/lake.jpg` |
| development | `spot-2` | 音乐生态湖 | `images.1` | `/assets/l1.jpg` |
| development | `spot-2` | 音乐生态湖 | `images.2` | `/assets/l2.jpg` |
| development | `spot-2` | 音乐生态湖 | `images.3` | `/assets/l3.jpg` |
| development | `spot-3` | 产业园·中小企业集聚区 | `images.0` | `/assets/industry.jpg` |
| development | `spot-3` | 产业园·中小企业集聚区 | `images.1` | `/assets/i1.jpg` |
| development | `spot-3` | 产业园·中小企业集聚区 | `images.2` | `/assets/i2.jpg` |
| development | `spot-3` | 产业园·中小企业集聚区 | `images.3` | `/assets/i3.jpg` |
| development | `spot-3` | 产业园·中小企业集聚区 | `images.4` | `/assets/i4.jpg` |
| development | `spot-4` | 绿岛·智能环保表面处理中心 | `images.0` | `/assets/green.jpg` |
| development | `spot-4` | 绿岛·智能环保表面处理中心 | `images.1` | `/assets/g1.jpg` |
| development | `spot-4` | 绿岛·智能环保表面处理中心 | `images.2` | `/assets/g2.jpg` |
| development | `spot-4` | 绿岛·智能环保表面处理中心 | `images.3` | `/assets/g3.jpg` |
| development | `spot-4` | 绿岛·智能环保表面处理中心 | `images.4` | `/assets/g4.jpg` |
| staging | `site` | 黄桥乐器文化产业园 | `images.0` | `/assets/yorray-logo-CFmraOUS.png` |

Development的package-1「琴韵初体验」、package-5「小小制琴师·工序体验营」封面仍使用/assets/workshop.jpg：其业务用途与固定背景不同，继续保留。Staging的site.images.0仍为/assets/yorray-logo-CFmraOUS.png，来自此前已批准迁移的同字节系统Logo引用；此次不改、不新建云路由、不迁媒体。其他已迁移业务图片继续/api/media。

## C 历史未使用文件

| 路径 | 字节数 | 处理 |
|---|---:|---|
| `/assets/brand/hero-detail-v2.jpg` | 450,926 | 无源码引用，保留；未发现仍在运行的废弃引用 |
| `/assets/brand/hero.jpg` | 330,589 | 无源码引用，保留；未发现仍在运行的废弃引用 |

## D 配置与未解释项

| 源文件:行号 | 值 | 结论 |
|---|---|---|
| `config.ts:24` | `localhost` | 环境SSOT或回环安全校验，属于正常API配置，不是图片依赖 |
| `environment-settings.ts:3` | `http://127.0.0.1:8787` | 环境SSOT或回环安全校验，属于正常API配置，不是图片依赖 |
| `environment-settings.ts:9` | `https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com` | 环境SSOT或回环安全校验，属于正常API配置，不是图片依赖 |

未发现页面硬编码localhost/127.0.0.1/CloudBase域名、外部images拼接或其他本地Server固定资源；API SSOT及业务mediaUrl兼容保持。
