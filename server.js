import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" })); // 增加限制以支援圖片上傳

// Supabase Admin Client (使用 Service Role Key，可繞過 RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️  Missing Supabase credentials. LINE API endpoints will not work.");
}

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
  : null;

app.get("/health", (_req, res) => res.json({ ok: true }));

// ========================================
// 輔助函數：從 Supabase 取得 LINE Access Token
// ========================================
async function getLineAccessToken(userId) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized");
  }

  const { data, error } = await supabaseAdmin
    .from("rm_line_channels")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("LINE Channel not found or not active");
  }

  return data.access_token_encrypted;
}

// 驗證用戶身份的 middleware
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.userId = user.id;
  next();
}

// ========================================
// LINE API Endpoints
// ========================================

// 廣播 Flex Message
app.post("/api/line/broadcast", authenticateUser, async (req, res) => {
  try {
    const { flexContents, altText } = req.body;

    if (!flexContents || !altText) {
      return res.status(400).json({ error: "Missing required fields: flexContents, altText" });
    }

    const accessToken = await getLineAccessToken(req.userId);

    const response = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: [{
          type: "flex",
          altText,
          contents: flexContents,
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        success: false,
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Broadcast error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 取得好友數量
app.get("/api/line/followers", authenticateUser, async (req, res) => {
  try {
    const accessToken = await getLineAccessToken(req.userId);

    const response = await fetch("https://api.line.me/v2/bot/insight/followers", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        success: false,
        error: errorData.message || `HTTP ${response.status}`,
      });
    }

    const data = await response.json();
    res.json({
      success: true,
      count: data.followers,
    });
  } catch (err) {
    console.error("Get followers error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 發布 Rich Menu（完整流程）
app.post("/api/line/richmenu/publish", authenticateUser, async (req, res) => {
  try {
    const { menus } = req.body;

    if (!Array.isArray(menus) || menus.length === 0) {
      return res.status(400).json({ error: "Invalid menus data" });
    }

    const accessToken = await getLineAccessToken(req.userId);
    const results = [];

    // 處理每個 Rich Menu
    for (const menu of menus) {
      const { menuData, imageBase64, aliasId, isMain } = menu;

      // 1. 建立 Rich Menu
      const createResponse = await fetch("https://api.line.me/v2/bot/richmenu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(menuData),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json().catch(() => ({}));
        results.push({
          success: false,
          menuName: menuData.name,
          error: error.message || `Failed to create menu: ${createResponse.status}`,
        });
        continue;
      }

      const { richMenuId } = await createResponse.json();

      // 2. 上傳圖片
      if (imageBase64) {
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const uploadResponse = await fetch(
          `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
          {
            method: "POST",
            headers: {
              "Content-Type": "image/png",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: imageBuffer,
          }
        );

        if (!uploadResponse.ok) {
          results.push({
            success: false,
            menuName: menuData.name,
            richMenuId,
            error: `Failed to upload image: ${uploadResponse.status}`,
          });
          continue;
        }
      }

      // 3. 設定 Alias
      const aliasResponse = await fetch(
        `https://api.line.me/v2/bot/richmenu/alias/${aliasId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ richMenuId }),
        }
      );

      // 4. 設定為預設選單（如果是主選單）
      if (isMain) {
        await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });
      }

      results.push({
        success: true,
        menuName: menuData.name,
        richMenuId,
        aliasId,
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("Publish richmenu error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/check-image", async (req, res) => {
  const url = String(req.query.url || "");
  if (!url.startsWith("https://")) {
    return res.status(400).json({ ok: false, level: "fail", reasonCode: "NOT_HTTPS" });
  }
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    const head = await fetch(url, { method: "HEAD", signal: controller.signal });
    let r = head;
    if (!head.ok) {
      r = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1024" }, signal: controller.signal });
    }
    clearTimeout(t);

    const contentType = r.headers.get("content-type") || "";
    const contentLength = Number(r.headers.get("content-length") || "0") || undefined;
    const isImage = /^image\/(jpeg|png|webp)/i.test(contentType);

    if (!r.ok) return res.json({ ok: false, level: "fail", reasonCode: "FETCH_FAIL", status: r.status, contentType, contentLength });
    if (!isImage) return res.json({ ok: false, level: "fail", reasonCode: "CONTENT_TYPE_INVALID", status: r.status, contentType, contentLength });

    if (contentLength && contentLength > 5 * 1024 * 1024) {
      return res.json({ ok: true, level: "warn", reasonCode: "TOO_LARGE", status: r.status, contentType, contentLength });
    }
    return res.json({ ok: true, level: "pass", status: r.status, contentType, contentLength });
  } catch (_e) {
    return res.json({ ok: false, level: "fail", reasonCode: "TIMEOUT_OR_NETWORK" });
  }
});

// Proxy for validating LINE Channel Access Token to avoid CORS
app.post("/api/validate-token", async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ valid: false, error: "Missing accessToken" });

  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return res.json({ valid: false, error: `無效的 Token (HTTP ${response.status})` });
    }

    const data = await response.json();
    return res.json({
      valid: true,
      botName: data.displayName || data.basicId,
      basicId: data.basicId
    });
  } catch (err) {
    console.error("Validate token error:", err);
    return res.json({ valid: false, error: err.message || "伺服器連線錯誤" });
  }
});

const dist = path.join(__dirname, "dist");
app.use(express.static(dist, { index: false }));

app.get("*", (_req, res) => {
  const indexPath = path.join(dist, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) res.status(200).send("Dev mode: run `npm run dev` and open Vite dev server.");
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => console.log(`[server] listening on :${port}`));
