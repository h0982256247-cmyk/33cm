alter table rm_drafts
add column if not exists published_at timestamptz,
add column if not exists published_payload jsonb;