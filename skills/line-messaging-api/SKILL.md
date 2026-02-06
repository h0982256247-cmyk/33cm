---
name: line-messaging-api
description: LINE Messaging API 開發指南 - 發送訊息、回覆訊息、推播訊息
---

# LINE Messaging API

## 概述
這個 skill 提供 LINE Messaging API 的開發指南，包括訊息發送、回覆、推播等功能。

## 觸發條件
當使用者提到以下關鍵字時觸發：
- "LINE 訊息"、"LINE message"
- "推播訊息"、"push message"
- "回覆訊息"、"reply message"
- "LINE bot"

## ⚠️ 關鍵限制

> [!CAUTION]
> **發送失敗常見原因：**
> - 每次請求最多 **5 則訊息**
> - 文字訊息最大 **5000 字元**
> - 圖片 URL 必須 **HTTPS**
> - 原始圖片最大 **10MB**，預覽圖最大 **1MB**
> - Multicast 最多 **500 人**
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## 前置條件
- 已建立 LINE Official Account
- 已取得 Channel Access Token
- 已設定 Webhook URL

---

## API 基礎資訊

### Base URL
```
https://api.line.me/v2/bot
```

### 認證方式
```http
Authorization: Bearer {channel_access_token}
Content-Type: application/json
```

---

## 核心 API 端點

### 1. 回覆訊息 (Reply Message)
**用途**：回覆使用者發送的訊息（需要 replyToken，有效期限約 1 分鐘）

```http
POST https://api.line.me/v2/bot/message/reply
```

**Request Body**:
```json
{
  "replyToken": "回覆 token",
  "messages": [
    {
      "type": "text",
      "text": "Hello, world!"
    }
  ]
}
```

**TypeScript 範例**:
```typescript
async function replyMessage(replyToken: string, messages: Message[]) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages })
  });
  
  if (!response.ok) {
    throw new Error(`Reply failed: ${response.status}`);
  }
}
```

---

### 2. 推播訊息 (Push Message)
**用途**：主動發送訊息給特定使用者（不需要 replyToken）

```http
POST https://api.line.me/v2/bot/message/push
```

**Request Body**:
```json
{
  "to": "使用者 ID",
  "messages": [
    {
      "type": "text",
      "text": "主動推播的訊息"
    }
  ]
}
```

**TypeScript 範例**:
```typescript
async function pushMessage(userId: string, messages: Message[]) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ to: userId, messages })
  });
  
  if (!response.ok) {
    throw new Error(`Push failed: ${response.status}`);
  }
}
```

---

### 3. 多人推播 (Multicast)
**用途**：同時發送訊息給多位使用者（最多 500 人）

```http
POST https://api.line.me/v2/bot/message/multicast
```

**Request Body**:
```json
{
  "to": ["userId1", "userId2", "userId3"],
  "messages": [
    {
      "type": "text",
      "text": "群發訊息"
    }
  ]
}
```

---

### 4. 廣播訊息 (Broadcast)
**用途**：發送訊息給所有好友

```http
POST https://api.line.me/v2/bot/message/broadcast
```

**Request Body**:
```json
{
  "messages": [
    {
      "type": "text",
      "text": "廣播給所有人的訊息"
    }
  ]
}
```

---

## 訊息類型

### 文字訊息 (Text)
```json
{
  "type": "text",
  "text": "Hello, world!"
}
```

### 貼圖訊息 (Sticker)
```json
{
  "type": "sticker",
  "packageId": "446",
  "stickerId": "1988"
}
```

### 圖片訊息 (Image)
```json
{
  "type": "image",
  "originalContentUrl": "https://example.com/image.jpg",
  "previewImageUrl": "https://example.com/preview.jpg"
}
```

### 影片訊息 (Video)
```json
{
  "type": "video",
  "originalContentUrl": "https://example.com/video.mp4",
  "previewImageUrl": "https://example.com/preview.jpg"
}
```

### 位置訊息 (Location)
```json
{
  "type": "location",
  "title": "my location",
  "address": "〒150-0002 東京都渋谷区渋谷２丁目２１−１",
  "latitude": 35.65910807942215,
  "longitude": 139.70372892916718
}
```

---

## 錯誤處理

| 狀態碼 | 說明 | 解決方式 |
|--------|------|----------|
| 400 | 請求格式錯誤 | 檢查 JSON 格式和必要欄位 |
| 401 | 認證失敗 | 檢查 Channel Access Token |
| 403 | 沒有權限 | 確認 Bot 已被使用者加為好友 |
| 429 | 請求過於頻繁 | 實作 Rate Limiting |

---

## 最佳實踐

1. **使用環境變數**：永遠不要將 Channel Access Token 寫在程式碼中
2. **錯誤重試**：實作指數退避 (Exponential Backoff) 重試機制
3. **訊息數量限制**：每次請求最多 5 則訊息
4. **驗證 Webhook 簽名**：確保請求來自 LINE 平台

---

## 相關資源
- [LINE Messaging API 官方文件](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Bot SDK](https://github.com/line/line-bot-sdk-nodejs)
- [Postman Collection](https://developers.line.biz/en/docs/messaging-api/postman/)
