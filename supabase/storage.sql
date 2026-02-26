-- =========================================
-- Supabase Storage Setup (buckets + policies)
-- Buckets:
-- - flex-assets (Flex 編輯器圖片)
-- - richmenu-images (Rich Menu 圖片)
-- =========================================

-- Buckets (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flex-assets', 'flex-assets', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('richmenu-images', 'richmenu-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Enable RLS on storage.objects (if not already)
alter table storage.objects enable row level security;

-- Clear old policies (safe)
drop policy if exists "flex_public_read" on storage.objects;
drop policy if exists "flex_auth_upload" on storage.objects;
drop policy if exists "flex_owner_update" on storage.objects;
drop policy if exists "flex_owner_delete" on storage.objects;

drop policy if exists "richmenu_public_read" on storage.objects;
drop policy if exists "richmenu_auth_upload" on storage.objects;
drop policy if exists "richmenu_owner_update" on storage.objects;
drop policy if exists "richmenu_owner_delete" on storage.objects;

-- flex-assets
create policy "flex_public_read"
on storage.objects for select
to public
using (bucket_id = 'flex-assets');

create policy "flex_auth_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'flex-assets');

create policy "flex_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'flex-assets' and (auth.uid())::text = (owner)::text)
with check (bucket_id = 'flex-assets');

create policy "flex_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'flex-assets' and (auth.uid())::text = (owner)::text);

-- richmenu-images
create policy "richmenu_public_read"
on storage.objects for select
to public
using (bucket_id = 'richmenu-images');

create policy "richmenu_auth_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'richmenu-images');

create policy "richmenu_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'richmenu-images' and (auth.uid())::text = (owner)::text)
with check (bucket_id = 'richmenu-images');

create policy "richmenu_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'richmenu-images' and (auth.uid())::text = (owner)::text);
