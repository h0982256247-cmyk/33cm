-- =========================================
-- 診斷 TOKEN 問題
-- =========================================

-- 1. 檢查當前登入用戶
SELECT
    '當前登入用戶' AS check_type,
    auth.uid() AS current_user_id,
    CASE
        WHEN auth.uid() IS NULL THEN '❌ 未登入（在 SQL Editor 中執行會是 NULL，這是正常的）'
        ELSE '✅ 已登入'
    END AS status;

-- 2. 檢查 rm_line_channels 表中所有記錄
SELECT
    '所有 Token 記錄' AS check_type,
    id,
    user_id,
    name,
    is_active,
    LENGTH(access_token_encrypted) AS token_length,
    created_at,
    updated_at
FROM public.rm_line_channels
ORDER BY created_at DESC;

-- 3. 檢查 RLS Policies
SELECT
    'RLS Policies' AS check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'rm_line_channels';

-- 4. 檢查 RPC 函數是否存在
SELECT
    'RPC 函數' AS check_type,
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    CASE
        WHEN p.proname = 'get_channel_status' THEN '✅ 新的安全 RPC'
        WHEN p.proname = 'rm_channel_upsert' THEN '✅ Token 儲存 RPC'
        WHEN p.proname = 'get_line_token' THEN '⚠️ 舊的不安全 RPC（應該被刪除）'
        ELSE '❓ 其他函數'
    END AS note
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%channel%'
    OR p.proname LIKE '%token%'
    OR p.proname = 'get_channel_status'
    OR p.proname = 'rm_channel_upsert'
  )
ORDER BY p.proname;

-- 5. 檢查 VIEW 是否存在（應該要被刪除）
SELECT
    'VIEWs 檢查' AS check_type,
    table_name,
    CASE
        WHEN table_name = 'rm_line_channels_safe' THEN '⚠️ 這個 VIEW 應該被刪除'
        ELSE '❓ 其他 VIEW'
    END AS note
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%channel%';

-- 6. 權限檢查
SELECT
    '權限檢查' AS check_type,
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'rm_line_channels'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;
