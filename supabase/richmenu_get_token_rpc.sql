-- =========================================
-- Rich Menu 取得 LINE Token RPC 函數
-- 簡化方案：RPC 只返回 token，前端直接調用 LINE API
-- 避免 pgsql-http API 限制問題
-- =========================================

CREATE OR REPLACE FUNCTION public.rm_get_line_token()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_line_token TEXT;
BEGIN
    -- 取得用戶的 LINE Channel Access Token
    SELECT access_token_encrypted
    INTO v_line_token
    FROM public.rm_line_channels
    WHERE user_id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;

    IF v_line_token IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'TOKEN_NOT_FOUND',
                'message', 'LINE Token 未設定，請先綁定 LINE Channel'
            )
        );
    END IF;

    -- 返回 token（已加密儲存，但用戶可以讀取用於 API 調用）
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'accessToken', v_line_token
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
            'code', 'UNEXPECTED_ERROR',
            'message', '取得 Token 時發生錯誤',
            'details', SQLERRM
        )
    );
END;
$$;

-- 授權 authenticated 用戶執行此 RPC
GRANT EXECUTE ON FUNCTION public.rm_get_line_token() TO authenticated;

COMMENT ON FUNCTION public.rm_get_line_token() IS 'Rich Menu 取得 LINE Token - 前端用於直接調用 LINE API';
