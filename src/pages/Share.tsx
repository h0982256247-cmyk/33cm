import React, { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";
import { useNavigate } from "react-router-dom";

import FlexPreview from "@/components/FlexPreview";
import { resolveDocIdToToken, resolveShareToken } from "@/lib/db";
import { broadcastFlexMessage } from "@/lib/lineMessagingApi";
import { hasChannel } from "@/lib/channel";

// 建立分享用的訊息陣列
// LIFF shareTargetPicker 支援 Flex Message 中的 video component
// 影片和文字、按鈕會在同一個 bubble 訊息內
function buildShareMessages(contents: any, altText: string): any[] {
  if (!contents) return [];

  // 直接使用 Flex Message（包含影片）
  return [{
    type: "flex",
    altText,
    contents,
  }];
}

type FullUrlParams = { token: string | null; id: string | null; autoshare: boolean };

function parseUrlParams(): FullUrlParams {
  const sp = new URLSearchParams(window.location.search);
  let token = sp.get("token");
  let id = sp.get("id");
  let autoshare = sp.get("autoshare") === "1";

  // LIFF 可能會把參數包在 liff.state
  if (!token && !id) {
    const liffState = sp.get("liff.state");
    if (liffState) {
      try {
        const decoded = decodeURIComponent(liffState);
        // liff.state 可能是 "?token=xxx" 或 "token=xxx" 或 "/share?token=xxx"
        let queryPart = decoded;
        if (decoded.includes("?")) {
          queryPart = decoded.split("?").pop() || "";
        } else if (decoded.startsWith("/")) {
          // 路徑格式，沒有參數
          queryPart = "";
        }

        const inner = new URLSearchParams(queryPart);
        token = inner.get("token") || token;
        id = inner.get("id") || id;
        autoshare = inner.get("autoshare") === "1" || autoshare;
      } catch (e) {
        console.error("[parseUrlParams] Failed to parse liff.state:", e);
      }
    }
  }

  // 額外嘗試從 hash 解析（某些 LIFF 版本會用 hash）
  if (!token && !id && window.location.hash) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      token = hashParams.get("token") || token;
      id = hashParams.get("id") || id;
    } catch (e) {
      console.error("[parseUrlParams] Failed to parse hash:", e);
    }
  }

  console.log("[parseUrlParams] Resolved:", { token, id, autoshare });
  return { token, id, autoshare };
}

type Toast = { type: "ok" | "err"; msg: string } | null;

export default function Share() {
  const nav = useNavigate();
  const [urlParams, setUrlParams] = useState<FullUrlParams>({ token: null, id: null, autoshare: false });
  const [loading, setLoading] = useState(true);
  const [docModel, setDocModel] = useState<any>(null);
  const [flexJson, setFlexJson] = useState<any>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [sharing, setSharing] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const [liffReady, setLiffReady] = useState(false);
  const [paramsReady, setParamsReady] = useState(false);
  const autoShareTriggered = useRef(false);

  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;

  const tokenParam = urlParams.token;
  const idParam = urlParams.id;
  const autoshare = urlParams.autoshare;

  const shareUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    if (tokenParam) return `${base}?token=${encodeURIComponent(tokenParam)}`;
    if (idParam) return `${base}?id=${encodeURIComponent(idParam)}`;
    return window.location.href;
  }, [tokenParam, idParam]);

  const liffUrl = useMemo(() => {
    if (!liffId) return null;
    const q = tokenParam
      ? `token=${encodeURIComponent(tokenParam)}`
      : idParam
        ? `id=${encodeURIComponent(idParam)}`
        : "";
    return `https://liff.line.me/${liffId}${q ? "?" + q : ""}`;
  }, [liffId, tokenParam, idParam]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  // 初始化 LIFF 並解析 URL 參數
  useEffect(() => {
    (async () => {
      // 先嘗試解析 URL 參數（非 LIFF 環境可能直接有參數）
      const initialParams = parseUrlParams();

      if (!liffId) {
        console.warn("[Share] VITE_LIFF_ID not set");
        setUrlParams(initialParams);
        setParamsReady(true);
        return;
      }

      try {
        await liff.init({ liffId });
        setLiffReady(true);
        console.log("[Share] LIFF initialized, isInClient:", liff.isInClient());

        // LIFF 初始化後重新解析參數（可能從 liff.state 取得）
        const params = parseUrlParams();
        console.log("[Share] After LIFF init, params:", params);
        setUrlParams(params);
        setParamsReady(true);
      } catch (e: any) {
        console.error("[Share] LIFF init error:", e);
        // 即使 LIFF 初始化失敗，也嘗試使用初始參數
        setUrlParams(initialParams);
        setParamsReady(true);
      }
    })();
  }, [liffId]);

  // 載入分享資料（等待參數解析完成）
  useEffect(() => {
    if (!paramsReady) return;

    (async () => {
      try {
        setLoading(true);

        // resolve share token if only have id
        let token = tokenParam;
        if (!token && idParam) {
          token = (await resolveDocIdToToken(idParam)) || null;
        }
        if (!token) throw new Error("找不到分享內容（缺少 token 或 id）");

        const data = await resolveShareToken(token);
        if (!data) throw new Error("找不到分享內容（token 無效或未發佈）");

        setDocModel(data.doc_model || null);
        setFlexJson(data.flex_json || null);
      } catch (e: any) {
        setToast({ type: "err", msg: e?.message || String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [paramsReady, tokenParam, idParam]);

  const contents = flexJson?.contents ?? null;
  const altText = flexJson?.altText ?? (docModel?.title || "Flex Message");

  // autoshare: 自動觸發分享（⚠️ 建議正式上線可關掉，只保留點擊觸發更穩）
  useEffect(() => {
    if (
      autoshare &&
      liffReady &&
      !loading &&
      !!contents &&
      !autoShareTriggered.current
    ) {
      autoShareTriggered.current = true;
      setTimeout(() => {
        triggerShare();
      }, 300);
    }
  }, [autoshare, liffReady, loading, contents]);

  function validateBeforeShare(c: any) {
    if (!c) throw new Error("此內容尚未準備好（沒有 flex contents）");

    const ctype = c?.type;
    if (!ctype || !["bubble", "carousel"].includes(ctype)) {
      throw new Error(`contents.type 不正確：${ctype}（必須是 bubble 或 carousel）`);
    }

    if (ctype === "carousel") {
      const arr = c?.contents;
      if (!Array.isArray(arr)) {
        throw new Error("carousel.contents 必須是 array");
      }
      const n = arr.length;
      // 保守上限 <= 10（最穩）
      if (n > 10) {
        throw new Error(`多頁（carousel bubble）超過上限：${n}（建議 <= 10）`);
      }
    }
  }

  async function triggerShare() {
    try {
      setSharing(true);
      setToast(null);

      // 不在 LINE in-app：直接導向 LIFF URL（不要呼叫 liff.login）
      if (!liff.isInClient()) {
        if (!liffUrl) throw new Error("尚未設定 LIFF（缺少 VITE_LIFF_ID）");

        // 帶 autoshare=1，進入 LIFF 後自動觸發分享
        const u = new URL(liffUrl);
        u.searchParams.set("autoshare", "1");
        window.location.href = u.toString();
        return;
      }

      // 確保 LIFF 已初始化
      if (!liffReady) {
        if (!liffId) throw new Error("缺少 VITE_LIFF_ID");
        await liff.init({ liffId });
        setLiffReady(true);
      }

      // 檢查 API 可用性
      if (!liff.isApiAvailable("shareTargetPicker")) {
        throw new Error("此環境不支援分享好友，或未開啟 ShareTargetPicker 權限（請檢查 LINE Developers Console）。");
      }

      // 送出前檢查 contents 結構
      validateBeforeShare(contents);

      // 建立訊息陣列（如果有影片會自動拆成 Video Message + Flex Message）
      const messages = buildShareMessages(contents, altText);

      if (messages.length === 0) {
        throw new Error("無法建立分享訊息");
      }

      // 檢查訊息數量（shareTargetPicker 最多 5 則）
      if (messages.length > 5) {
        throw new Error(`訊息數量超過上限：${messages.length}（最多 5 則）`);
      }

      console.log("===== SHARE PAYLOAD START =====");
      console.log("[Share] messages.length =", messages.length);
      console.log("[Share] message types =", messages.map(m => m.type).join(", "));
      if (contents?.type === "carousel") {
        console.log("[Share] carousel bubbles =", Array.isArray(contents?.contents) ? contents.contents.length : -1);
      }
      console.log("[Share] payload JSON =", JSON.stringify(messages, null, 2));
      console.log("===== SHARE PAYLOAD END =====");

      // 呼叫 shareTargetPicker
      const res = await liff.shareTargetPicker(messages);

      // 正確判斷：取消是 null，成功是非 null
      if (res === null) {
        setToast({ type: "err", msg: "已取消分享" });
      } else {
        setToast({ type: "ok", msg: "已傳送成功！" });
      }
    } catch (e: any) {
      console.error("[Share] Error:", e);
      setToast({ type: "err", msg: e?.message || String(e) });
    } finally {
      setSharing(false);
    }
  }

  async function onPrimaryClick() {
    await triggerShare();
  }

  // LINE OA 廣播功能
  async function handleBroadcast() {
    try {
      setBroadcasting(true);
      setToast(null);

      // 檢查是否有設定 Token
      const tokenExists = await hasChannel();
      if (!tokenExists) {
        setToast({
          type: "err",
          msg: "尚未設定 LINE Channel Token，請先到設定頁面綁定",
        });
        // 3 秒後導向登入頁重新設定
        setTimeout(() => {
          nav("/login");
        }, 3000);
        setBroadcasting(false);
        return;
      }

      // 驗證內容
      validateBeforeShare(contents);

      // 發送廣播
      const result = await broadcastFlexMessage(contents, altText);

      if (result.success) {
        setToast({ type: "ok", msg: "已成功廣播給所有好友！" });
      } else {
        setToast({ type: "err", msg: result.error || "廣播失敗" });
      }
    } catch (e: any) {
      console.error("[Broadcast] Error:", e);
      setToast({ type: "err", msg: e?.message || String(e) });
    } finally {
      setBroadcasting(false);
    }
  }

  return (
    <div className="bg-pink-50">
      {/* 第一區：分享按鈕 + 預覽箭頭 */}
      <div className="h-screen flex flex-col items-center justify-center px-4 relative">
        {/* Toast 訊息 */}
        {toast ? (
          <div
            className={`mb-6 rounded-2xl px-6 py-3 text-sm shadow-sm max-w-2xl ${toast.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-100"
              : "bg-red-50 text-red-700 border border-red-100"
              }`}
          >
            <div className="whitespace-pre-wrap text-left font-mono text-xs">
              {toast.msg}
            </div>
          </div>
        ) : null}

        {/* 分享按鈕區 */}
        <div className="flex flex-col gap-4">
          <button
            className="px-12 py-4 bg-[#06C755] hover:bg-[#05b04c] text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
            disabled={loading || sharing || broadcasting}
            onClick={onPrimaryClick}
          >
            {sharing ? "處理中…" : "分享好友"}
          </button>

          {/* LINE OA 廣播按鈕 */}
          <button
            className="px-12 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
            disabled={loading || sharing || broadcasting}
            onClick={handleBroadcast}
          >
            {broadcasting ? "廣播中…" : "從 LINE OA 廣播"}
          </button>

          <p className="text-xs text-gray-400 text-center mt-2">
            OA 廣播會發送給所有已加入好友的用戶
          </p>
        </div>

        {/* 預覽箭頭 - 固定在畫面下方 */}
        <button
          className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 group"
          onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span className="text-sm text-gray-400">預覽</span>
          <div className="w-12 h-12 bg-white/90 rounded-full shadow-md border border-pink-100 flex items-center justify-center group-hover:shadow-lg group-hover:scale-110 transition-all">
            <svg className="w-5 h-5 text-pink-400 animate-bounce" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 16l-6-6h4V4h4v6h4l-6 6z" />
              <path d="M4 18h16v2H4v-2z" />
            </svg>
          </div>
        </button>
      </div>

      {/* 第二區：預覽內容 */}
      <div ref={previewRef} className="min-h-screen px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/80 rounded-2xl shadow-lg border border-gray-100 p-6">
            {loading ? (
              <div className="text-sm text-gray-500 text-center py-12">載入中…</div>
            ) : contents ? (
              <FlexPreview doc={docModel} flex={flexJson} />
            ) : (
              <div className="text-sm text-gray-500 text-center py-12">沒有可預覽的內容</div>
            )}
          </div>

          <div className="mt-6 text-center text-xs text-gray-400">
            分享連結：<span className="select-all">{shareUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
