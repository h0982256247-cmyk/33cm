// Edge Function: publish-richmenu
// 用於發布 Rich Menu 至 LINE 官方帳號
// Deploy: supabase functions deploy publish-richmenu

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINE_API = "https://api.line.me/v2/bot";

interface PublishRichMenuResponse {
    success: boolean;
    data?: {
        results: Array<{ aliasId: string; richMenuId: string }>;
        publishedAt: string;
    };
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("[publish-richmenu] ===== Request Start =====");

        // Check Authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "UNAUTHORIZED",
                    message: "請先登入",
                    details: "Missing Authorization header"
                }
            } as PublishRichMenuResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Check environment variables
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "CONFIG_ERROR",
                    message: "伺服器配置錯誤",
                    details: "Missing environment variables"
                }
            } as PublishRichMenuResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Create Supabase client with user auth
        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            { global: { headers: { Authorization: authHeader } } }
        );

        // Verify user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "AUTH_FAILED",
                    message: "認證失敗",
                    details: userError?.message || "No user found"
                }
            } as PublishRichMenuResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[publish-richmenu] ✅ User:", user.id);

        // Get LINE token via Service Role (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        const { data: channelData, error: tokenError } = await supabaseAdmin
            .from("rm_line_channels")
            .select("access_token_encrypted")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .single();

        if (tokenError || !channelData?.access_token_encrypted) {
            console.error("[publish-richmenu] ❌ Token error:", tokenError);
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "TOKEN_NOT_FOUND",
                    message: "LINE Token 未設定，請先綁定 LINE Channel",
                    details: tokenError?.message
                }
            } as PublishRichMenuResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const lineToken = channelData.access_token_encrypted;
        console.log("[publish-richmenu] ✅ LINE token retrieved");

        // Parse request body
        const body = await req.json();
        const { menus, cleanOldMenus } = body;

        if (!menus || menus.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "INVALID_REQUEST",
                    message: "沒有提供選單資料",
                    details: "menus is empty"
                }
            } as PublishRichMenuResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const lineHeaders = {
            Authorization: `Bearer ${lineToken}`,
            "Content-Type": "application/json",
        };

        // Step 1: Clean old menus (only on first batch)
        if (cleanOldMenus) {
            console.log("[publish-richmenu] Cleaning old Rich Menus...");
            try {
                const listRes = await fetch(`${LINE_API}/richmenu/list`, {
                    headers: { Authorization: `Bearer ${lineToken}` },
                });
                if (listRes.ok) {
                    const listData = await listRes.json();
                    const existingMenus = listData.richmenus || [];
                    console.log(`[publish-richmenu] Found ${existingMenus.length} existing menus`);

                    for (const existing of existingMenus) {
                        try {
                            await fetch(`${LINE_API}/richmenu/${existing.richMenuId}`, {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${lineToken}` },
                            });
                            console.log(`[publish-richmenu] Deleted: ${existing.richMenuId}`);
                        } catch (e) {
                            console.warn(`[publish-richmenu] Failed to delete: ${existing.richMenuId}`, e);
                        }
                    }

                    // Also clean aliases
                    for (const existing of existingMenus) {
                        try {
                            const aliasId = existing.name?.replace(/-/g, "") || "";
                            if (aliasId) {
                                await fetch(`${LINE_API}/richmenu/alias/${aliasId}`, {
                                    method: "DELETE",
                                    headers: { Authorization: `Bearer ${lineToken}` },
                                });
                            }
                        } catch (_e) {
                            // Ignore alias deletion errors
                        }
                    }
                }
            } catch (e) {
                console.warn("[publish-richmenu] Clean old menus error (non-fatal):", e);
            }
        }

        // Step 2: Create and publish each menu
        const results: { aliasId: string; richMenuId: string }[] = [];

        for (const menuItem of menus) {
            const { menuData, imageBase64, aliasId, isMain } = menuItem;

            console.log(`[publish-richmenu] Creating Rich Menu: ${menuData.name}, alias: ${aliasId}`);

            // 2a. Create Rich Menu
            const createRes = await fetch(`${LINE_API}/richmenu`, {
                method: "POST",
                headers: lineHeaders,
                body: JSON.stringify(menuData),
            });

            if (!createRes.ok) {
                const errText = await createRes.text();
                console.error("[publish-richmenu] ❌ Create failed:", errText);

                let errorCode = "LINE_API_ERROR";
                let errorMessage = "建立 Rich Menu 失敗";

                if (createRes.status === 401) {
                    errorCode = "INVALID_LINE_TOKEN";
                    errorMessage = "LINE Token 無效或已過期";
                } else if (createRes.status === 400) {
                    errorCode = "INVALID_MENU_DATA";
                    errorMessage = "選單資料格式錯誤";
                }

                return new Response(JSON.stringify({
                    success: false,
                    error: {
                        code: errorCode,
                        message: errorMessage,
                        details: { status: createRes.status, response: errText }
                    }
                } as PublishRichMenuResponse), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const createData = await createRes.json();
            const richMenuId = createData.richMenuId;
            console.log(`[publish-richmenu] ✅ Created: ${richMenuId}`);

            // 2b. Upload image
            if (imageBase64) {
                console.log(`[publish-richmenu] Uploading image for ${richMenuId}...`);

                // Convert base64 to binary
                const base64Data = imageBase64.includes(",")
                    ? imageBase64.split(",")[1]
                    : imageBase64;
                const binaryStr = atob(base64Data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }

                const uploadRes = await fetch(
                    `${LINE_API}/richmenu/${richMenuId}/content`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${lineToken}`,
                            "Content-Type": "image/png",
                        },
                        body: bytes,
                    }
                );

                if (!uploadRes.ok) {
                    const errText = await uploadRes.text();
                    console.error("[publish-richmenu] ❌ Image upload failed:", errText);
                    return new Response(JSON.stringify({
                        success: false,
                        error: {
                            code: "IMAGE_UPLOAD_FAILED",
                            message: "上傳圖片失敗",
                            details: { status: uploadRes.status, response: errText }
                        }
                    } as PublishRichMenuResponse), {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
                console.log(`[publish-richmenu] ✅ Image uploaded for ${richMenuId}`);
            }

            // 2c. Create or update alias
            if (aliasId) {
                console.log(`[publish-richmenu] Setting alias: ${aliasId} -> ${richMenuId}`);

                // Try to update existing alias first
                const updateAliasRes = await fetch(`${LINE_API}/richmenu/alias/${aliasId}`, {
                    method: "POST",
                    headers: lineHeaders,
                    body: JSON.stringify({ richMenuAliasId: aliasId, richMenuId }),
                });

                if (!updateAliasRes.ok) {
                    // If update fails, try to create new alias
                    const createAliasRes = await fetch(`${LINE_API}/richmenu/alias`, {
                        method: "POST",
                        headers: lineHeaders,
                        body: JSON.stringify({ richMenuAliasId: aliasId, richMenuId }),
                    });

                    if (!createAliasRes.ok) {
                        const errText = await createAliasRes.text();
                        console.warn(`[publish-richmenu] ⚠️ Alias creation failed (non-fatal): ${errText}`);
                        // Non-fatal: continue without alias
                    } else {
                        console.log(`[publish-richmenu] ✅ Alias created: ${aliasId}`);
                    }
                } else {
                    console.log(`[publish-richmenu] ✅ Alias updated: ${aliasId}`);
                }
            }

            // 2d. If main menu, set as default
            if (isMain) {
                console.log(`[publish-richmenu] Setting ${richMenuId} as default...`);
                const defaultRes = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${lineToken}` },
                });

                if (!defaultRes.ok) {
                    const errText = await defaultRes.text();
                    console.warn(`[publish-richmenu] ⚠️ Set default failed: ${errText}`);
                } else {
                    console.log(`[publish-richmenu] ✅ Default menu set: ${richMenuId}`);
                }
            }

            results.push({ aliasId, richMenuId });
        }

        console.log("[publish-richmenu] ✅ All menus published successfully");

        return new Response(JSON.stringify({
            success: true,
            data: {
                results,
                publishedAt: new Date().toISOString()
            }
        } as PublishRichMenuResponse), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("[publish-richmenu] ❌❌❌ Unexpected error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: "UNEXPECTED_ERROR",
                message: "伺服器錯誤",
                details: errorMessage
            }
        } as PublishRichMenuResponse), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
