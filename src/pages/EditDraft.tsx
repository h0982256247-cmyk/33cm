import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProgressBar from "@/components/ProgressBar";
import { supabase } from "@/lib/supabase";
import { AccordionSection } from "@/components/Accordion";
import FlexPreview from "@/components/FlexPreview";
import ColorPicker, { AutoTextColorHint } from "@/components/ColorPicker";
import { buildFlex } from "@/lib/buildFlex";
import { getDoc, saveDoc, createTemplateFromDoc, getActiveShareForDoc } from "@/lib/db";
import { DocModel, FooterButton, ImageSource, SpecialSection, BubbleSize } from "@/lib/types";
import { uid, autoTextColor } from "@/lib/utils";
import { seedSpecialSection } from "@/lib/templates";
import { validateDoc } from "@/lib/validate";
import { extractVideoFrame } from "@/lib/extractVideoFrame";

type SaveState = "idle" | "saving" | "saved" | "error";

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export default function EditDraft() {
  const { id } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState<DocModel | null>(null);
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [open, setOpen] = useState<"hero" | "body" | "footer">("hero");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [viewMode, setViewMode] = useState<"preview" | "json">("preview");
  const [jsonCode, setJsonCode] = useState<string | null>(null);
  const [activeShare, setActiveShare] = useState<{ token: string; version_no: number } | null>(null);
  const [editingNameIdx, setEditingNameIdx] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);
  const cardTabsRef = useRef<HTMLDivElement>(null);

  // 分享連結使用 LIFF URL 格式（自動觸發分享）
  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;
  const shareUrl = activeShare && liffId
    ? `https://liff.line.me/${liffId}?token=${activeShare.token}&autoshare=1`
    : null;

  useEffect(() => {
    (async () => {
      if (!id) return;
      const row = await getDoc(id);
      setDoc(row.content);
      // 取得已發布的分享連結
      const share = await getActiveShareForDoc(id);
      setActiveShare(share);
    })();
  }, [id]);

  useEffect(() => {
    setJsonCode(null);
  }, [doc]);

  // Auto-scroll card tabs when selectedCardIdx changes
  useEffect(() => {
    if (cardTabsRef.current && doc?.type === "carousel") {
      const container = cardTabsRef.current;
      const selectedBtn = container.children[selectedCardIdx] as HTMLElement;
      if (selectedBtn) {
        const containerRect = container.getBoundingClientRect();
        const btnRect = selectedBtn.getBoundingClientRect();
        const scrollLeft = selectedBtn.offsetLeft - containerRect.width / 2 + btnRect.width / 2;
        container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
      }
    }
  }, [selectedCardIdx, doc?.type]);

  const scheduleSave = (next: DocModel) => {
    setDoc(next);
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        if (!id) return;
        await saveDoc(id, next);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);
  };

  const flushSave = async () => {
    if (!doc || !id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("saving");
    try { await saveDoc(id, doc); setSaveState("saved"); } catch { setSaveState("error"); }
  };

  if (!doc || !id) {
    return <div className="glass-bg"><div className="mx-auto max-w-5xl px-4 py-10"><div className="glass-panel p-6">載入中…</div></div></div>;
  }

  // Safe access for carousel cards
  const currentCardIdx = doc.type === "carousel" ? Math.min(selectedCardIdx, doc.cards.length - 1) : 0;
  const section = doc.type === "bubble" ? doc.section : doc.cards[currentCardIdx].section;
  const isSpecialCard = (section as SpecialSection).kind === "special";
  const specialSection = isSpecialCard ? (section as SpecialSection) : null;

  // Check if hero contains video
  const isVideoHero = !isSpecialCard && (section as any).hero?.some((h: any) => h.kind === "hero_video");
  const heroVideo = isVideoHero ? (section as any).hero.find((h: any) => h.kind === "hero_video") : null;

  const report = validateDoc(doc);

  const setSection = (next: any) => {
    if (doc.type === "bubble") {
      scheduleSave({ ...doc, section: next });
    } else {
      const nextCards = [...doc.cards];
      nextCards[currentCardIdx] = { ...nextCards[currentCardIdx], section: next };
      scheduleSave({ ...doc, cards: nextCards });
    }
  };

  const checkExternalImage = async (url: string) => {
    const res = await fetch(`/api/check-image?url=${encodeURIComponent(url)}`);
    return await res.json();
  };

  const updateHeroImageSource = async (img: ImageSource) => {
    if (isSpecialCard || isVideoHero) return; // Special cards and video heroes don't have hero_image
    const regularSection = section as any;
    const hero = regularSection.hero.map((c: any) => (c.kind === "hero_image" ? { ...c, image: img } : c));
    setSection({ ...regularSection, hero });
  };

  const updateHeroVideoSource = async (videoUrl: string, previewUrl: string, assetId?: string, previewAssetId?: string) => {
    if (isSpecialCard || !isVideoHero) return;
    const regularSection = section as any;
    const videoSource = assetId
      ? { kind: "upload" as const, assetId, url: videoUrl, previewAssetId: previewAssetId || "", previewUrl }
      : { kind: "external" as const, url: videoUrl, previewUrl };
    const hero = regularSection.hero.map((c: any) => (c.kind === "hero_video" ? { ...c, video: videoSource } : c));
    setSection({ ...regularSection, hero });
  };

  return (
    <div className="glass-bg">
      <ProgressBar docId={id} />

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex-1 mr-4">
            <input
              type="text"
              value={doc.title}
              onChange={(e) => scheduleSave({ ...doc, title: e.target.value })}
              placeholder="輸入草稿標題"
              className="text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full max-w-md"
            />
            <div className="text-sm opacity-70">儲存：{saveState === "saving" ? "●" : saveState === "saved" ? "✓" : saveState === "error" ? "✗" : "—"}</div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-70">卡片大小</span>
              <select
                className="glass-input py-1 text-sm"
                value={(doc as any).bubbleSize || "kilo"}
                onChange={(e) => {
                  if (doc.type === "folder") return;
                  scheduleSave({ ...doc, bubbleSize: e.target.value as BubbleSize });
                }}
              >
                <option value="nano">Nano (最小)</option>
                <option value="micro">Micro</option>
                <option value="kilo">Kilo</option>
                <option value="mega">Mega</option>
                <option value="giga">Giga (最大)</option>
              </select>
            </div>
            <button className="glass-btn glass-btn--secondary" onClick={async () => {
              const name = prompt("範本名稱（儲存後可在「新增草稿」直接使用）");
              if (!name) return;
              try {
                await createTemplateFromDoc(name.trim(), null, doc);
                alert("已儲存為範本");
              } catch (e: any) {
                alert(e?.message || String(e));
              }
            }}>另存為範本</button>
            <button className="glass-btn glass-btn--secondary" onClick={() => nav("/drafts")}>回草稿</button>
          </div>
        </div>

        {doc.type === "carousel" && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <div ref={cardTabsRef} className="flex gap-2 overflow-x-auto pb-2 flex-1 items-center scroll-smooth no-scrollbar">
              {doc.cards.map((c, idx) => {
                const isSpecial = (c.section as SpecialSection).kind === "special";
                const sameTypeCount = doc.cards.slice(0, idx).filter(card =>
                  ((card.section as SpecialSection).kind === "special") === isSpecial
                ).length + 1;
                const defaultLabel = isSpecial ? `特殊 ${sameTypeCount}` : `卡片 ${sameTypeCount}`;
                const displayName = c.name || defaultLabel;

                return editingNameIdx === idx ? (
                  <input
                    key={c.id}
                    autoFocus
                    className="glass-input text-sm py-1 px-2 w-24 text-center rounded-full"
                    defaultValue={c.name || defaultLabel}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val) {
                        const nextCards = [...doc.cards];
                        nextCards[idx] = { ...c, name: val };
                        scheduleSave({ ...doc, cards: nextCards });
                      }
                      setEditingNameIdx(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditingNameIdx(null);
                    }}
                  />
                ) : (
                  <button
                    key={c.id}
                    draggable
                    onMouseDown={(e) => {
                      // Track if drag started
                      (e.currentTarget as any)._isDragging = false;
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("cardIdx", idx.toString());
                      (e.currentTarget as HTMLElement).style.opacity = "0.4";
                      (e.currentTarget as any)._isDragging = true;
                    }}
                    onDragEnd={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                      // Reset dragging state after a short delay
                      setTimeout(() => {
                        (e.currentTarget as any)._isDragging = false;
                      }, 100);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = parseInt(e.dataTransfer.getData("cardIdx"));
                      if (isNaN(from) || from === idx) return;
                      const nextCards = moveItem(doc.cards, from, idx);
                      scheduleSave({ ...doc, cards: nextCards });
                      setSelectedCardIdx(idx);
                    }}
                    className={`glass-btn text-sm whitespace-nowrap cursor-move rounded-full px-4 ${selectedCardIdx === idx ? (isSpecial ? "bg-purple-100 border-purple-300 text-purple-700 font-medium" : "bg-blue-100 border-blue-300 text-blue-700 font-medium") : "glass-btn--secondary hover:bg-gray-100"}`}
                    onClick={(e) => {
                      // Prevent click during drag
                      if ((e.currentTarget as any)._isDragging) return;
                      setSelectedCardIdx(idx);
                    }}
                    onDoubleClick={() => setEditingNameIdx(idx)}
                  >
                    {displayName}
                  </button>
                );
              })}

              <div className="w-px h-6 bg-gray-300 mx-1 flex-shrink-0" />

              <div className="relative">
                <select
                  className="glass-btn glass-btn--secondary text-sm px-3 pr-8 rounded-full appearance-none cursor-pointer bg-white hover:bg-gray-50"
                  value=""
                  onChange={(e) => {
                    const cardType = e.target.value;
                    if (!cardType) return;

                    let newCard;
                    if (cardType === "regular") {
                      newCard = {
                        id: uid("card_"),
                        section: {
                          hero: [{
                            id: uid("hero_"), kind: "hero_image", enabled: true,
                            image: { kind: "external", url: "https://placehold.co/600x400/png", lastCheck: { ok: true, level: "pass" } },
                            ratio: "20:13", mode: "cover"
                          }],
                          body: [],
                          footer: []
                        } as any
                      };
                    } else {
                      newCard = {
                        id: uid("card_"),
                        section: seedSpecialSection()
                      };
                    }

                    scheduleSave({ ...doc, cards: [...doc.cards, newCard] });
                    setSelectedCardIdx(doc.cards.length);
                    e.target.value = "";
                  }}
                >
                  <option value="">＋ 卡片</option>
                  <option value="regular">一般卡片</option>
                  <option value="special">特殊卡片</option>
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="glass-btn glass-btn--secondary text-sm text-blue-600" onClick={() => {
                const current = doc.cards[selectedCardIdx];
                const newCard = JSON.parse(JSON.stringify(current));
                newCard.id = uid("card_");
                const nextCards = [...doc.cards];
                nextCards.splice(selectedCardIdx + 1, 0, newCard);
                scheduleSave({ ...doc, cards: nextCards });
                setSelectedCardIdx(selectedCardIdx + 1);
              }}>複製當前</button>

              {doc.cards.length > 1 && (
                <button className="glass-btn glass-btn--secondary text-sm text-red-600" onClick={() => {
                  if (!confirm("確定刪除此卡片？")) return;
                  const nextCards = doc.cards.filter((_, i) => i !== selectedCardIdx);
                  scheduleSave({ ...doc, cards: nextCards });
                  setSelectedCardIdx(Math.max(0, selectedCardIdx - 1));
                }}>刪除當前</button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {/* Special Card Editor */}
          {isSpecialCard && specialSection ? (
            <>
              <AccordionSection
                title="滿版圖片"
                subtitle="上傳圖片，圖片會佔滿整張卡片"
                open={open === "hero"}
                onToggle={() => setOpen(open === "hero" ? "body" : "hero")}
                right={<span className="glass-badge glass-badge--purple">特殊卡片</span>}
              >
                <div className="space-y-3">
                  <label className="glass-btn glass-btn--secondary w-full justify-center">
                    上傳圖片
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1 * 1024 * 1024) return alert("檔案過大，請小於 1MB");
                      try {
                        const ext = file.name.split(".").pop();
                        const path = `${uid("img_")}.${ext}`;
                        const { error } = await supabase.storage.from("flex-assets").upload(path, file);
                        if (error) return alert("上傳失敗：" + error.message);
                        const { data: { publicUrl } } = supabase.storage.from("flex-assets").getPublicUrl(path);
                        setSection({ ...specialSection, image: { kind: "upload", assetId: path, url: publicUrl } });
                      } catch (err: any) {
                        alert("上傳錯誤：" + err.message);
                      }
                    }} />
                  </label>

                  <div className="mt-3">
                    <div className="glass-label mb-2">圖片比例</div>
                    <select
                      className="glass-input"
                      value={specialSection.ratio || "2:3"}
                      onChange={(e) => setSection({ ...specialSection, ratio: e.target.value as any })}
                    >
                      <option value="2:3">2:3 (直向卡片)</option>
                      <option value="9:16">9:16 (滿版直向)</option>
                      <option value="1:1">1:1 (正方形)</option>
                      <option value="4:3">4:3 (標準)</option>
                      <option value="16:9">16:9 (寬螢幕)</option>
                    </select>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                title="底部覆蓋層"
                subtitle="半透明背景，可調整高度與顏色"
                open={open === "body"}
                onToggle={() => setOpen(open === "body" ? "footer" : "body")}
                right={<span className="glass-badge">{specialSection.body.filter((c: any) => c.enabled).length} 個</span>}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="glass-label mb-2">覆蓋層高度</div>
                      <select
                        className="glass-input"
                        value={specialSection.overlay?.height || "auto"}
                        onChange={(e) => setSection({ ...specialSection, overlay: { ...specialSection.overlay, height: e.target.value as any } })}
                      >
                        <option value="auto">自動 (依內容)</option>
                        <option value="30%">30%</option>
                        <option value="40%">40%</option>
                        <option value="50%">50%</option>
                        <option value="60%">60%</option>
                        <option value="70%">70%</option>
                      </select>
                    </div>
                    <div>
                      <div className="glass-label mb-2">背景顏色</div>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                          value={(specialSection.overlay?.backgroundColor || "#03303A").substring(0, 7)}
                          onChange={(e) => {
                            const alpha = (specialSection.overlay?.backgroundColor || "#03303Acc").substring(7) || "cc";
                            setSection({ ...specialSection, overlay: { ...specialSection.overlay, backgroundColor: e.target.value + alpha } });
                          }}
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            className="glass-input text-sm"
                            value={specialSection.overlay?.backgroundColor || "#03303Acc"}
                            onChange={(e) => setSection({ ...specialSection, overlay: { ...specialSection.overlay, backgroundColor: e.target.value } })}
                            placeholder="#03303Acc"
                          />
                          <div className="text-xs opacity-70 mt-1">後2位為透明度 (00~ff)</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <div className="glass-label mb-2">覆蓋層內容</div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <button className="glass-btn text-xs py-2" onClick={() => {
                        const next = [...specialSection.body, { id: uid("t_"), kind: "title", enabled: true, text: "標題", size: "lg", weight: "bold", color: "#FFFFFF", align: "start" }];
                        setSection({ ...specialSection, body: next });
                      }}>＋ 標題</button>
                      <button className="glass-btn text-xs py-2" onClick={() => {
                        const next = [...specialSection.body, { id: uid("p_"), kind: "paragraph", enabled: true, text: "描述文字…", size: "md", weight: "regular", color: "#FFFFFF", wrap: true }];
                        setSection({ ...specialSection, body: next });
                      }}>＋ 段落</button>
                      <button className="glass-btn text-xs py-2" onClick={() => {
                        const next = [...specialSection.body, { id: uid("kv_"), kind: "key_value", enabled: true, label: "標籤", value: "內容" }];
                        setSection({ ...specialSection, body: next });
                      }}>＋ 標籤數值</button>
                    </div>

                    {specialSection.body.map((c: any, idx: number) => (
                      <div key={c.id} className="glass-panel p-3 mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-sm">{idx + 1}. {c.kind}</div>
                          <button className="glass-btn glass-btn--secondary px-2 py-1 text-xs text-red-600" onClick={() => {
                            const next = specialSection.body.filter((_: any, i: number) => i !== idx);
                            setSection({ ...specialSection, body: next });
                          }}>刪除</button>
                        </div>
                        {(c.kind === "title" || c.kind === "paragraph") && (
                          <div className="space-y-2">
                            <textarea className="glass-input text-sm" rows={2} value={c.text} onChange={(e) => {
                              const next = [...specialSection.body]; next[idx] = { ...c, text: e.target.value };
                              setSection({ ...specialSection, body: next });
                            }} />
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <ColorPicker label="文字顏色" value={c.color || "#FFFFFF"} onChange={(v) => {
                                  const next = [...specialSection.body]; next[idx] = { ...c, color: v.toUpperCase() };
                                  setSection({ ...specialSection, body: next });
                                }} />
                              </div>
                              <div className="w-20">
                                <div className="glass-label text-xs mb-1">大小</div>
                                <select className="glass-input text-sm" value={c.size} onChange={(e) => {
                                  const next = [...specialSection.body]; next[idx] = { ...c, size: e.target.value };
                                  setSection({ ...specialSection, body: next });
                                }}>
                                  <option value="xs">XS</option><option value="sm">SM</option>
                                  <option value="md">MD</option><option value="lg">LG</option><option value="xl">XL</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                        {c.kind === "key_value" && (
                          <div className="grid grid-cols-2 gap-2">
                            <input className="glass-input text-sm" placeholder="標籤" value={c.label} onChange={(e) => {
                              const next = [...specialSection.body]; next[idx] = { ...c, label: e.target.value };
                              setSection({ ...specialSection, body: next });
                            }} />
                            <input className="glass-input text-sm" placeholder="數值" value={c.value} onChange={(e) => {
                              const next = [...specialSection.body]; next[idx] = { ...c, value: e.target.value };
                              setSection({ ...specialSection, body: next });
                            }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionSection>
            </>
          ) : isVideoHero && heroVideo ? (
            <>
              <AccordionSection
                title="影片封面"
                subtitle="上傳影片檔案（MP4，最大 200MB）與預覽圖"
                open={open === "hero"}
                onToggle={() => setOpen(open === "hero" ? "body" : "hero")}
                right={<span className="glass-badge">影片</span>}
              >
                <div className="space-y-3">
                  <label className="glass-btn glass-btn--secondary w-full justify-center">
                    上傳影片
                    <input type="file" accept="video/mp4" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 200 * 1024 * 1024) return alert(`影片檔案過大，請小於 200 MB\n目前大小：${(file.size / 1024 / 1024).toFixed(1)} MB`);
                      try {
                        // 1. 上傳影片
                        const ext = file.name.split(".").pop();
                        const path = `${uid("video_")}.${ext}`;
                        const { error } = await supabase.storage.from("flex-assets").upload(path, file);
                        if (error) return alert("上傳失敗：" + error.message);
                        const { data: { publicUrl } } = supabase.storage.from("flex-assets").getPublicUrl(path);

                        // 2. 自動擷取第一幀作為預覽圖
                        let previewUrl = heroVideo.video?.previewUrl || "";
                        let previewAssetId = heroVideo.video?.kind === "upload" ? heroVideo.video.previewAssetId : "";
                        try {
                          const frameBlob = await extractVideoFrame(publicUrl, 0.1);
                          const previewPath = `${uid("preview_")}.jpg`;
                          const { error: previewError } = await supabase.storage.from("flex-assets").upload(previewPath, frameBlob, { contentType: "image/jpeg" });
                          if (!previewError) {
                            const { data: { publicUrl: previewPublicUrl } } = supabase.storage.from("flex-assets").getPublicUrl(previewPath);
                            previewUrl = previewPublicUrl;
                            previewAssetId = previewPath;
                          }
                        } catch (frameErr) {
                          console.warn("自動擷取預覽圖失敗，請手動上傳：", frameErr);
                        }

                        await updateHeroVideoSource(publicUrl, previewUrl, path, previewAssetId);
                      } catch (err: any) {
                        alert("上傳錯誤：" + err.message);
                      }
                    }} />
                  </label>
                  <label className="glass-btn glass-btn--secondary w-full justify-center">
                    上傳預覽圖
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1 * 1024 * 1024) return alert("檔案過大，請小於 1MB");
                      try {
                        const ext = file.name.split(".").pop();
                        const path = `${uid("img_")}.${ext}`;
                        const { error } = await supabase.storage.from("flex-assets").upload(path, file);
                        if (error) return alert("上傳失敗：" + error.message);
                        const { data: { publicUrl } } = supabase.storage.from("flex-assets").getPublicUrl(path);
                        await updateHeroVideoSource(heroVideo.video?.url || "", publicUrl, heroVideo.video?.kind === "upload" ? heroVideo.video.assetId : "", path);
                      } catch (err: any) {
                        alert("上傳錯誤：" + err.message);
                      }
                    }} />
                  </label>
                  <div className="mt-3">
                    <div className="glass-label mb-2">影片比例</div>
                    <select
                      className="glass-input"
                      value={heroVideo.ratio || "16:9"}
                      onChange={(e) => {
                        const regularSection = section as any;
                        const hero = regularSection.hero.map((c: any) => (c.kind === "hero_video" ? { ...c, ratio: e.target.value } : c));
                        setSection({ ...regularSection, hero });
                      }}
                    >
                      <option value="20:13">20:13 (標準卡片)</option>
                      <option value="9:16">9:16 (滿版/直向)</option>
                      <option value="16:9">16:9 (寬螢幕)</option>
                      <option value="4:3">4:3 (標準)</option>
                      <option value="1:1">1:1 (正方形)</option>
                    </select>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                title="內容設定"
                open={open === "body"}
                onToggle={() => setOpen(open === "body" ? "footer" : "body")}
                right={<span className="glass-badge">{section.body.filter((c: any) => c.enabled).length} 個</span>}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("t_"), kind: "title", enabled: true, text: "新標題", size: "lg", weight: "bold", color: "#111111", align: "start" }];
                      setSection({ ...section, body: next });
                    }}>＋ 標題</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("p_"), kind: "paragraph", enabled: true, text: "新段落…", size: "md", color: "#333333", wrap: true }];
                      setSection({ ...section, body: next });
                    }}>＋ 段落</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("kv_"), kind: "key_value", enabled: true, label: "標籤", value: "內容", action: { type: "uri", uri: "https://example.com" } }];
                      setSection({ ...section, body: next });
                    }}>＋ 標籤數值</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("l_"), kind: "list", enabled: true, items: [{ id: uid("i_"), text: "清單項目" }] }];
                      setSection({ ...section, body: next });
                    }}>＋ 列表</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("d_"), kind: "divider", enabled: true }];
                      setSection({ ...section, body: next });
                    }}>＋ 分隔線</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("s_"), kind: "spacer", enabled: true, size: "md" }];
                      setSection({ ...section, body: next });
                    }}>＋ 留白</button>
                  </div>

                  {section.body.map((c: any, idx: number) => (
                    <div key={c.id} className="glass-panel p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">{idx + 1}. {c.kind}</div>
                        <div className="flex items-center gap-1">
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === 0}
                            onClick={() => setSection({ ...section, body: moveItem(section.body, idx, idx - 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                          </button>
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === section.body.length - 1}
                            onClick={() => setSection({ ...section, body: moveItem(section.body, idx, idx + 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                          <button className="glass-btn glass-btn--secondary px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={() => {
                            const next = [...section.body]; next.splice(idx, 1);
                            setSection({ ...section, body: next });
                          }}>刪除</button>
                        </div>
                      </div>

                      {(c.kind === "title" || c.kind === "paragraph") ? (
                        <div className="mt-3 space-y-3">
                          <div>
                            <div className="glass-label mb-2">文字內容</div>
                            <textarea className="glass-input" rows={c.kind === "title" ? 2 : 3} value={c.text} onChange={(e) => {
                              const next = [...section.body]; next[idx] = { ...c, text: e.target.value };
                              setSection({ ...section, body: next });
                            }} />
                          </div>

                          <details className="group">
                            <summary className="cursor-pointer text-xs text-blue-600 font-medium py-1 select-none flex items-center gap-1">
                              <svg className="w-4 h-4 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                              調整樣式 (顏色/大小/粗細)
                            </summary>
                            <div className="pt-2 pl-4 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex-1 min-w-[150px]">
                                <ColorPicker
                                  label="文字顏色"
                                  value={c.color}
                                  colors={["#111111", "#8E8E93", "#0A84FF", "#30D158", "#FF453A"]}
                                  onChange={(v) => {
                                    const next = [...section.body]; next[idx] = { ...c, color: v.toUpperCase() };
                                    setSection({ ...section, body: next });
                                  }}
                                />
                              </div>
                              <div className="w-24">
                                <div className="glass-label mb-1">大小</div>
                                <select className="glass-input w-full py-1.5" value={c.size} onChange={(e) => {
                                  const next = [...section.body]; next[idx] = { ...c, size: e.target.value };
                                  setSection({ ...section, body: next });
                                }}>
                                  <option value="xs">XS</option><option value="sm">SM</option>
                                  <option value="md">MD</option><option value="lg">LG</option>
                                  <option value="xl">XL</option>
                                </select>
                              </div>
                              <div className="w-24">
                                <div className="glass-label mb-1">粗細</div>
                                <select className="glass-input w-full py-1.5" value={c.weight || "regular"} onChange={(e) => {
                                  const next = [...section.body]; next[idx] = { ...c, weight: e.target.value as any };
                                  setSection({ ...section, body: next });
                                }}>
                                  <option value="regular">一般</option>
                                  <option value="bold">粗體</option>
                                </select>
                              </div>
                            </div>
                          </details>
                        </div>
                      ) : null}

                      {c.kind === "key_value" ? (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><div className="glass-label mb-2">標籤名稱 (Label)</div><input className="glass-input" value={c.label} onChange={(e) => {
                              const next = [...section.body]; next[idx] = { ...c, label: e.target.value }; setSection({ ...section, body: next });
                            }} /></div>
                            <div><div className="glass-label mb-2">顯示數值 (Value)</div><input className="glass-input" value={c.value} onChange={(e) => {
                              const next = [...section.body]; next[idx] = { ...c, value: e.target.value }; setSection({ ...section, body: next });
                            }} /></div>
                          </div>
                          <div><div className="glass-label mb-2">連結網址 (URL)</div><input className="glass-input" value={c.action?.uri || ""} onChange={(e) => {
                            const next = [...section.body]; next[idx] = { ...c, action: { type: "uri", uri: e.target.value } }; setSection({ ...section, body: next });
                          }} /></div>
                        </div>
                      ) : null}

                      {c.kind === "list" ? (
                        <div className="mt-3 space-y-2">
                          {c.items.map((it: any, j: number) => (
                            <input key={it.id} className="glass-input" value={it.text} onChange={(e) => {
                              const next = [...section.body];
                              const items = [...c.items]; items[j] = { ...it, text: e.target.value };
                              next[idx] = { ...c, items }; setSection({ ...section, body: next });
                            }} />
                          ))}
                          <button className="glass-btn glass-btn--secondary w-full" onClick={() => {
                            const next = [...section.body]; next[idx] = { ...c, items: [...c.items, { id: uid("i_"), text: "新項目" }] };
                            setSection({ ...section, body: next });
                          }}>+ 新增項目</button>
                        </div>
                      ) : null}

                      {c.kind === "spacer" ? (
                        <div className="mt-3">
                          <div className="glass-label mb-2">留白大小</div>
                          <select className="glass-input" value={c.size} onChange={(e) => {
                            const next = [...section.body]; next[idx] = { ...c, size: e.target.value }; setSection({ ...section, body: next });
                          }}>
                            <option value="sm">sm</option><option value="md">md</option><option value="lg">lg</option>
                          </select>
                        </div>
                      ) : null}

                      {c.kind === "divider" ? <div className="mt-3 text-xs opacity-70">（分隔線無需設定）</div> : null}
                    </div>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection
                title="底部按鈕"
                subtitle="最多 3 顆；直向滿版"
                open={open === "footer"}
                onToggle={() => setOpen(open === "footer" ? "hero" : "footer")}
                right={<span className="glass-badge">{(section as any).footer?.length || 0}/3</span>}
              >
                <div className="space-y-3">
                  <button className="glass-btn w-full" disabled={((section as any).footer?.length || 0) >= 3} onClick={() => {
                    const bg = "#0A84FF";
                    const btn: FooterButton = { id: uid("btn_"), kind: "footer_button", enabled: true, label: "新按鈕", action: { type: "uri", uri: "https://example.com" }, style: "primary", bgColor: bg, textColor: autoTextColor(bg), autoTextColor: true };
                    setSection({ ...section, footer: [...((section as any).footer || []), btn].slice(0, 3) });
                  }}>+ 新增按鈕</button>

                  {((section as any).footer || []).map((b: any, idx: number) => (
                    <div key={b.id} className="glass-panel p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">按鈕 {idx + 1}</div>
                        <div className="flex items-center gap-1">
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === 0}
                            onClick={() => setSection({ ...section, footer: moveItem((section as any).footer, idx, idx - 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                          </button>
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === (section as any).footer.length - 1}
                            onClick={() => setSection({ ...section, footer: moveItem((section as any).footer, idx, idx + 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                          <button className="glass-btn glass-btn--secondary px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={() => {
                            const next = (section as any).footer.filter((_: any, i: number) => i !== idx);
                            setSection({ ...section, footer: next });
                          }}>刪除</button>
                        </div>
                      </div>

                      <div>
                        <div>
                          <div className="flex gap-4 mb-2">
                            <div className="flex-1">
                              <div className="glass-label mb-1">按鈕文字</div>
                              <input className="glass-input w-full" value={b.label} onChange={(e) => {
                                const next = [...(section as any).footer]; next[idx] = { ...b, label: e.target.value }; setSection({ ...section, footer: next });
                              }} />
                            </div>
                            <div className="w-1/3">
                              <div className="glass-label mb-1">動作類型</div>
                              <select className="glass-input w-full py-1.5" value={b.action.type} onChange={(e) => {
                                const type = e.target.value as any;
                                const next = [...(section as any).footer];
                                if (type === "uri") next[idx] = { ...b, action: { type, uri: "" } };
                                else if (type === "message") next[idx] = { ...b, action: { type, text: "" } };
                                else if (type === "share") next[idx] = { ...b, action: { type, uri: "" } };
                                setSection({ ...section, footer: next });
                              }}>
                                <option value="uri">開啟網址</option>
                                <option value="message">傳送文字</option>
                                <option value="share">分享好友</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="glass-label mb-2">
                              {b.action.type === "uri" ? "URL連結" : b.action.type === "message" ? "訊息文字" : "分享連結（自動填入）"}
                            </div>
                            <input
                              className={`glass-input w-full ${b.action.type === "share" ? "bg-gray-100 opacity-60 cursor-not-allowed" : ""}`}
                              disabled={b.action.type === "share"}
                              value={b.action.type === "uri" ? b.action.uri : b.action.type === "message" ? b.action.text : (shareUrl || "尚未發布，請先至預覽頁發布")}
                              onChange={(e) => {
                                if (b.action.type === "share") return;
                                const next = [...(section as any).footer];
                                if (b.action.type === "uri") next[idx] = { ...b, action: { ...b.action, uri: e.target.value } };
                                else if (b.action.type === "message") next[idx] = { ...b, action: { ...b.action, text: e.target.value } };
                                setSection({ ...section, footer: next });
                              }}
                            />
                            {b.action.type === "uri" ? <div className="mt-1 text-xs opacity-70">僅支援 https://、line://、liff://</div> : null}
                            {b.action.type === "share" && !shareUrl ? <div className="mt-1 text-xs text-amber-600">請先至「預覽與發布」頁面發布後，連結會自動顯示</div> : null}
                            {b.action.type === "share" && shareUrl ? <div className="mt-1 text-xs text-green-600">已發布 v{activeShare?.version_no}</div> : null}
                          </div>
                        </div>
                      </div>

                      <details className="glass-panel p-3">
                        <summary className="cursor-pointer font-semibold text-sm">顏色設定</summary>
                        <div className="mt-3 space-y-4">
                          <ColorPicker label="背景色" value={b.bgColor} onChange={(v) => {
                            const next = [...(section as any).footer];
                            next[idx] = { ...b, bgColor: v.toUpperCase(), textColor: b.autoTextColor ? autoTextColor(v) : b.textColor };
                            setSection({ ...section, footer: next });
                          }} />
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs opacity-70">文字色：{b.textColor}</div>
                            <button className="glass-btn glass-btn--secondary px-3 py-2 text-xs" onClick={() => {
                              const next = [...(section as any).footer]; next[idx] = { ...b, textColor: autoTextColor(b.bgColor), autoTextColor: true }; setSection({ ...section, footer: next });
                            }}>自動</button>
                          </div>
                          <ColorPicker label="文字色（手動）" value={b.textColor} onChange={(v) => {
                            const next = [...(section as any).footer]; next[idx] = { ...b, textColor: v.toUpperCase(), autoTextColor: false }; setSection({ ...section, footer: next });
                          }} />
                          <AutoTextColorHint bgColor={b.bgColor} textColor={b.textColor} />
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            </>
          ) : (
            /* Regular Card Editor */
            <>
              <AccordionSection
                title="封面圖片"
                subtitle="輪播卡片每張必填；建議使用 1.91:1 比例"
                open={open === "hero"}
                onToggle={() => setOpen(open === "hero" ? "body" : "hero")}
                right={<span className="glass-badge">{report.status === "publishable" ? "✅" : report.status === "previewable" ? "⚠️" : "📝"}</span>}
              >
                <div className="space-y-3">
                  <label className="glass-btn glass-btn--secondary w-full justify-center">
                    上傳圖片（Supabase Storage）
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      // Simple verification
                      if (file.size > 1 * 1024 * 1024) return alert("檔案過大，請小於 1MB");

                      try {
                        const ext = file.name.split(".").pop();
                        const path = `${uid("img_")}.${ext}`;
                        const { data, error } = await supabase.storage.from("flex-assets").upload(path, file);

                        if (error) {
                          console.error(error);
                          return alert("上傳失敗：" + error.message);
                        }

                        const { data: { publicUrl } } = supabase.storage.from("flex-assets").getPublicUrl(path);

                        await updateHeroImageSource({
                          kind: "upload",
                          assetId: path,
                          url: publicUrl
                        });
                      } catch (err: any) {
                        alert("上傳錯誤：" + err.message);
                      }
                    }} />
                  </label>



                  <div className="mt-3">
                    <div className="glass-label mb-2">圖片比例</div>
                    <select
                      className="glass-input"
                      value={(() => {
                        const heroArr = (section as any).hero || [];
                        const heroImage = heroArr.find((c: any) => c.kind === "hero_image");
                        return heroImage?.ratio || "20:13";
                      })()}
                      onChange={(e) => {
                        const ratio = e.target.value as any;
                        const heroArr = (section as any).hero || [];
                        const hero = heroArr.map((c: any) => c.kind === "hero_image" ? { ...c, ratio } : c);
                        setSection({ ...section, hero });
                      }}
                    >
                      <option value="20:13">20:13 (標準卡片)</option>
                      <option value="9:16">9:16 (滿版/直向)</option>
                      <option value="1.91:1">1.91:1 (矩形)</option>
                      <option value="16:9">16:9 (寬螢幕)</option>
                      <option value="4:3">4:3 (標準)</option>
                      <option value="1:1">1:1 (正方形)</option>
                    </select>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                title="內容設定"
                open={open === "body"}
                onToggle={() => setOpen(open === "body" ? "footer" : "body")}
                right={<span className="glass-badge">{section.body.filter((c: any) => c.enabled).length} 個</span>}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("t_"), kind: "title", enabled: true, text: "新標題", size: "lg", weight: "bold", color: "#111111", align: "start" }];
                      setSection({ ...section, body: next });
                    }}>＋ 標題</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("p_"), kind: "paragraph", enabled: true, text: "新段落…", size: "md", color: "#333333", wrap: true }];
                      setSection({ ...section, body: next });
                    }}>＋ 段落</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("kv_"), kind: "key_value", enabled: true, label: "標籤", value: "內容", action: { type: "uri", uri: "https://example.com" } }];
                      setSection({ ...section, body: next });
                    }}>＋ 標籤數值</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("l_"), kind: "list", enabled: true, items: [{ id: uid("i_"), text: "清單項目" }] }];
                      setSection({ ...section, body: next });
                    }}>＋ 列表</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("d_"), kind: "divider", enabled: true }];
                      setSection({ ...section, body: next });
                    }}>＋ 分隔線</button>
                    <button className="glass-btn text-xs py-2" onClick={() => {
                      const next = [...section.body, { id: uid("s_"), kind: "spacer", enabled: true, size: "md" }];
                      setSection({ ...section, body: next });
                    }}>＋ 留白</button>
                  </div>

                  {section.body.map((c: any, idx: number) => (
                    <div key={c.id} className="glass-panel p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">{idx + 1}. {c.kind}</div>
                        <div className="flex items-center gap-1">
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === 0}
                            onClick={() => setSection({ ...section, body: moveItem(section.body, idx, idx - 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                          </button>
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === section.body.length - 1}
                            onClick={() => setSection({ ...section, body: moveItem(section.body, idx, idx + 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                          <button className="glass-btn glass-btn--secondary px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={() => {
                            const next = [...section.body]; next.splice(idx, 1);
                            setSection({ ...section, body: next });
                          }}>刪除</button>
                        </div>
                      </div>

                      {(c.kind === "title" || c.kind === "paragraph") ? (
                        <div className="mt-3 space-y-3">
                          <div>
                            <div className="glass-label mb-2">文字內容</div>
                            <textarea className="glass-input" rows={c.kind === "title" ? 2 : 3} value={c.text} onChange={(e) => {
                              const next = [...section.body]; next[idx] = { ...c, text: e.target.value };
                              setSection({ ...section, body: next });
                            }} />
                          </div>

                          <details className="group">
                            <summary className="cursor-pointer text-xs text-blue-600 font-medium py-1 select-none flex items-center gap-1">
                              <svg className="w-4 h-4 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                              調整樣式 (顏色/大小/粗細)
                            </summary>
                            <div className="pt-2 pl-4 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex-1 min-w-[150px]">
                                <ColorPicker
                                  label="文字顏色"
                                  value={c.color}
                                  colors={["#111111", "#8E8E93", "#0A84FF", "#30D158", "#FF453A"]}
                                  onChange={(v) => {
                                    const next = [...section.body]; next[idx] = { ...c, color: v.toUpperCase() };
                                    setSection({ ...section, body: next });
                                  }}
                                />
                              </div>
                              <div className="w-24">
                                <div className="glass-label mb-1">大小</div>
                                <select className="glass-input w-full py-1.5" value={c.size} onChange={(e) => {
                                  const next = [...section.body]; next[idx] = { ...c, size: e.target.value };
                                  setSection({ ...section, body: next });
                                }}>
                                  <option value="xs">XS</option><option value="sm">SM</option>
                                  <option value="md">MD</option><option value="lg">LG</option>
                                  <option value="xl">XL</option>
                                </select>
                              </div>
                              <div className="w-24">
                                <div className="glass-label mb-1">粗細</div>
                                <select className="glass-input w-full py-1.5" value={c.weight || "regular"} onChange={(e) => {
                                  const next = [...section.body]; next[idx] = { ...c, weight: e.target.value as any };
                                  setSection({ ...section, body: next });
                                }}>
                                  <option value="regular">一般</option>
                                  <option value="bold">粗體</option>
                                </select>
                              </div>
                            </div>
                          </details>
                        </div>
                      ) : null}

                      {c.kind === "key_value" ? (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><div className="glass-label mb-2">標籤名稱 (Label)</div><input className="glass-input" value={c.label} onChange={(e) => {
                              const next = [...section.body]; next[idx] = { ...c, label: e.target.value }; setSection({ ...section, body: next });
                            }} /></div>
                            <div><div className="glass-label mb-2">顯示數值 (Value)</div><input className="glass-input" value={c.value} onChange={(e) => {
                              const next = [...section.body]; next[idx] = { ...c, value: e.target.value }; setSection({ ...section, body: next });
                            }} /></div>
                          </div>
                          <div><div className="glass-label mb-2">連結網址 (URL)</div><input className="glass-input" value={c.action?.uri || ""} onChange={(e) => {
                            const next = [...section.body]; next[idx] = { ...c, action: { type: "uri", uri: e.target.value } }; setSection({ ...section, body: next });
                          }} /></div>
                        </div>
                      ) : null}

                      {c.kind === "list" ? (
                        <div className="mt-3 space-y-2">
                          {c.items.map((it: any, j: number) => (
                            <input key={it.id} className="glass-input" value={it.text} onChange={(e) => {
                              const next = [...section.body];
                              const items = [...c.items]; items[j] = { ...it, text: e.target.value };
                              next[idx] = { ...c, items }; setSection({ ...section, body: next });
                            }} />
                          ))}
                          <button className="glass-btn glass-btn--secondary w-full" onClick={() => {
                            const next = [...section.body]; next[idx] = { ...c, items: [...c.items, { id: uid("i_"), text: "新項目" }] };
                            setSection({ ...section, body: next });
                          }}>+ 新增項目</button>
                        </div>
                      ) : null}

                      {c.kind === "spacer" ? (
                        <div className="mt-3">
                          <div className="glass-label mb-2">留白大小</div>
                          <select className="glass-input" value={c.size} onChange={(e) => {
                            const next = [...section.body]; next[idx] = { ...c, size: e.target.value }; setSection({ ...section, body: next });
                          }}>
                            <option value="sm">sm</option><option value="md">md</option><option value="lg">lg</option>
                          </select>
                        </div>
                      ) : null}

                      {c.kind === "divider" ? <div className="mt-3 text-xs opacity-70">（分隔線無需設定）</div> : null}
                    </div>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection
                title="底部按鈕"
                subtitle="最多 3 顆；直向滿版"
                open={open === "footer"}
                onToggle={() => setOpen(open === "footer" ? "hero" : "footer")}
                right={<span className="glass-badge">{(section as any).footer?.length || 0}/3</span>}
              >
                <div className="space-y-3">
                  <button className="glass-btn w-full" disabled={((section as any).footer?.length || 0) >= 3} onClick={() => {
                    const bg = "#0A84FF";
                    const btn: FooterButton = { id: uid("btn_"), kind: "footer_button", enabled: true, label: "新按鈕", action: { type: "uri", uri: "https://example.com" }, style: "primary", bgColor: bg, textColor: autoTextColor(bg), autoTextColor: true };
                    setSection({ ...section, footer: [...((section as any).footer || []), btn].slice(0, 3) });
                  }}>+ 新增按鈕</button>

                  {((section as any).footer || []).map((b: any, idx: number) => (
                    <div key={b.id} className="glass-panel p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">按鈕 {idx + 1}</div>
                        <div className="flex items-center gap-1">
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === 0}
                            onClick={() => setSection({ ...section, footer: moveItem((section as any).footer, idx, idx - 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                          </button>
                          <button
                            className="glass-btn glass-btn--secondary p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-500"
                            disabled={idx === (section as any).footer.length - 1}
                            onClick={() => setSection({ ...section, footer: moveItem((section as any).footer, idx, idx + 1) })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                          <button className="glass-btn glass-btn--secondary px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={() => {
                            const next = (section as any).footer.filter((_: any, i: number) => i !== idx);
                            setSection({ ...section, footer: next });
                          }}>刪除</button>
                        </div>
                      </div>

                      <div>
                        <div>
                          <div className="flex gap-4 mb-2">
                            <div className="flex-1">
                              <div className="glass-label mb-1">按鈕文字</div>
                              <input className="glass-input w-full" value={b.label} onChange={(e) => {
                                const next = [...(section as any).footer]; next[idx] = { ...b, label: e.target.value }; setSection({ ...section, footer: next });
                              }} />
                            </div>
                            <div className="w-1/3">
                              <div className="glass-label mb-1">動作類型</div>
                              <select className="glass-input w-full py-1.5" value={b.action.type} onChange={(e) => {
                                const type = e.target.value as any;
                                const next = [...(section as any).footer];
                                if (type === "uri") next[idx] = { ...b, action: { type, uri: "" } };
                                else if (type === "message") next[idx] = { ...b, action: { type, text: "" } };
                                else if (type === "share") next[idx] = { ...b, action: { type, uri: "" } };
                                setSection({ ...section, footer: next });
                              }}>
                                <option value="uri">開啟網址</option>
                                <option value="message">傳送文字</option>
                                <option value="share">分享好友</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="glass-label mb-2">
                              {b.action.type === "uri" ? "URL連結" : b.action.type === "message" ? "訊息文字" : "分享連結（自動填入）"}
                            </div>
                            <input
                              className={`glass-input w-full ${b.action.type === "share" ? "bg-gray-100 opacity-60 cursor-not-allowed" : ""}`}
                              disabled={b.action.type === "share"}
                              value={b.action.type === "uri" ? b.action.uri : b.action.type === "message" ? b.action.text : (shareUrl || "尚未發布，請先至預覽頁發布")}
                              onChange={(e) => {
                                if (b.action.type === "share") return;
                                const next = [...(section as any).footer];
                                if (b.action.type === "uri") next[idx] = { ...b, action: { ...b.action, uri: e.target.value } };
                                else if (b.action.type === "message") next[idx] = { ...b, action: { ...b.action, text: e.target.value } };
                                setSection({ ...section, footer: next });
                              }}
                            />
                            {b.action.type === "uri" ? <div className="mt-1 text-xs opacity-70">僅支援 https://、line://、liff://</div> : null}
                            {b.action.type === "share" && !shareUrl ? <div className="mt-1 text-xs text-amber-600">請先至「預覽與發布」頁面發布後，連結會自動顯示</div> : null}
                            {b.action.type === "share" && shareUrl ? <div className="mt-1 text-xs text-green-600">已發布 v{activeShare?.version_no}</div> : null}
                          </div>
                        </div>
                      </div>

                      <details className="glass-panel p-3">
                        <summary className="cursor-pointer font-semibold text-sm">顏色設定</summary>
                        <div className="mt-3 space-y-4">
                          <ColorPicker label="背景色" value={b.bgColor} onChange={(v) => {
                            const next = [...(section as any).footer];
                            next[idx] = { ...b, bgColor: v.toUpperCase(), textColor: b.autoTextColor ? autoTextColor(v) : b.textColor };
                            setSection({ ...section, footer: next });
                          }} />
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs opacity-70">文字色：{b.textColor}</div>
                            <button className="glass-btn glass-btn--secondary px-3 py-2 text-xs" onClick={() => {
                              const next = [...(section as any).footer]; next[idx] = { ...b, textColor: autoTextColor(b.bgColor), autoTextColor: true }; setSection({ ...section, footer: next });
                            }}>自動</button>
                          </div>
                          <ColorPicker label="文字色（手動）" value={b.textColor} onChange={(v) => {
                            const next = [...(section as any).footer]; next[idx] = { ...b, textColor: v.toUpperCase(), autoTextColor: false }; setSection({ ...section, footer: next });
                          }} />
                          <AutoTextColorHint bgColor={b.bgColor} textColor={b.textColor} />
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            </>
          )}

          <div className="sticky bottom-4">
            <div className="glass-panel p-3 flex gap-2">
              <button className="glass-btn flex-1" onClick={async () => { await flushSave(); nav(`/drafts/${id}/preview`); }}>下一步</button>
            </div>
            <div className="mt-2 text-xs opacity-70">{report.errors.length ? `❌ 有 ${report.errors.length} 個錯誤` : report.warnings.length ? `⚠️ 有 ${report.warnings.length} 個警告` : "✅ 可發布"}</div>
          </div>
        </div>

        <div className="space-y-4 sticky top-24 self-start">
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">即時預覽</div>
              <div className="flex items-center gap-2">
                <div className="bg-gray-100/50 border border-gray-200/50 p-0.5 rounded-lg flex text-xs">
                  <button className={`px-3 py-1 rounded-md transition ${viewMode === "preview" ? "bg-white shadow text-black font-medium" : "text-gray-500 hover:text-gray-700"}`} onClick={() => setViewMode("preview")}>預覽</button>
                  <button className={`px-3 py-1 rounded-md transition ${viewMode === "json" ? "bg-white shadow text-black font-medium" : "text-gray-500 hover:text-gray-700"}`} onClick={() => setViewMode("json")}>JSON</button>
                </div>
                <span className="glass-badge">{report.errors.length ? `❌ ${report.errors.length}` : report.warnings.length ? `⚠️ ${report.warnings.length}` : "✅ OK"}</span>
              </div>
            </div>
            <div className="mt-4">
              {viewMode === "json" ? (
                <textarea
                  className="w-full h-[500px] glass-input font-mono text-xs leading-5 p-3 resize-y"
                  value={jsonCode ?? JSON.stringify(buildFlex(doc), null, 2)}
                  onChange={(e) => setJsonCode(e.target.value)}
                  spellCheck={false}
                />
              ) : (
                <FlexPreview
                  doc={doc}
                  selectedIndex={currentCardIdx}
                  onIndexChange={(i) => {
                    if (i >= 0 && i < (doc.type === "carousel" ? doc.cards.length : 1)) {
                      setSelectedCardIdx(i);
                    }
                  }}
                  flex={jsonCode ? (() => { try { return JSON.parse(jsonCode); } catch { return undefined; } })() : undefined}
                />
              )}
            </div>
          </div>

          <div className="glass-panel p-4">
            <div className="font-semibold">驗證清單</div>
            <div className="mt-2 space-y-2 text-sm">
              {report.errors.map((e: any, i: number) => <div key={i} className="text-red-600">❌ {e.message}</div>)}
              {report.warnings.map((w: any, i: number) => <div key={i} className="text-amber-700">⚠️ {w.message}</div>)}
              {report.errors.length === 0 && report.warnings.length === 0 ? <div className="opacity-70">沒有問題。</div> : null}
            </div>
          </div>
        </div>
      </div >
    </div >
  );
}
