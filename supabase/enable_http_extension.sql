-- 啟用 HTTP extension for Rich Menu publishing
-- 在 Supabase Dashboard > SQL Editor 中執行此 SQL

-- 1. 啟用 http extension
CREATE EXTENSION IF NOT EXISTS http SCHEMA extensions;

-- 2. 驗證 extension 已啟用
SELECT * FROM pg_extension WHERE extname = 'http';

-- 3. 測試 http 函數是否可用
SELECT exists(
  SELECT 1
  FROM pg_proc
  WHERE proname = 'http_get'
) AS http_functions_available;
