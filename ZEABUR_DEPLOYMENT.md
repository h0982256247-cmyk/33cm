# Zeabur 部署問題排查指南

## 🔍 常見部署失敗原因

根據您的專案配置，以下是最可能導致 Zeabur 部署失敗的原因：

---

## ❗ 問題 1：缺少環境變數

### 錯誤現象
- Build 成功但應用無法啟動
- 出現 `undefined` 或環境變數相關錯誤

### 解決方法

在 **Zeabur Dashboard** 設定以下環境變數：

1. 前往您的專案 → 選擇服務 → **Variables** 頁籤

2. 新增以下環境變數：

```env
# Supabase 設定（必填）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# LINE LIFF 設定（選填）
VITE_LIFF_ID=your_liff_id
```

**重要：**
- 變數名稱必須完全一致（包括 `VITE_` 前綴）
- 不需要引號
- 設定完成後點選「Save」

---

## ❗ 問題 2：Build 命令錯誤

### 檢查 zeabur.json 配置

確認您的 `zeabur.json` 設定正確：

```json
{
    "serviceName": "line-portal",
    "buildCommand": "npm install && npm run build",
    "startCommand": "node server.js",
    "outputDirectory": "dist"
}
```

### 如果使用 Zeabur 自動偵測

確保 `package.json` 中的 scripts 正確：

```json
{
  "scripts": {
    "build": "vite build",
    "start": "node server.js"
  }
}
```

---

## ❗ 問題 3：TypeScript 編譯錯誤

### 可能的錯誤訊息

```
Error: Cannot find module '@/components/PageHeader'
Error: Cannot find module '@/lib/broadcast'
```

### 解決方法

**方案 A：確保 tsconfig.json 正確（已設定）**

檢查 `tsconfig.json` 有以下配置：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**方案 B：確保 vite.config.ts 正確（已設定）**

檢查 `vite.config.ts` 有以下配置：

```typescript
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**方案 C：檢查 import 路徑**

如果還是有問題，可能需要使用相對路徑：

```typescript
// 從這樣：
import { PageHeader } from "@/components/PageHeader";

// 改成這樣：
import { PageHeader } from "../components/PageHeader";
```

---

## ❗ 問題 4：Node.js 版本不符

### 錯誤現象
```
Error: The engine "node" is incompatible with this module
```

### 解決方法

在 **Zeabur Dashboard** 設定 Node.js 版本：

1. 前往服務設定
2. 找到 **Runtime** 或 **Environment** 設定
3. 選擇 Node.js 版本：**20** 或更高

或在 `package.json` 中已經指定：
```json
{
  "engines": {
    "node": ">=20"
  }
}
```

---

## ❗ 問題 5：檔案大小寫問題

### Linux 伺服器區分大小寫

確保所有 import 的檔案名稱大小寫完全一致：

```typescript
// ❌ 錯誤：檔案是 PageHeader.tsx 但 import 寫成
import { PageHeader } from "@/components/pageHeader";

// ✅ 正確
import { PageHeader } from "@/components/PageHeader";
```

---

## ❗ 問題 6：缺少依賴套件

### 檢查新增的功能是否有對應套件

我們新增的功能使用的套件（應該都已在 package.json 中）：

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.49.1",  // ✅ broadcast.ts 需要
    "react-router-dom": "^6.26.2",       // ✅ PageHeader 需要
    "qrcode.react": "^4.2.0"             // ✅ PreviewDraft 需要
  }
}
```

---

## 🔧 完整部署檢查清單

### Step 1: 本地測試 Build

在本地先測試 build 是否成功：

```bash
# 1. 清除舊的 build
rm -rf dist node_modules

# 2. 重新安裝依賴
npm install

# 3. 測試 build
npm run build

# 4. 測試啟動
npm start
```

如果本地 build 成功，問題通常在環境變數或 Zeabur 設定。

### Step 2: Zeabur 設定檢查

- [ ] 環境變數已設定（VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY）
- [ ] Node.js 版本設定為 20 或更高
- [ ] zeabur.json 配置正確
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `node server.js`

### Step 3: 查看 Zeabur Build Logs

1. 前往 Zeabur Dashboard
2. 選擇您的服務
3. 點選 **Deployments**
4. 查看最近失敗的部署
5. 點選查看 **Build Logs**

常見錯誤關鍵字：
- `Cannot find module` → import 路徑錯誤
- `ENOENT` → 檔案不存在
- `undefined` → 環境變數未設定
- `SyntaxError` → 程式碼語法錯誤

---

## 🚀 建議的部署流程

### 選項 A：使用 GitHub 自動部署（推薦）

1. 確保所有更改已 push 到 GitHub ✅（已完成）
2. 在 Zeabur 連接 GitHub Repository
3. 選擇分支：`main`
4. Zeabur 會自動偵測並部署

### 選項 B：手動部署

如果 GitHub 自動部署失敗，可以嘗試：

1. **Fork 專案到新的 Repository**
2. **重新在 Zeabur 建立服務**
3. **逐步新增環境變數**

---

## 📊 部署成功後的驗證

### 1. 檢查應用是否正常啟動

訪問 Zeabur 提供的 URL，應該看到登入頁面。

### 2. 測試關鍵功能

- [ ] 可以註冊/登入
- [ ] 可以建立 Flex Message 草稿
- [ ] PageHeader 的返回和主頁按鈕正常
- [ ] 按鈕樣式正確（不再是白色）

### 3. 測試 Supabase 連接

在瀏覽器 Console 不應該看到：
- `Failed to connect to Supabase`
- `Invalid API key`

---

## 🆘 仍然無法解決？

### 提供以下資訊以便進一步協助：

1. **Zeabur Build Logs 截圖或文字**
   - 最重要！可以看到具體錯誤

2. **部署設定截圖**
   - Environment Variables
   - Build Command
   - Start Command

3. **錯誤訊息**
   - 完整的錯誤堆疊

4. **本地測試結果**
   - `npm run build` 是否成功？
   - `npm start` 是否能啟動？

---

## 📝 快速修復指令

如果需要快速回滾到部署前的版本：

```bash
# 查看 commit 歷史
git log --oneline -5

# 回滾到上一個版本
git revert HEAD

# 或者建立新分支測試
git checkout -b deploy-test

# Push 到 GitHub
git push origin deploy-test
```

在 Zeabur 切換到 `deploy-test` 分支測試。

---

## 🎯 最可能的問題（排序）

根據我們的更改，最可能導致部署失敗的原因排序：

1. **缺少環境變數** (80% 機率)
   - 解決：在 Zeabur 設定 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY

2. **Import 路徑錯誤** (15% 機率)
   - 解決：檢查 build logs，看是否有 "Cannot find module"

3. **Node.js 版本** (5% 機率)
   - 解決：確保使用 Node 20+

---

**提示：** 先從環境變數開始檢查，這是最常見的問題！
