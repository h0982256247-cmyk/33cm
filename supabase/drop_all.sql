-- =========================================
-- LINE Portal - DROP ALL (⚠️Destructive)
-- 會刪掉本專案用到的 tables / functions / triggers
-- =========================================

-- Functions
drop function if exists public.get_share(text);
drop function if exists public.get_active_token(uuid);
drop function if exists public.rm_channel_upsert(text,text);
drop function if exists public.set_updated_at();

-- Triggers (tables might not exist, so wrap by dropping tables later)

-- Tables (order matters due to FK)
drop table if exists public.shares cascade;
drop table if exists public.doc_versions cascade;
drop table if exists public.docs cascade;

drop table if exists public.templates cascade;

drop table if exists public.rm_drafts cascade;
drop table if exists public.rm_folders cascade;
drop table if exists public.rm_line_channels cascade;

-- NOTE:
-- Storage buckets & objects are NOT dropped here.
-- If you also want to delete buckets, please do it in Supabase Storage UI:
-- - flex-assets
-- - richmenu-images
