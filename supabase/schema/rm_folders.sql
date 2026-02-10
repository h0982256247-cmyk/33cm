create table if not exists rm_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table rm_folders enable row level security;

create policy "user owns folders"
on rm_folders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);