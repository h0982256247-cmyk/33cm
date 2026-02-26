-- =====================================================
-- Supabase RLS (Row Level Security) 策略範例集合
-- =====================================================

-- ===================
-- 1. 基本用戶隔離策略
-- ===================

-- 用戶只能看到自己的資料
CREATE POLICY "users_select_own"
  ON public.user_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用戶只能建立屬於自己的記錄
CREATE POLICY "users_insert_own"
  ON public.user_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能更新自己的資料
CREATE POLICY "users_update_own"
  ON public.user_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能刪除自己的資料
CREATE POLICY "users_delete_own"
  ON public.user_data
  FOR DELETE
  USING (auth.uid() = user_id);


-- ===================
-- 2. 角色基礎存取控制 (RBAC)
-- ===================

-- 建立角色檢查函數
CREATE OR REPLACE FUNCTION public.user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = required_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 管理員可以做任何事
CREATE POLICY "admin_full_access"
  ON public.content
  FOR ALL
  USING (public.user_has_role('admin'));

-- 編輯者可以讀取和更新
CREATE POLICY "editor_read_update"
  ON public.content
  FOR SELECT
  USING (public.user_has_role('editor') OR public.user_has_role('admin'));

CREATE POLICY "editor_update"
  ON public.content
  FOR UPDATE
  USING (public.user_has_role('editor') OR public.user_has_role('admin'));


-- ===================
-- 3. 組織/團隊存取控制
-- ===================

-- 建立獲取用戶組織 ID 的函數
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    ARRAY_AGG(organization_id),
    ARRAY[]::UUID[]
  )
  FROM public.organization_members
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 用戶只能存取所屬組織的資料
CREATE POLICY "org_member_access"
  ON public.projects
  FOR SELECT
  USING (organization_id = ANY(public.get_user_org_ids()));

-- 只有特定角色可以建立專案
CREATE OR REPLACE FUNCTION public.can_create_in_org(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND role IN ('admin', 'owner')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "org_admin_insert"
  ON public.projects
  FOR INSERT
  WITH CHECK (public.can_create_in_org(organization_id));


-- ===================
-- 4. 公開/私有混合策略
-- ===================

-- 公開發布的內容任何人可讀，草稿只有作者可讀
CREATE POLICY "public_or_author_read"
  ON public.articles
  FOR SELECT
  USING (
    status = 'published'
    OR author_id = auth.uid()
  );

-- 只有作者可以更新
CREATE POLICY "author_update"
  ON public.articles
  FOR UPDATE
  USING (author_id = auth.uid());


-- ===================
-- 5. 時間限制存取
-- ===================

-- 只能在特定時間內編輯（例如：24小時內）
CREATE POLICY "time_limited_update"
  ON public.posts
  FOR UPDATE
  USING (
    author_id = auth.uid()
    AND created_at > (now() - interval '24 hours')
  );


-- ===================
-- 6. 分層權限（文件夾結構）
-- ===================

-- 建立檢查資料夾權限的函數
CREATE OR REPLACE FUNCTION public.can_access_folder(folder_uuid UUID)
RETURNS BOOLEAN AS $$
WITH RECURSIVE folder_tree AS (
  SELECT id, parent_id FROM public.folders WHERE id = folder_uuid
  UNION ALL
  SELECT f.id, f.parent_id
  FROM public.folders f
  JOIN folder_tree ft ON f.id = ft.parent_id
)
SELECT EXISTS (
  SELECT 1 FROM folder_tree ft
  JOIN public.folder_permissions fp ON ft.id = fp.folder_id
  WHERE fp.user_id = auth.uid()
);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "folder_hierarchy_access"
  ON public.documents
  FOR SELECT
  USING (public.can_access_folder(folder_id));


-- ===================
-- 7. 速率限制
-- ===================

CREATE OR REPLACE FUNCTION public.check_insert_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.posts
  WHERE author_id = NEW.author_id
  AND created_at > (now() - interval '1 minute');
  
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 5 posts per minute';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_post_rate_limit
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.check_insert_rate_limit();


-- ===================
-- 8. 軟刪除過濾
-- ===================

-- 自動過濾已軟刪除的記錄
CREATE POLICY "hide_deleted"
  ON public.items
  FOR SELECT
  USING (deleted_at IS NULL OR owner_id = auth.uid());

-- 只允許軟刪除，不允許真正刪除
CREATE POLICY "prevent_hard_delete"
  ON public.items
  FOR DELETE
  USING (false); -- 禁止所有刪除

CREATE POLICY "allow_soft_delete"
  ON public.items
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (
    -- 只允許設定 deleted_at，不能更改其他欄位
    (OLD.* IS NOT DISTINCT FROM NEW.* 
     OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL))
  );


-- ===================
-- 9. 審計追蹤
-- ===================

-- 建立審計日誌表
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 審計日誌觸發器
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, user_id)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_posts_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 審計日誌只有管理員可讀
CREATE POLICY "admin_read_audit"
  ON public.audit_logs
  FOR SELECT
  USING (public.user_has_role('admin'));


-- ===================
-- 10. 邀請制存取
-- ===================

CREATE TABLE public.shared_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id),
  shared_with_user_id UUID REFERENCES auth.users(id),
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "shared_document_access"
  ON public.documents
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT document_id FROM public.shared_documents
      WHERE shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "shared_document_edit"
  ON public.documents
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT document_id FROM public.shared_documents
      WHERE shared_with_user_id = auth.uid()
      AND permission = 'edit'
    )
  );
