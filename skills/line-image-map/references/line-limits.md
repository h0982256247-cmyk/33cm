# LINE 平台限制速查表

本文件整理 LINE 平台的各項限制，幫助開發者避免因超出限制而導致發送失敗。

---

## Image Map 限制

| 項目 | 限制 |
|------|------|
| 動作區域數 | **最多 50 個** |
| 基礎圖片寬度 | 建議 1040px |
| 支援圖片尺寸 | 240, 300, 460, 700, 1040 px 寬 |
| 圖片 URL | 必須 HTTPS |

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

### 影片訊息

| 項目 | 限制 |
|------|------|
| 影片大小 | **最大 200MB** |
| 影片長度 | **最長 1 分鐘** |
| 影片格式 | MP4 |

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

- [Image Map 官方文件](https://developers.line.biz/en/docs/messaging-api/using-imagemap/)
- [Messaging API 官方文件](https://developers.line.biz/en/docs/messaging-api/)
