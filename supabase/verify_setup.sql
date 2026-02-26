-- =========================================
-- 驗證 LINE Portal 數據庫設定
-- =========================================

-- 檢查 1: rm_line_channels 表是否存在
SELECT 'rm_line_channels table' AS check_item,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rm_line_channels')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 檢查 2: rm_line_channels_safe VIEW 是否存在
SELECT 'rm_line_channels_safe view' AS check_item,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'rm_line_channels_safe')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 檢查 3: VIEW 的定義
SELECT 'VIEW definition' AS check_item,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public' AND table_name = 'rm_line_channels_safe';

-- 檢查 4: rm_line_channels 表的 RLS 政策
SELECT
  'RLS policies on rm_line_channels' AS check_item,
  policyname AS policy_name,
  cmd AS command
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rm_line_channels';

-- 檢查 5: rm_channel_upsert RPC 函數是否存在
SELECT 'rm_channel_upsert function' AS check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'rm_channel_upsert'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 檢查 6: get_line_token RPC 函數是否存在
SELECT 'get_line_token function' AS check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'get_line_token'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 檢查 7: 當前用戶的 channel 記錄（需要在登入狀態下執行）
SELECT
  'Current user channels' AS check_item,
  COUNT(*) AS record_count
FROM public.rm_line_channels
WHERE user_id = auth.uid();

-- 檢查 8: 透過 VIEW 查詢（測試 RLS）
SELECT
  'Channels via safe VIEW' AS check_item,
  COUNT(*) AS record_count
FROM public.rm_line_channels_safe;
