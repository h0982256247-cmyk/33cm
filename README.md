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

### 1-3. 建立 Storage buckets + Policies（圖片用）
最後執行：
- `supabase/storage.sql`

---

## 2) 環境變數（本機 / Zeabur 都一樣）
建立 `.env`（或在 Zeabur Variables 設定）：
```env
VITE_SUPABASE_URL=你的_supabase_url
VITE_SUPABASE_ANON_KEY=你的_anon_key
VITE_LIFF_ID=（選填，用於分享/自動分享）
VITE_APP_URL=https://你的網域（用於分享連結）
```

---

## 3) Token 共用邏輯（你這次的需求）
- 登入後，入口頁會呼叫 `rm_channel_upsert()` 把 token 寫入 `rm_line_channels`
- 後續不管你在 Rich Menu 或 Flex Message，只要要發 LINE API 都從同一張表取 token
- 你不用拆兩套 token；**一個使用者只會有一筆 active token**

---

## 常見問題
### Q1：為什麼我已登入，但系統說缺少 LINE Token？
- 代表你還沒在入口頁完成「綁定 LINE Channel」
- 或是你 DB 沒有跑 `setup.sql`（缺表/缺欄位/缺 RLS）

### Q2：我想把 Token 存加密（不是明碼）
目前 DB 欄位命名為 `access_token_encrypted`（方便你之後替換成真正加密流程）。
若你要做到真正加密，建議用 Edge Function / Server 端處理加解密，前端只送明文一次、DB 只存密文。
