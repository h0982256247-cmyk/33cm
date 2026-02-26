import { DocModel, Section, FooterButton, Action, SizeToken } from "./types";
import { isHexColor } from "./utils";

function sizeMap(s: SizeToken): string {
  return s;
}

function buildLiffShareUrl(docId?: string) {
  const liffId = import.meta.env.VITE_LIFF_ID || "YOUR_LIFF_ID";
  const targetId = docId || "PREVIEW_MODE";

  // ✅ 讓「電腦 Chrome」也能走得通的關鍵：
  // - 電腦 Chrome 本身不能彈 shareTargetPicker
  // - 但可以用 line://app deep link 叫起（已安裝的）LINE Desktop / LINE App
  // - 進入 LINE 內的 LIFF 後才可分享
  // NOTE: 仍然用 liff.state 帶 SPA 路由與 query
  const state = `/share?id=${encodeURIComponent(targetId)}&autoshare=1`;

  // line://app/{LIFF_ID}?liff.state=...
  // 在 LINE 裡點擊或在瀏覽器點擊，都會嘗試喚起 LINE（視裝置/瀏覽器安全設定）
  return `line://app/${liffId}?liff.state=${encodeURIComponent(state)}`;
}

function actionToFlex(a: Action, docId?: string) {
  if (a.type === "uri") return { type: "uri", uri: a.uri };
  if (a.type === "message") return { type: "message", text: a.text };
  if (a.type === "share") {
    return { type: "uri", uri: buildLiffShareUrl(docId) };
  }
  return { type: "uri", uri: "https://example.com" };
}

function safeHttpsUrl(url?: string) {
  if (!url) return null;
  if (typeof url !== "string") return null;
  if (!url.startsWith("https://")) return null;
  return url;
}

function sectionToBubble(section: Section, docId?: string) {
  const heroImg = section.hero.find((x: any) => x.enabled && x.kind === "hero_image") as any | undefined;

  const heroUrl = heroImg ? safeHttpsUrl(heroImg?.image?.url) : null;
  const hero = heroUrl
    ? {
        type: "image",
        url: heroUrl,
        aspectRatio: heroImg.ratio,
        aspectMode: heroImg.mode,
      }
    : undefined;

  const bodyContents: any[] = [];
  for (const c of section.body) {
    if (!c.enabled) continue;

    if (c.kind === "title")
      bodyContents.push({
        type: "text",
        text: c.text,
        weight: c.weight === "bold" ? "bold" : "regular",
        size: sizeMap(c.size),
        color: c.color,
        align: c.align,
        wrap: true,
      });

    if (c.kind === "paragraph")
      bodyContents.push({
        type: "text",
        text: c.text,
        size: sizeMap(c.size),
        color: c.color,
        wrap: true,
      });

    if (c.kind === "key_value") {
      const row: any = {
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          { type: "text", text: c.label, size: "sm", color: "#8E8E93", flex: 2, wrap: true },
          { type: "text", text: c.value, size: "sm", color: "#111111", flex: 5, wrap: true },
        ],
      };
      if (c.action) row.contents[1].action = actionToFlex(c.action, docId);
      bodyContents.push(row);
    }

    if (c.kind === "list")
      bodyContents.push({
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: c.items.map((it: any) => ({
          type: "text",
          text: "• " + it.text,
          size: "sm",
          color: "#111111",
          wrap: true,
        })),
      });

    if (c.kind === "divider") bodyContents.push({ type: "separator", margin: "md" });
    if (c.kind === "spacer") bodyContents.push({ type: "spacer", size: c.size });
  }

  const footerButtons = section.footer.filter((b) => b.enabled).slice(0, 3);
  const footer = footerButtons.length
    ? {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerButtons.map((b: FooterButton) => ({
          type: "button",
          style: "primary",
          color: isHexColor(b.bgColor) ? b.bgColor : "#0A84FF",
          action: actionToFlex(b.action, docId),
          height: "sm",
        })),
      }
    : undefined;

  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: bodyContents.length ? bodyContents : [{ type: "text", text: "（空）", size: "sm", color: "#8E8E93" }],
    },
  };

  if (hero) bubble.hero = hero;
  if (footer) bubble.footer = footer;

  return bubble;
}

export function buildFlex(doc: DocModel, docId?: string) {
  if (doc.type === "bubble") {
    return {
      type: "flex",
      altText: doc.title || "Flex Message",
      contents: sectionToBubble(doc.section, docId),
    };
  }

  // ✅ 保守：最多 10 頁，避免投遞失敗
  const cards = Array.isArray(doc.cards) ? doc.cards.slice(0, 10) : [];

  return {
    type: "flex",
    altText: doc.title || "Flex Message",
    contents: {
      type: "carousel",
      contents: cards.map((c) => sectionToBubble(c.section, docId)),
    },
  };
}
