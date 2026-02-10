create table if not exists rm_line_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  access_token_encrypted text not null,
  channel_id text,
  channel_secret_encrypted text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists rm_line_channels_user_idx
on rm_line_channels(user_id);

alter table rm_line_channels enable row level security;

create policy "user owns channel"
on rm_line_channels
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);