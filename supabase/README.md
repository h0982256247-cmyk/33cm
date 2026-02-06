# Supabase 設定指南

## 📋 快速開始

### 1. 執行 SQL 設定

在 Supabase Dashboard → SQL Editor 執行：

```sql
-- 執行這個檔案即可完成所有資料庫設定
-- 檔案位置：supabase/complete_setup.sql
```

### 2. 部署 Edge Functions

```bash
# 安裝 Supabase CLI
npm install -g supabase

# 登入
supabase login

# Link 到你的專案
supabase link --project-ref YOUR_PROJECT_REF

# 部署 Edge Functions
supabase functions deploy broadcast
supabase functions deploy publish-richmenu
```

---

## 📊 資料表說明

| 資料表 | 用途 |
|--------|------|
| `line_channels` | 儲存用戶的 LINE Bot Token |
| `rm_folders` | Rich Menu 草稿資料夾 |
| `rm_drafts` | Rich Menu 草稿（含完整選單設定） |
| `docs` | Flex Message 文件 |
| `doc_versions` | Flex Message 版本記錄 |
| `shares` | 分享連結 |

---

## 🪣 Storage Buckets

| Bucket | 用途 | 大小限制 |
|--------|------|----------|
| `flex-assets` | Flex Message 圖片/影片 | 2MB |
| `richmenu-images` | Rich Menu 選單圖片 | 1MB |

---

## ⚡ Edge Functions

### `broadcast`
呼叫 LINE Messaging API 發送推播訊息

**Request:**
```json
{
  "flexMessages": [{ "type": "bubble", ... }],
  "altText": "您收到新訊息"
}
```

### `publish-richmenu`
發布 Rich Menu 到 LINE（建立 + 上傳圖片 + 設定別名）

**Request:**
```json
{
  "menus": [
    {
      "id": "uuid",
      "name": "主選單",
      "barText": "打開選單",
      "isMain": true,
      "imageData": "data:image/png;base64,...",
      "hotspots": [...]
    }
  ],
  "setAsDefault": true
}
```

---

## 🔐 RLS 政策

所有資料表都啟用 Row Level Security：
- 使用者只能存取自己的資料
- 分享連結的 `get_share()` RPC 允許匿名存取

---

## 🔧 RPC Functions

| Function | 用途 | 權限 |
|----------|------|------|
| `get_share(token)` | 取得分享內容 | 公開 |
| `check_line_token()` | 檢查 Token 是否存在 | authenticated |
| `get_line_token()` | 取得 LINE Token | authenticated |

---

## 📝 環境變數

前端專案需要設定：
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_LIFF_ID=1234567890-abcdefgh
```
