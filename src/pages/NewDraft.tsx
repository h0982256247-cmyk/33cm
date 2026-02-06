import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { createDoc, deleteTemplate, listTemplates, TemplateRow } from "@/lib/db";
import { seedBubble, seedCarousel, seedVideoBubble } from "@/lib/templates";

export default function NewDraft() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tpls, setTpls] = useState<TemplateRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = await supabase.auth.getUser();
      if (!u.data.user) return nav("/login");
      try {
        const rows = await listTemplates();
        setTpls(rows);
      } catch (e: any) {
        // 忽略 templates 表不存在的錯誤，讓內建範本仍可使用
        console.warn("Templates load failed:", e?.message);
      }
    })();
  }, [nav]);

  const builtinQuick = useMemo(() => {
    return [
      { key: "blank_bubble", name: "空白 Bubble", description: "從空白 bubble 開始", doc: seedBubble() },
      { key: "video_bubble", name: "影片 Bubble", description: "包含影片的 bubble", doc: seedVideoBubble() },
      { key: "blank_carousel", name: "空白 Carousel", description: "從空白 carousel 開始（3 張）", doc: seedCarousel(3) },
    ];
  }, []);

  async function createFromDoc(doc: any) {
    setErr(null);
    setLoading(true);
    try {
      const id = await createDoc(doc);
      nav(`/drafts/${id}/edit`);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteTemplate(tpl: TemplateRow) {
    if (!tpl.owner_id) return;
    if (!confirm(`要刪除範本「${tpl.name}」嗎？`)) return;
    setLoading(true);
    setErr(null);
    try {
      await deleteTemplate(tpl.id);
      const rows = await listTemplates();
      setTpls(rows);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-bg">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">新增草稿</div>
            <div className="text-sm opacity-70">選一個範本開始，之後再到編輯頁調整內容與排版。</div>
          </div>
          <button className="glass-btn glass-btn--secondary" onClick={() => nav("/drafts")}>
            返回列表
          </button>
        </div>

        {err ? (
          <div className="mt-4 glass-panel p-4 text-red-600 text-sm whitespace-pre-wrap">
            {err}
          </div>
        ) : null}

        <div className="mt-6">
          <div className="text-sm opacity-70 mb-3">內建快速開始</div>
          <div className="grid md:grid-cols-2 gap-4">
            {builtinQuick.map((b) => (
              <button
                key={b.key}
                className="glass-panel p-5 text-left hover:brightness-110 transition disabled:opacity-60"
                disabled={loading}
                onClick={() => createFromDoc(b.doc)}
              >
                <div className="font-semibold">{b.name}</div>
                <div className="text-sm opacity-70 mt-1">{b.description}</div>
                <div className="text-xs opacity-50 mt-3">點擊建立</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="text-sm opacity-70 mb-3">範本庫</div>
          {tpls.length === 0 ? (
            <div className="glass-panel p-5 opacity-80">目前沒有範本。你可以先建立草稿後，在編輯頁「另存為範本」。</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {tpls.map((t) => (
                <div key={t.id} className="glass-panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.name}</div>
                      <div className="text-sm opacity-70 mt-1 whitespace-pre-wrap">
                        {t.description || (t.is_public ? "內建範本" : "我的範本")}
                      </div>
                    </div>

                    {t.owner_id ? (
                      <button
                        className="glass-btn glass-btn--secondary shrink-0"
                        disabled={loading}
                        onClick={() => onDeleteTemplate(t)}
                        title="刪除範本"
                      >
                        刪除
                      </button>
                    ) : (
                      <span className="glass-badge shrink-0">內建</span>
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button className="glass-btn flex-1" disabled={loading} onClick={() => createFromDoc(t.doc_model)}>
                      {loading ? "處理中…" : "使用此範本"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
