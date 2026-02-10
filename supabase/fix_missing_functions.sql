-- =========================================
-- 修復缺失的 RPC 函數
-- 執行此 SQL 以修復分享連結功能
-- =========================================

-- 1. get_active_token: 根據 doc_id 取得 active token
CREATE OR REPLACE FUNCTION public.get_active_token(p_doc_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT token
    FROM public.shares
    WHERE doc_id = p_doc_id AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
$$;

-- 授權匿名和已認證使用者使用
GRANT EXECUTE ON FUNCTION public.get_active_token(UUID) TO anon, authenticated;

-- 2. 確保 get_share 函數存在且正確
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

-- 授權匿名和已認證使用者使用
GRANT EXECUTE ON FUNCTION public.get_share(TEXT) TO anon, authenticated;

-- 3. get_line_token: 取得使用者的 LINE Channel Access Token
CREATE OR REPLACE FUNCTION public.get_line_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT access_token INTO v_token
    FROM public.line_channels
    WHERE owner_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN v_token;
END;
$$;

-- 授權已認證使用者使用
GRANT EXECUTE ON FUNCTION public.get_line_token() TO authenticated;

-- 4. check_line_token: 檢查使用者是否已設定 LINE Token
CREATE OR REPLACE FUNCTION public.check_line_token()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.line_channels
        WHERE owner_id = auth.uid()
    );
END;
$$;

-- 授權已認證使用者使用
GRANT EXECUTE ON FUNCTION public.check_line_token() TO authenticated;

-- =========================================
-- 完成！現在可以測試分享連結和 LINE OA 廣播功能
-- =========================================
