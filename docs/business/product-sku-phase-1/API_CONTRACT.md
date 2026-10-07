# SKU-1 API Contract

现有GET/POST /api/admin/content及GET/PUT /api/admin/content/:id，不新增Endpoint。写请求保留kind/name/state/sort/version/data，新增顶层skus数组；data只存产品及Options，不存SKU数组/specs。variantModelVersion固定2。所有新/修改产品要求v2，旧测试产品GET可读且无version标记，Admin只提示重建，Service旧写400 MODEL_UPGRADE_REQUIRED；新产品旧payload同样拒绝。

skus请求为当前候选组合的完整列表（可包含enabled=false行），不提交退休历史行；服务器生成历史停用变化。新行无id，已有行必须提供GET得到的id；Option/Value统一UUID v4，客户端生成的新UUID经Server结构与归属验证后成为正式ID。服务端重算候选组合，缺行/多行/重复/错属均400。未知新SKU ID拒绝。错误响应保留error/code，可选field用于精确行定位；不泄露其它产品详情。

成功201/200返回原展开Product加options、variantMode、variantModelVersion、skus（含历史；current布尔）、只读specs投影。SKU含raw价格/图、effectiveReferencePrice（inquiry=null）、effectiveImages；combination_key不作为业务编码。Admin保存后用返回模型回填。public过滤停用历史并裁去raw inquiry参考价，specs动态生成且不入content.data；显示名称按Option顺序用“ / ”连接，simple为“默认规格”。SKU-2前旧咨询仍按该名称校验，不宣称skuId已接入。

错误：400格式/范围/旧写/组合无效，403权限，409 VERSION_CONFLICT或SKU_CODE_CONFLICT；码冲突返回field=sku:<规范组合key>:sku_code。所有检查与写入在BEGIN IMMEDIATE事务内，任何失败回滚产品/Options/SKU/audit。Media URL仅现有assets或已存在image媒体，不接受任意远程地址。

新增维度经界面确认绑定每个旧SKU到新增维度第一启用值（服务器按sort/id确定），其余组合新建；已有精确组合优先恢复。请求必须按此预测提交，不允许客户端任意重分配ID。

以下完整示例仅合成契约；UUID及code须替换为实际返回值，version须使用最新版本。

## simple创建 POST /api/admin/content

```json
{
  "kind": "product",
  "name": "合成SKU验证产品",
  "state": "draft",
  "sort": 10,
  "data": {
    "code": "QA-SKU",
    "category": "violin",
    "description": "仅隔离开发测试",
    "images": [],
    "priceMode": "reference",
    "price": 450,
    "isTest": true,
    "variantModelVersion": 2,
    "variantMode": "simple",
    "options": []
  },
  "skus": [
    {
      "sku_code": "QA-SKU-001",
      "option_values": {},
      "reference_price": null,
      "images": [],
      "enabled": true,
      "sort_order": 0
    }
  ]
}
```

## options创建 POST /api/admin/content

```json
{
  "kind": "product",
  "name": "合成SKU验证产品",
  "state": "draft",
  "sort": 10,
  "data": {
    "code": "QA-SKU",
    "category": "violin",
    "description": "仅隔离开发测试",
    "images": [],
    "priceMode": "reference",
    "price": 450,
    "isTest": true,
    "variantModelVersion": 2,
    "variantMode": "options",
    "options": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "尺寸",
        "enabled": true,
        "sort": 0,
        "values": [
          {
            "id": "22222222-2222-4222-8222-222222222222",
            "label": "4/4",
            "enabled": true,
            "sort": 0
          },
          {
            "id": "33333333-3333-4333-8333-333333333333",
            "label": "3/4",
            "enabled": true,
            "sort": 1
          }
        ]
      }
    ]
  },
  "skus": [
    {
      "sku_code": "QA-SKU-001",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "22222222-2222-4222-8222-222222222222"
      },
      "reference_price": null,
      "images": [],
      "enabled": true,
      "sort_order": 0
    },
    {
      "sku_code": "QA-SKU-002",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "33333333-3333-4333-8333-333333333333"
      },
      "reference_price": null,
      "images": [],
      "enabled": true,
      "sort_order": 1
    }
  ]
}
```

## options修改 PUT /api/admin/content/:id（ID示意，以真实响应为准）

```json
{
  "kind": "product",
  "name": "合成SKU验证产品",
  "state": "draft",
  "sort": 10,
  "data": {
    "code": "QA-SKU",
    "category": "violin",
    "description": "仅隔离开发测试",
    "images": [],
    "priceMode": "reference",
    "price": 450,
    "isTest": true,
    "variantModelVersion": 2,
    "variantMode": "options",
    "options": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "琴体尺寸",
        "enabled": true,
        "sort": 0,
        "values": [
          {
            "id": "22222222-2222-4222-8222-222222222222",
            "label": "4/4",
            "enabled": true,
            "sort": 0
          },
          {
            "id": "33333333-3333-4333-8333-333333333333",
            "label": "3/4",
            "enabled": true,
            "sort": 1
          }
        ]
      }
    ]
  },
  "skus": [
    {
      "sku_code": "QA-SKU-001",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "22222222-2222-4222-8222-222222222222"
      },
      "reference_price": null,
      "images": [],
      "enabled": true,
      "sort_order": 0,
      "id": "44444444-4444-4444-8444-444444444444"
    },
    {
      "sku_code": "QA-SKU-002",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "33333333-3333-4333-8333-333333333333"
      },
      "reference_price": null,
      "images": [],
      "enabled": true,
      "sort_order": 1,
      "id": "55555555-5555-4555-8555-555555555555"
    }
  ],
  "version": 1
}
```

## Option停用 PUT（同时保留一个有效维度；原SKU服务端停用保留）

```json
{
  "kind": "product",
  "name": "合成SKU验证产品",
  "state": "draft",
  "sort": 10,
  "data": {
    "code": "QA-SKU",
    "category": "violin",
    "description": "仅隔离开发测试",
    "images": [],
    "priceMode": "reference",
    "price": 450,
    "isTest": true,
    "variantModelVersion": 2,
    "variantMode": "options",
    "options": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "琴体尺寸",
        "enabled": false,
        "sort": 0,
        "values": [
          {
            "id": "22222222-2222-4222-8222-222222222222",
            "label": "4/4",
            "enabled": true,
            "sort": 0
          },
          {
            "id": "33333333-3333-4333-8333-333333333333",
            "label": "3/4",
            "enabled": true,
            "sort": 1
          }
        ]
      },
      {
        "id": "66666666-6666-4666-8666-666666666666",
        "name": "套装",
        "enabled": true,
        "sort": 1,
        "values": [
          {
            "id": "77777777-7777-4777-8777-777777777777",
            "label": "标准",
            "enabled": true,
            "sort": 0
          }
        ]
      }
    ]
  },
  "skus": [
    {
      "sku_code": "QA-SET-001",
      "option_values": {
        "66666666-6666-4666-8666-666666666666": "77777777-7777-4777-8777-777777777777"
      },
      "reference_price": null,
      "images": [],
      "enabled": true,
      "sort_order": 0
    }
  ],
  "version": 1
}
```

## SKU单独停用 PUT

```json
{
  "kind": "product",
  "name": "合成SKU验证产品",
  "state": "draft",
  "sort": 10,
  "data": {
    "code": "QA-SKU",
    "category": "violin",
    "description": "仅隔离开发测试",
    "images": [],
    "priceMode": "reference",
    "price": 450,
    "isTest": true,
    "variantModelVersion": 2,
    "variantMode": "options",
    "options": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "琴体尺寸",
        "enabled": true,
        "sort": 0,
        "values": [
          {
            "id": "22222222-2222-4222-8222-222222222222",
            "label": "4/4",
            "enabled": true,
            "sort": 0
          },
          {
            "id": "33333333-3333-4333-8333-333333333333",
            "label": "3/4",
            "enabled": true,
            "sort": 1
          }
        ]
      }
    ]
  },
  "skus": [
    {
      "sku_code": "QA-SKU-001",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "22222222-2222-4222-8222-222222222222"
      },
      "reference_price": null,
      "images": [],
      "enabled": true,
      "sort_order": 0,
      "id": "44444444-4444-4444-8444-444444444444"
    },
    {
      "sku_code": "QA-SKU-002",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "33333333-3333-4333-8333-333333333333"
      },
      "reference_price": null,
      "images": [],
      "enabled": false,
      "sort_order": 1,
      "id": "55555555-5555-4555-8555-555555555555"
    }
  ],
  "version": 1
}
```

## 批量价格后单行覆盖的完整PUT（null恢复继承，0是有效价）

```json
{
  "kind": "product",
  "name": "合成SKU验证产品",
  "state": "draft",
  "sort": 10,
  "data": {
    "code": "QA-SKU",
    "category": "violin",
    "description": "仅隔离开发测试",
    "images": [],
    "priceMode": "reference",
    "price": 450,
    "isTest": true,
    "variantModelVersion": 2,
    "variantMode": "options",
    "options": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "琴体尺寸",
        "enabled": true,
        "sort": 0,
        "values": [
          {
            "id": "22222222-2222-4222-8222-222222222222",
            "label": "4/4",
            "enabled": true,
            "sort": 0
          },
          {
            "id": "33333333-3333-4333-8333-333333333333",
            "label": "3/4",
            "enabled": true,
            "sort": 1
          }
        ]
      }
    ]
  },
  "skus": [
    {
      "sku_code": "QA-SKU-001",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "22222222-2222-4222-8222-222222222222"
      },
      "reference_price": 450,
      "images": [],
      "enabled": true,
      "sort_order": 0,
      "id": "44444444-4444-4444-8444-444444444444"
    },
    {
      "sku_code": "QA-SKU-002",
      "option_values": {
        "11111111-1111-4111-8111-111111111111": "33333333-3333-4333-8333-333333333333"
      },
      "reference_price": 480,
      "images": [],
      "enabled": true,
      "sort_order": 1,
      "id": "55555555-5555-4555-8555-555555555555"
    }
  ],
  "version": 1
}
```
