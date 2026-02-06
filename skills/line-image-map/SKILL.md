---
name: line-image-map
description: LINE Image Map 開發指南 - 在圖片上建立可點擊的熱區，適合用於視覺化選單和互動圖片。當用戶詢問 Image Map、圖片地圖、可點擊圖片相關問題時使用。
---

# LINE Image Map

## 概述
Image Map 是一種在圖片上定義可點擊區域的訊息類型，每個區域可以觸發不同的動作，適合建立視覺化選單。

## 觸發條件
- "Image Map"、"圖片地圖"
- "可點擊圖片"、"圖片熱區"

---

## ⚠️ 關鍵限制

> [!CAUTION]
> - 動作區域最多 **50 個**
> - 基礎圖片寬度建議 **1040px**
> - 支援圖片寬度：240, 300, 460, 700, 1040 px
> - 圖片 URL 必須 **HTTPS**
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## Image Map 結構

```json
{
  "type": "imagemap",
  "baseUrl": "https://example.com/imagemap",
  "altText": "圖片選單",
  "baseSize": {
    "width": 1040,
    "height": 1040
  },
  "actions": [
    {
      "type": "uri",
      "linkUri": "https://example.com/page1",
      "area": {
        "x": 0,
        "y": 0,
        "width": 520,
        "height": 520
      }
    }
  ]
}
```

---

## 圖片 URL 規則

LINE 會根據裝置自動選擇適合的圖片尺寸。需提供多個尺寸：

```
baseUrl/
├── 240      (240px 寬)
├── 300      (300px 寬)
├── 460      (460px 寬)
├── 700      (700px 寬)
└── 1040     (1040px 寬)
```

例如 `baseUrl` 為 `https://example.com/imagemap`，則：
- `https://example.com/imagemap/240`
- `https://example.com/imagemap/700`
- `https://example.com/imagemap/1040`

> [!TIP]
> 檔案名稱就是數字本身，不需要副檔名。

---

## Action 類型

### URI Action
```json
{
  "type": "uri",
  "linkUri": "https://example.com",
  "area": {
    "x": 0,
    "y": 0,
    "width": 520,
    "height": 520
  }
}
```

### Message Action
```json
{
  "type": "message",
  "text": "使用者點擊後發送的文字",
  "area": {
    "x": 520,
    "y": 0,
    "width": 520,
    "height": 520
  }
}
```

---

## 座標系統

```
(0, 0) ────────────────── (width, 0)
  │                           │
  │      Image Map 區域        │
  │                           │
(0, height) ───────────── (width, height)
```

- 座標原點在左上角
- 單位為像素 (px)
- 寬高比需與 baseSize 一致

---

## 完整範例：四格選單

```typescript
const imageMapMessage = {
  type: 'imagemap',
  baseUrl: 'https://example.com/menu',
  altText: '產品選單',
  baseSize: {
    width: 1040,
    height: 1040
  },
  actions: [
    // 左上
    {
      type: 'message',
      text: '商品 A',
      area: { x: 0, y: 0, width: 520, height: 520 }
    },
    // 右上
    {
      type: 'message',
      text: '商品 B',
      area: { x: 520, y: 0, width: 520, height: 520 }
    },
    // 左下
    {
      type: 'message',
      text: '商品 C',
      area: { x: 0, y: 520, width: 520, height: 520 }
    },
    // 右下
    {
      type: 'uri',
      linkUri: 'https://example.com/contact',
      area: { x: 520, y: 520, width: 520, height: 520 }
    }
  ]
};

await pushMessage(userId, [imageMapMessage]);
```

---

## Video in Image Map

可以在 Image Map 中嵌入影片：

```json
{
  "type": "imagemap",
  "baseUrl": "https://example.com/imagemap",
  "altText": "影片訊息",
  "baseSize": {
    "width": 1040,
    "height": 585
  },
  "video": {
    "originalContentUrl": "https://example.com/video.mp4",
    "previewImageUrl": "https://example.com/preview.jpg",
    "area": {
      "x": 0,
      "y": 0,
      "width": 1040,
      "height": 585
    },
    "externalLink": {
      "linkUri": "https://example.com",
      "label": "觀看更多"
    }
  },
  "actions": []
}
```

---

## 使用場景

1. **產品目錄**：圖片式商品選單
2. **地圖導覽**：點擊地圖不同區域查看資訊
3. **互動遊戲**：點擊圖片觸發不同回應
4. **活動宣傳**：視覺化的活動資訊

---

## 相關資源
- [Image Map 官方文件](https://developers.line.biz/en/docs/messaging-api/using-imagemap/)
