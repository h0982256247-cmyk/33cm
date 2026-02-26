// Edge Function: publish-richmenu
// 用於發布 Rich Menu 至 LINE 官方帳號
// Deploy: supabase functions deploy publish-richmenu

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINE_API = "https://api.line.me/v2/bot";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("[publish-richmenu] ===== Request Start =====");

        // Auth
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, error: "Missing Authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            return new Response(
                JSON.stringify({ success: false, error: "認證失敗 - 請重新登入" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        console.log("[publish-richmenu] ✅ User:", user.id);

        // Get LINE token via Service Role (bypasses RLS)
        console.log("[publish-richmenu] Fetching LINE token...");
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: channelData, error: tokenError } = await supabaseAdmin
            .from("rm_line_channels")
            .select("access_token_encrypted")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .single();

        if (tokenError || !channelData || !channelData.access_token_encrypted) {
            console.error("[publish-richmenu] ❌ Token error:", tokenError);
            return new Response(
                JSON.stringify({ success: false, error: "LINE Token 未設定，請先綁定 LINE Channel" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const lineToken = channelData.access_token_encrypted;
        console.log("[publish-richmenu] ✅ LINE token retrieved, length:", lineToken.length);

        // Parse body
        const body = await req.json();
        const { menus, cleanOldMenus } = body;

        if (!menus || menus.length === 0) {
            return new Response(
                JSON.stringify({ success: false, error: "沒有提供選單資料" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
                            // Delete rich menu alias if it exists (ignore errors)
                            const aliasId = existing.name?.replace(/-/g, "") || "";
                            if (aliasId) {
                                await fetch(
                                    `${LINE_API}/richmenu/alias/${aliasId}`,
                                    {
                                        method: "DELETE",
                                        headers: { Authorization: `Bearer ${lineToken}` },
                                    }
                                );
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
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: `建立 Rich Menu 失敗: ${errText}`,
                        lineStatus: createRes.status,
                    }),
                    {
                        status: createRes.status,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
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
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: `上傳圖片失敗: ${errText}`,
                            lineStatus: uploadRes.status,
                        }),
                        {
                            status: uploadRes.status,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        }
                    );
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
        console.log("[publish-richmenu] ===== Request End =====");

        return new Response(
            JSON.stringify({ success: true, results }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: unknown) {
        console.error("[publish-richmenu] ❌❌❌ Unexpected error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
