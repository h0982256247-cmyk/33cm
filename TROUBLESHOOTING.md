# 🔧 LINE Broadcast 錯誤排查指南

## ❌ 問題：廣播時出現 401 錯誤

### 📋 錯誤訊息
```
FunctionsHttpError: Edge Function returned a non-2xx status code
failed to load resource: the server responded with a status of 401 ()
```

---

## 🎯 解決步驟

### 第一步：執行安全架構 SQL

1. 登入 **Supabase Dashboard** → **SQL Editor**

2. 複製並執行 `/supabase/secure_token_access.sql` 的完整內容

3. 確認執行成功（應該看到 "Success. No rows returned"）

### 第二步：診斷資料庫狀態

在 **Supabase Dashboard** → **SQL Editor** 執行：

```sql
-- 檢查所有 Token 記錄
SELECT
    id,
    user_id,
    name,
    is_active,
    LENGTH(access_token_encrypted) AS token_length,
    created_at,
    updated_at
FROM public.rm_line_channels
ORDER BY created_at DESC;
```

**檢查重點：**
- ✅ 是否有記錄？
- ✅ `user_id` 是否與你當前登入帳號相符？
- ✅ `is_active` 是否為 `true`？
- ✅ `token_length` 是否 > 0？

### 第三步：清理不匹配的舊記錄（如果需要）

如果發現 `user_id` 與你當前帳號不符：

```sql
-- ⚠️ 警告：這會刪除所有記錄，請確認後再執行
DELETE FROM public.rm_line_channels;
```

刪除後，請到應用程式重新綁定 LINE Channel Token。

### 第四步：驗證 RPC 函數

執行診斷腳本：

```sql
-- 執行 /supabase/debug_token_issue.sql 的內容
```

**確認項目：**
- ✅ `get_channel_status` RPC 存在
- ✅ `rm_channel_upsert` RPC 存在
- ❌ `get_line_token` RPC **不存在**（已刪除）
- ❌ `rm_line_channels_safe` VIEW **不存在**（已刪除）

### 第五步：本地測試

```bash
cd /Users/edwin/new33cm/33cm-main
npm run dev
```

**測試流程：**
1. 登入系統
2. 前往設定頁面，綁定 LINE Channel Access Token
3. 刷新頁面，確認 token 已保存（不需要重新輸入）
4. 前往廣播頁面，測試發送廣播

### 第六步：檢查 Edge Function 日誌

如果仍有問題，到 **Supabase Dashboard** → **Edge Functions** → **broadcast** → **Logs**

查看後端詳細錯誤訊息。

---

## 🔍 常見錯誤與解決方法

### 錯誤 1：401 Unauthorized

**原因：**
- 資料庫中沒有 token 記錄
- Token 記錄的 `user_id` 與當前登入用戶不符
- `secure_token_access.sql` 尚未執行

**解決：**
按照上述「解決步驟」完整執行一遍

---

### 錯誤 2：404 Not Found

**原因：**
Edge Function 尚未部署

**解決：**
```bash
supabase functions deploy broadcast
```

---

### 錯誤 3：LINE API 回傳錯誤

**原因：**
- LINE Channel Access Token 無效或過期
- LINE Channel 設定錯誤
- LINE API 配額已用完

**解決：**
1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 確認 Channel Access Token 有效性
3. 重新產生 Token 並更新到系統中

---

## 📊 安全架構說明

### 設計原則

1. **前端永遠無法讀取 LINE Token**
   - 禁止 authenticated 用戶 SELECT `rm_line_channels` 表
   - 移除 `rm_line_channels_safe` VIEW
   - 移除 `get_line_token()` RPC

2. **前端只能透過 RPC 取得非敏感資訊**
   - `get_channel_status()` → 回傳 `(has_channel, name, updated_at)`
   - `rm_channel_upsert()` → 接受 token 但不回傳

3. **只有 Edge Functions 能讀取 Token**
   - Edge Functions 使用 `SUPABASE_SERVICE_ROLE_KEY`
   - Service Role 繞過所有 RLS 限制
   - 雙客戶端模式：
     - `supabaseClient`（Anon Key）→ 驗證用戶身份
     - `supabaseAdmin`（Service Role）→ 讀取 Token

---

## 🛡️ 安全驗證

開啟瀏覽器 DevTools → Network 標籤，確認：

- ❌ `access_token_encrypted` **絕不**出現在任何 Response 中
- ✅ 只能看到 `has_channel`, `name`, `updated_at`

---

## 📞 需要幫助？

如果按照以上步驟仍無法解決：

1. 複製 Console 完整錯誤日誌
2. 複製 Supabase Edge Function Logs
3. 截圖錯誤畫面
4. 提供給開發團隊協助排查
