import { DocModel, Section, FooterButton, Action, SizeToken, SpecialSection, CardSection, BubbleSize } from "./types";
import { isHexColor } from "./utils";

function sizeMap(s: SizeToken): string {
  return s;
}

function buildShareUrl(token?: string, docId?: string, liffId?: string) {
  const appUrl = import.meta.env.VITE_APP_URL || "https://33cm.zeabur.app";

  // 有 token 且有 liffId 時使用 LIFF URL 格式（自動觸發分享）
  if (token && liffId) {
    return `https://liff.line.me/${liffId}?token=${token}&autoshare=1`;
  }
  // 有 token 時使用正式分享連結格式
  if (token) {
    return `${appUrl}/share?token=${token}`;
  }
  // 預覽模式：使用 docId
  if (docId) {
    return `${appUrl}/share?id=${docId}`;
  }
  return `${appUrl}/share`;
}

function actionToFlex(a: Action, label?: string, docId?: string, token?: string, liffId?: string) {
  const common = label ? { label } : {};

  if (a.type === "uri") {
    // LINE Flex Message 的 URI 必須使用 HTTPS（官方規定）
    // 例外：line:// 和 tel: 協議允許使用
    let uri = a.uri;
    if (uri && !uri.startsWith("https://") && !uri.startsWith("line://") && !uri.startsWith("tel:")) {
      console.warn(`[Flex Message] URI 必須使用 HTTPS，已自動轉換: ${uri}`);
      // 嘗試自動轉換 http:// 為 https://
      if (uri.startsWith("http://")) {
        uri = uri.replace("http://", "https://");
      } else {
        // 如果不是有效的協議，使用預設值
        uri = "https://line.me";
      }
    }
    return { type: "uri", uri, ...common };
  }

  if (a.type === "message") return { type: "message", text: a.text, ...common };

  if (a.type === "share") {
    return { type: "uri", uri: buildShareUrl(token, docId, liffId), ...common };
  }

  return { type: "uri", uri: "https://line.me", ...common };
}

function safeHttpsUrl(url?: string) {
  if (!url) return null;
  if (typeof url !== "string") return null;
  if (!url.startsWith("https://")) return null;
  return url;
}

function sectionToBubble(section: Section, bubbleSize: BubbleSize, docId?: string, token?: string, liffId?: string) {
  const heroImg = section.hero.find((x: any) => x.enabled && x.kind === "hero_image") as any | undefined;
  const heroVideo = section.hero.find((x: any) => x.enabled && x.kind === "hero_video") as any | undefined;

  let hero: any = undefined;

  if (heroVideo) {
    const videoUrl = safeHttpsUrl(heroVideo?.video?.url);
    const previewUrl = safeHttpsUrl(heroVideo?.video?.previewUrl);
    if (videoUrl && previewUrl) {
      // 使用 LINE 官方 video component 格式
      // altContent 是必要的，給不支援 video 的舊版 LINE 顯示備用圖片
      hero = {
        type: "video",
        url: videoUrl,
        previewUrl: previewUrl,
        aspectRatio: heroVideo.ratio || "16:9",
        altContent: {
          type: "image",
          size: "full",
          aspectRatio: heroVideo.ratio || "16:9",
          aspectMode: "cover",
          url: previewUrl,
        },
      };
    }
  } else if (heroImg) {
    const heroUrl = safeHttpsUrl(heroImg?.image?.url);
    if (heroUrl) {
      hero = {
        type: "image",
        url: heroUrl,
        size: "full",
        aspectRatio: heroImg.ratio || "20:13",
        aspectMode: heroImg.mode || "cover",
      };
    }
  }

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
        weight: c.weight === "bold" ? "bold" : "regular",
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
      if (c.action) row.action = actionToFlex(c.action, undefined, docId, token, liffId);
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
      contents: footerButtons.map((b: FooterButton) => {
        // 統一使用 box 結構，可同時自訂文字色與背景色
        return {
          type: "box",
          layout: "vertical",
          contents: [{
            type: "text",
            text: b.label,
            color: isHexColor(b.textColor) ? b.textColor : "#FFFFFF",
            align: "center",
            weight: "bold",
          }],
          backgroundColor: isHexColor(b.bgColor) ? b.bgColor : "#0A84FF",
          cornerRadius: "md",
          justifyContent: "center",
          alignItems: "center",
          paddingAll: "10px",
          action: actionToFlex(b.action, undefined, docId, token, liffId),
        };
      }),
    }
    : undefined;

  const bubble: any = {
    type: "bubble",
    size: bubbleSize,
  };

  bubble.body = {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: bodyContents,
    backgroundColor: section.styles?.body?.backgroundColor,
    paddingAll: "20px",
  };

  if (hero) bubble.hero = hero;
  if (footer) bubble.footer = footer;

  return bubble;
}

function specialSectionToBubble(section: SpecialSection, bubbleSize: BubbleSize, docId?: string, token?: string, liffId?: string) {
  const imageUrl = safeHttpsUrl(section.image?.url) || "https://placehold.co/600x900/png";

  // Build overlay body contents
  const overlayContents: any[] = [];
  for (const c of section.body) {
    if (!c.enabled) continue;

    if (c.kind === "title")
      overlayContents.push({
        type: "text",
        text: c.text,
        weight: c.weight === "bold" ? "bold" : "regular",
        size: sizeMap(c.size),
        color: c.color,
        align: c.align,
        wrap: true,
      });

    if (c.kind === "paragraph")
      overlayContents.push({
        type: "text",
        text: c.text,
        size: sizeMap(c.size),
        weight: c.weight === "bold" ? "bold" : "regular",
        color: c.color,
        wrap: true,
      });

    if (c.kind === "key_value") {
      const row: any = {
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          { type: "text", text: c.label, size: "sm", color: "#CCCCCC", flex: 2, wrap: true },
          { type: "text", text: c.value, size: "sm", color: "#FFFFFF", flex: 5, wrap: true },
        ],
      };
      if (c.action) row.action = actionToFlex(c.action, undefined, docId, token, liffId);
      overlayContents.push(row);
    }

    if (c.kind === "list")
      overlayContents.push({
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: c.items.map((it: any) => ({
          type: "text",
          text: "• " + it.text,
          size: "sm",
          color: "#FFFFFF",
          wrap: true,
        })),
      });

    if (c.kind === "divider") overlayContents.push({ type: "separator", margin: "md", color: "#FFFFFF33" });
    if (c.kind === "spacer") overlayContents.push({ type: "spacer", size: c.size });
  }

  // Build overlay box with configurable height
  const overlayBox: any = {
    type: "box",
    layout: "vertical",
    contents: overlayContents,
    position: "absolute",
    offsetBottom: "0px",
    offsetStart: "0px",
    offsetEnd: "0px",
    backgroundColor: section.overlay?.backgroundColor || "#03303Acc",
    paddingAll: "20px",
    paddingTop: "18px",
  };

  // Apply height if not auto
  if (section.overlay?.height && section.overlay.height !== "auto") {
    overlayBox.height = section.overlay.height;
    overlayBox.justifyContent = "flex-end";
  }

  return {
    type: "bubble",
    size: bubbleSize,
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "image",
          url: imageUrl,
          size: "full",
          aspectMode: "cover",
          aspectRatio: section.ratio || "2:3",
          gravity: "top",
        },
        overlayBox,
      ],
      paddingAll: "0px",
    },
  };
}

function isSpecialSection(section: CardSection): section is SpecialSection {
  return (section as SpecialSection).kind === "special";
}

export function buildFlex(doc: DocModel, docId?: string, token?: string, liffId?: string) {
  if (doc.type === "folder") {
    return { type: "flex", altText: "Folder", contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [] } } };
  }

  const bubbleSize: BubbleSize = doc.bubbleSize || "kilo";

  if (doc.type === "bubble") {
    return {
      type: "flex",
      altText: doc.title || "Flex Message",
      contents: sectionToBubble(doc.section, bubbleSize, docId, token, liffId),
    };
  }

  // ✅ 保守：最多 10 頁，避免投遞失敗
  const cards = (doc.type === "carousel" && Array.isArray(doc.cards)) ? doc.cards.slice(0, 10) : [];

  return {
    type: "flex",
    altText: doc.title || "Flex Message",
    contents: {
      type: "carousel",
      contents: cards.map((c) => {
        if (isSpecialSection(c.section)) {
          return specialSectionToBubble(c.section, bubbleSize, docId, token, liffId);
        }
        return sectionToBubble(c.section, bubbleSize, docId, token, liffId);
      }),
    },
  };
}
