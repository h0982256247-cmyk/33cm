import React, { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";

import FlexPreview from "@/components/FlexPreview";
import { resolveDocIdToToken, resolveShareToken } from "@/lib/db";
import { isLineInApp } from "@/lib/lineEnv";

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
      const decoded = decodeURIComponent(liffState);
      const q = decoded.includes("?")
        ? decoded.split("?")[1]
        : decoded.startsWith("?")
          ? decoded.slice(1)
          : decoded;

      const inner = new URLSearchParams(q);
      token = inner.get("token");
      id = inner.get("id");
      autoshare = inner.get("autoshare") === "1";
    }
  }

  return { token, id, autoshare };
}

type Toast = { type: "ok" | "err"; msg: string } | null;

export default function Share() {
  const { token: tokenParam, id: idParam, autoshare } = useMemo(() => parseUrlParams(), []);
  const [loading, setLoading] = useState(true);
  const [docModel, setDocModel] = useState<any>(null);
  const [flexJson, setFlexJson] = useState<any>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [sharing, setSharing] = useState(false);

  const [liffReady, setLiffReady] = useState(false);
  const autoShareTriggered = useRef(false);

  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;

  const shareUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    if (tokenParam) return `${base}?token=${encodeURIComponent(tokenParam)}`;
    if (idParam) return `${base}?id=${encodeURIComponent(idParam)}`;
    return window.location.href;
  }, [tokenParam, idParam]);

  // ✅ 最穩的 LIFF 連結（同時支援桌機/手機/LINE 內開啟）
  // - Web 連結：https://liff.line.me/{LIFF_ID}?liff.state=/share?...（適合 QR/複製）
  // - Line Scheme：line://app/{LIFF_ID}?liff.state=/share?...（可嘗試在桌機 Chrome 喚起 LINE Desktop）
  const liffState = useMemo(() => {
    const inner = new URLSearchParams();
    if (tokenParam) inner.set("token", tokenParam);
    else if (idParam) inner.set("id", idParam);
    // 讓使用者被導入 LIFF 後可以自動觸發分享（仍以 user gesture 為優先）
    inner.set("autoshare", "1");
    return `/share?${inner.toString()}`;
  }, [tokenParam, idParam]);

  const liffWebUrl = useMemo(() => {
    if (!liffId) return null;
    return `https://liff.line.me/${liffId}?liff.state=${encodeURIComponent(liffState)}`;
  }, [liffId, liffState]);

  const liffLineUrl = useMemo(() => {
    if (!liffId) return null;
    return `line://app/${liffId}?liff.state=${encodeURIComponent(liffState)}`;
  }, [liffId, liffState]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  // 初始化 LIFF
  useEffect(() => {
    (async () => {
      if (!liffId) {
        console.warn("[Share] VITE_LIFF_ID not set");
        return;
      }
      try {
        await liff.init({ liffId });
        setLiffReady(true);
        console.log("[Share] LIFF initialized, isInClient:", liff.isInClient());
      } catch (e: any) {
        console.error("[Share] LIFF init error:", e);
      }
    })();
  }, [liffId]);

  // 載入分享資料
  useEffect(() => {
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
  }, [tokenParam, idParam]);

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

      // 不在 LINE in-app → 導向 LIFF URL
      if (!liff.isInClient()) {
        // ✅ 不在 LINE 內：
        // 1) 先嘗試用 line://app 喚起（桌機 Chrome 也有機會直接打開 LINE Desktop）
        // 2) 不行再用 https://liff.line.me（適合手機瀏覽器/QR/複製）
        if (liffLineUrl) {
          window.location.href = liffLineUrl;
        } else if (liffWebUrl) {
          window.location.href = liffWebUrl;
        } else {
          setToast({ type: "err", msg: "尚未設定 LIFF（缺少 VITE_LIFF_ID）" });
        }
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
        throw new Error("目前 LINE 版本不支援分享好友（shareTargetPicker）。請更新 LINE App 後再試。");
      }

      // ✅ 送出前硬檢查，避免你「看似分享成功但好友收不到」
      validateBeforeShare(contents);

      // ✅ 明確建立 payload（這就是你要抓問題的「結構」）
      const payload = {
        type: "flex" as const,
        altText,
        contents,
      };
      const messages = [payload];

      console.log("===== SHARE PAYLOAD START =====");
      console.log("[Share] messages.length =", messages.length);
      console.log("[Share] contents.type =", contents?.type);
      if (contents?.type === "carousel") {
        console.log("[Share] carousel bubbles =", Array.isArray(contents?.contents) ? contents.contents.length : -1);
      }
      console.log("[Share] payload JSON =", JSON.stringify(payload, null, 2));
      console.log("===== SHARE PAYLOAD END =====");

      // ✅ 呼叫 shareTargetPicker
      const res = await liff.shareTargetPicker(messages);

      // ✅ 正確判斷：取消是 null，成功是非 null
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="text-xl font-semibold text-gray-900">分享 Flex Message</div>
            <div className="mt-2 text-sm text-gray-500">
              這頁面的預覽即為實際分享給好友的內容（published 版本）。
            </div>

            {toast ? (
              <div
                className={`mt-4 rounded-xl p-3 text-sm whitespace-pre-wrap ${
                  toast.type === "ok"
                    ? "bg-green-50 text-green-700 border border-green-100"
                    : "bg-red-50 text-red-700 border border-red-100"
                }`}
              >
                {toast.msg}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button className="glass-btn flex-1" disabled={loading || sharing} onClick={onPrimaryClick}>
                {sharing ? "處理中…" : "分享給好友"}
              </button>

              <button
                className="glass-btn glass-btn--secondary"
                onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                看預覽
              </button>
            </div>

            {!liff.isInClient() && liffWebUrl ? (
              <div className="mt-3 text-xs text-gray-500">
                提示：分享好友必須在 LINE 內開啟（LIFF）。
                你現在是在瀏覽器環境，點「分享給好友」會嘗試喚起 LINE；若未自動跳轉，請用下方 QR Code / 複製連結在手機或 LINE Desktop 開啟。
              </div>
            ) : null}

            {!liff.isInClient() && liffWebUrl ? (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">電腦也能分享（推薦流程）</div>
                <div className="mt-1 text-xs text-gray-600">
                  1) 用手機掃 QR Code 或複製連結到手機 LINE 打開 → 2) 在 LIFF 內選好友分享。
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-4 items-start">
                  <div className="bg-white p-3 rounded-lg border">
                    <img
                      alt="QR Code"
                      width={160}
                      height={160}
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(liffWebUrl)}`}
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <div className="text-xs text-gray-500 break-all">{liffWebUrl}</div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      {liffLineUrl ? (
                        <button
                          className="glass-btn"
                          onClick={() => {
                            window.location.href = liffLineUrl;
                          }}
                        >
                          在 LINE 開啟
                        </button>
                      ) : null}
                      <button
                        className="glass-btn glass-btn--secondary"
                        onClick={async () => {
                          await navigator.clipboard.writeText(liffWebUrl);
                          setToast({ type: "ok", msg: "已複製 LIFF 連結，請貼到手機 LINE 打開後再分享。" });
                        }}
                      >
                        複製 LIFF 連結
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={previewRef} className="border-t border-gray-100 bg-gray-50 p-6">
            <div className="font-semibold text-gray-900">預覽</div>
            <div className="mt-4">
              {loading ? (
                <div className="text-sm text-gray-500">載入中…</div>
              ) : contents ? (
                <FlexPreview doc={docModel} flex={flexJson} />
              ) : (
                <div className="text-sm text-gray-500">沒有可預覽的內容</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          分享連結：<span className="select-all">{shareUrl}</span>
        </div>
      </div>
    </div>
  );
}
