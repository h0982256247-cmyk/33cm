# 🏗️ 專案架構審查報告
**審查日期**: 2026-02-27
**專案**: LINE Portal (33cm)
**審查者**: Senior Engineer (30年經驗)

---

## 📊 專案概況
- **技術棧**: React + TypeScript + Supabase + LINE Messaging API
- **代碼量**: ~8,600 行
- **核心功能**: Flex Message 編輯器 + Rich Menu 編輯器 + 廣播功能
- **部署**: Zeabur + Supabase Edge Functions

---

## 🔴 **嚴重問題（Critical）- 需立即修復**

### 1. ⚠️ SQL 文件衝突和版本管理混亂
**問題描述**:
- `setup.sql` 和 `secure_token_access.sql` 對同一個 RPC 函數有不同定義
- `setup.sql` 允許更新 token，但 `secure_token_access.sql` 禁止更新
- 缺乏 SQL migration 版本控制

**風險等級**: 🔴 **CRITICAL**
- 數據庫狀態不確定
- 部署時可能覆蓋安全設定
- 多人協作時容易造成衝突

**建議解決方案**:
```
📁 專案結構建議：
supabase/
├── migrations/           ← 使用 Supabase CLI 管理
│   ├── 20260101_initial_schema.sql
│   ├── 20260215_add_secure_token_policies.sql
│   └── 20260227_restrict_token_update.sql
├── functions/           ← Edge Functions
└── seed.sql            ← 測試數據

移除這些檔案（已過時）：
❌ setup.sql
❌ secure_token_access.sql
❌ debug_token_issue.sql
❌ quick_diagnosis.sql
```

**行動項目**:
- [ ] 使用 `supabase migration new` 創建版本化的 migration
- [ ] 將現有 SQL 整合到單一 migration 文件
- [ ] 刪除重複和診斷用的 SQL 文件
- [ ] 在 README 中記錄部署順序

---

### 2. 🔐 安全架構不一致
**問題描述**:
- `secure_token_access.sql` 禁止前端 SELECT，但 `setup.sql` 允許
- RLS policies 在兩個文件中定義不同
- 安全設定可能被錯誤順序的部署覆蓋

**風險等級**: 🔴 **CRITICAL**
- LINE Channel Access Token 可能暴露給前端
- 違反零信任安全原則

**當前狀態對比**:
| 安全要求 | setup.sql | secure_token_access.sql | 實際生效 |
|---------|-----------|------------------------|---------|
| 禁止前端 SELECT | ❌ | ✅ | ❓ 不確定 |
| 禁止更新 token | ❌ | ✅ | ❓ 不確定 |
| 撤銷 SELECT 權限 | ❌ | ✅ | ❓ 不確定 |

**建議解決方案**:
```sql
-- ✅ 正確的安全架構（應該成為唯一真相來源）
-- 1. 完全禁止前端訪問 rm_line_channels 表
-- 2. 僅通過 RPC 函數提供受控訪問
-- 3. 使用 SECURITY DEFINER 提升權限

-- 在 migration 中明確記錄安全要求：
COMMENT ON TABLE rm_line_channels IS
  '安全等級: CRITICAL
   前端: 禁止 SELECT（即使是自己的記錄）
   訪問: 僅通過 get_channel_status() RPC
   更新: 僅首次設定，不允許更新';
```

---

### 3. 🐛 Edge Function 錯誤處理不統一
**問題描述**:
- `validate-token`: 總是返回 200
- `broadcast`: 返回 401/500 等錯誤狀態碼
- 前端需要不同的錯誤處理邏輯

**風險等級**: 🟡 **HIGH**
- 錯誤處理邏輯分散
- 難以追蹤和調試
- 前端代碼冗余

**建議解決方案**:
```typescript
// ✅ 統一的 Edge Function 響應格式
interface EdgeFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;          // 例如: "INVALID_TOKEN", "UNAUTHORIZED"
    message: string;       // 用戶友好的訊息
    details?: any;         // 調試信息（僅開發環境）
  };
}

// 所有 Edge Functions 都應該：
// 1. 總是返回 200 狀態碼
// 2. 使用統一的響應格式
// 3. 錯誤信息在 response body 中

// 前端統一處理：
async function invokeEdgeFunction<T>(
  name: string,
  body: any
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) throw new Error(`Edge Function 調用失敗: ${error.message}`);
  if (!data.success) throw new Error(data.error.message);

  return data.data;
}
```

---

## 🟡 **重要問題（High）- 應盡快處理**

### 4. 📦 缺乏環境配置驗證
**問題描述**:
- `.env` 文件在 git 中（應該在 .gitignore）
- 缺乏啟動時的環境變數驗證
- 錯誤的配置只在運行時才發現

**建議解決方案**:
```typescript
// src/lib/env.ts - 使用 Zod 驗證環境變數
import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_LIFF_ID: z.string().optional(),
  VITE_APP_URL: z.string().url(),
});

export const env = envSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_LIFF_ID: import.meta.env.VITE_LIFF_ID,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
});

// 如果環境變數不正確，應用會在啟動時立即失敗
// 而不是在運行時出現難以追蹤的錯誤
```

---

### 5. 🔄 缺乏 Token 過期和刷新機制
**問題描述**:
- LINE Channel Access Token 是長期 token
- 如果 token 過期或被撤銷，用戶無法更新（受限於"只能設定一次"）
- 沒有 token 健康檢查機制

**建議解決方案**:
```typescript
// 方案 A: 允許管理員重置 token（推薦）
// 在用戶介面提供"更換 Token"功能，需要額外驗證（例如輸入密碼）

// 方案 B: 自動健康檢查
// 定期（每小時）調用 LINE API 驗證 token
// 如果失敗，通知用戶並允許更新

// 方案 C: 緊急重置流程
// 提供管理員命令或 SQL 腳本清除 token
DELETE FROM rm_line_channels WHERE user_id = 'xxx';
-- 然後用戶可以重新設定
```

**業務邏輯建議**:
- "一個帳號只能設定一次" 過於嚴格
- 建議改為 "設定後需要管理員權限才能更改"
- 或者 "30天內只能更換一次"

---

### 6. 🔍 缺乏日誌和監控
**問題描述**:
- Edge Functions 的 console.log 在生產環境難以訪問
- 沒有錯誤追蹤（例如 Sentry）
- 無法監控 API 使用率和錯誤率

**建議解決方案**:
```typescript
// 1. 整合 Sentry 或 LogRocket
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});

// 2. 結構化日誌
interface LogContext {
  userId?: string;
  action: string;
  metadata?: Record<string, any>;
}

function logEvent(level: 'info' | 'warn' | 'error', ctx: LogContext) {
  // 開發環境：console
  if (import.meta.env.DEV) {
    console[level]('[Log]', ctx);
  }

  // 生產環境：發送到日誌服務
  if (import.meta.env.PROD) {
    // 例如：PostHog, Mixpanel, 或自建日誌服務
  }
}

// 3. Edge Function 日誌應該發送到外部服務
// Supabase 的日誌保留期有限，且難以搜索
```

---

## 🟢 **改進建議（Medium）- 提升品質**

### 7. 📝 代碼組織和命名
**觀察**:
- `buildFlex.ts` 在根目錄，應該在 `src/lib/`
- `Share.tsx` 在根目錄，應該在 `src/pages/`
- 混合使用中英文命名（例如 `rm_` 前綴）

**建議**:
```
src/
├── lib/              ← 純函數、工具
├── pages/            ← 頁面組件
├── components/       ← 可重用組件
├── hooks/            ← 自定義 React Hooks（新增）
├── services/         ← API 呼叫層（新增）
│   ├── lineApi.ts
│   ├── broadcastService.ts
│   └── edgeFunction.ts
├── types/            ← TypeScript 類型定義（新增）
└── utils/            ← 通用工具函數

命名規範：
- 表名: snake_case（line_channels）
- 函數: camelCase（validateToken）
- 組件: PascalCase（TokenSetup）
- 常量: UPPER_SNAKE_CASE（MAX_RETRY）
```

---

### 8. 🧪 缺乏測試
**觀察**:
- 沒有單元測試
- 沒有集成測試
- 沒有 E2E 測試

**建議**:
```typescript
// 1. 關鍵業務邏輯應該有單元測試
// 例如: src/lib/channel.test.ts
import { describe, it, expect, vi } from 'vitest';
import { validateAccessToken } from './channel';

describe('validateAccessToken', () => {
  it('應該正確驗證有效的 token', async () => {
    // Mock supabase.functions.invoke
    vi.mock('./supabase', () => ({
      supabase: {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: { valid: true, botName: 'Test Bot' },
            error: null,
          }),
        },
      },
    }));

    const result = await validateAccessToken('valid-token');
    expect(result.valid).toBe(true);
  });
});

// 2. Edge Functions 應該有集成測試
// 使用 Supabase CLI 的測試工具

// 3. 關鍵流程應該有 E2E 測試
// 使用 Playwright 測試登入 -> 設定 token -> 發送廣播
```

---

### 9. 💾 資料庫設計優化
**觀察**:
```sql
-- ❌ 當前設計
rm_line_channels (
  id uuid,
  user_id uuid UNIQUE,  -- 一個用戶只能有一個 channel
  access_token_encrypted text,
  ...
)

-- 問題：未來如果需要支援多個 LINE Channel 就需要重構
```

**建議**:
```sql
-- ✅ 改進設計（為未來擴展做準備）
line_channels (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  access_token_encrypted text NOT NULL,
  is_default boolean DEFAULT false,  -- 標記默認 channel
  is_active boolean DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz,

  UNIQUE(user_id, name),  -- 同一用戶可以有多個 channel，但名稱不能重複

  -- 確保每個用戶只有一個默認 channel
  CONSTRAINT one_default_per_user
    EXCLUDE (user_id WITH =)
    WHERE (is_default = true)
);

-- 這樣的設計：
-- 1. 當前：一個用戶一個 channel（設定 is_default = true）
-- 2. 未來：如果需要支援多個 channel，只需要移除業務邏輯限制
-- 3. 不需要破壞性的資料庫 migration
```

---

### 10. 🚀 性能和快取
**建議**:
```typescript
// 1. 使用 React Query 管理伺服器狀態
import { useQuery, useMutation } from '@tanstack/react-query';

function useChannelStatus() {
  return useQuery({
    queryKey: ['channel', 'status'],
    queryFn: () => hasChannel(),
    staleTime: 5 * 60 * 1000,  // 5分鐘內不重新請求
    cacheTime: 10 * 60 * 1000,
  });
}

// 2. Edge Function 響應快取
// 在 Supabase Edge Function 中添加 Cache-Control header
return new Response(JSON.stringify(data), {
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',  // 快取5分鐘
  },
});

// 3. 靜態資源 CDN
// 確保 Zeabur 配置了 CDN，減少靜態檔案加載時間
```

---

## 📋 **優先級和行動計劃**

### Phase 1: 緊急修復（本週完成）
1. [ ] 🔴 **SQL 遷移和版本控制**
   - 創建 `migrations/` 目錄
   - 整合所有 SQL 到版本化的 migration
   - 刪除重複的 SQL 文件
   - 更新部署文檔

2. [ ] 🔴 **統一 Edge Function 錯誤處理**
   - 創建統一的響應格式
   - 修改 `broadcast` 和 `publish-richmenu` Edge Functions
   - 更新前端錯誤處理邏輯

3. [ ] 🟡 **環境變數驗證**
   - 創建 `src/lib/env.ts`
   - 使用 Zod 驗證所有環境變數
   - 在 `main.tsx` 中最先執行

### Phase 2: 安全強化（下週完成）
4. [ ] 🔴 **確認安全架構**
   - 在生產環境執行 `secure_token_access.sql`
   - 驗證 RLS policies 生效
   - 測試前端無法讀取 access_token

5. [ ] 🟡 **Token 管理改進**
   - 設計 token 更新流程
   - 添加 token 健康檢查
   - 提供管理員重置功能

### Phase 3: 品質提升（兩週內完成）
6. [ ] 🟡 **日誌和監控**
   - 整合 Sentry 錯誤追蹤
   - 實現結構化日誌
   - 設定告警規則

7. [ ] 🟢 **代碼組織**
   - 重組檔案結構
   - 統一命名規範
   - 添加 ESLint 規則

8. [ ] 🟢 **測試覆蓋**
   - 為核心邏輯添加單元測試
   - 為 Edge Functions 添加集成測試
   - 為關鍵流程添加 E2E 測試

---

## 🎯 **架構改進建議（長期）**

### 1. 考慮 Monorepo 結構
```
line-portal/
├── apps/
│   ├── web/              ← 當前的 React 應用
│   └── admin/            ← 管理後台（未來）
├── packages/
│   ├── shared/           ← 共用代碼
│   ├── line-sdk/         ← LINE API 封裝
│   └── database/         ← 資料庫類型和 migrations
└── supabase/             ← Supabase 配置
```

### 2. 實現 Feature Flags
```typescript
// 使用 PostHog 或 LaunchDarkly
const canUpdateToken = useFeatureFlag('allow-token-update');

// 這樣可以：
// - 逐步推出新功能
// - A/B 測試
// - 快速回滾有問題的功能
```

### 3. API 版本控制
```typescript
// Edge Functions 應該支援版本控制
// /functions/v1/broadcast
// /functions/v2/broadcast

// 這樣可以：
// - 向後兼容
// - 逐步遷移舊客戶端
// - 避免破壞性更新
```

---

## 📚 **推薦的技術決策記錄（ADR）**

建議創建 `docs/adr/` 目錄，記錄重要的技術決策：

```markdown
# ADR-001: 為什麼禁止用戶更新 LINE Token

## 狀態
已接受

## 背景
用戶曾經能夠隨時更新 LINE Channel Access Token，但這導致...

## 決策
一個帳號只能設定一次 LINE Token，不允許從前端更新。

## 後果
優點：
- 防止意外覆蓋
- 簡化業務邏輯

缺點：
- 如果 token 過期，用戶需要管理員協助
- 不靈活

## 替代方案
- 允許用戶更新，但需要重新驗證身份
- 提供"凍結期"（例如30天內只能更新一次）
```

---

## 🏆 **做得好的地方**

1. ✅ **安全意識**：已經意識到不能讓前端讀取 LINE Token
2. ✅ **使用 Supabase**：減少後端維護成本
3. ✅ **Edge Functions**：serverless 架構，易於擴展
4. ✅ **TypeScript**：類型安全
5. ✅ **代碼註釋**：SQL 和 TypeScript 都有詳細註釋

---

## 📞 **後續支援**

如需討論任何建議或需要實施協助，請：
1. 創建 GitHub Issues 追蹤每個改進項目
2. 使用這份文檔作為技術債務清單
3. 在每個 Sprint 中選擇 2-3 個項目進行改進

---

**審查完成日期**: 2026-02-27
**下次審查建議**: 2026-04-01（或完成 Phase 1 後）
