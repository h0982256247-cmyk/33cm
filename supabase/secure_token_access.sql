-- =========================================
-- 安全架構：禁止前端讀取 LINE Token
-- =========================================
-- 目標：authenticated 用戶永遠無法透過任何方式取得 access_token_encrypted
-- 只有 Edge Functions 使用 service role 才能讀取

-- =========================================
-- 1. 移除舊的 VIEW（如果存在）
-- =========================================
DROP VIEW IF EXISTS public.rm_line_channels_safe CASCADE;

-- =========================================
-- 2. 移除可能讓前端讀取 token 的 RPC
-- =========================================
-- 移除 get_line_token() - 前端不應該有權限呼叫
DROP FUNCTION IF EXISTS public.get_line_token() CASCADE;

-- 移除其他可能暴露 token 的函數
DROP FUNCTION IF EXISTS public.check_line_token() CASCADE;
DROP FUNCTION IF EXISTS public.get_active_token() CASCADE;

-- =========================================
-- 3. 設定 rm_line_channels 的 RLS
-- =========================================
ALTER TABLE public.rm_line_channels ENABLE ROW LEVEL SECURITY;

-- 刪除所有現有 policies
DROP POLICY IF EXISTS rm_line_channels_select_own ON public.rm_line_channels;
DROP POLICY IF EXISTS rm_line_channels_insert_own ON public.rm_line_channels;
DROP POLICY IF EXISTS rm_line_channels_update_own ON public.rm_line_channels;
DROP POLICY IF EXISTS rm_line_channels_delete_own ON public.rm_line_channels;
DROP POLICY IF EXISTS rm_line_channels_all_own ON public.rm_line_channels;

-- ❌ 禁止 authenticated 用戶 SELECT（即使是自己的記錄也不行）
-- 這樣前端永遠無法直接查詢 token
-- (沒有 SELECT policy = 無法 SELECT)

-- ✅ 允許 authenticated 用戶 INSERT 自己的記錄
CREATE POLICY rm_line_channels_insert_own
ON public.rm_line_channels FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ✅ 允許 authenticated 用戶 UPDATE 自己的記錄
CREATE POLICY rm_line_channels_update_own
ON public.rm_line_channels FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ✅ 允許 authenticated 用戶 DELETE 自己的記錄
CREATE POLICY rm_line_channels_delete_own
ON public.rm_line_channels FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =========================================
-- 4. 建立給前端使用的 RPC：get_channel_status
-- =========================================
-- 只回傳非敏感資訊，不回傳 token
CREATE OR REPLACE FUNCTION public.get_channel_status()
RETURNS TABLE (
    has_channel BOOLEAN,
    name TEXT,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_name TEXT;
    v_updated_at TIMESTAMPTZ;
BEGIN
    -- 直接查詢記錄
    SELECT
        c.name,
        c.updated_at
    INTO v_name, v_updated_at
    FROM public.rm_line_channels c
    WHERE c.user_id = auth.uid()
      AND c.is_active = TRUE
    LIMIT 1;

    -- 根據是否找到記錄返回結果
    IF v_name IS NOT NULL THEN
        -- 找到記錄
        RETURN QUERY SELECT TRUE, v_name, v_updated_at;
    ELSE
        -- 沒有記錄
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TIMESTAMPTZ;
    END IF;
END;
$function$;

-- 授權 authenticated 用戶執行此 RPC
GRANT EXECUTE ON FUNCTION public.get_channel_status() TO authenticated;

COMMENT ON FUNCTION public.get_channel_status() IS '前端查詢 LINE Channel 狀態（不含 token）';

-- =========================================
-- 5. 建立 rm_channel_upsert RPC（只允許新增）
-- =========================================
-- 前端只能新增 token，不允許更新
-- 一個帳號只能設定一次 LINE Token
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
    -- 檢查 token 是否為空
    IF p_access_token IS NULL OR p_access_token = '' THEN
        RAISE EXCEPTION 'access_token cannot be empty';
    END IF;

    -- 查找現有記錄
    SELECT id INTO v_id
    FROM public.rm_line_channels
    WHERE user_id = auth.uid();

    IF v_id IS NULL THEN
        -- 新增記錄
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
        -- 已有記錄，不允許更新 - 一個帳號只能設定一次 token
        RAISE EXCEPTION '此帳號已設定 LINE Token，一個帳號只能設定一次';
    END IF;

    -- 只回傳 ID，不回傳 token
    RETURN v_id;
END;
$$;

-- 授權 authenticated 用戶執行此 RPC
GRANT EXECUTE ON FUNCTION public.rm_channel_upsert(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.rm_channel_upsert(TEXT, TEXT) IS '前端新增 LINE Channel（不允許更新，一個帳號只能設定一次）';

-- =========================================
-- 6. 撤銷 authenticated 對表的直接 SELECT 權限
-- =========================================
REVOKE SELECT ON public.rm_line_channels FROM authenticated;
REVOKE SELECT ON public.rm_line_channels FROM anon;

-- =========================================
-- 完成
-- =========================================
-- 現在：
-- ✅ 前端無法 SELECT public.rm_line_channels
-- ✅ 前端只能透過 get_channel_status() 取得非敏感資訊
-- ✅ 前端可以透過 rm_channel_upsert() 新增 token（只能設定一次，不允許更新）
-- ✅ Edge Functions 使用 service role 可以讀取 token
-- ✅ 一個帳號只會有一個 LINE Token，設定後無法從前端更新
