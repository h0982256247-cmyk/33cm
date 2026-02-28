
import { supabase } from '@/lib/supabase';
import { Project, Folder } from '@/lib/richmenuTypes';

export const draftService = {
    // --- Folders ---
    async getFolders() {
        console.log('[draftService] getFolders: Starting...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            console.error('[draftService] getFolders: No session');
            throw new Error('Not authenticated');
        }

        console.log('[draftService] getFolders: Session found, user ID:', session.user.id);

        const { data, error } = await supabase
            .from('rm_folders')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[draftService] getFolders: Query error:', error);
            throw error;
        }

        console.log('[draftService] getFolders: Found', data?.length || 0, 'folders');
        return data as Folder[];
    },

    async createFolder(name: string) {
        console.log('[draftService] createFolder: Starting...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            console.error('[draftService] createFolder: No session');
            throw new Error('Not authenticated');
        }

        const { data, error } = await supabase
            .from('rm_folders')
            .insert({
                user_id: session.user.id,
                name
            })
            .select()
            .single();

        if (error) {
            console.error('[draftService] createFolder: Insert error:', error);
            throw error;
        }

        console.log('[draftService] createFolder: Created folder:', data.id);
        return data as Folder;
    },

    async updateFolder(id: string, name: string) {
        const { error } = await supabase
            .from('rm_folders')
            .update({ name, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },

    async deleteFolder(id: string) {
        const { error } = await supabase
            .from('rm_folders')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- Drafts (Projects) ---
    async getDrafts() {
        console.log('[draftService] getDrafts: Starting...');

        // 確保 session 存在（重要：因為 persistSession: false，需要確認 session 已建立）
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('[draftService] getDrafts: Session error:', sessionError);
            return [];
        }

        if (!session) {
            console.warn('[draftService] getDrafts: No session found, returning empty array');
            return [];
        }

        console.log('[draftService] getDrafts: Session found, user ID:', session.user.id);

        // 使用 session 中的 user ID 直接查詢
        const { data, error } = await supabase
            .from('rm_drafts')
            .select('*')
            .eq('user_id', session.user.id)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('[draftService] getDrafts: Query error:', error);
            throw error;
        }

        console.log('[draftService] getDrafts: Found', data?.length || 0, 'drafts');

        // Transform DB schema to Project type
        return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            status: d.status,
            scheduledAt: d.scheduled_at,
            folderId: d.folder_id,
            menus: d.data.menus, // JSONB data contains the menus array
            updatedAt: d.updated_at
        })) as Project[];
    },

    async saveDraft(project: Project) {
        console.log('[draftService] saveDraft: Starting for project:', project.id);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            console.error('[draftService] saveDraft: No session');
            throw new Error('請先登入以儲存草稿');
        }

        const userId = session.user.id;
        console.log('[draftService] saveDraft: User ID:', userId);

        // Helper: Upload Base64 image to Storage
        const uploadImage = async (base64: string, menuId: string): Promise<string> => {
            try {
                // Check if it's already a URL
                if (base64.startsWith('http')) return base64;

                // Decode Base64
                const base64Data = base64.split(',')[1];
                const binaryStr = atob(base64Data);
                const len = binaryStr.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'image/png' });

                // Upload
                const path = `${userId}/${project.id}/${menuId}.png`;
                const { error: uploadError } = await supabase.storage
                    .from('richmenu-images')
                    .upload(path, blob, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Get Public URL with cache busting
                const { data: { publicUrl } } = supabase.storage
                    .from('richmenu-images')
                    .getPublicUrl(path);

                return `${publicUrl}?t=${Date.now()}`;
            } catch (e) {
                console.error('Image upload failed, fallback to base64 (might fail DB save):', e);
                return base64;
            }
        };

        // Process all menus to upload images
        console.log('[draftService] saveDraft: Processing', project.menus.length, 'menus');
        const processedMenus = await Promise.all(project.menus.map(async (menu) => {
            if (menu.imageData && menu.imageData.startsWith('data:image')) {
                const publicUrl = await uploadImage(menu.imageData, menu.id);
                return { ...menu, imageData: publicUrl };
            }
            return menu;
        }));

        // Transform Project to DB schema
        const payload = {
            id: project.id,
            user_id: userId,
            name: project.name,
            status: project.status,
            scheduled_at: project.scheduledAt || null,
            folder_id: project.folderId || null,
            data: { menus: processedMenus }, // Use processed menus with URLs
            updated_at: new Date().toISOString()
        };

        console.log('[draftService] saveDraft: Upserting to database...');
        const { data, error } = await supabase
            .from('rm_drafts')
            .upsert(payload)
            .select()
            .single();

        if (error) {
            console.error('[draftService] saveDraft: Upsert error:', error);
            throw error;
        }

        console.log('[draftService] saveDraft: ✅ Draft saved successfully');
        return data;
    },

    async deleteDraft(id: string) {
        const { error } = await supabase
            .from('rm_drafts')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
