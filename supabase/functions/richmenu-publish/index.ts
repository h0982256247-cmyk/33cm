import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_API = "https://api.line.me/v2/bot";

interface PublishMenuRequest {
  menuData: any;
  imageBase64: string | null;
  aliasId: string;
  isMain: boolean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function requireEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

serve(async (req) => {
  try {
    console.log("[richmenu-publish] ===== Request Start =====", req.method);

    // CORS preflight
    if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

    // Only allow POST
    if (req.method !== "POST") {
      return json(
        { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" } },
        { status: 405 },
      );
    }

    // 1) Auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Missing Authorization header",
          },
        },
        { status: 401 },
      );
    }

    // 2) Required env
    // NOTE: SUPABASE_URL / SUPABASE_ANON_KEY 通常在 Edge Runtime 會自帶，但你仍可用 secrets set 覆蓋
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? requireEnv("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    // 3) Verify JWT + get user
    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUserClient.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      console.error("[richmenu-publish] Invalid JWT:", userError?.message);
      return json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid JWT or user not found",
            details: userError?.message ?? null,
          },
        },
        { status: 401 },
      );
    }

    const userId = user.id;
    console.log("[richmenu-publish] ✅ User:", userId);

    // 4) Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(
        { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const menus = body?.menus;
    const cleanOldMenus = !!body?.cleanOldMenus;

    if (!Array.isArray(menus) || menus.length === 0) {
      return json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "`menus` must be a non-empty array" },
        },
        { status: 400 },
      );
    }

    // 5) Admin client (bypass RLS)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: channelData, error: channelError } = await supabaseAdmin
      .from("rm_line_channels")
      .select("access_token_encrypted")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (channelError || !channelData?.access_token_encrypted) {
      console.error("[richmenu-publish] LINE token not found:", channelError?.message);
      return json(
        {
          success: false,
          error: {
            code: "TOKEN_NOT_FOUND",
            message: "LINE Token 未設定，請先綁定 LINE Channel",
            details: channelError?.message ?? null,
          },
        },
        { status: 404 },
      );
    }

    const lineToken = channelData.access_token_encrypted;

    // 6) Clean old menus (optional)
    if (cleanOldMenus) {
      console.log("[richmenu-publish] Cleaning old menus...");

      const listResponse = await fetch(`${LINE_API}/richmenu/list`, {
        headers: { Authorization: `Bearer ${lineToken}` },
      });

      if (!listResponse.ok) {
        const t = await listResponse.text();
        console.error("[richmenu-publish] list old menus failed:", t);
        // 這邊視為 server error
        return json(
          { success: false, error: { code: "LINE_API_ERROR", message: "Failed to list old rich menus", details: t } },
          { status: 502 },
        );
      }

      const listData = await listResponse.json();
      const existingMenus = listData?.richmenus ?? [];

      for (const menu of existingMenus) {
        const delRes = await fetch(`${LINE_API}/richmenu/${menu.richMenuId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${lineToken}` },
        });

        if (!delRes.ok) {
          const t = await delRes.text();
          console.warn("[richmenu-publish] delete old menu failed (ignored):", t);
        }
      }
    }

    // 7) Publish menus
    const results: Array<{ aliasId: string; richMenuId: string }> = [];

    for (const menuRequest of menus as PublishMenuRequest[]) {
      const { menuData, imageBase64, aliasId, isMain } = menuRequest;

      if (!menuData) {
        return json(
          { success: false, error: { code: "BAD_REQUEST", message: "Each menu item must include `menuData`" } },
          { status: 400 },
        );
      }

      // 7a) Create rich menu
      const createResponse = await fetch(`${LINE_API}/richmenu`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lineToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(menuData),
      });

      if (!createResponse.ok) {
        const t = await createResponse.text();
        console.error("[richmenu-publish] create rich menu failed:", t);
        return json(
          { success: false, error: { code: "LINE_API_ERROR", message: "Failed to create rich menu", details: t } },
          { status: 502 },
        );
      }

      const createData = await createResponse.json();
      const richMenuId = createData?.richMenuId;

      if (!richMenuId) {
        return json(
          { success: false, error: { code: "LINE_API_ERROR", message: "LINE did not return richMenuId" } },
          { status: 502 },
        );
      }

      // 7b) Upload image (optional)
      if (imageBase64) {
        let bytes: Uint8Array;

        try {
          let base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
          base64Data = base64Data.replace(/\s/g, "");

          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
            return json(
              { success: false, error: { code: "BAD_REQUEST", message: "Invalid base64 format for image" } },
              { status: 400 },
            );
          }

          const binaryString = atob(base64Data);
          bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        } catch (e: any) {
          console.error("[richmenu-publish] base64 decode failed:", e?.message);
          return json(
            { success: false, error: { code: "BAD_REQUEST", message: "Failed to decode base64 image", details: e?.message ?? null } },
            { status: 400 },
          );
        }

        const uploadResponse = await fetch(`${LINE_API}/richmenu/${richMenuId}/content`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lineToken}`,
            "Content-Type": "image/png",
          },
          body: bytes.buffer as ArrayBuffer,
        });

        if (!uploadResponse.ok) {
          const t = await uploadResponse.text();
          console.error("[richmenu-publish] upload image failed:", t);
          return json(
            { success: false, error: { code: "LINE_API_ERROR", message: "Failed to upload rich menu image", details: t } },
            { status: 502 },
          );
        }
      }

      // 7c) Set alias (optional; non-fatal)
      if (aliasId) {
        const aliasRes = await fetch(`${LINE_API}/richmenu/alias`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lineToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ richMenuAliasId: aliasId, richMenuId }),
        });

        if (!aliasRes.ok) {
          const t = await aliasRes.text();
          console.warn("[richmenu-publish] alias failed (ignored):", t);
        }
      }

      // 7d) Set as default (optional; non-fatal)
      if (isMain) {
        const defaultRes = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${lineToken}` },
        });

        if (!defaultRes.ok) {
          const t = await defaultRes.text();
          console.warn("[richmenu-publish] set default failed (ignored):", t);
        }
      }

      results.push({ aliasId, richMenuId });
    }

    // OK
    return json(
      {
        success: true,
        data: { results, publishedAt: new Date().toISOString() },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("[richmenu-publish] ❌ Unhandled error:", err?.message, err?.stack);
    return json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unexpected server error",
          details: err?.message ?? String(err),
        },
      },
      { status: 500 },
    );
  }
});
