# 固定 Guide 映射（未执行）

所有目标均为计划 UUID；本轮未在 Staging 创建。

## 内容

|源 ID|名称|目标 content ID|排序|图片数|
|---|---|---|---|---|
|spot-1|城市客厅|2177d369-4cb6-5ee8-8246-cdbc0e18fe79|80|5|
|spot-2|音乐生态湖|61610c9a-3bb3-508d-97a4-ff3a455a5ef1|81|4|
|spot-3|产业园·中小企业集聚区|7d48f1df-e2aa-5c9e-ae2f-75f88396b798|82|5|
|spot-4|绿岛·智能环保表面处理中心|981fd3f8-4d08-561d-ae9b-0983214e0b87|83|5|

字段：id→固定UUID；kind/name/state/sort/data非images字段保留；version→1；created_at/updated_at→manifest.batchTime；每个images元素按原位置替换为下表URL。19张原件直接读取 images/，不是旧SQLite media记录；不导入旧mediaID。无SQL FK需改写，依赖为content.data.images中的JSON URL。

## 媒体（顺序固定）

|源文件|目标 media ID / 对象key（ID.jpg）|bytes|SHA-256|
|---|---|---|---|
|images/city.jpg|f953afa4-bd2b-51c1-9b1d-ac3a7693d69e|342073|529e27143a567f58b73750e4b1548fe7ea1ec31e64f091cb3bed026f72eb531e|
|images/c1.jpg|c2da474c-e6f3-5f46-b764-fe971db216d7|160505|5ff0f482f76007a8f417f000aa09313676fa09beda933ecacbe23fa22d3c41e7|
|images/c2.jpg|b9a89ecd-3d7f-5210-ad90-33d4aaa04569|140252|5b40c754ca250fbb0d277ea0a669330e754b36ad2f466cedeab68fdf1889fd42|
|images/c3.jpg|ee75c8ea-7a79-56d9-8408-390945a93bd8|94954|dc8230ef77e9b23af6bb204f998c344290f779e4912a4af2f00917d5e4877dc8|
|images/c4.jpg|5fb05472-3b03-54d9-80d1-5ad7b6c635ce|53294|24e64d1882ed4775358d1cc7a2118a3b79e927385f26cbd92e853473d260d1d0|
|images/lake.jpg|68548eda-35be-5dc2-946c-05b2349cc77a|221562|1b3e6ce424b42e18fb73289b87f22d91c3375896153418368a87b7eee02ff5c3|
|images/l1.jpg|2232c217-4d2c-5949-aa26-70f120e1d176|135818|d00607ca3d94c26710cc894eeaf08d95c37e87dd9c05f11fb88f07d5fcecf875|
|images/l2.jpg|9a80ca22-5121-5b25-937b-0b642117bc9c|129446|3bc3f28bac57d52aa96cf26f27827084c3db5326e322ac3c79afba546788039e|
|images/l3.jpg|fb2f6bbe-e8e0-5c7a-9291-b8276c0d796a|53144|f01bc09c9d45a6fbd0d4d7a29c56186623d25858c005d6ce930951010d3c82ef|
|images/industry.jpg|0d7b9c57-e19f-55c4-a412-93b62fac95a5|225273|4a58eb780ab8992de21e8586fec140db70e28a8ea8d9775d9a7302a232722e7d|
|images/i1.jpg|e5ec6fae-b7dc-5fb8-82d4-c3b431bc3ec8|94775|143804173d53cd55e86aa39a6d0e230caaeff55f618e5681e693e731db85c0c6|
|images/i2.jpg|d1cf8d1d-48a6-5fe5-abcd-d6d29511a616|84456|e019b8247943741bfbbd2f172c34c6df6a1845fb86ab0896465d1746c55d0685|
|images/i3.jpg|c5945292-a4c6-5232-b1b6-922937b752c8|102935|ead20d1239cdaec70026874a2fa544bf232c35cb7b247eb5deb4c3e51c2011f5|
|images/i4.jpg|08c9a6ed-f4b2-5e94-a403-ff6de6baf9be|127530|251584dcfd579947d88f65f11f4d59f86bd0890593d49dfa97945163f3fd603f|
|images/green.jpg|16709e66-3a12-5978-ba28-283791a470d5|167195|d653a7245c9ced5724ac996d67b39a8df0ceac6be51202d755b396b5242aabd2|
|images/g1.jpg|f3acb25f-dd6b-58a1-a8d2-d1d1b183efb7|99304|9c242f08aa7f90e938c2b940ec442a87ea453bf4c7408e2275fa1cd04bebbd72|
|images/g2.jpg|613a9c16-36e2-58d4-b97a-ddeef2c503bf|103317|18048dfdcf6d896811c40ddbaf8d157827adfb5a5831c3772c5dbba2024cfd17|
|images/g3.jpg|c1a9cee6-dbd3-5481-8c0f-a9f0d630bcaa|83222|fcd0176db3b460f7183694e140ab65a50c2c804bd952b66bb291eacf3c9f032a|
|images/g4.jpg|60a9a3f6-3fda-57a8-af2a-9dddaaf7bed0|59956|5b03c77125332aaa6735240b6d5961602ad568a13948592ed0dcf31e39886dc5|

目标图库URL统一 `/api/media/<目标 media ID>`；目标对象为 `huangqiao-media/<目标 media ID>.jpg`，均通过CloudBase逻辑Storage API，不是COS直写。媒体mime=image/jpeg，duration=null，rights为空；图片顺序见内容manifest，不按文件名重新排序。
