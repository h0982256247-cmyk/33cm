---
name: line-flex-message
description: LINE Flex Message 開發指南 - 建立豐富的彈性訊息版面
---

# LINE Flex Message

## 概述
Flex Message 是 LINE 的進階訊息格式，可以自由設計版面、顏色、按鈕等元素，創造豐富的互動訊息體驗。

## 觸發條件
當使用者提到以下關鍵字時觸發：
- "Flex Message"、"Flex 訊息"
- "卡片訊息"、"carousel"
- "bubble"、"氣泡訊息"

---

## ⚠️ 關鍵限制

> [!CAUTION]
> **發送失敗常見原因：**
> - 單一 Bubble JSON **最大 50KB**
> - Carousel JSON **最大 300KB**，最多 **12 bubbles**
> - **Carousel 不支援 video hero**
> - altText **最大 400 字元**
> - Button label **最大 20 字元**
> - Action URI **最大 1000 字元**
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## Flex Message 結構

### 階層架構
```
Flex Message
└── Container (bubble 或 carousel)
    └── Bubble
        ├── header (選用)
        ├── hero (選用) - 圖片或影片
        ├── body (選用) - 主要內容
        └── footer (選用) - 按鈕區域
```

---

## Container 類型

### 1. Bubble（單一氣泡）
```json
{
  "type": "flex",
  "altText": "Flex Message",
  "contents": {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "Hello, World!"
        }
      ]
    }
  }
}
```

### 2. Carousel（輪播）
```json
{
  "type": "flex",
  "altText": "Carousel",
  "contents": {
    "type": "carousel",
    "contents": [
      { "type": "bubble", "body": { ... } },
      { "type": "bubble", "body": { ... } }
    ]
  }
}
```

> [!IMPORTANT]
> Carousel 最多支援 12 個 bubble，且**不支援 video 類型的 hero**。

---

## Bubble 組成元素

### Header
```json
{
  "header": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "標題",
        "weight": "bold",
        "size": "xl"
      }
    ]
  }
}
```

### Hero（圖片）
```json
{
  "hero": {
    "type": "image",
    "url": "https://example.com/image.jpg",
    "size": "full",
    "aspectRatio": "20:13",
    "aspectMode": "cover"
  }
}
```

### Hero（影片）
```json
{
  "hero": {
    "type": "video",
    "url": "https://example.com/video.mp4",
    "previewUrl": "https://example.com/preview.jpg",
    "aspectRatio": "20:13",
    "altContent": {
      "type": "image",
      "size": "full",
      "aspectRatio": "20:13",
      "aspectMode": "cover",
      "url": "https://example.com/fallback.jpg"
    }
  }
}
```

> [!WARNING]
> 影片規格限制：
> - 格式：MP4
> - 時長：最長 1 分鐘
> - 檔案大小：最大 200MB

### Body
```json
{
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "商品名稱",
        "weight": "bold",
        "size": "xl"
      },
      {
        "type": "text",
        "text": "商品描述",
        "size": "sm",
        "color": "#999999",
        "wrap": true
      }
    ]
  }
}
```

### Footer
```json
{
  "footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [
      {
        "type": "button",
        "style": "primary",
        "action": {
          "type": "uri",
          "label": "立即購買",
          "uri": "https://example.com/buy"
        }
      },
      {
        "type": "button",
        "style": "secondary",
        "action": {
          "type": "uri",
          "label": "了解更多",
          "uri": "https://example.com/details"
        }
      }
    ]
  }
}
```

---

## Box Layout 類型

| Layout | 說明 | 使用場景 |
|--------|------|----------|
| `vertical` | 垂直排列 | 標題+描述、表單 |
| `horizontal` | 水平排列 | 圖示+文字、評分星星 |
| `baseline` | 基線對齊 | 不同大小文字對齊 |

---

## 常用元件

### Text
```json
{
  "type": "text",
  "text": "文字內容",
  "size": "md",
  "weight": "bold",
  "color": "#1DB446",
  "wrap": true,
  "maxLines": 2
}
```

### Image
```json
{
  "type": "image",
  "url": "https://example.com/image.jpg",
  "size": "full",
  "aspectRatio": "1:1",
  "aspectMode": "cover"
}
```

### Button
```json
{
  "type": "button",
  "style": "primary",
  "color": "#1DB446",
  "action": {
    "type": "uri",
    "label": "按鈕文字",
    "uri": "https://example.com"
  }
}
```

### Separator
```json
{
  "type": "separator",
  "margin": "md"
}
```

### Spacer
```json
{
  "type": "spacer",
  "size": "md"
}
```

---

## Action 類型

### URI Action
```json
{
  "type": "uri",
  "label": "開啟連結",
  "uri": "https://example.com"
}
```

### Message Action
```json
{
  "type": "message",
  "label": "發送訊息",
  "text": "Hello"
}
```

### Postback Action
```json
{
  "type": "postback",
  "label": "購買",
  "data": "action=buy&itemId=123"
}
```

---

## 完整範例：商品卡片

```json
{
  "type": "flex",
  "altText": "商品資訊",
  "contents": {
    "type": "bubble",
    "hero": {
      "type": "image",
      "url": "https://example.com/product.jpg",
      "size": "full",
      "aspectRatio": "20:13",
      "aspectMode": "cover"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "精選商品",
          "weight": "bold",
          "size": "xl"
        },
        {
          "type": "box",
          "layout": "baseline",
          "margin": "md",
          "contents": [
            {
              "type": "text",
              "text": "NT$",
              "size": "sm",
              "color": "#999999"
            },
            {
              "type": "text",
              "text": "1,990",
              "size": "xl",
              "weight": "bold",
              "color": "#1DB446"
            }
          ]
        },
        {
          "type": "text",
          "text": "限時特價，售完為止",
          "size": "xs",
          "color": "#999999",
          "margin": "md",
          "wrap": true
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "style": "primary",
          "color": "#1DB446",
          "action": {
            "type": "uri",
            "label": "立即購買",
            "uri": "https://example.com/buy"
          }
        }
      ]
    }
  }
}
```

---

## TypeScript 建構函式

```typescript
interface FlexBubble {
  type: 'bubble';
  header?: FlexBox;
  hero?: FlexImage | FlexVideo;
  body?: FlexBox;
  footer?: FlexBox;
  styles?: BubbleStyles;
}

function buildProductCard(product: Product): FlexBubble {
  return {
    type: 'bubble',
    hero: {
      type: 'image',
      url: product.imageUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: product.name, weight: 'bold', size: 'xl' },
        { type: 'text', text: `NT$ ${product.price}`, color: '#1DB446' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          action: { type: 'uri', label: '購買', uri: product.buyUrl }
        }
      ]
    }
  };
}
```

---

## 除錯工具

- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- 驗證 JSON 格式是否正確
- 預覽不同裝置的顯示效果

---

## 相關資源
- [Flex Message 官方文件](https://developers.line.biz/en/docs/messaging-api/flex-message-elements/)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [Flex Message 設計指南](https://developers.line.biz/en/docs/messaging-api/flex-message-layout/)
