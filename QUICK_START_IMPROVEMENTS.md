# 🚀 快速實施改進指南

這份文件提供逐步指引，幫助您快速實施最關鍵的改進。

---

## 📋 改進優先級概覽

| 優先級 | 改進項目 | 時間估計 | 風險 |
|--------|---------|---------|------|
| 🔴 P0 | SQL Migration 整合 | 2-4 小時 | 高 |
| 🔴 P0 | 環境變數驗證 | 30 分鐘 | 低 |
| 🟡 P1 | 統一 Edge Function 格式 | 2-3 小時 | 中 |
| 🟡 P1 | Token 更新機制 | 1-2 小時 | 中 |
| 🟢 P2 | 代碼組織 | 3-5 小時 | 低 |
| 🟢 P2 | 添加測試 | 持續進行 | 低 |

---

## 🔴 Phase 1: 緊急修復（本週完成）

### 1️⃣ 環境變數驗證（30分鐘）✅ 已完成

**檔案**: `src/lib/env.ts`（已創建）

**步驟**:
1. ✅ 檔案已創建
2. 在 `src/main.tsx` 中最先導入：

```typescript
// src/main.tsx
import './lib/env'; // ⬅️ 添加這行（在所有 import 之前）
import React from 'react';
import ReactDOM from 'react-dom/client';
// ... 其他 imports
```

3. 測試：
```bash
# 測試錯誤配置（應該立即失敗並顯示清晰錯誤）
mv .env .env.backup
npm run dev
# 預期：顯示環境變數錯誤訊息

# 恢復
mv .env.backup .env
npm run dev
# 預期：成功啟動
```

**驗證**:
- [ ] Console 顯示 "✅ 環境變數驗證通過"
- [ ] 錯誤的 .env 會立即失敗並顯示友好訊息

---

### 2️⃣ SQL Migration 整合（2-4小時）

**參考文件**: `MIGRATION_PLAN.md`

**步驟**:

#### 步驟 2.1: 準備（15分鐘）
```bash
# 1. 備份生產資料庫
# 在 Supabase Dashboard > Database > Backups 中創建備份

# 2. 安裝 Supabase CLI（如果還沒有）
npm install -g supabase

# 3. 登入 Supabase
supabase login

# 4. 連接到專案
supabase link --project-ref mslliuocrcgqvppvnvqo
```

#### 步驟 2.2: 創建整合 Migration（30分鐘）
```bash
# 1. 初始化（如果還沒有）
supabase init

# 2. 創建新的 migration
supabase migration new consolidated_schema

# 3. 複製整合的 SQL
# 從 MIGRATION_PLAN.md 複製 consolidated_schema.sql 的內容
# 貼到生成的 migration 檔案中
```

#### 步驟 2.3: 測試 Migration（1小時）
```bash
# 1. 啟動本地 Supabase（使用 Docker）
supabase start

# 2. 應用 migration
supabase db reset

# 3. 驗證
# 打開 Supabase Studio: http://localhost:54323
# 檢查所有表和函數是否正確創建

# 4. 測試應用
npm run dev
# 測試登入、設定 token、廣播等功能
```

#### 步驟 2.4: 部署到生產環境（30分鐘）
```bash
# ⚠️ 重要：先在預發布環境測試！

# 1. 推送到遠端
supabase db push

# 2. 驗證
# 在 Supabase Dashboard 檢查資料庫狀態

# 3. 測試生產應用
# 訪問 https://33cm.zeabur.app
# 測試所有關鍵功能
```

#### 步驟 2.5: 清理（15分鐘）
```bash
# 移動舊的 SQL 檔案到 archive
mkdir -p supabase/archive
mv supabase/*.sql supabase/archive/

# 保留
git rm supabase/archive/*
git add supabase/migrations/
git commit -m "整合 SQL migrations 到版本化的 migration 系統"
```

**驗證**:
- [ ] 所有表都存在且 RLS 已啟用
- [ ] RPC 函數可以正常調用
- [ ] 前端無法直接讀取 rm_line_channels
- [ ] 登入和廣播功能正常
- [ ] 舊的 SQL 檔案已移除或歸檔

---

### 3️⃣ 統一 Edge Function 響應格式（2-3小時）

**檔案**: `src/lib/edgeFunction.ts`（已創建）

#### 步驟 3.1: 更新前端調用（1小時）

**範例：更新 channel.ts**
```typescript
// src/lib/channel.ts
import { validateToken } from './edgeFunction'; // ⬅️ 新增

// ❌ 舊的實現（刪除）
export async function validateAccessToken(accessToken: string) {
  const { data, error } = await supabase.functions.invoke("validate-token", {
    body: { accessToken },
  });
  // ...
}

// ✅ 新的實現
export async function validateAccessToken(accessToken: string) {
  try {
    return await validateToken(accessToken);
  } catch (error) {
    console.error('[channel] Token 驗證失敗:', error);
    throw error;
  }
}
```

**需要更新的文件**:
- [ ] `src/lib/channel.ts` - validateAccessToken
- [ ] `src/lib/broadcast.ts` - sendBroadcast
- [ ] `src/lib/lineRichMenuBuilder.ts` - publishRichMenu 相關函數

#### 步驟 3.2: 更新 Edge Functions（1-2小時）

**validate-token** - 已經是正確格式 ✅

**broadcast** - 需要更新：
```typescript
// supabase/functions/broadcast/index.ts
// ❌ 當前返回格式不統一

// ✅ 更新為統一格式
return new Response(JSON.stringify({
  success: true,
  data: {
    messageCount: flexMessages.length,
    targetCount: 100 // 從 LINE API 取得
  }
}), {
  status: 200,  // 總是 200
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

// 錯誤時：
return new Response(JSON.stringify({
  success: false,
  error: {
    code: 'INVALID_TOKEN',
    message: '無效的 LINE Token',
    details: error
  }
}), {
  status: 200,  // 仍然是 200
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
```

**publish-richmenu** - 同樣需要更新

#### 步驟 3.3: 測試（30分鐘）
```bash
# 1. 重新部署 Edge Functions
supabase functions deploy broadcast
supabase functions deploy publish-richmenu

# 2. 測試所有 Edge Function 調用
# - Token 驗證
# - 廣播訊息
# - 發布 Rich Menu

# 3. 檢查錯誤處理
# - 故意輸入錯誤的 token
# - 確認錯誤訊息友好且清晰
```

**驗證**:
- [ ] 所有 Edge Functions 返回統一格式
- [ ] 錯誤訊息清晰易懂
- [ ] 前端錯誤處理簡潔一致

---

## 🟡 Phase 2: 重要改進（下週完成）

### 4️⃣ Token 更新機制（1-2小時）

**選項 A: 提供「重置 Token」功能（推薦）**

1. 創建設定頁面：
```typescript
// src/pages/Settings.tsx
export default function Settings() {
  const handleResetToken = async () => {
    const confirmed = window.confirm(
      '確定要重置 LINE Token 嗎？\n這將刪除現有 token，您需要重新設定。'
    );

    if (confirmed) {
      // 刪除現有 token
      await supabase
        .from('rm_line_channels')
        .delete()
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      // 導向設定頁面
      navigate('/');
    }
  };

  return (
    <div>
      <h2>設定</h2>
      <button onClick={handleResetToken}>重置 LINE Token</button>
    </div>
  );
}
```

2. 添加路由：
```typescript
// src/App.tsx
<Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
```

**選項 B: 允許更新 + 需要再次驗證**

修改 `secure_token_access.sql`:
```sql
-- 允許更新，但記錄更新次數和時間
ALTER TABLE rm_line_channels
ADD COLUMN update_count INTEGER DEFAULT 0,
ADD COLUMN last_updated_at TIMESTAMPTZ;

-- 修改 RPC，允許更新但有限制
CREATE OR REPLACE FUNCTION public.rm_channel_upsert(...)
AS $$
BEGIN
  IF v_id IS NOT NULL THEN
    -- 檢查是否在30天內已更新過
    IF (SELECT last_updated_at FROM rm_line_channels WHERE id = v_id)
       > NOW() - INTERVAL '30 days' THEN
      RAISE EXCEPTION '每30天只能更新一次 Token';
    END IF;

    -- 允許更新
    UPDATE rm_line_channels
    SET access_token_encrypted = p_access_token,
        update_count = update_count + 1,
        last_updated_at = NOW()
    WHERE id = v_id;
  END IF;
END;
$$;
```

**驗證**:
- [ ] 用戶可以在需要時更換 token
- [ ] 有適當的限制防止濫用
- [ ] 操作有審計記錄

---

### 5️⃣ 日誌和監控（2-3小時）

**步驟 5.1: 整合 Sentry（1小時）**

```bash
npm install @sentry/react
```

```typescript
// src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**步驟 5.2: 添加結構化日誌（1小時）**

```typescript
// src/lib/logger.ts
export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    if (import.meta.env.DEV) {
      console.log(`[INFO] ${message}`, context);
    }
    // 生產環境：發送到日誌服務
  },

  error: (message: string, error: unknown, context?: Record<string, any>) => {
    console.error(`[ERROR] ${message}`, error, context);
    Sentry.captureException(error, { extra: context });
  },
};
```

**驗證**:
- [ ] 錯誤自動上報到 Sentry
- [ ] 可以在 Sentry Dashboard 查看錯誤
- [ ] 錯誤包含足夠的 context 信息

---

## 🟢 Phase 3: 品質提升（持續進行）

### 6️⃣ 代碼組織（3-5小時）

**移動錯位的文件**:
```bash
# 移動到正確位置
mv buildFlex.ts src/lib/
mv flexRenderer.ts src/lib/
mv Share.tsx src/pages/

# 提交
git add -A
git commit -m "重組檔案結構"
```

**創建新的目錄結構**:
```bash
mkdir -p src/{hooks,services,types,utils}
```

---

### 7️⃣ 添加測試（持續進行）

**安裝測試工具**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**配置 vitest**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

**寫第一個測試**:
```typescript
// src/lib/env.test.ts
import { describe, it, expect } from 'vitest';
import { env } from './env';

describe('env', () => {
  it('應該載入環境變數', () => {
    expect(env.VITE_SUPABASE_URL).toBeDefined();
    expect(env.VITE_SUPABASE_ANON_KEY).toBeDefined();
  });
});
```

---

## ✅ 完整檢查清單

### Phase 1 (本週)
- [ ] 環境變數驗證已啟用
- [ ] SQL migrations 已整合
- [ ] 舊的 SQL 檔案已清理
- [ ] Edge Functions 使用統一格式
- [ ] 所有功能測試通過

### Phase 2 (下週)
- [ ] Token 更新機制已實施
- [ ] Sentry 錯誤追蹤已整合
- [ ] 結構化日誌已實施

### Phase 3 (持續)
- [ ] 檔案結構已重組
- [ ] 測試覆蓋率 > 50%
- [ ] 文檔已更新

---

## 🆘 遇到問題？

### 常見問題

**Q: Migration 失敗，顯示"物件已存在"**
A: 這是正常的。如果是現有資料庫，請：
```sql
-- 在 Supabase SQL Editor 中執行
-- 檢查哪些物件已存在
\dt  -- 列出所有表
\df  -- 列出所有函數

-- 手動調整 migration，註釋掉已存在的部分
```

**Q: 環境變數驗證失敗**
A: 檢查：
1. `.env` 文件是否存在
2. 所有必要的變數是否都有設定
3. URL 格式是否正確

**Q: Edge Function 部署失敗**
A: 檢查：
1. 是否已登入 Supabase CLI
2. 是否已連接到正確的專案
3. 函數代碼語法是否正確

---

## 📞 後續支援

完成各個 Phase 後，建議：
1. 創建 GitHub Issues 追蹤遇到的問題
2. 更新 README 記錄新的架構
3. 進行代碼審查（Code Review）
4. 監控生產環境的錯誤率

**下次架構審查建議**: 2026-04-01
