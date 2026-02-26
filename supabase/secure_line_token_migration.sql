-- =========================================
-- Secure LINE Token Migration
-- 目標：確保 authenticated 用戶無法讀取 token 原文
-- =========================================

-- 1. 移除 rm_line_channels 的 SELECT privilege 和舊的 RLS
REVOKE SELECT ON public.rm_line_channels FROM authenticated;
DROP POLICY IF EXISTS rm_line_channels_select_own ON public.rm_line_channels;

-- 2. 移除任何會回傳 token 的 RPC (前人留下來的)
DROP FUNCTION IF EXISTS public.get_line_token();

-- 3. 建立給前端使用的 RPC，只回傳狀態 (SECURITY DEFINER 繞過 SELECT 限制)
CREATE OR REPLACE FUNCTION public.get_channel_status()
RETURNS TABLE (
  has_channel boolean,
  name text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS has_channel,
    c.name,
    c.updated_at
  FROM public.rm_line_channels c
  WHERE c.user_id = auth.uid()
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_status() TO authenticated;

-- 4. 確保寫入 / 更新 RPC 正確且安全，不回傳 token
CREATE OR REPLACE FUNCTION public.rm_channel_upsert(
  p_name text,
  p_access_token text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.rm_line_channels
  WHERE user_id = auth.uid();

  IF v_id IS NULL THEN
    INSERT INTO public.rm_line_channels (user_id, name, access_token_encrypted, is_active)
    VALUES (auth.uid(), coalesce(p_name,'My LINE Channel'), p_access_token, true)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.rm_line_channels
      SET name = coalesce(p_name, name),
          access_token_encrypted = p_access_token,
          is_active = true,
          updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rm_channel_upsert(text, text) TO authenticated;

-- (可選) 確保 check_line_token 不回傳 token，且使用 SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_line_token()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.rm_line_channels
    WHERE user_id = auth.uid()
      AND is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_line_token() TO authenticated;
