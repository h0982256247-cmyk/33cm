// Edge Function: LINE Broadcast
// 用於發送 Flex Message 推播給所有粉絲
// Deploy: supabase functions deploy broadcast

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BroadcastRequest {
    flexMessages: object[];
    altText?: string;
}

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("[broadcast] ===== Request Start =====");
        console.log("[broadcast] Method:", req.method);
        console.log("[broadcast] URL:", req.url);

        // Check Authorization header
        const authHeader = req.headers.get("Authorization");
        console.log("[broadcast] Authorization header:", authHeader ? `Present (${authHeader.substring(0, 20)}...)` : "MISSING");

        if (!authHeader) {
            console.error("[broadcast] ❌ Missing Authorization header");
            return new Response(JSON.stringify({
                success: false,
                error: "Missing Authorization header - 請確認已登入"
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[broadcast] ✅ Authorization header present");

        // Check environment variables
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        console.log("[broadcast] SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ MISSING");
        console.log("[broadcast] SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ MISSING");

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error("[broadcast] ❌ Missing environment variables");
            return new Response(JSON.stringify({
                success: false,
                error: "Server configuration error - missing environment variables"
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get Supabase client
        console.log("[broadcast] Creating Supabase client...");
        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                global: { headers: { Authorization: authHeader } },
            }
        );
        console.log("[broadcast] ✅ Supabase client created");

        // Verify user
        console.log("[broadcast] Verifying user with getUser()...");
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError) {
            console.error("[broadcast] ❌ getUser() error:", userError);
            console.error("[broadcast] Error details:", JSON.stringify(userError, null, 2));
            return new Response(JSON.stringify({
                success: false,
                error: "認證失敗 - getUser() error",
                details: userError?.message
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!user) {
            console.error("[broadcast] ❌ No user returned from getUser()");
            return new Response(JSON.stringify({
                success: false,
                error: "認證失敗 - No user found",
                details: "getUser() returned null"
            }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[broadcast] ✅ User verified:", user.id);

        // Get LINE token via Service Role (bypasses RLS)
        console.log("[broadcast] Fetching LINE token...");
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

        if (tokenError) {
            console.error("[broadcast] ❌ LINE token fetch error:", tokenError);
            return new Response(JSON.stringify({
                success: false,
                error: "無法取得 LINE Token",
                details: tokenError.message
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!channelData || !channelData.access_token_encrypted) {
            console.error("[broadcast] ❌ LINE token not found in database");
            return new Response(JSON.stringify({
                success: false,
                error: "LINE Token 未設定，請先綁定 LINE Channel"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const lineToken = channelData.access_token_encrypted;
        console.log("[broadcast] ✅ LINE token retrieved, length:", lineToken.length);

        // Parse request body
        const body = await req.json();
        const { flexMessages, altText = "您收到新訊息" }: BroadcastRequest = body;

        if (!flexMessages || flexMessages.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "沒有提供訊息內容"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // LINE 官方限制：Broadcast 一次最多 5 則訊息
        if (flexMessages.length > 5) {
            return new Response(JSON.stringify({
                success: false,
                error: "LINE 官方限制：一次最多只能廣播 5 則訊息",
                provided: flexMessages.length
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`[broadcast] Processing ${flexMessages.length} message(s)`);

        // Build LINE messages
        const messages = flexMessages.map((flex) => ({
            type: "flex",
            altText,
            contents: flex,
        }));

        // Call LINE Messaging API
        console.log("[broadcast] Calling LINE Messaging API...");
        const lineResponse = await fetch("https://api.line.me/v2/bot/message/broadcast", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lineToken}`,
            },
            body: JSON.stringify({ messages }),
        });

        console.log("[broadcast] LINE API response status:", lineResponse.status);

        if (!lineResponse.ok) {
            const errorText = await lineResponse.text();
            console.error("[broadcast] ❌ LINE API error:", errorText);
            return new Response(JSON.stringify({
                success: false,
                error: "LINE API 呼叫失敗",
                details: errorText,
                lineStatus: lineResponse.status
            }), {
                status: lineResponse.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[broadcast] ✅ Broadcast successful");

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("[broadcast] ❌❌❌ Unexpected error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({
            success: false,
            error: errorMessage,
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
