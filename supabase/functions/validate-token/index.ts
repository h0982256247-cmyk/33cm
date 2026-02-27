// Edge Function: Validate LINE Channel Access Token
// 驗證 LINE Channel Access Token 是否有效
// Deploy: supabase functions deploy validate-token

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ValidateRequest {
    accessToken: string;
}

interface ValidateTokenResponse {
    success: boolean;
    data?: {
        valid: boolean;
        botName?: string;
        basicId?: string;
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
        console.log("[validate-token] ===== Request Start =====");

        // Parse request body
        const body: ValidateRequest = await req.json();
        const { accessToken } = body;

        if (!accessToken || typeof accessToken !== "string") {
            console.error("[validate-token] ❌ Missing or invalid accessToken");
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: "INVALID_REQUEST",
                    message: "缺少 accessToken 參數",
                    details: "accessToken is required"
                }
            } as ValidateTokenResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("[validate-token] Token length:", accessToken.length);

        // Call LINE Messaging API to validate token
        console.log("[validate-token] Calling LINE API /v2/bot/info...");
        const lineResponse = await fetch("https://api.line.me/v2/bot/info", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        console.log("[validate-token] LINE API response status:", lineResponse.status);

        if (!lineResponse.ok) {
            const errorText = await lineResponse.text();
            console.error("[validate-token] ❌ LINE API error:", errorText);

            let errorCode = "INVALID_TOKEN";
            let errorMessage = "無效的 Token";

            if (lineResponse.status === 401) {
                errorCode = "INVALID_LINE_TOKEN";
                errorMessage = "LINE Token 無效或已過期";
            }

            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: errorCode,
                    message: errorMessage,
                    details: { status: lineResponse.status, response: errorText }
                }
            } as ValidateTokenResponse), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const data = await lineResponse.json();
        console.log("[validate-token] ✅ Token is valid, bot info:", {
            displayName: data.displayName,
            basicId: data.basicId
        });

        return new Response(JSON.stringify({
            success: true,
            data: {
                valid: true,
                botName: data.displayName || data.basicId,
                basicId: data.basicId
            }
        } as ValidateTokenResponse), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("[validate-token] ❌ Unexpected error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: "UNEXPECTED_ERROR",
                message: "伺服器錯誤",
                details: errorMessage
            }
        } as ValidateTokenResponse), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
