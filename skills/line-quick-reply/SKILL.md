---
name: line-quick-reply
description: LINE Quick Reply 開發指南 - 在訊息下方顯示快速回覆按鈕，提供使用者便捷的互動選項。當用戶詢問 Quick Reply、快速回覆、快捷按鈕相關問題時使用。
---

# LINE Quick Reply

## 概述
Quick Reply 是在訊息下方顯示的快速回覆按鈕列，讓使用者可以快速選擇預設選項，提升互動效率。

## 觸發條件
- "Quick Reply"、"快速回覆"
- "快捷按鈕"、"快速選項"

---

## ⚠️ 關鍵限制

> [!CAUTION]
> - Quick Reply 按鈕最多 **13 個**
> - 按鈕 label 最大 **20 字元**
> - 圖示 URL 必須 **HTTPS**
> - Quick Reply 在使用者點擊後會**自動消失**
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## Quick Reply 結構

```json
{
  "type": "text",
  "text": "請選擇一個選項：",
  "quickReply": {
    "items": [
      {
        "type": "action",
        "imageUrl": "https://example.com/icon.png",
        "action": {
          "type": "message",
          "label": "選項 A",
          "text": "A"
        }
      }
    ]
  }
}
```

---

## Action 類型

### Message Action
```json
{
  "type": "action",
  "action": {
    "type": "message",
    "label": "選項 A",
    "text": "使用者點擊後發送的文字"
  }
}
```

### Postback Action
```json
{
  "type": "action",
  "action": {
    "type": "postback",
    "label": "購買",
    "data": "action=buy&itemId=123",
    "displayText": "我要購買"
  }
}
```

### URI Action
```json
{
  "type": "action",
  "action": {
    "type": "uri",
    "label": "開啟連結",
    "uri": "https://example.com"
  }
}
```

### Datetime Picker Action
```json
{
  "type": "action",
  "action": {
    "type": "datetimepicker",
    "label": "選擇日期",
    "data": "action=selectDate",
    "mode": "date",
    "initial": "2024-01-01",
    "min": "2024-01-01",
    "max": "2024-12-31"
  }
}
```

| mode | 說明 |
|------|------|
| `date` | 日期選擇器 |
| `time` | 時間選擇器 |
| `datetime` | 日期時間選擇器 |

### Camera Action
```json
{
  "type": "action",
  "action": {
    "type": "camera",
    "label": "拍照"
  }
}
```

### Camera Roll Action
```json
{
  "type": "action",
  "action": {
    "type": "cameraRoll",
    "label": "選擇照片"
  }
}
```

### Location Action
```json
{
  "type": "action",
  "action": {
    "type": "location",
    "label": "傳送位置"
  }
}
```

---

## 完整範例

```typescript
const replyMessage = {
  type: 'text',
  text: '請問您需要什麼服務？',
  quickReply: {
    items: [
      {
        type: 'action',
        imageUrl: 'https://example.com/icons/product.png',
        action: {
          type: 'message',
          label: '查詢商品',
          text: '查詢商品'
        }
      },
      {
        type: 'action',
        imageUrl: 'https://example.com/icons/order.png',
        action: {
          type: 'message',
          label: '訂單查詢',
          text: '訂單查詢'
        }
      },
      {
        type: 'action',
        imageUrl: 'https://example.com/icons/support.png',
        action: {
          type: 'message',
          label: '聯繫客服',
          text: '聯繫客服'
        }
      },
      {
        type: 'action',
        action: {
          type: 'location',
          label: '分享位置'
        }
      },
      {
        type: 'action',
        action: {
          type: 'datetimepicker',
          label: '預約時間',
          data: 'action=booking',
          mode: 'datetime'
        }
      }
    ]
  }
};

await replyMessage(replyToken, [replyMessage]);
```

---

## 使用場景

1. **問卷調查**：提供選項讓使用者快速回答
2. **客服引導**：引導使用者選擇常見問題類型
3. **預約系統**：結合 datetimepicker 選擇時間
4. **位置服務**：讓使用者分享位置
5. **多媒體上傳**：讓使用者拍照或選擇照片

---

## 相關資源
- [Quick Reply 官方文件](https://developers.line.biz/en/docs/messaging-api/using-quick-reply/)
