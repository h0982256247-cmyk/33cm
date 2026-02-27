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

interface BroadcastResponse {
    success: boolean;
    data?: {
        messageCount: number;
        sentAt: string;
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
        console.log("[broadcast] ===== Request Start =====");

        // Check Authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            console.error("[broadcast] ❌ Missing Authorization header");
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "UNAUTHORIZED",
                    message: "請先登入",
                    details: "Missing Authorization header"
                }
            } as BroadcastResponse), {
                status: 200, // 統一返回 200
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Check environment variables
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
            console.error("[broadcast] ❌ Missing environment variables");
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "CONFIG_ERROR",
                    message: "伺服器配置錯誤",
                    details: "Missing environment variables"
                }
            } as BroadcastResponse), {
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
            console.error("[broadcast] ❌ User verification failed:", userError);
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "AUTH_FAILED",
                    message: "認證失敗",
                    details: userError?.message || "No user found"
                }
            } as BroadcastResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[broadcast] ✅ User verified:", user.id);

        // Get LINE token via Service Role (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        const { data: channelData, error: tokenError } = await supabaseAdmin
            .from("rm_line_channels")
            .select("access_token_encrypted")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .single();

        if (tokenError || !channelData?.access_token_encrypted) {
            console.error("[broadcast] ❌ LINE token not found:", tokenError);
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "TOKEN_NOT_FOUND",
                    message: "LINE Token 未設定，請先綁定 LINE Channel",
                    details: tokenError?.message
                }
            } as BroadcastResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const lineToken = channelData.access_token_encrypted;
        console.log("[broadcast] ✅ LINE token retrieved");

        // Parse request body
        const body: BroadcastRequest = await req.json();
        const { flexMessages, altText = "您收到新訊息" } = body;

        if (!flexMessages || flexMessages.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "INVALID_REQUEST",
                    message: "沒有提供訊息內容",
                    details: "flexMessages is empty"
                }
            } as BroadcastResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // LINE 官方限制：Broadcast 一次最多 5 則訊息
        if (flexMessages.length > 5) {
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "TOO_MANY_MESSAGES",
                    message: "LINE 官方限制：一次最多只能廣播 5 則訊息",
                    details: `Provided: ${flexMessages.length}, Maximum: 5`
                }
            } as BroadcastResponse), {
                status: 200,
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

            // 解析 LINE API 錯誤
            let errorCode = "LINE_API_ERROR";
            let errorMessage = "LINE API 呼叫失敗";

            if (lineResponse.status === 401) {
                errorCode = "INVALID_LINE_TOKEN";
                errorMessage = "LINE Token 無效或已過期";
            } else if (lineResponse.status === 403) {
                errorCode = "LINE_API_FORBIDDEN";
                errorMessage = "沒有權限執行此操作";
            } else if (lineResponse.status === 429) {
                errorCode = "RATE_LIMIT_EXCEEDED";
                errorMessage = "發送頻率過高，請稍後再試";
            }

            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: errorCode,
                    message: errorMessage,
                    details: {
                        status: lineResponse.status,
                        response: errorText
                    }
                }
            } as BroadcastResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[broadcast] ✅ Broadcast successful");

        return new Response(JSON.stringify({
            success: true,
            data: {
                messageCount: flexMessages.length,
                sentAt: new Date().toISOString()
            }
        } as BroadcastResponse), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("[broadcast] ❌❌❌ Unexpected error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: "UNEXPECTED_ERROR",
                message: "伺服器錯誤",
                details: errorMessage
            }
        } as BroadcastResponse), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
