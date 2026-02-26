/**
 * Supabase 客戶端最佳實踐範例
 *
 * 這個檔案展示如何正確設置和使用 Supabase 客戶端
 */

import { createClient, SupabaseClient, Session, User } from "@supabase/supabase-js";

// ======================
// 類型定義
// ======================

// 從 Supabase 生成的類型（使用 supabase gen types typescript）
interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string | null;
                    avatar_url: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                };
                Update: {
                    email?: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                };
            };
            posts: {
                Row: {
                    id: string;
                    title: string;
                    content: string;
                    author_id: string;
                    status: "draft" | "published";
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    title: string;
                    content: string;
                    author_id?: string;
                    status?: "draft" | "published";
                };
                Update: {
                    title?: string;
                    content?: string;
                    status?: "draft" | "published";
                };
            };
        };
        Functions: {
            get_user_stats: {
                Args: { user_uuid: string };
                Returns: { total_posts: number; total_likes: number };
            };
        };
    };
}

// ======================
// 客戶端初始化
// ======================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 帶類型的客戶端
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
    global: {
        headers: {
            "x-application-name": "my-app",
        },
    },
    db: {
        schema: "public",
    },
});

// ======================
// 認證服務
// ======================

export class AuthService {
    private supabase: SupabaseClient<Database>;

    constructor(client: SupabaseClient<Database>) {
        this.supabase = client;
    }

    // 註冊新用戶
    async signUp(email: string, password: string, metadata?: Record<string, unknown>) {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) throw error;
        return data;
    }

    // 登入
    async signIn(email: string, password: string) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        return data;
    }

    // OAuth 登入
    async signInWithOAuth(provider: "google" | "github" | "facebook") {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) throw error;
        return data;
    }

    // 魔法連結登入
    async signInWithMagicLink(email: string) {
        const { data, error } = await this.supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) throw error;
        return data;
    }

    // 登出
    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    // 獲取當前用戶
    async getCurrentUser(): Promise<User | null> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();
        return user;
    }

    // 獲取當前 session
    async getSession(): Promise<Session | null> {
        const {
            data: { session },
        } = await this.supabase.auth.getSession();
        return session;
    }

    // 監聽認證狀態變化
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        return this.supabase.auth.onAuthStateChange(callback);
    }

    // 重設密碼
    async resetPassword(email: string) {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) throw error;
    }

    // 更新密碼
    async updatePassword(newPassword: string) {
        const { error } = await this.supabase.auth.updateUser({
            password: newPassword,
        });

        if (error) throw error;
    }
}

// ======================
// 資料庫服務
// ======================

export class DatabaseService {
    private supabase: SupabaseClient<Database>;

    constructor(client: SupabaseClient<Database>) {
        this.supabase = client;
    }

    // 獲取所有文章（帶分頁）
    async getPosts(page: number = 1, limit: number = 10) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await this.supabase
            .from("posts")
            .select("*, profiles!author_id(full_name, avatar_url)", { count: "exact" })
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            posts: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        };
    }

    // 獲取單篇文章
    async getPost(id: string) {
        const { data, error } = await this.supabase
            .from("posts")
            .select("*, profiles!author_id(full_name, avatar_url)")
            .eq("id", id)
            .single();

        if (error) throw error;
        return data;
    }

    // 建立文章
    async createPost(post: Database["public"]["Tables"]["posts"]["Insert"]) {
        const { data, error } = await this.supabase
            .from("posts")
            .insert(post)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // 更新文章
    async updatePost(id: string, updates: Database["public"]["Tables"]["posts"]["Update"]) {
        const { data, error } = await this.supabase
            .from("posts")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // 刪除文章
    async deletePost(id: string) {
        const { error } = await this.supabase.from("posts").delete().eq("id", id);

        if (error) throw error;
    }

    // 呼叫資料庫函數
    async getUserStats(userId: string) {
        const { data, error } = await this.supabase.rpc("get_user_stats", {
            user_uuid: userId,
        });

        if (error) throw error;
        return data;
    }

    // 搜尋文章
    async searchPosts(query: string) {
        const { data, error } = await this.supabase
            .from("posts")
            .select("id, title, created_at")
            .textSearch("title", query, {
                type: "websearch",
                config: "english",
            })
            .limit(10);

        if (error) throw error;
        return data;
    }
}

// ======================
// 即時訂閱服務
// ======================

export class RealtimeService {
    private supabase: SupabaseClient<Database>;

    constructor(client: SupabaseClient<Database>) {
        this.supabase = client;
    }

    // 訂閱文章變更
    subscribeToPostChanges(callback: (payload: any) => void) {
        const channel = this.supabase
            .channel("posts-changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "posts",
                },
                callback
            )
            .subscribe();

        return () => {
            this.supabase.removeChannel(channel);
        };
    }

    // 訂閱特定文章的評論
    subscribeToComments(postId: string, callback: (payload: any) => void) {
        const channel = this.supabase
            .channel(`comments-${postId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "comments",
                    filter: `post_id=eq.${postId}`,
                },
                callback
            )
            .subscribe();

        return () => {
            this.supabase.removeChannel(channel);
        };
    }

    // 廣播訊息（無需資料庫）
    createBroadcastChannel(channelName: string) {
        const channel = this.supabase.channel(channelName);

        return {
            subscribe: (event: string, callback: (payload: any) => void) => {
                channel.on("broadcast", { event }, callback).subscribe();
            },
            send: (event: string, payload: any) => {
                channel.send({
                    type: "broadcast",
                    event,
                    payload,
                });
            },
            unsubscribe: () => {
                this.supabase.removeChannel(channel);
            },
        };
    }

    // Presence 在線狀態
    createPresenceChannel(roomId: string, userInfo: Record<string, unknown>) {
        const channel = this.supabase.channel(`presence-${roomId}`);

        return {
            track: async () => {
                await channel.subscribe(async (status) => {
                    if (status === "SUBSCRIBED") {
                        await channel.track(userInfo);
                    }
                });
            },
            onSync: (callback: (state: Record<string, any>) => void) => {
                channel.on("presence", { event: "sync" }, () => {
                    const state = channel.presenceState();
                    callback(state);
                });
            },
            onJoin: (callback: (key: string, newPresences: any[]) => void) => {
                channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
                    callback(key, newPresences);
                });
            },
            onLeave: (callback: (key: string, leftPresences: any[]) => void) => {
                channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
                    callback(key, leftPresences);
                });
            },
            unsubscribe: () => {
                this.supabase.removeChannel(channel);
            },
        };
    }
}

// ======================
// 儲存服務
// ======================

export class StorageService {
    private supabase: SupabaseClient<Database>;

    constructor(client: SupabaseClient<Database>) {
        this.supabase = client;
    }

    // 上傳檔案
    async uploadFile(bucket: string, path: string, file: File, options?: { upsert?: boolean }) {
        const { data, error } = await this.supabase.storage.from(bucket).upload(path, file, {
            cacheControl: "3600",
            upsert: options?.upsert ?? false,
        });

        if (error) throw error;
        return data;
    }

    // 獲取公開 URL
    getPublicUrl(bucket: string, path: string): string {
        const {
            data: { publicUrl },
        } = this.supabase.storage.from(bucket).getPublicUrl(path);
        return publicUrl;
    }

    // 獲取簽名 URL（私有檔案）
    async getSignedUrl(bucket: string, path: string, expiresIn: number = 3600) {
        const { data, error } = await this.supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);

        if (error) throw error;
        return data.signedUrl;
    }

    // 下載檔案
    async downloadFile(bucket: string, path: string) {
        const { data, error } = await this.supabase.storage.from(bucket).download(path);

        if (error) throw error;
        return data;
    }

    // 刪除檔案
    async deleteFile(bucket: string, paths: string[]) {
        const { error } = await this.supabase.storage.from(bucket).remove(paths);

        if (error) throw error;
    }

    // 列出資料夾內容
    async listFiles(bucket: string, folder: string, options?: { limit?: number; offset?: number }) {
        const { data, error } = await this.supabase.storage.from(bucket).list(folder, {
            limit: options?.limit ?? 100,
            offset: options?.offset ?? 0,
            sortBy: { column: "created_at", order: "desc" },
        });

        if (error) throw error;
        return data;
    }

    // 上傳頭像（帶驗證）
    async uploadAvatar(userId: string, file: File) {
        // 驗證檔案類型
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            throw new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
        }

        // 驗證檔案大小（最大 5MB）
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error("File too large. Maximum size is 5MB.");
        }

        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/avatar.${fileExt}`;

        return this.uploadFile("avatars", filePath, file, { upsert: true });
    }
}

// ======================
// 導出服務實例
// ======================

export const authService = new AuthService(supabase);
export const databaseService = new DatabaseService(supabase);
export const realtimeService = new RealtimeService(supabase);
export const storageService = new StorageService(supabase);
