import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import ProgressBar from "@/components/ProgressBar";
import FlexPreview from "@/components/FlexPreview";
import { getDoc, getActiveShareForDoc, publishDoc } from "@/lib/db";
import { DocModel } from "@/lib/types";
import { isPublishable, validateDoc } from "@/lib/validate";
import { PageHeader } from "@/components/PageHeader";
import { buildFlex } from "@/lib/buildFlex";
import { broadcastFlexMessage } from "@/lib/broadcast";

export default function PreviewDraft() {
  const { id } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState<DocModel | null>(null);
  const [active, setActive] = useState<{ token: string; version_no: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const row = await getDoc(id);
      setDoc(row.content);
      setActive(await getActiveShareForDoc(id));
    })();
  }, [id]);

  const handleBroadcast = async () => {
    if (!doc) return;

    setBroadcastMsg(null);
    setBroadcastBusy(true);

    try {
      // Build flex message
      const flexMessage = buildFlex(doc, id);

      // Broadcast via Edge Function
      const result = await broadcastFlexMessage([flexMessage.contents], doc.altText || flexMessage.altText || "您收到新訊息");

      if (result.success) {
        setBroadcastMsg("✅ 廣播成功！訊息已發送給所有好友");
      } else {
        setBroadcastMsg(`❌ ${result.error || "廣播失敗"}`);
      }
    } catch (e: any) {
      setBroadcastMsg(`❌ 廣播失敗：${e.message}`);
    } finally {
      setBroadcastBusy(false);
    }
  };

  if (!doc || !id) return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">載入中…</div>
      </div>
    </div>
  );

  const rep = validateDoc(doc);
  const gate = isPublishable(doc);
  const shareUrl = active ? `https://linemgm.com/share?token=${active.token}` : null;
  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;
  const liffUrl = active && liffId ? `https://liff.line.me/${liffId}?token=${active.token}` : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="預覽與發布" subtitle={doc.name || "Flex Message"} backPath={`/drafts/${id}/edit`} />

      <ProgressBar docId={id} />

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">
              {rep.status === "publishable" ? "✅ 可發布" : rep.status === "previewable" ? "⚠️ 可預覽不可發布（外部圖）" : "📝 草稿（有錯誤）"}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              onClick={() => nav(`/drafts/${id}/edit`)}
            >
              返回編輯
            </button>
            <button
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              onClick={() => nav("/drafts")}
            >
              草稿列表
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 預覽區 */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="font-semibold mb-4">預覽</div>
          <FlexPreview doc={doc} />
        </div>

        <div className="space-y-4">
          {/* 驗證結果 */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="font-semibold">驗證結果</div>
            <div className="mt-2 text-sm space-y-2">
              {rep.errors.map((e, i) => <div key={i} className="text-red-600">❌ {e.message}</div>)}
              {rep.warnings.map((w, i) => <div key={i} className="text-amber-700">⚠️ {w.message}</div>)}
              {rep.errors.length === 0 && rep.warnings.length === 0 ? <div className="text-gray-500">✓ 沒有問題</div> : null}
            </div>
          </div>

          {/* LINE OA 廣播 */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.99 12.06c0-5.7-4.93-10.31-10-10.31S2 6.36 2 12.06c0 5.1 4 9.35 8.89 10.16.34.07.8.22.92.51.1.25.07.62 0 1.05l-.18 1.09c-.05.32-.24 1.25 1.09.66s7.24-4.26 7.24-4.26a9.55 9.55 0 004.03-9.21z" />
              </svg>
              <div className="font-semibold text-green-900">LINE OA 廣播推送</div>
            </div>
            <div className="mt-2 text-sm text-green-800 opacity-80">
              發送給所有 LINE 官方帳號好友（需先設定 Channel Access Token）
            </div>
            {broadcastMsg && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${broadcastMsg.startsWith('✅') ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                {broadcastMsg}
              </div>
            )}
            <div className="mt-4">
              <button
                className="w-full px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34d] text-white font-semibold rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={broadcastBusy}
                onClick={handleBroadcast}
              >
                {broadcastBusy ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    發送中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    廣播推送給所有好友
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 分享連結發布 */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="font-semibold">分享連結發布</div>
            <div className="mt-2 text-sm text-gray-600">產生固定版本連結，重發會產生新版本，舊連結自動停用</div>
            {msg && <div className="mt-2 text-sm text-red-600">{msg}</div>}
            <div className="mt-4">
              <button
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!gate.ok || busy}
                onClick={async () => {
                  setMsg(null);
                  setBusy(true);
                  try {
                    await publishDoc(id);
                    setActive(await getActiveShareForDoc(id));
                  }
                  catch (e: any) {
                    setMsg(e.message === "NOT_PUBLISHABLE" ? "目前不可發布：請修正錯誤或改用上傳圖片。" : "發布失敗");
                  }
                  finally {
                    setBusy(false);
                  }
                }}
              >
                {active ? "重發（新版本）" : "產生分享連結"}
              </button>
            </div>

            {active && (
              <div className="mt-4 space-y-3">
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  目前版本：v{active.version_no}
                </div>
                {(shareUrl || liffUrl) && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="text-xs font-medium text-gray-700">分享連結</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 rounded text-xs break-all border border-gray-200">
                        {shareUrl || liffUrl}
                      </code>
                      <button
                        className="px-4 py-2 text-xs bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
                        onClick={() => navigator.clipboard.writeText((shareUrl || liffUrl)!)}
                      >
                        複製
                      </button>
                    </div>
                    {liffUrl && (
                      <a
                        href={liffUrl}
                        className="block w-full py-3 bg-[#06C755] hover:bg-[#05b34d] text-white font-bold text-center rounded-lg shadow-md transition-all duration-200"
                      >
                        LINE 分享好友
                      </a>
                    )}

                    {/* QR Code */}
                    <div className="mt-4 flex flex-col items-center gap-2 pt-3 border-t border-gray-200">
                      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <QRCodeSVG value={liffUrl || shareUrl || ""} size={160} />
                      </div>
                      <div className="text-xs text-gray-500">請用手機掃描分享</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
