-- =========================================
-- LINE Portal - Minimal DB Setup (Single Entry + Shared Token)
-- 會建立：
-- - rm_line_channels（共用 Token）
-- - rm_folders / rm_drafts（Rich Menu）
-- - docs / doc_versions / shares（Flex Message + 分享）
-- - templates（Flex 範本）
-- - 必要 RPC + RLS
-- =========================================

create extension if not exists pgcrypto;

-- helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================
-- 1) LINE Channels（共用 Token）
-- =========================================
create table if not exists public.rm_line_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My LINE Channel',
  access_token_encrypted text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

drop trigger if exists trg_rm_line_channels_updated_at on public.rm_line_channels;
create trigger trg_rm_line_channels_updated_at
before update on public.rm_line_channels
for each row execute function public.set_updated_at();

alter table public.rm_line_channels enable row level security;

drop policy if exists rm_line_channels_select_own on public.rm_line_channels;
create policy rm_line_channels_select_own
on public.rm_line_channels for select
using (auth.uid() = user_id);

drop policy if exists rm_line_channels_insert_own on public.rm_line_channels;
create policy rm_line_channels_insert_own
on public.rm_line_channels for insert
with check (auth.uid() = user_id);

drop policy if exists rm_line_channels_update_own on public.rm_line_channels;
create policy rm_line_channels_update_own
on public.rm_line_channels for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists rm_line_channels_delete_own on public.rm_line_channels;
create policy rm_line_channels_delete_own
on public.rm_line_channels for delete
using (auth.uid() = user_id);

-- RPC: upsert token (front-end calls this once after login)
create or replace function public.rm_channel_upsert(
  p_name text,
  p_access_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.rm_line_channels
  where user_id = auth.uid();

  if v_id is null then
    insert into public.rm_line_channels (user_id, name, access_token_encrypted, is_active)
    values (auth.uid(), coalesce(p_name,'My LINE Channel'), p_access_token, true)
    returning id into v_id;
  else
    update public.rm_line_channels
      set name = coalesce(p_name, name),
          access_token_encrypted = p_access_token,
          is_active = true,
          updated_at = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.rm_channel_upsert(text,text) to authenticated;

-- =========================================
-- 2) Rich Menu: folders / drafts
-- =========================================
create table if not exists public.rm_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '新資料夾',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rm_folders_updated_at on public.rm_folders;
create trigger trg_rm_folders_updated_at
before update on public.rm_folders
for each row execute function public.set_updated_at();

alter table public.rm_folders enable row level security;

drop policy if exists rm_folders_all_own on public.rm_folders;
create policy rm_folders_all_own
on public.rm_folders for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.rm_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '未命名專案',
  data jsonb not null default '{"menus":[]}'::jsonb,
  status text not null default 'draft',
  scheduled_at timestamptz null,
  folder_id uuid null references public.rm_folders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rm_drafts_updated_at on public.rm_drafts;
create trigger trg_rm_drafts_updated_at
before update on public.rm_drafts
for each row execute function public.set_updated_at();

alter table public.rm_drafts enable row level security;

drop policy if exists rm_drafts_all_own on public.rm_drafts;
create policy rm_drafts_all_own
on public.rm_drafts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================================
-- 3) Flex Message: docs / versions / shares
-- =========================================
create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bubble','carousel','folder')),
  title text not null default 'Untitled',
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','previewable','publishable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists docs_owner_idx on public.docs(owner_id);
create index if not exists docs_updated_idx on public.docs(updated_at desc);

drop trigger if exists trg_docs_updated_at on public.docs;
create trigger trg_docs_updated_at
before update on public.docs
for each row execute function public.set_updated_at();

alter table public.docs enable row level security;

drop policy if exists docs_select_own on public.docs;
create policy docs_select_own on public.docs for select using (auth.uid() = owner_id);

drop policy if exists docs_insert_own on public.docs;
create policy docs_insert_own on public.docs for insert with check (auth.uid() = owner_id);

drop policy if exists docs_update_own on public.docs;
create policy docs_update_own on public.docs for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists docs_delete_own on public.docs;
create policy docs_delete_own on public.docs for delete using (auth.uid() = owner_id);

create table if not exists public.doc_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  doc_id uuid not null references public.docs(id) on delete cascade,
  version_no int not null,
  flex_json jsonb not null,
  validation_report jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists doc_versions_unique on public.doc_versions(doc_id, version_no);
create index if not exists doc_versions_owner_idx on public.doc_versions(owner_id);

alter table public.doc_versions enable row level security;

drop policy if exists doc_versions_select_own on public.doc_versions;
create policy doc_versions_select_own on public.doc_versions for select using (auth.uid() = owner_id);

drop policy if exists doc_versions_insert_own on public.doc_versions;
create policy doc_versions_insert_own on public.doc_versions for insert with check (auth.uid() = owner_id);

drop policy if exists doc_versions_delete_own on public.doc_versions;
create policy doc_versions_delete_own on public.doc_versions for delete using (auth.uid() = owner_id);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  doc_id uuid not null references public.docs(id) on delete cascade,
  version_id uuid not null references public.doc_versions(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists shares_doc_idx on public.shares(doc_id);
create index if not exists shares_active_idx on public.shares(is_active);

alter table public.shares enable row level security;

drop policy if exists shares_select_own on public.shares;
create policy shares_select_own on public.shares for select using (auth.uid() = owner_id);

drop policy if exists shares_insert_own on public.shares;
create policy shares_insert_own on public.shares for insert with check (auth.uid() = owner_id);

drop policy if exists shares_update_own on public.shares;
create policy shares_update_own on public.shares for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists shares_delete_own on public.shares;
create policy shares_delete_own on public.shares for delete using (auth.uid() = owner_id);

-- public RPC: get_share (anon can read via function)
create or replace function public.get_share(p_token text)
returns table (
  token text,
  version_no int,
  flex_json jsonb,
  doc_model jsonb
)
language sql
security definer
set search_path = public
as $$
  select s.token,
         v.version_no,
         v.flex_json,
         d.content as doc_model
  from public.shares s
  join public.doc_versions v on v.id = s.version_id
  join public.docs d on d.id = s.doc_id
  where s.token = p_token and s.is_active = true
  limit 1;
$$;

grant execute on function public.get_share(text) to anon, authenticated;

create or replace function public.get_active_token(p_doc_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select token
  from public.shares
  where doc_id = p_doc_id and is_active = true
  order by created_at desc
  limit 1;
$$;

grant execute on function public.get_active_token(uuid) to anon, authenticated;

-- harden anon access: tables should not be directly readable by anon
revoke all on table public.docs from anon;
revoke all on table public.doc_versions from anon;
revoke all on table public.shares from anon;

-- =========================================
-- 4) Templates
-- =========================================
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references auth.users(id) on delete set null,
  is_public boolean not null default false,
  name text not null,
  description text null,
  doc_model jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_templates_updated_at on public.templates;
create trigger trg_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

create index if not exists templates_owner_idx on public.templates(owner_id);
create index if not exists templates_public_idx on public.templates(is_public);

alter table public.templates enable row level security;

drop policy if exists templates_select_public_or_own on public.templates;
create policy templates_select_public_or_own
on public.templates for select
using (is_public = true or auth.uid() = owner_id);

drop policy if exists templates_insert_own on public.templates;
create policy templates_insert_own
on public.templates for insert
with check (auth.uid() = owner_id);

drop policy if exists templates_update_own on public.templates;
create policy templates_update_own
on public.templates for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists templates_delete_own on public.templates;
create policy templates_delete_own
on public.templates for delete
using (auth.uid() = owner_id);

-- =========================================
-- DONE
-- =========================================
