
import { supabase } from '@/lib/supabase';
import { Project, Folder } from '@/lib/richmenuTypes';

export const draftService = {
    // --- Folders ---
    async getFolders() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('rm_folders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data as Folder[];
    },

    async createFolder(name: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('rm_folders')
            .insert({
                user_id: user.id,
                name
            })
            .select()
            .single();

        if (error) throw error;
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return []; // Allow viewing app as guest but return empty

        const { data, error } = await supabase
            .from('rm_drafts')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('請先登入以儲存草稿');

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
                const path = `${user.id}/${project.id}/${menuId}.png`;
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
            user_id: user.id,
            name: project.name,
            status: project.status,
            scheduled_at: project.scheduledAt || null,
            folder_id: project.folderId || null,
            data: { menus: processedMenus }, // Use processed menus with URLs
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('rm_drafts')
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
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
