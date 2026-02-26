# 🚀 Zeabur 部署檢查清單

## ✅ 部署前檢查

### 1. Supabase 資料庫設定
- [ ] 執行 `supabase/drop_all.sql`（如果需要清空舊資料）
- [ ] 執行 `supabase/setup.sql`
- [ ] 執行 `supabase/security.sql` ⚠️ **重要！保護 access_token**
- [ ] 執行 `supabase/storage.sql`

### 2. 環境變數設定（Zeabur Variables）
- [ ] `VITE_SUPABASE_URL` - 你的 Supabase Project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - 你的 Supabase Anon Key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - 你的 Service Role Key ⚠️ **必須設定！**
- [ ] `VITE_APP_URL` - 你的網域（例如：https://33cm.zeabur.app）
- [ ] `VITE_LIFF_ID` - LINE LIFF ID（選填）

### 3. Supabase Auth 設定
- [ ] 啟用 Email/Password 驗證
  - 前往 Supabase → Authentication → Providers
  - 啟用 Email provider

### 4. 本機測試
```bash
# 安裝依賴
npm install

# 建立 .env 檔案（參考 .env.example）
cp .env.example .env

# 修改 .env 填入正確的環境變數

# 執行開發模式測試
npm run dev

# 測試編譯
npm run build

# 測試正式環境
npm start
```

### 5. Git 提交
```bash
# 確認 .gitignore 已包含 dist/ 和 .env
git add .
git commit -m "優化安全架構：將 LINE Token 處理移至後端"
git push
```

---

## 🔒 安全性檢查

### ✅ 已實作的安全措施
- [x] 前端無法直接讀取 `access_token_encrypted`
- [x] 建立 `rm_line_channels_safe` VIEW 只暴露基本資訊
- [x] 所有 LINE API 呼叫都透過後端代理
- [x] 後端使用 Service Role Key 安全存取 token
- [x] 後端驗證用戶身份（Supabase Auth Token）
- [x] .gitignore 排除敏感檔案（.env, dist/）

### ⚠️ 注意事項
- `SUPABASE_SERVICE_ROLE_KEY` 擁有完整權限，切勿暴露在前端或 Git
- 定期檢查 Zeabur 環境變數設定是否正確
- 如遇到 CORS 問題，確認後端 API 路徑正確

---

## 📊 部署後驗證

### 1. 健康檢查
```bash
curl https://your-domain.zeabur.app/health
# 預期回應：{"ok":true}
```

### 2. 功能測試
1. [ ] 訪問網站首頁
2. [ ] 測試登入功能（Email/Password）
3. [ ] 測試綁定 LINE Channel Token
4. [ ] 測試 Rich Menu 編輯器
5. [ ] 測試 Flex Message 編輯器
6. [ ] 測試廣播功能

### 3. 安全性驗證
1. [ ] 打開瀏覽器開發者工具 → Network
2. [ ] 確認前端查詢使用 `rm_line_channels_safe`
3. [ ] 確認 `access_token_encrypted` 沒有出現在任何前端回應中
4. [ ] 確認 LINE API 呼叫都透過 `/api/line/*` endpoints

---

## 🐛 常見問題排除

### 問題 1：後端無法啟動
**原因**：缺少 `SUPABASE_SERVICE_ROLE_KEY`
**解決**：在 Zeabur Variables 中新增此環境變數

### 問題 2：LINE API 呼叫失敗 (401)
**原因**：用戶 Session 過期或未登入
**解決**：重新登入

### 問題 3：找不到 LINE Channel
**原因**：資料庫缺少 `rm_line_channels_safe` VIEW
**解決**：執行 `supabase/security.sql`

### 問題 4：前端報錯 "relation rm_line_channels_safe does not exist"
**原因**：未執行 `security.sql`
**解決**：到 Supabase SQL Editor 執行 `supabase/security.sql`

---

## 📝 架構說明

```
┌─────────────┐
│   前端 UI   │
└──────┬──────┘
       │ Supabase Auth Token
       │
       ▼
┌─────────────────────┐
│   後端 API Server   │
│  (server.js)        │
│  - 驗證用戶身份      │
│  - 讀取 LINE Token  │
└──────┬──────────────┘
       │ Service Role Key
       │
       ▼
┌─────────────────────┐
│   Supabase DB       │
│  - rm_line_channels │
│    (含 token)       │
└─────────────────────┘
       │
       │ LINE Token
       │
       ▼
┌─────────────────────┐
│   LINE API          │
│  - Broadcast        │
│  - Rich Menu        │
└─────────────────────┘
```

**安全性關鍵點**：
- 前端只看得到基本資訊（透過 `rm_line_channels_safe` VIEW）
- LINE Token 只在後端存取（使用 Service Role Key）
- 所有 LINE API 呼叫都由後端代理
