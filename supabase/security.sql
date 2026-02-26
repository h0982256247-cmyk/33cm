-- =========================================
-- 安全性強化：保護 LINE Channel Access Token
-- =========================================
-- 此檔案用於加強安全性，確保前端無法直接讀取 access_token

-- 建立一個安全的 VIEW，只暴露基本資訊
create or replace view public.rm_line_channels_safe as
select
  id,
  user_id,
  name,
  is_active,
  created_at,
  updated_at
from public.rm_line_channels
where user_id = auth.uid();  -- 直接在 VIEW 中過濾當前用戶

-- 設定 VIEW 使用調用者權限（繼承 RLS）
alter view public.rm_line_channels_safe set (security_invoker = on);

-- 授權 authenticated 用戶可以讀取此 VIEW
grant select on public.rm_line_channels_safe to authenticated;
grant usage on schema public to authenticated;

-- 註解：前端應該使用 rm_line_channels_safe VIEW 而不是直接查詢 rm_line_channels 表
comment on view public.rm_line_channels_safe is '前端安全查詢用，不含 access_token_encrypted';
