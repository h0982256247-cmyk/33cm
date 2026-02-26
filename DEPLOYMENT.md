# 🚀 Zeabur 部署檢查清單

## ✅ 部署前檢查

### 1. Supabase 資料庫設定
- [ ] 執行 `supabase/drop_all.sql`（如果需要清空舊資料）
- [ ] 執行 `supabase/setup.sql`
- [ ] 執行 `supabase/security.sql` ⚠️ **重要！保護 access_token**
- [ ] 執行 `supabase/storage.sql`

### 2. Supabase Edge Functions 部署
```bash
# 部署 broadcast function（Flex Message 廣播）
supabase functions deploy broadcast --project-ref <your-project-ref>

# 部署 publish-richmenu function（Rich Menu 發布）
supabase functions deploy publish-richmenu --project-ref <your-project-ref>

# 檢查部署狀態
supabase functions list --project-ref <your-project-ref>
```

⚠️ **注意**：Edge Functions 在 Supabase 端執行，不需要額外的環境變數設定

### 3. 環境變數設定（Zeabur Variables）
- [ ] `VITE_SUPABASE_URL` - 你的 Supabase Project URL ⚠️ **必填**
- [ ] `VITE_SUPABASE_ANON_KEY` - 你的 Supabase Anon Key ⚠️ **必填**
- [ ] `VITE_APP_URL` - 你的網域（例如：https://33cm.zeabur.app） ⚠️ **必填**
- [ ] `VITE_LIFF_ID` - LINE LIFF ID（選填）

**重要**：不需要設定 `SUPABASE_SERVICE_ROLE_KEY`（已改用 Edge Functions）

### 4. Supabase Auth 設定
- [ ] 啟用 Email/Password 驗證
  - 前往 Supabase → Authentication → Providers
  - 啟用 Email provider

### 5. 本機測試
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

### 6. Git 提交
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
- [x] 所有 LINE API 呼叫都透過 Supabase Edge Functions
- [x] Edge Functions 使用 RPC `get_line_token()` 安全存取 token
- [x] Edge Functions 驗證用戶身份（Supabase Auth Token）
- [x] .gitignore 排除敏感檔案（.env, dist/）

### ⚠️ 注意事項
- Edge Functions 在 Supabase 雲端執行，無需在 Zeabur 設定 Service Role Key
- 定期檢查 Zeabur 環境變數設定是否正確
- 確認 Edge Functions 已正確部署並處於 ACTIVE 狀態

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
4. [ ] 確認 LINE API 呼叫都透過 Supabase Edge Functions
   - 廣播請求：`functions/v1/broadcast`
   - Rich Menu 發布：`functions/v1/publish-richmenu`

---

## 🐛 常見問題排除

### 問題 1：Edge Function 呼叫失敗
**原因**：Edge Functions 未部署或部署失敗
**解決**：
```bash
# 檢查 Edge Functions 狀態
supabase functions list --project-ref <your-project-ref>

# 重新部署
supabase functions deploy broadcast --project-ref <your-project-ref>
supabase functions deploy publish-richmenu --project-ref <your-project-ref>
```

### 問題 2：LINE API 呼叫失敗 (401)
**原因**：用戶 Session 過期或未登入
**解決**：重新登入

### 問題 3：找不到 LINE Channel
**原因**：資料庫缺少 `rm_line_channels_safe` VIEW
**解決**：執行 `supabase/security.sql`

### 問題 4：前端報錯 "relation rm_line_channels_safe does not exist"
**原因**：未執行 `security.sql`
**解決**：到 Supabase SQL Editor 執行 `supabase/security.sql`

### 問題 5：VITE_SUPABASE_ANON_KEY 錯誤
**原因**：環境變數未正確設定
**解決**：檢查 Zeabur Variables 中的 `VITE_SUPABASE_ANON_KEY` 是否正確

---

## 📝 架構說明

```
┌─────────────────────┐
│     前端 UI         │
│   (React + Vite)    │
└──────┬──────────────┘
       │ supabase.functions.invoke()
       │ + Supabase Auth Token
       │
       ▼
┌─────────────────────────────────────┐
│   Supabase Edge Functions (Deno)   │
│   - broadcast                       │
│   - publish-richmenu                │
│   - 驗證用戶身份                     │
│   - 使用 RPC get_line_token()       │
└──────┬──────────────────────────────┘
       │ RPC: get_line_token()
       │
       ▼
┌─────────────────────┐
│   Supabase DB       │
│  - rm_line_channels │
│    (含 token)       │
│  - rm_line_channels │
│    _safe (VIEW)     │
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
- LINE Token 只在 Edge Functions 存取（使用 RPC）
- 所有 LINE API 呼叫都由 Supabase Edge Functions 代理
- Edge Functions 在 Supabase 雲端執行，無需暴露 Service Role Key
