---
name: line-template-message
description: LINE Template Message 開發指南 - 包含 Buttons、Confirm、Carousel、Image Carousel 四種預設模板。當用戶詢問 Template Message、模板訊息、按鈕模板、確認模板、輪播模板相關問題時使用。
---

# LINE Template Message

## 概述
Template Message 是 LINE 提供的預設訊息模板，包含 Buttons、Confirm、Carousel、Image Carousel 四種類型，適合快速建立結構化的互動訊息。

## 觸發條件
- "Template Message"、"模板訊息"
- "Buttons Template"、"按鈕模板"
- "Confirm Template"、"確認模板"
- "Carousel Template"（非 Flex Carousel）

---

## ⚠️ 關鍵限制

> [!CAUTION]
> **Buttons Template：**
> - 標題最多 **40 字元**
> - 文字最多 **160 字元**（有標題）/ **60 字元**（無標題）
> - 按鈕最多 **4 個**
>
> **Confirm Template：**
> - 文字最多 **240 字元**
> - 按鈕固定 **2 個**
>
> **Carousel Template：**
> - Column 最多 **10 個**
> - 每個 Column 按鈕最多 **3 個**
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## 1. Buttons Template

帶有圖片、標題、文字和多個按鈕的模板。

```json
{
  "type": "template",
  "altText": "按鈕選單",
  "template": {
    "type": "buttons",
    "thumbnailImageUrl": "https://example.com/image.jpg",
    "imageAspectRatio": "rectangle",
    "imageSize": "cover",
    "imageBackgroundColor": "#FFFFFF",
    "title": "商品標題",
    "text": "商品描述文字",
    "defaultAction": {
      "type": "uri",
      "label": "查看詳情",
      "uri": "https://example.com"
    },
    "actions": [
      {
        "type": "uri",
        "label": "購買",
        "uri": "https://example.com/buy"
      },
      {
        "type": "postback",
        "label": "加入購物車",
        "data": "action=addCart&itemId=123"
      }
    ]
  }
}
```

### imageAspectRatio

| 值 | 比例 |
|-----|------|
| `rectangle` | 1.51:1 |
| `square` | 1:1 |

### imageSize

| 值 | 說明 |
|-----|------|
| `cover` | 裁切填滿 |
| `contain` | 完整顯示 |

---

## 2. Confirm Template

帶有確認/取消兩個按鈕的簡單模板。

```json
{
  "type": "template",
  "altText": "確認訊息",
  "template": {
    "type": "confirm",
    "text": "確定要刪除這個項目嗎？",
    "actions": [
      {
        "type": "postback",
        "label": "確定",
        "data": "action=delete&itemId=123"
      },
      {
        "type": "message",
        "label": "取消",
        "text": "取消刪除"
      }
    ]
  }
}
```

---

## 3. Carousel Template

水平滑動的多欄模板，每欄結構類似 Buttons Template。

```json
{
  "type": "template",
  "altText": "商品列表",
  "template": {
    "type": "carousel",
    "columns": [
      {
        "thumbnailImageUrl": "https://example.com/item1.jpg",
        "imageBackgroundColor": "#FFFFFF",
        "title": "商品 A",
        "text": "描述 A",
        "defaultAction": {
          "type": "uri",
          "label": "查看",
          "uri": "https://example.com/item1"
        },
        "actions": [
          {
            "type": "uri",
            "label": "購買",
            "uri": "https://example.com/buy/1"
          },
          {
            "type": "postback",
            "label": "加入購物車",
            "data": "action=addCart&itemId=1"
          }
        ]
      },
      {
        "thumbnailImageUrl": "https://example.com/item2.jpg",
        "title": "商品 B",
        "text": "描述 B",
        "actions": [
          {
            "type": "uri",
            "label": "購買",
            "uri": "https://example.com/buy/2"
          },
          {
            "type": "postback",
            "label": "加入購物車",
            "data": "action=addCart&itemId=2"
          }
        ]
      }
    ],
    "imageAspectRatio": "rectangle",
    "imageSize": "cover"
  }
}
```

> [!IMPORTANT]
> Carousel 中所有 Column 的按鈕數量必須相同！

---

## 4. Image Carousel Template

只有圖片的輪播模板，點擊圖片觸發動作。

```json
{
  "type": "template",
  "altText": "圖片輪播",
  "template": {
    "type": "image_carousel",
    "columns": [
      {
        "imageUrl": "https://example.com/image1.jpg",
        "action": {
          "type": "uri",
          "label": "查看圖片 1",
          "uri": "https://example.com/1"
        }
      },
      {
        "imageUrl": "https://example.com/image2.jpg",
        "action": {
          "type": "message",
          "label": "選擇圖片 2",
          "text": "選擇 2"
        }
      }
    ]
  }
}
```

---

## Action 類型

Template Message 支援以下 Action：

### Postback Action
```json
{
  "type": "postback",
  "label": "按鈕文字",
  "data": "action=xxx&id=yyy",
  "displayText": "使用者看到的文字"
}
```

### Message Action
```json
{
  "type": "message",
  "label": "按鈕文字",
  "text": "使用者發送的文字"
}
```

### URI Action
```json
{
  "type": "uri",
  "label": "按鈕文字",
  "uri": "https://example.com"
}
```

### Datetime Picker Action
```json
{
  "type": "datetimepicker",
  "label": "選擇日期",
  "data": "action=selectDate",
  "mode": "date"
}
```

---

## Template vs Flex Message

| 特性 | Template Message | Flex Message |
|------|------------------|--------------|
| 彈性 | 低（固定結構） | 高（自由排版） |
| 開發速度 | 快 | 較慢 |
| 視覺效果 | 基本 | 豐富 |
| 檔案大小 | 小 | 較大 |
| 推薦用途 | 簡單互動 | 複雜排版 |

---

## 使用場景

1. **商品推薦**：使用 Carousel 展示多個商品
2. **確認對話**：使用 Confirm 進行二選一確認
3. **快速選單**：使用 Buttons 提供選項
4. **圖片展示**：使用 Image Carousel 展示相簿

---

## TypeScript 範例

```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
}

function buildProductCarousel(products: Product[]) {
  return {
    type: 'template',
    altText: '商品推薦',
    template: {
      type: 'carousel',
      columns: products.slice(0, 10).map(product => ({
        thumbnailImageUrl: product.imageUrl,
        title: product.name.slice(0, 40),
        text: `NT$ ${product.price}`.slice(0, 60),
        actions: [
          {
            type: 'uri',
            label: '查看詳情',
            uri: `https://example.com/products/${product.id}`
          },
          {
            type: 'postback',
            label: '加入購物車',
            data: `action=addCart&productId=${product.id}`
          }
        ]
      })),
      imageAspectRatio: 'rectangle',
      imageSize: 'cover'
    }
  };
}
```

---

## 相關資源
- [Template Message 官方文件](https://developers.line.biz/en/docs/messaging-api/message-types/#template-messages)
