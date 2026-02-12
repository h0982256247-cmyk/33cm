// Edge Function: Publish Rich Menu
// 用於發布 Rich Menu 到 LINE（建立 + 上傳圖片 + 設定別名）
// Deploy: supabase functions deploy publish-richmenu

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RichMenuSize {
    width: number;
    height: number;
}

interface RichMenuArea {
    bounds: { x: number; y: number; width: number; height: number };
    action: { type: string; data?: string; text?: string; uri?: string; richMenuAliasId?: string };
}

interface RichMenuPayload {
    size: RichMenuSize;
    selected: boolean;
    name: string;
    chatBarText: string;
    areas: RichMenuArea[];
}

interface MenuData {
    menuData: RichMenuPayload;  // Already converted to LINE API format by frontend
    imageBase64: string | null;
    aliasId: string;
    isMain: boolean;
}

interface PublishRequest {
    menus: MenuData[];
    cleanOldMenus?: boolean;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Log incoming request
        console.log("[publish-richmenu] Request received");

        // Check Authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            console.error("[publish-richmenu] Missing Authorization header");
            return new Response(JSON.stringify({
                error: "Missing Authorization header - 請確認已登入"
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[publish-richmenu] Authorization header exists:", authHeader.substring(0, 20) + "...");

        // Get Supabase client
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: { headers: { Authorization: authHeader } },
            }
        );

        // Verify user
        console.log("[publish-richmenu] Verifying user...");
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError) {
            console.error("[publish-richmenu] Auth error:", userError.message);
            return new Response(JSON.stringify({
                error: "認證失敗 - 請重新登入",
                details: userError.message
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!user) {
            console.error("[publish-richmenu] No user found");
            return new Response(JSON.stringify({
                error: "找不到使用者 - 請重新登入"
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[publish-richmenu] User verified:", user.id);

        // Get LINE token
        const { data: tokenData, error: tokenError } = await supabaseClient.rpc("get_line_token");
        if (tokenError || !tokenData) {
            return new Response(JSON.stringify({ error: "LINE Token not found" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const accessToken = tokenData as string;
        const { menus }: PublishRequest = await req.json();
        const results: { aliasId: string; richMenuId: string }[] = [];

        for (const menu of menus) {
            // 1. Create Rich Menu using pre-converted menuData from frontend
            const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(menu.menuData),
            });

            if (!createRes.ok) {
                const errorText = await createRes.text();
                throw new Error(`Create Rich Menu failed for ${menu.menuData.name}: ${errorText}`);
            }

            const { richMenuId } = await createRes.json();

            // 2. Upload Image
            if (!menu.imageBase64) {
                throw new Error(`No image data for menu: ${menu.menuData.name}`);
            }

            let imageBlob: Blob;
            if (menu.imageBase64.startsWith("data:image")) {
                const base64Data = menu.imageBase64.split(",")[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                imageBlob = new Blob([bytes], { type: "image/png" });
            } else {
                // Download from URL
                const imgRes = await fetch(menu.imageBase64);
                imageBlob = await imgRes.blob();
            }

            const uploadRes = await fetch(
                `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "image/png",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: imageBlob,
                }
            );

            if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`Upload image failed for ${menu.menuData.name}: ${errorText}`);
            }

            // 3. Create/Update Alias
            const aliasId = menu.aliasId;

            // Try delete existing alias first
            await fetch(`https://api.line.me/v2/bot/richmenu/alias/${aliasId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            const aliasRes = await fetch("https://api.line.me/v2/bot/richmenu/alias", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ richMenuAliasId: aliasId, richMenuId }),
            });

            if (!aliasRes.ok) {
                console.warn(`Alias creation warning: ${await aliasRes.text()}`);
            }

            // 4. Set as default if main menu
            if (menu.isMain) {
                await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
            }

            results.push({ aliasId, richMenuId });

            // 5. Record to database
            const supabaseAdmin = createClient(
                Deno.env.get("SUPABASE_URL") ?? "",
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
            );

            const { error: recordError } = await supabaseAdmin.rpc("record_rich_menu_published", {
                p_channel_owner_id: user.id,
                p_draft_id: null,  // Could be passed from frontend if needed
                p_rich_menu_id: richMenuId,
                p_rich_menu_alias_id: aliasId,
                p_name: menu.menuData.name,
                p_chat_bar_text: menu.menuData.chatBarText,
                p_menu_data: menu.menuData,
                p_image_url: menu.imageBase64?.startsWith("data:") ? null : menu.imageBase64,
                p_is_default: menu.isMain,
            });

            if (recordError) {
                console.warn("Failed to record menu to database:", recordError);
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Publish Rich Menu error:", error);

        // 提供更詳細的錯誤資訊
        const errorDetails = {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            type: error instanceof Error ? error.constructor.name : typeof error,
            raw: JSON.stringify(error, Object.getOwnPropertyNames(error))
        };

        console.error("Error details:", errorDetails);

        return new Response(JSON.stringify({
            success: false,
            error: errorDetails.message,
            errorDetails: errorDetails
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
