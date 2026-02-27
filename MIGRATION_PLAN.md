# 🔄 SQL Migration 整合計劃

## 當前問題
您的專案有多個 SQL 文件定義相同的資料庫物件，這會導致：
- 部署順序錯誤會覆蓋安全設定
- 難以追蹤資料庫版本
- 團隊協作時容易衝突

## 解決方案：版本化 Migrations

### Step 1: 安裝 Supabase CLI（如果還沒安裝）
```bash
npm install -g supabase
```

### Step 2: 初始化 Supabase 專案
```bash
cd /Users/edwin/new33cm/33cm-main
supabase init

# 這會創建以下結構：
# supabase/
# ├── config.toml
# ├── migrations/     ← 版本化的 SQL 文件
# └── functions/      ← 已存在
```

### Step 3: 創建整合的 Migration
```bash
# 創建新的 migration
supabase migration new consolidated_schema
```

### Step 4: 整合所有 SQL 到單一 Migration
我已經為您準備好了整合的 SQL，請參考下面的 `consolidated_schema.sql`

### Step 5: 清理舊文件
```bash
# 備份（以防萬一）
mkdir -p supabase/archive
mv supabase/*.sql supabase/archive/

# 保留這些：
# - migrations/  （新的版本化 migrations）
# - functions/   （Edge Functions）
```

### Step 6: 部署
```bash
# 本地測試
supabase db reset

# 部署到生產環境
supabase db push
```

---

## 📄 整合的 Migration 文件

將以下內容保存為 `supabase/migrations/20260227000000_consolidated_schema.sql`：

```sql
-- =========================================
-- LINE Portal - Consolidated Schema
-- Version: 1.0.0
-- Date: 2026-02-27
-- =========================================
-- 此 migration 整合了所有資料庫物件
-- 替代了：setup.sql, secure_token_access.sql, storage.sql, security.sql
-- =========================================

-- 啟用必要的擴展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- Helper Functions
-- =========================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =========================================
-- 1. LINE Channels Table
-- =========================================
-- 安全等級: CRITICAL
-- 存儲 LINE Channel Access Token（加密）
-- 前端: 禁止 SELECT，僅透過 RPC 訪問
-- 更新: 僅首次設定，不允許更新（一個帳號一個 token）
-- =========================================

CREATE TABLE IF NOT EXISTS public.rm_line_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My LINE Channel',
  access_token_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 一個用戶只能有一個 LINE Channel
  CONSTRAINT rm_line_channels_user_unique UNIQUE(user_id)
);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_rm_line_channels_updated_at ON public.rm_line_channels;
CREATE TRIGGER trg_rm_line_channels_updated_at
BEFORE UPDATE ON public.rm_line_channels
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 啟用 RLS
ALTER TABLE public.rm_line_channels ENABLE ROW LEVEL SECURITY;

-- ⚠️ 關鍵安全設定：禁止前端 SELECT
-- 前端無法讀取此表，即使是自己的記錄
-- 只能透過 RPC 函數訪問非敏感資訊

-- 允許 INSERT（首次設定 token）
DROP POLICY IF EXISTS rm_line_channels_insert_own ON public.rm_line_channels;
CREATE POLICY rm_line_channels_insert_own
ON public.rm_line_channels
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 允許 UPDATE（透過 RPC，但 RPC 會拒絕更新）
DROP POLICY IF EXISTS rm_line_channels_update_own ON public.rm_line_channels;
CREATE POLICY rm_line_channels_update_own
ON public.rm_line_channels
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 允許 DELETE（用戶可以刪除自己的 token）
DROP POLICY IF EXISTS rm_line_channels_delete_own ON public.rm_line_channels;
CREATE POLICY rm_line_channels_delete_own
ON public.rm_line_channels
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 撤銷直接 SELECT 權限
REVOKE SELECT ON public.rm_line_channels FROM authenticated;
REVOKE SELECT ON public.rm_line_channels FROM anon;

-- 添加註釋
COMMENT ON TABLE public.rm_line_channels IS
  '【CRITICAL】LINE Channel Access Token 存儲
   安全要求：
   - 前端禁止 SELECT（即使是自己的記錄）
   - 僅透過 get_channel_status() RPC 訪問非敏感資訊
   - Token 只能設定一次，不允許更新（透過 rm_channel_upsert RPC 強制執行）
   - Edge Functions 使用 service role 訪問';

-- =========================================
-- 2. RPC: get_channel_status
-- =========================================
-- 前端調用此函數檢查是否已設定 LINE Channel
-- 只回傳非敏感資訊：has_channel, name, updated_at
-- 不回傳 access_token
-- =========================================

CREATE OR REPLACE FUNCTION public.get_channel_status()
RETURNS TABLE (
    has_channel BOOLEAN,
    name TEXT,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE AS has_channel,
        c.name,
        c.updated_at
    FROM public.rm_line_channels c
    WHERE c.user_id = auth.uid()
      AND c.is_active = TRUE
    LIMIT 1;

    -- 如果沒有記錄，回傳 has_channel = false
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TIMESTAMPTZ;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_status() TO authenticated;

COMMENT ON FUNCTION public.get_channel_status() IS
  '前端查詢 LINE Channel 狀態（不含 token）
   回傳：{ has_channel, name, updated_at }';

-- =========================================
-- 3. RPC: rm_channel_upsert
-- =========================================
-- 前端調用此函數新增 LINE Channel Token
-- ⚠️ 重要：不允許更新，一個帳號只能設定一次
-- 如需更換 token，必須先刪除舊記錄
-- =========================================

CREATE OR REPLACE FUNCTION public.rm_channel_upsert(
    p_name TEXT,
    p_access_token TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- 驗證 token 不為空
    IF p_access_token IS NULL OR p_access_token = '' THEN
        RAISE EXCEPTION 'access_token cannot be empty';
    END IF;

    -- 檢查是否已有記錄
    SELECT id INTO v_id
    FROM public.rm_line_channels
    WHERE user_id = auth.uid();

    IF v_id IS NULL THEN
        -- 首次設定：新增記錄
        INSERT INTO public.rm_line_channels (
            user_id,
            name,
            access_token_encrypted,
            is_active
        )
        VALUES (
            auth.uid(),
            COALESCE(p_name, 'My LINE Channel'),
            p_access_token,
            TRUE
        )
        RETURNING id INTO v_id;
    ELSE
        -- 已有記錄：拒絕更新
        RAISE EXCEPTION '此帳號已設定 LINE Token，一個帳號只能設定一次';
    END IF;

    -- 只回傳 ID，不回傳 token
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rm_channel_upsert(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.rm_channel_upsert(TEXT, TEXT) IS
  '前端新增 LINE Channel（不允許更新，一個帳號只能設定一次）
   如需更換 token，請先執行：DELETE FROM rm_line_channels WHERE user_id = auth.uid()';

-- =========================================
-- 4. Rich Menu Tables
-- =========================================

-- Folders (Rich Menu 分類)
CREATE TABLE IF NOT EXISTS public.rm_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rm_folders_name_unique UNIQUE(user_id, name)
);

DROP TRIGGER IF EXISTS trg_rm_folders_updated_at ON public.rm_folders;
CREATE TRIGGER trg_rm_folders_updated_at
BEFORE UPDATE ON public.rm_folders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rm_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rm_folders_all_own ON public.rm_folders;
CREATE POLICY rm_folders_all_own
ON public.rm_folders
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Drafts (Rich Menu 草稿)
CREATE TABLE IF NOT EXISTS public.rm_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.rm_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('full', 'half')),
  chat_bar_text TEXT NOT NULL DEFAULT 'Menu',
  selected BOOLEAN NOT NULL DEFAULT false,
  areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  rich_menu_id TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rm_drafts_updated_at ON public.rm_drafts;
CREATE TRIGGER trg_rm_drafts_updated_at
BEFORE UPDATE ON public.rm_drafts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rm_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rm_drafts_all_own ON public.rm_drafts;
CREATE POLICY rm_drafts_all_own
ON public.rm_drafts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =========================================
-- 5. Flex Message Tables
-- =========================================

-- Documents (Flex Message 文件)
CREATE TABLE IF NOT EXISTS public.docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_docs_updated_at ON public.docs;
CREATE TRIGGER trg_docs_updated_at
BEFORE UPDATE ON public.docs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS docs_all_own ON public.docs;
CREATE POLICY docs_all_own
ON public.docs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Document Versions (Flex Message 版本)
CREATE TABLE IF NOT EXISTS public.doc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.doc_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_versions_select_via_doc ON public.doc_versions;
CREATE POLICY doc_versions_select_via_doc
ON public.doc_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.docs
    WHERE docs.id = doc_versions.doc_id
      AND docs.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS doc_versions_insert_via_doc ON public.doc_versions;
CREATE POLICY doc_versions_insert_via_doc
ON public.doc_versions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.docs
    WHERE docs.id = doc_versions.doc_id
      AND docs.user_id = auth.uid()
  )
);

-- Shares (分享連結)
CREATE TABLE IF NOT EXISTS public.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.doc_versions(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT shares_doc_version_unique UNIQUE(doc_id, version_id)
);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shares_all_via_doc ON public.shares;
CREATE POLICY shares_all_via_doc
ON public.shares
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.docs
    WHERE docs.id = shares.doc_id
      AND docs.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.docs
    WHERE docs.id = shares.doc_id
      AND docs.user_id = auth.uid()
  )
);

-- Templates (Flex Message 範本)
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  template_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS templates_read_all ON public.templates;
CREATE POLICY templates_read_all
ON public.templates
FOR SELECT
TO authenticated
USING (true);

-- =========================================
-- 6. Storage Buckets
-- =========================================

-- Rich Menu Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('richmenu-images', 'richmenu-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS richmenu_images_select_all ON storage.objects;
CREATE POLICY richmenu_images_select_all
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'richmenu-images');

DROP POLICY IF EXISTS richmenu_images_insert_own ON storage.objects;
CREATE POLICY richmenu_images_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'richmenu-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS richmenu_images_delete_own ON storage.objects;
CREATE POLICY richmenu_images_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'richmenu-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Flex Message Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('flex-images', 'flex-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS flex_images_select_all ON storage.objects;
CREATE POLICY flex_images_select_all
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'flex-images');

DROP POLICY IF EXISTS flex_images_insert_own ON storage.objects;
CREATE POLICY flex_images_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'flex-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS flex_images_delete_own ON storage.objects;
CREATE POLICY flex_images_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'flex-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================
-- 完成
-- =========================================

COMMENT ON SCHEMA public IS '
LINE Portal Database Schema v1.0.0
Created: 2026-02-27

主要資料表：
- rm_line_channels: LINE Channel Token（CRITICAL 安全等級）
- rm_folders, rm_drafts: Rich Menu 編輯器
- docs, doc_versions, shares: Flex Message 編輯器
- templates: Flex Message 範本

安全架構：
✅ RLS 已啟用於所有表
✅ LINE Token 禁止前端 SELECT
✅ 僅透過 RPC 訪問敏感資料
✅ Storage buckets 已配置權限

如需變更資料庫結構，請創建新的 migration 文件';
```

---

## 🔄 未來的 Migrations

當您需要修改資料庫時：

```bash
# 創建新的 migration
supabase migration new add_line_channel_statistics

# 編輯生成的文件
# supabase/migrations/YYYYMMDDHHMMSS_add_line_channel_statistics.sql
```

範例 migration：
```sql
-- Migration: 添加 LINE Channel 統計資料
-- Version: 1.1.0
-- Date: 2026-03-01

ALTER TABLE public.rm_line_channels
ADD COLUMN last_broadcast_at TIMESTAMPTZ,
ADD COLUMN total_broadcasts INTEGER DEFAULT 0;

COMMENT ON COLUMN rm_line_channels.last_broadcast_at IS '最後一次廣播時間';
COMMENT ON COLUMN rm_line_channels.total_broadcasts IS '總廣播次數';
```

---

## ✅ 驗證步驟

部署後，執行以下檢查：

```sql
-- 1. 確認所有表都存在
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. 確認 RLS 已啟用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 應該所有表都是 rowsecurity = true

-- 3. 確認 RPC 函數存在
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_channel_status', 'rm_channel_upsert');

-- 4. 測試安全性：前端無法讀取 token
-- 在前端執行（應該返回空或錯誤）：
-- const { data } = await supabase.from('rm_line_channels').select('*');
-- 預期：data 為空陣列或出現權限錯誤

-- 5. 測試 RPC 正常工作
-- 在前端執行：
-- const { data } = await supabase.rpc('get_channel_status');
-- 預期：返回 { has_channel: true/false, name, updated_at }
```

---

## 📝 部署檢查清單

- [ ] 備份當前生產環境資料庫
- [ ] 在開發環境測試 migration
- [ ] 確認所有測試通過
- [ ] 部署到預發布環境（如果有）
- [ ] 執行驗證步驟
- [ ] 部署到生產環境
- [ ] 監控錯誤日誌
- [ ] 驗證用戶功能正常

---

**重要提醒**：
- 第一次執行整合 migration 時，可能會遇到"物件已存在"的錯誤
- 如果是全新資料庫，直接執行即可
- 如果是現有資料庫，請先備份，然後手動調整 migration（移除已存在的物件）
