# LINE Portal（單一入口版）
這個專案只有 **一個入口**：
1) 使用者先用 **Supabase Auth（Email/Password）登入**
2) 登入後在同一個入口頁填入 **LINE Channel Access Token**
3) Token 會存到 `rm_line_channels`，並且 **Rich Menu 編輯器**、**Flex Message 編輯器** 兩套系統共用同一組 Token（用於所有 LINE Messaging API 發送）

---

## 你需要準備的東西
- Supabase Project（含 Auth + Database + Storage）
- Zeabur（或任何 Node hosting）
- LINE Messaging API 的 Channel Access Token（長期有效的那種）

---

## 0) 本機先跑起來（確認 UI）
```bash
npm i
npm run dev
```
- 前台：http://localhost:5173  
- API：http://localhost:8080/health（dev 模式由 Vite proxy；正式由同一台 Node 服務）

---

## 1) Supabase：一鍵重建資料庫（推薦）
> 如果你現在 DB 裡已經亂掉了，建議用「先刪後建」的方式最乾淨。

### 1-1. 刪掉舊表（⚠️會清空所有資料）
到 Supabase → SQL Editor，執行：
- `supabase/drop_all.sql`

### 1-2. 建立需要的資料表 + RPC + RLS
接著執行：
- `supabase/setup.sql`

### 1-3. 🔒 安全性強化（重要！）
執行以下檔案以保護 LINE Access Token：
- `supabase/security.sql`
> 此步驟會建立安全的 VIEW，確保前端無法直接讀取 `access_token_encrypted`

### 1-4. 建立 Storage buckets + Policies（圖片用）
最後執行：
- `supabase/storage.sql`

---

## 2) 環境變數設定

### 本機開發 (.env)
```env
# 前端設定
VITE_SUPABASE_URL=你的_supabase_url
VITE_SUPABASE_ANON_KEY=你的_anon_key
VITE_LIFF_ID=（選填，用於分享/自動分享）
VITE_APP_URL=http://localhost:5173

# 🔒 後端設定（本機用於 server.js 的輔助功能）
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

### Zeabur 部署環境變數
```env
VITE_SUPABASE_URL=你的_supabase_url
VITE_SUPABASE_ANON_KEY=你的_anon_key
VITE_APP_URL=https://你的網域
VITE_LIFF_ID=（選填）
```

⚠️ **注意**：
- Zeabur 上**不需要**設定 `SUPABASE_SERVICE_ROLE_KEY`（LINE API 呼叫已改用 Edge Functions）
- 本機開發時保留 Service Role Key 是為了 server.js 的輔助功能（如 token 驗證）

---

## 3) 🔒 安全架構說明

### Token 安全處理
- **前端**：只能看到 Channel 基本資訊（id, name），無法讀取 `access_token`
- **Edge Functions**：在 Supabase 端執行，使用 RPC `get_line_token()` 安全地讀取 token
- **流程**：前端 → Supabase Edge Functions → LINE API

### Token 共用邏輯
- 登入後，入口頁會呼叫 `rm_channel_upsert()` 把 token 寫入 `rm_line_channels`
- 後續不管你在 Rich Menu 或 Flex Message，都透過 **Supabase Edge Functions** 發送 LINE API
- 你不用拆兩套 token；**一個使用者只會有一筆 active token**

### Supabase Edge Functions
已部署的 Edge Functions：
- `broadcast` - 廣播 Flex Message 給所有好友
- `publish-richmenu` - 發布 Rich Menu 到 LINE OA

部署命令：
```bash
supabase functions deploy broadcast --project-ref <your-project-ref>
supabase functions deploy publish-richmenu --project-ref <your-project-ref>
```

---

## 常見問題

### Q1：為什麼我已登入，但系統說缺少 LINE Token？
- 代表你還沒在入口頁完成「綁定 LINE Channel」
- 或是你 DB 沒有跑 `setup.sql` + `security.sql`（缺表/缺欄位/缺 RLS/缺 VIEW）

### Q2：為什麼前端無法直接呼叫 LINE API？
✅ **這是正確的安全設計！**
- 前端從 `rm_line_channels_safe` VIEW 讀取（不含 token）
- 所有 LINE API 呼叫都透過 **Supabase Edge Functions**
- Edge Functions 使用 RPC `get_line_token()` 安全地讀取 token

### Q3：如何在 Zeabur 設定環境變數？
1. 進入 Zeabur 專案 → Variables
2. 新增以下變數：
   - `VITE_SUPABASE_URL` ⚠️ **必填**
   - `VITE_SUPABASE_ANON_KEY` ⚠️ **必填**
   - `VITE_APP_URL` ⚠️ **必填**
   - `VITE_LIFF_ID`（選填）

**注意**：不需要設定 `SUPABASE_SERVICE_ROLE_KEY`（已改用 Edge Functions）

### Q4：我想把 Token 存加密（不是明碼）
目前 DB 欄位命名為 `access_token_encrypted`（方便你之後替換成真正加密流程）。
若要做到真正加密：
1. 使用 Supabase Vault（推薦）
2. 或在後端使用 `crypto` 模組加解密
