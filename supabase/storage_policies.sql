-- =========================================
-- Storage Policies
-- 在 Supabase SQL Editor 執行
-- 如果出現權限錯誤，請改用 Dashboard UI 設定
-- =========================================

-- richmenu-images bucket policies
CREATE POLICY "richmenu_public_read" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'richmenu-images');

CREATE POLICY "richmenu_auth_upload" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'richmenu-images');

CREATE POLICY "richmenu_owner_update" ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'richmenu-images' AND (auth.uid())::text = (owner)::text)
WITH CHECK (bucket_id = 'richmenu-images');

CREATE POLICY "richmenu_owner_delete" ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'richmenu-images' AND (auth.uid())::text = (owner)::text);

-- flex-assets bucket policies
CREATE POLICY "flex_public_read" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'flex-assets');

CREATE POLICY "flex_auth_upload" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'flex-assets');

CREATE POLICY "flex_owner_update" ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'flex-assets' AND (auth.uid())::text = (owner)::text)
WITH CHECK (bucket_id = 'flex-assets');

CREATE POLICY "flex_owner_delete" ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'flex-assets' AND (auth.uid())::text = (owner)::text);
