import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));

// ========================================
// 健康檢查
// ========================================

app.get("/health", (_req, res) => res.json({ ok: true }));

// ========================================
// 輔助 API（用於避免 CORS）
// ========================================

// 檢查圖片 URL 是否有效
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

// 驗證 LINE Channel Access Token（避免 CORS）
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

// ========================================
// 靜態檔案服務
// ========================================

const dist = path.join(__dirname, "dist");

// 靜態檔案服務 - 但不緩存
app.use(express.static(dist, {
  index: false,
  maxAge: 0,     // 不緩存（開發時）
  etag: true     // 使用 ETag 驗證
}));

// SPA fallback - 返回 index.html
app.get("*", (_req, res) => {
  // 設置 no-cache header 確保 index.html 不被緩存
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const indexPath = path.join(dist, "index.html");

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(
      "Dev mode: Please run `npm run dev` and open the Vite dev server at http://localhost:5173"
    );
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => console.log(`[server] listening on :${port}`));
