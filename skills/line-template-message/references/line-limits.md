# LINE 平台限制速查表

本文件整理 LINE 平台的各項限制，幫助開發者避免因超出限制而導致發送失敗。

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
| 所有 Column 按鈕數 | **必須相同** |

### Image Carousel Template

| 項目 | 限制 |
|------|------|
| Column 數 | **最多 10 個** |

---

## Messaging API 限制

### 訊息發送

| 項目 | 限制 | 備註 |
|------|------|------|
| 每次請求訊息數 | **最多 5 則** | reply/push/multicast 皆適用 |
| Multicast 對象數 | **最多 500 人** | 每次請求 |

### 圖片訊息

| 項目 | 限制 |
|------|------|
| 原始圖片大小 | **最大 10MB** |
| 預覽圖片大小 | **最大 1MB** |
| 圖片格式 | JPEG, PNG |
| URL 協議 | **必須 HTTPS** |

---

## Flex Message 限制

| 項目 | 限制 |
|------|------|
| 單一 Bubble JSON | **最大 50KB** |
| Carousel JSON | **最大 300KB** |
| altText 長度 | **最大 400 字元** |

---

## 常見錯誤碼

| 錯誤碼 | 說明 | 原因 |
|--------|------|------|
| 400 | Bad Request | JSON 格式錯誤、超出限制 |
| 401 | Unauthorized | Token 無效或過期 |
| 413 | Payload Too Large | 訊息或圖片超過大小限制 |

---

## 參考資源

- [Template Message 官方文件](https://developers.line.biz/en/docs/messaging-api/message-types/#template-messages)
- [Messaging API 官方文件](https://developers.line.biz/en/docs/messaging-api/)
