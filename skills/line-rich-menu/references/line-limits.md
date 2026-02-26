# LINE 平台限制速查表

本文件整理 LINE 平台的各項限制，幫助開發者避免因超出限制而導致發送失敗。

---

## Messaging API 限制

### 訊息發送

| 項目 | 限制 | 備註 |
|------|------|------|
| 每次請求訊息數 | **最多 5 則** | reply/push/multicast 皆適用 |
| Multicast 對象數 | **最多 500 人** | 每次請求 |
| 廣播免費額度 | 依方案而定 | 超過需付費 |

### 文字訊息

| 項目 | 限制 |
|------|------|
| 文字長度 | **最多 5000 字元** |

### 圖片訊息

| 項目 | 限制 |
|------|------|
| 原始圖片大小 | **最大 10MB** |
| 預覽圖片大小 | **最大 1MB** |
| 圖片格式 | JPEG, PNG |
| URL 協議 | **必須 HTTPS** |
| 最大寬度 | 4096px |

### 影片訊息

| 項目 | 限制 |
|------|------|
| 影片大小 | **最大 200MB** |
| 影片長度 | **最長 1 分鐘** |
| 影片格式 | MP4 |
| 預覽圖大小 | **最大 1MB** |
| URL 協議 | **必須 HTTPS** |

### 音訊訊息

| 項目 | 限制 |
|------|------|
| 音訊大小 | **最大 200MB** |
| 音訊長度 | **最長 1 分鐘** |
| 音訊格式 | M4A |

---

## Flex Message 限制

> [!CAUTION]
> Flex Message JSON 大小是最常見的發送失敗原因！

| 項目 | 限制 |
|------|------|
| 單一 Bubble JSON | **最大 50KB** |
| Carousel JSON | **最大 300KB** |
| Carousel Bubble 數量 | **最多 12 個** |
| altText 長度 | **最大 400 字元** |
| **Carousel Video Hero** | ❌ **不支援** |

### 元件限制

| 元件 | 屬性 | 限制 |
|------|------|------|
| Box | 巢狀深度 | 最深約 10 層 |
| Text | maxLines | 最大無限制（但建議 ≤ 10） |
| Button | label | **最多 20 字元** |
| Action URI | uri | **最大 1000 字元** |
| Action data | postback data | **最大 300 字元** |
| Icon | URL | 必須 HTTPS，最大 1MB |

### aspectRatio 規格

- 格式：`寬:高`
- 範圍：`1:3` 到 `3:1`
- 常用值：`1:1`, `4:3`, `16:9`, `20:13`

---

## LIFF 限制

### shareTargetPicker

| 項目 | 限制 |
|------|------|
| 選擇對象數 | **最多 10 個** |
| 訊息數量 | **最多 5 則** |
| 訊息大小 | 同 Messaging API 限制 |

### sendMessages

| 項目 | 限制 |
|------|------|
| 訊息數量 | **最多 5 則** |
| 使用環境 | **僅限 LINE App 內** |

---

## Rich Menu 限制

| 項目 | 限制 |
|------|------|
| Rich Menu 數量 | 每帳號 **最多 1000 個** |
| Rich Menu Alias 數量 | 每帳號 **最多 1000 個** |
| 圖片大小 | **最大 1MB** |
| 圖片尺寸 | 2500×1686 或 2500×843 |
| 圖片格式 | JPEG, PNG |
| 熱區數量 | **最多 20 個** |
| Alias ID 長度 | 1-100 字元 |
| Alias ID 字元 | 英數、底線、連字號 |

---

## Quick Reply 限制

| 項目 | 限制 |
|------|------|
| Quick Reply 按鈕數 | **最多 13 個** |
| 按鈕 label | **最多 20 字元** |
| 圖示 URL | 必須 HTTPS |

---

## Template Message 限制

### Buttons Template

| 項目 | 限制 |
|------|------|
| 標題 | 最多 40 字元 |
| 文字 | 最多 160 字元（有標題）/ 60 字元（無標題） |
| 按鈕數 | **最多 4 個** |

### Confirm Template

| 項目 | 限制 |
|------|------|
| 文字 | 最多 240 字元 |
| 按鈕數 | **固定 2 個** |

### Carousel Template

| 項目 | 限制 |
|------|------|
| Column 數 | **最多 10 個** |
| 每個 Column 按鈕數 | **最多 3 個** |

### Image Carousel Template

| 項目 | 限制 |
|------|------|
| Column 數 | **最多 10 個** |

---

## Image Map 限制

| 項目 | 限制 |
|------|------|
| 動作區域數 | **最多 50 個** |
| 基礎圖片寬度 | 建議 1040px |
| 支援圖片尺寸 | 240, 300, 460, 700, 1040 px 寬 |

---

## Webhook 限制

| 項目 | 限制 |
|------|------|
| 回應時間 | **必須 1 秒內** |
| replyToken 有效期 | 約 **1 分鐘** |
| 重試機制 | LINE 會自動重試失敗的 webhook |

---

## Rate Limiting

| API | 限制 |
|-----|------|
| Reply message | 無明確限制（受 replyToken 限制） |
| Push message | 取決於帳號方案 |
| Multicast | 取決於帳號方案 |
| Broadcast | 取決於帳號方案 |

---

## 常見錯誤碼

| 錯誤碼 | 說明 | 原因 |
|--------|------|------|
| 400 | Bad Request | JSON 格式錯誤、超出限制 |
| 401 | Unauthorized | Token 無效或過期 |
| 403 | Forbidden | Bot 未被加為好友 |
| 413 | Payload Too Large | 訊息或圖片超過大小限制 |
| 429 | Too Many Requests | 超過 Rate Limit |

---

## 參考資源

- [Messaging API 官方文件](https://developers.line.biz/en/docs/messaging-api/)
- [Flex Message 規格](https://developers.line.biz/en/docs/messaging-api/flex-message-elements/)
- [LIFF 文件](https://developers.line.biz/en/docs/liff/)
