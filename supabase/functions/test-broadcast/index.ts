// 極簡測試版本 - 確認 Edge Function 基本功能
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    console.log("======================");
    console.log("[test-broadcast] 🎯 Function started!");
    console.log("[test-broadcast] Method:", req.method);

    if (req.method === "OPTIONS") {
        console.log("[test-broadcast] CORS preflight");
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 檢查環境變數
        const envVars = {
            SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
            SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
            SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        };

        console.log("[test-broadcast] Environment variables:");
        console.log("  SUPABASE_URL:", envVars.SUPABASE_URL ? "✅ Set" : "❌ MISSING");
        console.log("  SUPABASE_ANON_KEY:", envVars.SUPABASE_ANON_KEY ? "✅ Set" : "❌ MISSING");
        console.log("  SUPABASE_SERVICE_ROLE_KEY:", envVars.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ MISSING");

        // 檢查 Authorization header
        const authHeader = req.headers.get("Authorization");
        console.log("[test-broadcast] Authorization header:", authHeader ? "✅ Present" : "❌ MISSING");

        return new Response(JSON.stringify({
            success: true,
            message: "Test passed!",
            environment: {
                hasUrl: !!envVars.SUPABASE_URL,
                hasAnonKey: !!envVars.SUPABASE_ANON_KEY,
                hasServiceRoleKey: !!envVars.SUPABASE_SERVICE_ROLE_KEY,
            },
            request: {
                hasAuthHeader: !!authHeader,
                method: req.method,
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("[test-broadcast] ❌ Error:", error);
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
