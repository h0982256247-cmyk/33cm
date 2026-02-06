-- =========================================
-- LINE Portal - 資料表設定（無 Storage）
-- 在 Supabase SQL Editor 執行這個檔案
-- =========================================

-- 啟用 pgcrypto 擴展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- 1. LINE Channels 資料表
-- =========================================
CREATE TABLE IF NOT EXISTS public.line_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default Channel',
    access_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.line_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "line_channels_select" ON public.line_channels;
DROP POLICY IF EXISTS "line_channels_insert" ON public.line_channels;
DROP POLICY IF EXISTS "line_channels_update" ON public.line_channels;
DROP POLICY IF EXISTS "line_channels_delete" ON public.line_channels;

CREATE POLICY "line_channels_select" ON public.line_channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "line_channels_insert" ON public.line_channels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "line_channels_update" ON public.line_channels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "line_channels_delete" ON public.line_channels FOR DELETE USING (auth.uid() = user_id);

-- =========================================
-- 2. Rich Menu 資料夾
-- =========================================
CREATE TABLE IF NOT EXISTS public.rm_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '新資料夾',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rm_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rm_folders_all" ON public.rm_folders;
CREATE POLICY "rm_folders_all" ON public.rm_folders FOR ALL USING (auth.uid() = user_id);

-- =========================================
-- 3. Rich Menu 草稿
-- =========================================
CREATE TABLE IF NOT EXISTS public.rm_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '未命名專案',
    data JSONB NOT NULL DEFAULT '{"menus": []}'::jsonb,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'active')),
    folder_id UUID REFERENCES public.rm_folders(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rm_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rm_drafts_all" ON public.rm_drafts;
CREATE POLICY "rm_drafts_all" ON public.rm_drafts FOR ALL USING (auth.uid() = user_id);

-- =========================================
-- 4. Flex Message 文件
-- =========================================
CREATE TABLE IF NOT EXISTS public.docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('bubble','carousel','folder')),
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','previewable','publishable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS docs_owner_idx ON public.docs(owner_id);
CREATE INDEX IF NOT EXISTS docs_updated_idx ON public.docs(updated_at DESC);

ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select_own" ON public.docs;
DROP POLICY IF EXISTS "docs_insert_own" ON public.docs;
DROP POLICY IF EXISTS "docs_update_own" ON public.docs;
DROP POLICY IF EXISTS "docs_delete_own" ON public.docs;

CREATE POLICY "docs_select_own" ON public.docs FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "docs_insert_own" ON public.docs FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "docs_update_own" ON public.docs FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "docs_delete_own" ON public.docs FOR DELETE USING (auth.uid() = owner_id);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_docs_updated_at ON public.docs;
CREATE TRIGGER trg_docs_updated_at BEFORE UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rm_drafts_updated_at ON public.rm_drafts;
CREATE TRIGGER trg_rm_drafts_updated_at BEFORE UPDATE ON public.rm_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rm_folders_updated_at ON public.rm_folders;
CREATE TRIGGER trg_rm_folders_updated_at BEFORE UPDATE ON public.rm_folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 5. Flex Message 版本記錄
-- =========================================
CREATE TABLE IF NOT EXISTS public.doc_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_id UUID NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    flex_json JSONB NOT NULL,
    validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS doc_versions_unique ON public.doc_versions(doc_id, version_no);

ALTER TABLE public.doc_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_versions_select_own" ON public.doc_versions;
DROP POLICY IF EXISTS "doc_versions_insert_own" ON public.doc_versions;
DROP POLICY IF EXISTS "doc_versions_delete_own" ON public.doc_versions;

CREATE POLICY "doc_versions_select_own" ON public.doc_versions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "doc_versions_insert_own" ON public.doc_versions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "doc_versions_delete_own" ON public.doc_versions FOR DELETE USING (auth.uid() = owner_id);

-- =========================================
-- 6. Flex Message 分享連結
-- =========================================
CREATE TABLE IF NOT EXISTS public.shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_id UUID NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.doc_versions(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shares_token_idx ON public.shares(token);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shares_select_own" ON public.shares;
DROP POLICY IF EXISTS "shares_insert_own" ON public.shares;
DROP POLICY IF EXISTS "shares_update_own" ON public.shares;
DROP POLICY IF EXISTS "shares_delete_own" ON public.shares;

CREATE POLICY "shares_select_own" ON public.shares FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "shares_insert_own" ON public.shares FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "shares_update_own" ON public.shares FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "shares_delete_own" ON public.shares FOR DELETE USING (auth.uid() = owner_id);

-- =========================================
-- 7. RPC Functions
-- =========================================

-- 取得分享資料（公開 - 匿名用戶可用）
CREATE OR REPLACE FUNCTION public.get_share(p_token TEXT)
RETURNS TABLE (
    token TEXT,
    version_no INT,
    flex_json JSONB,
    doc_model JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.token,
           v.version_no,
           v.flex_json,
           d.content AS doc_model
    FROM public.shares s
    JOIN public.doc_versions v ON v.id = s.version_id
    JOIN public.docs d ON d.id = s.doc_id
    WHERE s.token = p_token AND s.is_active = true
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_share(TEXT) TO anon, authenticated;

-- 檢查 LINE Token 是否存在
CREATE OR REPLACE FUNCTION public.check_line_token()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.line_channels
        WHERE user_id = auth.uid()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_line_token() TO authenticated;

-- 取得 LINE Token
CREATE OR REPLACE FUNCTION public.get_line_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT access_token INTO v_token
    FROM public.line_channels
    WHERE user_id = auth.uid();
    
    RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_line_token() TO authenticated;

-- =========================================
-- 完成！Storage Bucket 請手動建立（見下方說明）
-- =========================================
