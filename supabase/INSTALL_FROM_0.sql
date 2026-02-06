-- =========================================
-- INSTALL_FROM_0.sql
-- One-shot fresh install for Flex Glass Editor
-- =========================================


-- =========================================
-- Flex Glass Editor - Supabase schema (fresh install)
-- - Auth: Email/Password
-- - Storage bucket: flex-assets
-- =========================================

create extension if not exists pgcrypto;

-- ---------- docs ----------
create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bubble','carousel')),
  title text not null default 'Untitled',
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','previewable','publishable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists docs_owner_idx on public.docs(owner_id);
create index if not exists docs_updated_idx on public.docs(updated_at desc);

-- keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_docs_updated_at on public.docs;
create trigger trg_docs_updated_at
before update on public.docs
for each row execute function public.set_updated_at();

-- ---------- doc_versions ----------
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

-- ---------- shares ----------
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

-- ---------- RPC: resolve token ----------
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

-- Active token by doc id (share?id=... flow)
create or replace function public.get_active_token(p_doc_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select s.token
  from public.shares s
  where s.doc_id = p_doc_id and s.is_active = true
  order by s.created_at desc
  limit 1;
$$;

-- ---------- RLS ----------
alter table public.docs enable row level security;
alter table public.doc_versions enable row level security;
alter table public.shares enable row level security;

-- docs: owner only
drop policy if exists docs_select_own on public.docs;
create policy docs_select_own on public.docs for select using (auth.uid() = owner_id);

drop policy if exists docs_insert_own on public.docs;
create policy docs_insert_own on public.docs for insert with check (auth.uid() = owner_id);

drop policy if exists docs_update_own on public.docs;
create policy docs_update_own on public.docs for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists docs_delete_own on public.docs;
create policy docs_delete_own on public.docs for delete using (auth.uid() = owner_id);

-- doc_versions: owner only
drop policy if exists doc_versions_select_own on public.doc_versions;
create policy doc_versions_select_own on public.doc_versions for select using (auth.uid() = owner_id);

drop policy if exists doc_versions_insert_own on public.doc_versions;
create policy doc_versions_insert_own on public.doc_versions for insert with check (auth.uid() = owner_id);

drop policy if exists doc_versions_delete_own on public.doc_versions;
create policy doc_versions_delete_own on public.doc_versions for delete using (auth.uid() = owner_id);

-- shares: owner only (share page uses RPC)
drop policy if exists shares_select_own on public.shares;
create policy shares_select_own on public.shares for select using (auth.uid() = owner_id);

drop policy if exists shares_insert_own on public.shares;
create policy shares_insert_own on public.shares for insert with check (auth.uid() = owner_id);

drop policy if exists shares_update_own on public.shares;
create policy shares_update_own on public.shares for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists shares_delete_own on public.shares;
create policy shares_delete_own on public.shares for delete using (auth.uid() = owner_id);

-- allow anon to call get_share
grant execute on function public.get_share(text) to anon, authenticated;

-- allow anon to resolve active token by doc id
grant execute on function public.get_active_token(uuid) to anon, authenticated;

-- optional: allow anon to read from get_share outputs only, no table access
revoke all on table public.docs from anon;
revoke all on table public.doc_versions from anon;
revoke all on table public.shares from anon;

-- =========================================
-- Supabase Storage: bucket + RLS for flex-assets
-- Requirement:
-- - admin後台要登入
-- - 所有登入使用者都能上傳
-- =========================================

-- Create bucket (run in SQL editor with service role / project owner)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flex-assets', 'flex-assets', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Enable RLS
alter table storage.objects enable row level security;

-- Policy: authenticated can upload into flex-assets
drop policy if exists "flex-assets upload auth" on storage.objects;
create policy "flex-assets upload auth"
on storage.objects for insert
to authenticated
with check (bucket_id = 'flex-assets');

-- Policy: authenticated can update own objects in flex-assets
drop policy if exists "flex-assets update own" on storage.objects;
create policy "flex-assets update own"
on storage.objects for update
to authenticated
using (bucket_id = 'flex-assets' and owner = auth.uid())
with check (bucket_id = 'flex-assets' and owner = auth.uid());

-- Policy: authenticated can delete own objects in flex-assets
drop policy if exists "flex-assets delete own" on storage.objects;
create policy "flex-assets delete own"
on storage.objects for delete
to authenticated
using (bucket_id = 'flex-assets' and owner = auth.uid());

-- Policy: public read (since bucket is public)
drop policy if exists "flex-assets public read" on storage.objects;
create policy "flex-assets public read"
on storage.objects for select
to public
using (bucket_id = 'flex-assets');




-- ---------- templates ----------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  is_public boolean not null default false,
  name text not null,
  description text,
  doc_model jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists templates_owner_idx on public.templates(owner_id);
create index if not exists templates_public_idx on public.templates(is_public);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_templates_touch on public.templates;
create trigger trg_templates_touch
before update on public.templates
for each row execute function public.touch_updated_at();

alter table public.templates enable row level security;

-- Read: authenticated can read public templates + own templates
drop policy if exists templates_select on public.templates;
create policy templates_select
on public.templates for select
to authenticated
using (is_public = true or owner_id = auth.uid());

-- Insert: authenticated can create own templates
drop policy if exists templates_insert on public.templates;
create policy templates_insert
on public.templates for insert
to authenticated
with check (owner_id = auth.uid() and is_public = false);

-- Update: authenticated can update own templates
drop policy if exists templates_update on public.templates;
create policy templates_update
on public.templates for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Delete: authenticated can delete own templates
drop policy if exists templates_delete on public.templates;
create policy templates_delete
on public.templates for delete
to authenticated
using (owner_id = auth.uid());



-- ---------- publish gate (DB-side) ----------
create or replace function public.validate_flex_json(p_flex jsonb)
returns void
language plpgsql
as $$
declare
  t text;
  alt text;
  ctype text;
  bubbles int;
  txt text;
  sz int;
begin
  if p_flex is null then
    raise exception 'FLEX_EMPTY';
  end if;

  t := p_flex->>'type';
  if t is distinct from 'flex' then
    raise exception 'FLEX_TYPE_INVALID: %', coalesce(t,'(null)');
  end if;

  alt := coalesce(p_flex->>'altText','');
  if length(alt) < 1 then
    raise exception 'ALT_TEXT_REQUIRED';
  end if;
  if length(alt) > 400 then
    raise exception 'ALT_TEXT_TOO_LONG';
  end if;

  if (p_flex ? 'contents') is false then
    raise exception 'CONTENTS_REQUIRED';
  end if;

  ctype := (p_flex->'contents')->>'type';
  if ctype not in ('bubble','carousel') then
    raise exception 'CONTENTS_TYPE_INVALID: %', coalesce(ctype,'(null)');
  end if;

  if ctype = 'carousel' then
    if jsonb_typeof(p_flex->'contents'->'contents') <> 'array' then
      raise exception 'CAROUSEL_CONTENTS_INVALID';
    end if;
    bubbles := jsonb_array_length(p_flex->'contents'->'contents');
    if bubbles > 10 then
      raise exception 'CAROUSEL_TOO_MANY_BUBBLES: %', bubbles;
    end if;
  end if;

  txt := p_flex::text;
  sz := octet_length(txt);
  if sz > 61440 then
    raise exception 'FLEX_TOO_LARGE_BYTES: %', sz;
  end if;

  -- URL must be https:// (reject http://)
  if txt ~ '"url"\s*:\s*"http://' then
    raise exception 'URL_NOT_HTTPS';
  end if;
end;
$$;

create or replace function public.guard_doc_versions()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_flex_json(new.flex_json);
  return new;
end;
$$;

drop trigger if exists trg_guard_doc_versions on public.doc_versions;
create trigger trg_guard_doc_versions
before insert on public.doc_versions
for each row
execute function public.guard_doc_versions();


-- =========================================
-- Supabase Storage: bucket + RLS for flex-assets
-- Requirement:
-- - admin後台要登入
-- - 所有登入使用者都能上傳
-- =========================================

-- Create bucket (run in SQL editor with service role / project owner)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flex-assets', 'flex-assets', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Enable RLS
alter table storage.objects enable row level security;

-- Policy: authenticated can upload into flex-assets
drop policy if exists "flex-assets upload auth" on storage.objects;
create policy "flex-assets upload auth"
on storage.objects for insert
to authenticated
with check (bucket_id = 'flex-assets');

-- Policy: authenticated can update own objects in flex-assets
drop policy if exists "flex-assets update own" on storage.objects;
create policy "flex-assets update own"
on storage.objects for update
to authenticated
using (bucket_id = 'flex-assets' and owner = auth.uid())
with check (bucket_id = 'flex-assets' and owner = auth.uid());

-- Policy: authenticated can delete own objects in flex-assets
drop policy if exists "flex-assets delete own" on storage.objects;
create policy "flex-assets delete own"
on storage.objects for delete
to authenticated
using (bucket_id = 'flex-assets' and owner = auth.uid());

-- Policy: public read (since bucket is public)
drop policy if exists "flex-assets public read" on storage.objects;
create policy "flex-assets public read"
on storage.objects for select
to public
using (bucket_id = 'flex-assets');



-- Seed 4 built-in templates
insert into public.templates (owner_id,is_public,name,description,doc_model)
values (null,true,'名片｜商務聯絡','適合個人/企業名片分享（Bubble）','{"type": "bubble", "title": "名片｜商務聯絡", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Business+Card"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "柯禹彣  |  TapPay", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "Business Development · Payments & LINE solutions", "size": "md", "color": "#333333", "wrap": true}, {"id": "div1", "kind": "divider", "enabled": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "電話", "value": "+886 9xx-xxx-xxx", "action": {"type": "uri", "uri": "tel:+886900000000"}}, {"id": "kv2", "kind": "key_value", "enabled": true, "label": "Email", "value": "you@example.com", "action": {"type": "uri", "uri": "mailto:you@example.com"}}, {"id": "kv3", "kind": "key_value", "enabled": true, "label": "網站", "value": "https://example.com", "action": {"type": "uri", "uri": "https://example.com"}}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "加入 LINE 好友", "action": {"type": "uri", "uri": "https://line.me/R/ti/p/@yourOA"}, "style": "primary", "bgColor": "#0A84FF", "textColor": "#FFFFFF", "autoTextColor": true}]}}'::jsonb)
on conflict do nothing;

insert into public.templates (owner_id,is_public,name,description,doc_model)
values (null,true,'商品促銷｜主視覺+CTA','適合單一商品活動與導購（Bubble）','{"type": "bubble", "title": "商品促銷｜主視覺+CTA", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Promo"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "限時優惠 · eSIM 7 天", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "即買即用，支援多國高速上網。", "size": "md", "color": "#333333", "wrap": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "價格", "value": "NT$ 199 起"}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "立即購買", "action": {"type": "uri", "uri": "https://example.com/buy"}, "style": "primary", "bgColor": "#34C759", "textColor": "#FFFFFF", "autoTextColor": true}]}}'::jsonb)
on conflict do nothing;

insert into public.templates (owner_id,is_public,name,description,doc_model)
values (null,true,'方案比較｜三選一','適合方案比較與導流（Carousel）','{"type": "carousel", "title": "方案比較｜三選一", "cards": [{"id": "cardA", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Plan+A"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "方案 A", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "適合短天數旅行", "size": "md", "color": "#333333", "wrap": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "天數", "value": "3 天"}, {"id": "kv2", "kind": "key_value", "enabled": true, "label": "流量", "value": "1GB"}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "選擇 A", "action": {"type": "uri", "uri": "https://example.com/planA"}, "style": "primary", "bgColor": "#0A84FF", "textColor": "#FFFFFF", "autoTextColor": true}]}}, {"id": "cardB", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Plan+B"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "方案 B", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "最熱門", "size": "md", "color": "#333333", "wrap": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "天數", "value": "7 天"}, {"id": "kv2", "kind": "key_value", "enabled": true, "label": "流量", "value": "3GB"}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "選擇 B", "action": {"type": "uri", "uri": "https://example.com/planB"}, "style": "primary", "bgColor": "#FF9F0A", "textColor": "#FFFFFF", "autoTextColor": true}]}}, {"id": "cardC", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Plan+C"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "方案 C", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "長天數更划算", "size": "md", "color": "#333333", "wrap": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "天數", "value": "15 天"}, {"id": "kv2", "kind": "key_value", "enabled": true, "label": "流量", "value": "10GB"}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "選擇 C", "action": {"type": "uri", "uri": "https://example.com/planC"}, "style": "primary", "bgColor": "#AF52DE", "textColor": "#FFFFFF", "autoTextColor": true}]}}]}'::jsonb)
on conflict do nothing;

insert into public.templates (owner_id,is_public,name,description,doc_model)
values (null,true,'活動行程｜三日版','適合活動/行程資訊分頁（Carousel）','{"type": "carousel", "title": "活動行程｜三日版", "cards": [{"id": "d1", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Day+1"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "Day 1｜集合報到", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "18:00 集合、發放資料", "size": "md", "color": "#333333", "wrap": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "地點", "value": "台北車站"}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "查看地圖", "action": {"type": "uri", "uri": "https://maps.google.com"}, "style": "primary", "bgColor": "#0A84FF", "textColor": "#FFFFFF", "autoTextColor": true}]}}, {"id": "d2", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Day+2"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "Day 2｜主活動", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "09:00 出發，全天行程", "size": "md", "color": "#333333", "wrap": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "提醒", "value": "攜帶證件"}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "行程詳情", "action": {"type": "uri", "uri": "https://example.com/itinerary"}, "style": "primary", "bgColor": "#0A84FF", "textColor": "#FFFFFF", "autoTextColor": true}]}}, {"id": "d3", "section": {"hero": [{"id": "hero_1", "kind": "hero_image", "enabled": true, "image": {"kind": "external", "url": "https://placehold.co/1200x630/png?text=Day+3"}, "ratio": "16:9", "mode": "cover"}], "body": [{"id": "t1", "kind": "title", "enabled": true, "text": "Day 3｜返程解散", "size": "lg", "weight": "bold", "color": "#111111", "align": "start"}, {"id": "p1", "kind": "paragraph", "enabled": true, "text": "12:00 結束，返回集合點", "size": "md", "color": "#333333", "wrap": true}, {"id": "kv1", "kind": "key_value", "enabled": true, "label": "客服", "value": "LINE 聊聊", "action": {"type": "uri", "uri": "https://line.me/R/ti/p/@yourOA"}}], "footer": [{"id": "btn1", "kind": "footer_button", "enabled": true, "label": "聯絡客服", "action": {"type": "uri", "uri": "https://line.me/R/ti/p/@yourOA"}, "style": "primary", "bgColor": "#111111", "textColor": "#FFFFFF", "autoTextColor": true}]}}]}'::jsonb)
on conflict do nothing;
