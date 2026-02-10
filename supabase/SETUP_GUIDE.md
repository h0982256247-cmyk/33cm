# Supabase 完整設定指南（0-1 教學）

本指南將帶您完成從零開始設定 Supabase 資料庫和 Edge Functions 的完整流程。

## 📋 前置準備

1. **建立 Supabase 專案**
   - 前往 [https://supabase.com](https://supabase.com)
   - 註冊/登入帳號
   - 點選 "New Project"
   - 選擇組織，輸入專案名稱、資料庫密碼、選擇區域（建議選 Singapore 或 Tokyo）
   - 等待專案建立完成（約 2-3 分鐘）

2. **取得專案資訊**
   - 進入專案後，點選左側 Settings → API
   - 記下以下資訊：
     - `Project URL`（例如：https://xxx.supabase.co）
     - `anon public` key（公開金鑰）
     - `Project Ref`（專案參考代碼，用於 CLI）

---

## 🗄️ 步驟 1：建立資料庫結構

### 1.1 執行 SQL 設定檔

1. **開啟 SQL Editor**
   - 在 Supabase Dashboard 左側選單點選 **SQL Editor**
   - 點選右上角 **New Query**

2. **執行 schema.sql**
   - 複製 `supabase/schema.sql` 的完整內容
   - 貼上到 SQL Editor
   - 點選右下角 **Run** 或按 `Ctrl/Cmd + Enter`
   - 確認執行成功（會顯示 "Success. No rows returned"）

3. **執行 complete_setup.sql 的 Storage 部分**
   - 複製 `supabase/complete_setup.sql` 第 241-290 行（Storage Buckets 設定）
   - 在 SQL Editor 開新查詢
   - 貼上並執行
   - 確認執行成功

4. **新增缺少的 RPC Functions**
   - 執行以下 SQL 來新增 `check_line_token` 和 `get_line_token` 函數：

```sql
-- 檢查 LINE Token 是否存在
CREATE OR REPLACE FUNCTION public.check_line_token()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.rm_line_channels
        WHERE user_id = auth.uid()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_line_token() TO authenticated;

-- 取得 LINE Token（僅供 Edge Function 使用）
CREATE OR REPLACE FUNCTION public.get_line_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT access_token_encrypted INTO v_token
    FROM public.rm_line_channels
    WHERE user_id = auth.uid();

    RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_line_token() TO authenticated;
```

### 1.2 驗證資料表建立

在 **Table Editor** 中確認以下資料表已建立：
- ✅ `rm_line_channels` - LINE Channel 設定
- ✅ `rm_drafts` - Rich Menu 草稿
- ✅ `rm_folders` - 資料夾（如果有）
- ✅ `docs` - Flex Message 文件
- ✅ `doc_versions` - 版本記錄
- ✅ `shares` - 分享連結

---

## ⚡ 步驟 2：部署 Edge Functions

### 2.1 安裝 Supabase CLI

**macOS / Linux:**
```bash
brew install supabase/tap/supabase
```

**Windows:**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**或使用 npm:**
```bash
npm install -g supabase
```

### 2.2 登入 Supabase CLI

```bash
supabase login
```

這會開啟瀏覽器要求您授權，完成後回到終端機。

### 2.3 Link 到您的專案

```bash
# 切換到專案目錄
cd /path/to/your/project

# Link 到 Supabase 專案
supabase link --project-ref YOUR_PROJECT_REF
```

將 `YOUR_PROJECT_REF` 替換為您在 Settings → API 中看到的 Project Ref。

### 2.4 部署 Edge Functions

```bash
# 部署 broadcast 函數（LINE OA 廣播）
supabase functions deploy broadcast

# 部署 publish-richmenu 函數（Rich Menu 發布）
supabase functions deploy publish-richmenu
```

### 2.5 驗證 Edge Functions

在 Supabase Dashboard：
1. 點選左側 **Edge Functions**
2. 確認看到 `broadcast` 和 `publish-richmenu` 兩個函數
3. 狀態為 **Active**

---

## 🔐 步驟 3：設定環境變數

### 3.1 前端環境變數

在專案根目錄建立 `.env` 檔案：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_LIFF_ID=YOUR_LIFF_ID
```

替換：
- `YOUR_PROJECT_REF` - 專案參考代碼
- `YOUR_ANON_KEY` - anon public key
- `YOUR_LIFF_ID` - LINE LIFF ID（選用）

### 3.2 Edge Function 環境變數（自動設定）

Edge Functions 會自動從 Supabase 取得以下環境變數：
- `SUPABASE_URL` ✅ 自動
- `SUPABASE_ANON_KEY` ✅ 自動

---

## 🧪 步驟 4：測試功能

### 4.1 測試資料庫連線

1. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

2. 開啟瀏覽器前往 `http://localhost:5173`

3. 註冊/登入帳號（使用 Email Magic Link）

4. 確認可以成功登入

### 4.2 測試 LINE Channel 設定

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 選擇您的 Channel
3. 複製 **Channel Access Token (Long-lived)**
4. 在應用程式中：
   - 進入 Rich Menu 編輯器
   - 點選「綁定 LINE Channel」
   - 貼上 Channel Access Token
   - 點選「儲存設定」

### 4.3 測試 Flex Message 廣播

1. 建立一個 Flex Message 草稿
2. 進入「預覽與發布」頁面
3. 點選「LINE OA 廣播推送」按鈕
4. 確認訊息成功發送（檢查 LINE 官方帳號是否收到推播）

### 4.4 測試分享連結

1. 在「預覽與發布」頁面
2. 點選「產生分享連結」
3. 複製連結並在手機開啟
4. 確認可以正常顯示 Flex Message

---

## 🐛 常見問題排解

### 問題 1：Edge Function 部署失敗

**錯誤訊息：**
```
Error: Unable to deploy function broadcast
```

**解決方法：**
1. 確認已正確 link 到專案：
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
2. 檢查 CLI 版本是否最新：
   ```bash
   supabase --version
   supabase update
   ```
3. 確認函數目錄結構正確：
   ```
   supabase/functions/
   ├── broadcast/
   │   └── index.ts
   └── publish-richmenu/
       └── index.ts
   ```

### 問題 2：找不到 RPC 函數

**錯誤訊息：**
```
Could not find the function public.rm_channel_upsert
```

**解決方法：**
1. 確認已執行 `schema.sql`
2. 檢查函數是否存在：
   - 前往 Database → Functions
   - 搜尋函數名稱
3. 如果不存在，重新執行相關的 SQL

### 問題 3：廣播失敗

**錯誤訊息：**
```
LINE Token not found
```

**解決方法：**
1. 確認已設定 LINE Channel Access Token
2. 檢查 `rm_line_channels` 資料表：
   ```sql
   SELECT * FROM rm_line_channels WHERE user_id = auth.uid();
   ```
3. 確認 `get_line_token()` 函數已建立並授權

### 問題 4：CORS 錯誤

**錯誤訊息：**
```
Access to fetch blocked by CORS policy
```

**解決方法：**
1. 確認 Edge Function 中有設定 CORS headers（已在 broadcast/index.ts 中設定）
2. 檢查前端是否正確傳送 Authorization header

---

## 📊 資料庫結構說明

### 核心資料表

| 資料表 | 用途 | 主要欄位 |
|--------|------|----------|
| `rm_line_channels` | LINE Channel 設定 | `user_id`, `name`, `access_token_encrypted` |
| `rm_drafts` | Rich Menu 草稿 | `user_id`, `name`, `data`, `status` |
| `docs` | Flex Message 文件 | `owner_id`, `type`, `title`, `content` |
| `doc_versions` | 版本記錄 | `doc_id`, `version_no`, `flex_json` |
| `shares` | 分享連結 | `doc_id`, `token`, `is_active` |

### RPC Functions

| Function | 參數 | 返回值 | 用途 |
|----------|------|--------|------|
| `rm_channel_upsert` | `p_name`, `p_access_token` | UUID | 新增/更新 LINE Channel |
| `get_line_token` | - | TEXT | 取得用戶的 LINE Token |
| `check_line_token` | - | BOOLEAN | 檢查 Token 是否存在 |
| `get_share` | `p_token` | TABLE | 取得分享內容（公開） |

---

## 🚀 部署到生產環境

### 使用 Vercel 部署

1. **連接 GitHub Repo**
   - 前往 [Vercel](https://vercel.com)
   - Import GitHub Repository

2. **設定環境變數**
   - 在 Vercel 專案設定中加入：
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_LIFF_ID`

3. **部署**
   - Vercel 會自動部署
   - 取得生產環境 URL

---

## 📖 延伸閱讀

- [Supabase 官方文件](https://supabase.com/docs)
- [Edge Functions 指南](https://supabase.com/docs/guides/functions)
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [LINE LIFF 文件](https://developers.line.biz/en/docs/liff/)

---

## ✅ 設定檢查清單

完成以下步驟後，您的 Supabase 應該已經完全設定好了：

- [ ] Supabase 專案已建立
- [ ] 執行 `schema.sql` 建立資料表
- [ ] 執行 Storage Buckets 設定
- [ ] 新增 RPC Functions (`check_line_token`, `get_line_token`)
- [ ] 安裝 Supabase CLI
- [ ] Link 到專案
- [ ] 部署 `broadcast` Edge Function
- [ ] 部署 `publish-richmenu` Edge Function
- [ ] 設定前端環境變數
- [ ] 測試註冊/登入功能
- [ ] 測試 LINE Channel 設定
- [ ] 測試 Flex Message 廣播
- [ ] 測試分享連結功能

恭喜！🎉 您已完成 Supabase 的完整設定！
