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
    id: string;
    name: string;
    barText: string;
    isMain: boolean;
    imageData: string; // Base64 or URL
    aliasId?: string;
    hotspots: {
        x: number;
        y: number;
        width: number;
        height: number;
        action: { type: string; data: string };
    }[];
}

interface PublishRequest {
    menus: MenuData[];
    setAsDefault: boolean;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Get Supabase client
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: { headers: { Authorization: req.headers.get("Authorization")! } },
            }
        );

        // Verify user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get LINE token
        const { data: tokenData, error: tokenError } = await supabaseClient.rpc("get_line_token");
        if (tokenError || !tokenData) {
            return new Response(JSON.stringify({ error: "LINE Token not found" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const accessToken = tokenData as string;
        const { menus, setAsDefault }: PublishRequest = await req.json();
        const results: { menuId: string; richMenuId: string; aliasId: string }[] = [];

        for (const menu of menus) {
            // 1. Create Rich Menu
            const areas: RichMenuArea[] = menu.hotspots.map((h) => ({
                bounds: { x: h.x, y: h.y, width: h.width, height: h.height },
                action: buildAction(h.action),
            }));

            const richMenuPayload: RichMenuPayload = {
                size: { width: 2500, height: 1686 },
                selected: menu.isMain,
                name: menu.name,
                chatBarText: menu.barText || "選單",
                areas: areas.length > 0 ? areas : [{
                    bounds: { x: 0, y: 0, width: 2500, height: 1686 },
                    action: { type: "message", text: "選單" }
                }],
            };

            const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(richMenuPayload),
            });

            if (!createRes.ok) {
                const errorText = await createRes.text();
                throw new Error(`Create Rich Menu failed: ${errorText}`);
            }

            const { richMenuId } = await createRes.json();

            // 2. Upload Image
            let imageBlob: Blob;
            if (menu.imageData.startsWith("data:image")) {
                const base64Data = menu.imageData.split(",")[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                imageBlob = new Blob([bytes], { type: "image/png" });
            } else {
                // Download from URL
                const imgRes = await fetch(menu.imageData);
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
                throw new Error(`Upload image failed: ${errorText}`);
            }

            // 3. Create/Update Alias
            const aliasId = menu.aliasId || `menu_${menu.id}`;

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
            if (menu.isMain && setAsDefault) {
                await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
            }

            results.push({ menuId: menu.id, richMenuId, aliasId });
        }

        return new Response(JSON.stringify({ success: true, results }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Publish Rich Menu error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

function buildAction(action: { type: string; data: string }) {
    switch (action.type) {
        case "message":
            return { type: "message", text: action.data };
        case "uri":
            return { type: "uri", uri: action.data };
        case "postback":
            return { type: "postback", data: action.data };
        case "switch":
        case "richmenuswitch":
            return { type: "richmenuswitch", richMenuAliasId: action.data, data: action.data };
        default:
            return { type: "message", text: action.data || "menu" };
    }
}
