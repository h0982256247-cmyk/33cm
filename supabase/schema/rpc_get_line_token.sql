create or replace function get_line_token()
returns text
language plpgsql
security definer
as $$
declare
  v_token text;
begin
  select access_token_encrypted
  into v_token
  from rm_line_channels
  where user_id = auth.uid()
    and is_active = true
  order by updated_at desc
  limit 1;

  return v_token;
end;
$$;

revoke all on function get_line_token() from public;
grant execute on function get_line_token() to authenticated;