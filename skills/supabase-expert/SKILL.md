---
name: Supabase Expert
description: 提供 Supabase 平台專業知識，包括資料庫設計、認證、Row Level Security (RLS)、Edge Functions、儲存、即時訂閱等完整解決方案
---

# Supabase 專家 Skill

## 概述

這個 skill 讓你成為 Supabase 平台專家，能夠協助用戶：
- 設計和管理 PostgreSQL 資料庫
- 實作安全的認證系統
- 配置 Row Level Security (RLS) 策略
- 開發 Edge Functions
- 管理檔案儲存
- 實作即時訂閱功能
- 優化效能和成本

---

## 1. 資料庫設計與 SQL

### 表格設計最佳實踐

```sql
-- 標準表格模板，包含審計欄位
CREATE TABLE public.example_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  -- 你的欄位...
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted'))
);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_example_table_updated_at
  BEFORE UPDATE ON public.example_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 常用資料類型建議

| 用途 | 推薦類型 | 說明 |
|------|----------|------|
| 主鍵 | `UUID` | 使用 `gen_random_uuid()` 生成 |
| 時間戳 | `TIMESTAMPTZ` | 總是使用時區感知的時間 |
| 金額 | `NUMERIC(19, 4)` | 避免浮點數精度問題 |
| JSON 資料 | `JSONB` | 比 JSON 更高效 |
| 列舉 | `TEXT` + CHECK | 比 ENUM 更靈活 |
| 陣列 | `TEXT[]` 或 `UUID[]` | 適合小型標籤集合 |

### 索引策略

```sql
-- 單欄索引
CREATE INDEX idx_example_table_status ON public.example_table(status);

-- 複合索引（注意欄位順序）
CREATE INDEX idx_example_table_status_created 
  ON public.example_table(status, created_at DESC);

-- 部分索引（只索引符合條件的行）
CREATE INDEX idx_example_active_only 
  ON public.example_table(name) 
  WHERE status = 'active';

-- GIN 索引用於 JSONB
CREATE INDEX idx_example_metadata ON public.example_table USING GIN(metadata);

-- 全文搜尋索引
CREATE INDEX idx_example_search 
  ON public.example_table 
  USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

---

## 2. 認證 (Authentication)

### 設定認證提供者

Supabase 支援多種認證方式：

#### Email/Password 認證
```typescript
// 註冊
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      full_name: 'John Doe',
      avatar_url: 'https://example.com/avatar.png'
    }
  }
});

// 登入
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
});

// 登出
await supabase.auth.signOut();
```

#### OAuth 社交登入
```typescript
// Google 登入
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://your-app.com/auth/callback',
    scopes: 'email profile'
  }
});

// 支援的提供者: google, github, gitlab, facebook, twitter, discord, 等
```

#### Magic Link 無密碼登入
```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: 'https://your-app.com/welcome',
  }
});
```

### 處理認證狀態

```typescript
// 監聽認證狀態變化
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  console.log('Session:', session);
  
  if (event === 'SIGNED_IN') {
    // 用戶登入
  } else if (event === 'SIGNED_OUT') {
    // 用戶登出
  } else if (event === 'TOKEN_REFRESHED') {
    // Token 已刷新
  }
});

// 獲取當前用戶
const { data: { user } } = await supabase.auth.getUser();

// 獲取當前 session
const { data: { session } } = await supabase.auth.getSession();
```

---

## 3. Row Level Security (RLS)

### 啟用 RLS

> [!CAUTION]
> 在生產環境中，**所有公開表格都必須啟用 RLS**。未啟用 RLS 的表格對任何人都是完全開放的。

```sql
-- 啟用 RLS
ALTER TABLE public.example_table ENABLE ROW LEVEL SECURITY;

-- 強制 RLS 對表格擁有者也生效（推薦用於測試）
ALTER TABLE public.example_table FORCE ROW LEVEL SECURITY;
```

### 常見 RLS 策略模式

#### 用戶只能存取自己的資料
```sql
-- 讀取策略
CREATE POLICY "Users can view own data"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 完整 CRUD 策略
CREATE POLICY "Users can manage own data"
  ON public.profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### 基於角色的存取控制
```sql
-- 建立角色檢查函數
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 使用角色策略
CREATE POLICY "Admins can do anything"
  ON public.content
  FOR ALL
  USING (public.has_role('admin'));

CREATE POLICY "Editors can edit content"
  ON public.content
  FOR UPDATE
  USING (public.has_role('editor') OR public.has_role('admin'));
```

#### 組織/團隊存取控制
```sql
-- 用戶只能存取所屬組織的資料
CREATE POLICY "Users can access organization data"
  ON public.projects
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
```

#### 公開 + 私有混合
```sql
-- 公開內容任何人可讀，私有內容只有擁有者可讀
CREATE POLICY "Public or own content readable"
  ON public.posts
  FOR SELECT
  USING (
    is_public = true 
    OR author_id = auth.uid()
  );
```

### RLS 效能優化

```sql
-- 使用 SECURITY DEFINER 函數快取查詢結果
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(organization_id) 
  FROM public.organization_members
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 在策略中使用
CREATE POLICY "Optimized org access"
  ON public.projects
  FOR SELECT
  USING (organization_id = ANY(public.get_user_organization_ids()));
```

---

## 4. Edge Functions

### 建立 Edge Function

```bash
# 初始化專案
supabase init

# 建立新函數
supabase functions new my-function
```

### 標準 Edge Function 模板

```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 處理 CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 建立 Supabase 客戶端
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 獲取當前用戶
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;

    // 你的業務邏輯
    const body = await req.json();
    
    // 使用 service role key 執行管理操作
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabaseAdmin
      .from("example_table")
      .insert({ ...body, created_by: user?.id })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
```

### 呼叫 Edge Function

```typescript
// 從客戶端呼叫
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { name: 'example' },
});

// 帶有自訂 headers
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { name: 'example' },
  headers: {
    'x-custom-header': 'value'
  }
});
```

### 部署函數

```bash
# 部署單一函數
supabase functions deploy my-function

# 部署所有函數
supabase functions deploy

# 設定環境變數
supabase secrets set MY_SECRET_KEY=value
```

---

## 5. 儲存 (Storage)

### 建立 Bucket

```sql
-- 建立公開 bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- 建立私有 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
);
```

### Storage RLS 策略

```sql
-- 允許用戶上傳到自己的資料夾
CREATE POLICY "Users can upload own files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 允許讀取公開 bucket
CREATE POLICY "Public bucket is accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- 用戶可以刪除自己的檔案
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### JavaScript SDK 操作

```typescript
// 上傳檔案
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${user.id}/avatar.png`, file, {
    cacheControl: '3600',
    upsert: true,
  });

// 取得公開 URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl('path/to/file.png');

// 取得簽名 URL（私有檔案）
const { data: { signedUrl }, error } = await supabase.storage
  .from('documents')
  .createSignedUrl('path/to/file.pdf', 3600); // 1 小時有效

// 下載檔案
const { data, error } = await supabase.storage
  .from('documents')
  .download('path/to/file.pdf');

// 刪除檔案
const { error } = await supabase.storage
  .from('avatars')
  .remove(['path/to/file1.png', 'path/to/file2.png']);

// 列出資料夾內容
const { data, error } = await supabase.storage
  .from('avatars')
  .list('folder/', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });
```

---

## 6. 即時訂閱 (Realtime)

### 啟用表格的即時功能

```sql
-- 在 Supabase Dashboard 中啟用，或使用 SQL
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

### 訂閱資料變更

```typescript
// 訂閱所有變更
const channel = supabase
  .channel('table-changes')
  .on(
    'postgres_changes',
    {
      event: '*', // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: 'public',
      table: 'messages',
    },
    (payload) => {
      console.log('Change received:', payload);
      // payload.new - 新資料
      // payload.old - 舊資料（UPDATE 和 DELETE）
      // payload.eventType - 事件類型
    }
  )
  .subscribe();

// 訂閱特定條件的變更
const channel = supabase
  .channel('room-messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: 'room_id=eq.123',
    },
    (payload) => {
      console.log('New message:', payload.new);
    }
  )
  .subscribe();

// 取消訂閱
await supabase.removeChannel(channel);
```

### Broadcast 頻道（無需資料庫）

```typescript
// 房間內的即時通訊
const channel = supabase.channel('room-1');

// 訂閱訊息
channel
  .on('broadcast', { event: 'cursor-position' }, (payload) => {
    console.log('Cursor moved:', payload);
  })
  .subscribe();

// 發送訊息
channel.send({
  type: 'broadcast',
  event: 'cursor-position',
  payload: { x: 100, y: 200, user_id: 'abc' },
});
```

### Presence 在線狀態

```typescript
const channel = supabase.channel('online-users');

// 追蹤當前用戶
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Current online users:', state);
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', key, newPresences);
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', key, leftPresences);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: user.id,
        username: user.name,
        online_at: new Date().toISOString(),
      });
    }
  });
```

---

## 7. 資料庫函數與觸發器

### 建立資料庫函數

```sql
-- 簡單函數
CREATE OR REPLACE FUNCTION public.get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_posts', (SELECT COUNT(*) FROM posts WHERE author_id = user_uuid),
    'total_likes', (SELECT COUNT(*) FROM likes WHERE user_id = user_uuid),
    'total_comments', (SELECT COUNT(*) FROM comments WHERE author_id = user_uuid)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 從客戶端呼叫
const { data, error } = await supabase.rpc('get_user_stats', {
  user_uuid: user.id
});
```

### 觸發器範例

```sql
-- 新用戶註冊時自動建立 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 8. 效能優化

### 查詢優化

```typescript
// 只選擇需要的欄位
const { data } = await supabase
  .from('posts')
  .select('id, title, created_at')
  .limit(10);

// 使用 count 而不是獲取所有資料
const { count } = await supabase
  .from('posts')
  .select('*', { count: 'exact', head: true });

// 分頁使用 range
const { data } = await supabase
  .from('posts')
  .select('*')
  .range(0, 9) // 取得第 1-10 筆
  .order('created_at', { ascending: false });
```

### 連接池設定

```typescript
// 使用 Transaction 模式進行短連接
const supabase = createClient(url, key, {
  db: {
    schema: 'public'
  },
  global: {
    headers: { 'x-connection-pool-mode': 'transaction' }
  }
});
```

### 快取策略

```typescript
// 使用 stale-while-revalidate 模式
// 在 Edge Function 中設定回應快取
return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
  }
});
```

---

## 9. 安全最佳實踐

### 檢查清單

- [ ] 所有公開表格都啟用 RLS
- [ ] API keys 不暴露在前端程式碼中（僅使用 anon key）
- [ ] 敏感操作使用 Edge Functions + service role key
- [ ] 設定適當的 JWT 過期時間
- [ ] 啟用 CAPTCHA 防止暴力破解
- [ ] 定期審查 RLS 策略
- [ ] 使用環境變數管理 secrets

### 防止常見攻擊

```sql
-- 限制插入頻率（防止 spam）
CREATE OR REPLACE FUNCTION check_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM posts 
    WHERE author_id = NEW.author_id 
    AND created_at > now() - interval '1 minute'
  ) >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rate_limit_posts
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit();
```

---

## 10. 常用 SQL 範本

### 軟刪除
```sql
ALTER TABLE public.posts ADD COLUMN deleted_at TIMESTAMPTZ;

-- RLS 自動過濾已刪除的記錄
CREATE POLICY "Hide deleted posts"
  ON public.posts
  FOR SELECT
  USING (deleted_at IS NULL);
```

### 全文搜尋
```sql
SELECT * FROM posts
WHERE to_tsvector('english', title || ' ' || content) 
  @@ plainto_tsquery('english', 'search terms');
```

### 遞迴查詢（樹狀結構）
```sql
WITH RECURSIVE category_tree AS (
  SELECT id, name, parent_id, 0 AS depth
  FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, c.parent_id, ct.depth + 1
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree;
```

---

## 故障排除

### 常見錯誤

| 錯誤 | 原因 | 解決方案 |
|------|------|----------|
| `new row violates RLS policy` | RLS 策略阻擋操作 | 檢查 WITH CHECK 條件 |
| `JWT expired` | Token 過期 | 呼叫 `supabase.auth.refreshSession()` |
| `relation does not exist` | 表格不存在或 schema 錯誤 | 檢查 schema 設定 |
| `permission denied for table` | 缺少 RLS 策略 | 添加適當的 SELECT/INSERT/UPDATE/DELETE 策略 |

### 除錯 RLS

```sql
-- 檢查 RLS 是否啟用
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'your_table';

-- 列出所有策略
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- 以特定用戶身份測試
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here"}';
SELECT * FROM your_table; -- 測試查詢
RESET role;
```

---

## 快速參考

### Supabase CLI 常用命令

```bash
supabase init                    # 初始化專案
supabase start                   # 啟動本地開發環境
supabase stop                    # 停止本地環境
supabase db reset                # 重置本地資料庫
supabase db diff                 # 比較 schema 差異
supabase migration new name      # 建立新 migration
supabase db push                 # 推送 migration 到遠端
supabase functions serve         # 本地執行 Edge Functions
supabase gen types typescript    # 產生 TypeScript 型別
```

### 相關資源

- [Supabase 官方文檔](https://supabase.com/docs)
- [PostgreSQL 文檔](https://www.postgresql.org/docs/)
- [Supabase GitHub](https://github.com/supabase/supabase)
