-- =========================================
-- LINE Portal - Combined Database Schema
-- 合併 Rich Menu 編輯器和 Flex Message 編輯器的資料表
-- =========================================

-- 啟用 pgcrypto 擴展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- 1. LINE Channels 資料表（共用）
-- 存儲用戶的 LINE Channel Access Token
-- =========================================
CREATE TABLE IF NOT EXISTS public.rm_line_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.rm_line_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own channels"
    ON public.rm_line_channels FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own channels"
    ON public.rm_line_channels FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channels"
    ON public.rm_line_channels FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own channels"
    ON public.rm_line_channels FOR DELETE
    USING (auth.uid() = user_id);

-- RPC：新增/更新 Channel
CREATE OR REPLACE FUNCTION public.rm_channel_upsert(
    p_name TEXT,
    p_access_token TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_channel_id UUID;
BEGIN
    SELECT id INTO v_channel_id
    FROM public.rm_line_channels
    WHERE user_id = auth.uid();

    IF v_channel_id IS NOT NULL THEN
        UPDATE public.rm_line_channels
        SET 
            name = p_name,
            access_token_encrypted = p_access_token,
            updated_at = NOW()
        WHERE id = v_channel_id;
    ELSE
        INSERT INTO public.rm_line_channels (user_id, name, access_token_encrypted)
        VALUES (auth.uid(), p_name, p_access_token)
        RETURNING id INTO v_channel_id;
    END IF;

    RETURN v_channel_id;
END;
$$;

-- =========================================
-- 2. Rich Menu 草稿資料表
-- =========================================
CREATE TABLE IF NOT EXISTS public.rm_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    status TEXT DEFAULT 'draft',
    folder_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rm_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rm_drafts"
    ON public.rm_drafts FOR ALL
    USING (auth.uid() = user_id);

-- =========================================
-- 3. Flex Message 文件資料表
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

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_docs_updated_at ON public.docs;
CREATE TRIGGER trg_docs_updated_at
BEFORE UPDATE ON public.docs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY docs_select_own ON public.docs FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY docs_insert_own ON public.docs FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY docs_update_own ON public.docs FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY docs_delete_own ON public.docs FOR DELETE USING (auth.uid() = owner_id);

-- =========================================
-- 4. Flex Message 版本記錄
-- =========================================
CREATE TABLE IF NOT EXISTS public.doc_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_id UUID NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    flex_json JSONB NOT NULL,
    validation_report JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS doc_versions_unique ON public.doc_versions(doc_id, version_no);
CREATE INDEX IF NOT EXISTS doc_versions_owner_idx ON public.doc_versions(owner_id);

ALTER TABLE public.doc_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_versions_select_own ON public.doc_versions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY doc_versions_insert_own ON public.doc_versions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY doc_versions_delete_own ON public.doc_versions FOR DELETE USING (auth.uid() = owner_id);

-- =========================================
-- 5. Flex Message 分享連結
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

CREATE INDEX IF NOT EXISTS shares_doc_idx ON public.shares(doc_id);
CREATE INDEX IF NOT EXISTS shares_active_idx ON public.shares(is_active);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY shares_select_own ON public.shares FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY shares_insert_own ON public.shares FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY shares_update_own ON public.shares FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY shares_delete_own ON public.shares FOR DELETE USING (auth.uid() = owner_id);

-- =========================================
-- 6. RPC：取得分享資料（公開）
-- =========================================
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

-- 允許匿名用戶呼叫 get_share
GRANT EXECUTE ON FUNCTION public.get_share(TEXT) TO anon, authenticated;

-- 限制匿名用戶直接存取資料表
REVOKE ALL ON TABLE public.docs FROM anon;
REVOKE ALL ON TABLE public.doc_versions FROM anon;
REVOKE ALL ON TABLE public.shares FROM anon;

-- =========================================
-- 完成！
-- =========================================
