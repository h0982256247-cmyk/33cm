// Edge Function: LINE Broadcast
// 用於發送 Flex Message 推播給所有粉絲
// Deploy: supabase functions deploy broadcast

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
    flexMessages: object[];
    altText?: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Log incoming request
        console.log("[broadcast] Request received");

        // Check Authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            console.error("[broadcast] Missing Authorization header");
            return new Response(JSON.stringify({
                error: "Missing Authorization header - 請確認已登入"
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[broadcast] Authorization header exists");

        // Get Supabase client
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: { headers: { Authorization: authHeader } },
            }
        );

        // Verify user
        console.log("[broadcast] Verifying user...");
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError) {
            console.error("[broadcast] Auth error:", userError.message);
            return new Response(JSON.stringify({
                error: "認證失敗 - 請重新登入",
                details: userError.message
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!user) {
            console.error("[broadcast] No user found");
            return new Response(JSON.stringify({
                error: "找不到使用者 - 請重新登入"
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[broadcast] User verified:", user.id);

        // Get LINE token
        const { data: tokenData, error: tokenError } = await supabaseClient.rpc("get_line_token");
        if (tokenError || !tokenData) {
            return new Response(JSON.stringify({ error: "LINE Token not found" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Parse request body
        const { flexMessages, altText = "您收到新訊息" }: BroadcastRequest = await req.json();

        if (!flexMessages || flexMessages.length === 0) {
            return new Response(JSON.stringify({ error: "No messages provided" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // LINE 官方限制：Broadcast 一次最多 5 則訊息
        if (flexMessages.length > 5) {
            console.warn(`[broadcast] Message count exceeds limit: ${flexMessages.length}`);
            return new Response(JSON.stringify({
                error: "LINE 官方限制：一次最多只能廣播 5 則訊息",
                provided: flexMessages.length
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Build LINE messages
        const messages = flexMessages.map((flex) => ({
            type: "flex",
            altText,
            contents: flex,
        }));

        // Call LINE Messaging API
        const lineResponse = await fetch("https://api.line.me/v2/bot/message/broadcast", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenData}`,
            },
            body: JSON.stringify({ messages }),
        });

        if (!lineResponse.ok) {
            const errorText = await lineResponse.text();
            return new Response(JSON.stringify({ error: "LINE API Error", details: errorText }), {
                status: lineResponse.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Success
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Broadcast error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
