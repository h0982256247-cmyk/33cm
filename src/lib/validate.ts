import { DocModel, ValidationReport, ValidationIssue, ImageSource } from "./types";
import { isHexColor, safeUrlProtocol } from "./utils";

// LINE Flex Message 限制
const LIMITS = {
  TITLE_MAX: 400,
  TEXT_MAX: 2000,
  BUTTON_LABEL_MAX: 20,
  URI_MAX: 2000,
  KEY_VALUE_LABEL_MAX: 40,
  KEY_VALUE_VALUE_MAX: 300,
};

function issue(level: "error" | "warn", code: string, message: string, path: string): ValidationIssue {
  return { level, code, message, path };
}

function imagePublishable(img: ImageSource): boolean {
  if (img.kind === "upload") return img.url.startsWith("https://");
  const check = img.lastCheck;
  if (check && check.level === "fail") return false;
  return img.url.startsWith("https://") || img.url.startsWith("/");
}

export function validateDoc(doc: DocModel): ValidationReport {
  if (doc.type === "folder") {
    return { status: "publishable", errors: [], warnings: [] };
  }

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const checkFooter = (footer: any[], base: string) => {
    const enabledBtns = footer.filter((b: any) => b.enabled !== false);
    if (enabledBtns.length > 3) errors.push(issue("error", "E_FOOTER_TOO_MANY_BUTTONS", "Footer 最多只能 3 個按鈕", base));
    footer.forEach((b, i) => {
      if (b.enabled === false) return;
      if (!b.label?.trim()) errors.push(issue("error", "E_TEXT_REQUIRED", "按鈕文字為必填", `${base}[${i}].label`));
      else if (b.label.length > LIMITS.BUTTON_LABEL_MAX) errors.push(issue("error", "E_BUTTON_LABEL_TOO_LONG", `按鈕文字最多 ${LIMITS.BUTTON_LABEL_MAX} 字`, `${base}[${i}].label`));
      if (!b.action) errors.push(issue("error", "E_ACTION_REQUIRED", "按鈕動作為必填", `${base}[${i}].action`));
      if (b.action?.type === "uri") {
        if (!b.action.uri?.trim()) errors.push(issue("error", "E_ACTION_URI_INVALID", "連結格式不正確", `${base}[${i}].action.uri`));
        else if (!safeUrlProtocol(b.action.uri)) errors.push(issue("error", "E_ACTION_URI_PROTOCOL", "連結僅支援 https://、http://、line://、tel:", `${base}[${i}].action.uri`));
        else if (b.action.uri.length > LIMITS.URI_MAX) errors.push(issue("error", "E_URI_TOO_LONG", `連結最多 ${LIMITS.URI_MAX} 字元`, `${base}[${i}].action.uri`));
      }
      if (b.action?.type === "message" && !b.action.text?.trim()) errors.push(issue("error", "E_MESSAGE_TEXT_REQUIRED", "訊息內容為必填", `${base}[${i}].action.text`));
      if (b.bgColor && !isHexColor(b.bgColor)) warnings.push(issue("warn", "W_COLOR_FORMAT", "建議使用 #RRGGBB", `${base}[${i}].bgColor`));
      if (b.textColor && !isHexColor(b.textColor)) warnings.push(issue("warn", "W_COLOR_FORMAT", "建議使用 #RRGGBB", `${base}[${i}].textColor`));
    });
  };

  const checkBody = (body: any[], base: string) => {
    body.forEach((c, i) => {
      if (c.enabled === false) return;
      const path = `${base}[${i}]`;
      switch (c.kind) {
        case "title":
          if (!c.text?.trim()) errors.push(issue("error", "E_TITLE_EMPTY", "標題文字為必填", `${path}.text`));
          else if (c.text.length > LIMITS.TITLE_MAX) errors.push(issue("error", "E_TITLE_TOO_LONG", `標題最多 ${LIMITS.TITLE_MAX} 字`, `${path}.text`));
          if (c.color && !isHexColor(c.color)) warnings.push(issue("warn", "W_COLOR_FORMAT", "建議使用 #RRGGBB", `${path}.color`));
          break;
        case "paragraph":
          if (!c.text?.trim()) errors.push(issue("error", "E_PARAGRAPH_EMPTY", "段落文字為必填", `${path}.text`));
          else if (c.text.length > LIMITS.TEXT_MAX) errors.push(issue("error", "E_PARAGRAPH_TOO_LONG", `段落最多 ${LIMITS.TEXT_MAX} 字`, `${path}.text`));
          if (c.color && !isHexColor(c.color)) warnings.push(issue("warn", "W_COLOR_FORMAT", "建議使用 #RRGGBB", `${path}.color`));
          break;
        case "key_value":
          if (!c.label?.trim()) errors.push(issue("error", "E_KV_LABEL_EMPTY", "標籤為必填", `${path}.label`));
          else if (c.label.length > LIMITS.KEY_VALUE_LABEL_MAX) warnings.push(issue("warn", "W_KV_LABEL_LONG", `標籤建議 ${LIMITS.KEY_VALUE_LABEL_MAX} 字內`, `${path}.label`));
          if (!c.value?.trim()) errors.push(issue("error", "E_KV_VALUE_EMPTY", "值為必填", `${path}.value`));
          else if (c.value.length > LIMITS.KEY_VALUE_VALUE_MAX) warnings.push(issue("warn", "W_KV_VALUE_LONG", `值建議 ${LIMITS.KEY_VALUE_VALUE_MAX} 字內`, `${path}.value`));
          if (c.action?.type === "uri") {
            if (!safeUrlProtocol(c.action.uri)) errors.push(issue("error", "E_ACTION_URI_PROTOCOL", "連結僅支援 https://、http://、line://、tel:", `${path}.action.uri`));
            else if (c.action.uri.length > LIMITS.URI_MAX) errors.push(issue("error", "E_URI_TOO_LONG", `連結最多 ${LIMITS.URI_MAX} 字元`, `${path}.action.uri`));
          }
          break;
      }
    });
  };

  const checkSection = (section: any, base: string, requireHero: boolean) => {
    // Handle SpecialSection (has kind: "special")
    if (section.kind === "special") {
      // Special section validation
      if (section.image && !imagePublishable(section.image)) {
        warnings.push(issue("warn", "W_IMAGE_PUBLISH_BLOCK", "圖片不可確認可被 LINE 讀取（可預覽但不可發布）", `${base}.image`));
      }
      checkBody(section.body || [], `${base}.body`);
      return;
    }

    // Regular section validation
    const bodyEnabled = (section.body || []).filter((c: any) => c.enabled !== false);

    // Check for hero (image or video)
    const heroImage = (section.hero || []).find((c: any) => c.enabled !== false && c.kind === "hero_image");
    const heroVideo = (section.hero || []).find((c: any) => c.enabled !== false && c.kind === "hero_video");

    if (requireHero) {
      if (!heroImage && !heroVideo) {
        errors.push(issue("error", "E_HERO_REQUIRED", "每張卡片都必須有 Hero（圖片或影片）", `${base}.hero`));
      }
    }

    // Validate hero image
    if (heroImage && !imagePublishable(heroImage.image)) {
      warnings.push(issue("warn", "W_IMAGE_PUBLISH_BLOCK", "圖片不可確認可被 LINE 讀取（可預覽但不可發布）", `${base}.hero_image`));
    }

    // Validate hero video
    if (heroVideo) {
      const videoUrl = heroVideo.video?.url;
      const previewUrl = heroVideo.video?.previewUrl;

      if (!videoUrl || !videoUrl.trim()) {
        errors.push(issue("error", "E_VIDEO_URL_REQUIRED", "影片 URL 為必填", `${base}.hero_video.url`));
      } else if (!videoUrl.startsWith("https://")) {
        errors.push(issue("error", "E_VIDEO_URL_HTTPS", "影片 URL 必須使用 HTTPS", `${base}.hero_video.url`));
      }

      if (!previewUrl || !previewUrl.trim()) {
        errors.push(issue("error", "E_VIDEO_PREVIEW_REQUIRED", "影片預覽圖為必填", `${base}.hero_video.previewUrl`));
      } else if (!previewUrl.startsWith("https://") && !previewUrl.startsWith("/")) {
        warnings.push(issue("warn", "W_VIDEO_PREVIEW_HTTPS", "影片預覽圖建議使用 HTTPS", `${base}.hero_video.previewUrl`));
      }
    }

    checkBody(section.body || [], `${base}.body`);
    checkFooter(section.footer || [], `${base}.footer`);
  };

  if (doc.type === "bubble") {
    checkSection(doc.section, "section", false);

    // Check if bubble has video hero - must have valid bubbleSize
    const heroVideo = (doc.section.hero || []).find((c: any) => c.enabled !== false && c.kind === "hero_video");
    if (heroVideo) {
      const validSizes = ["kilo", "mega", "giga"];
      if (!doc.bubbleSize || !validSizes.includes(doc.bubbleSize)) {
        errors.push(issue("error", "E_VIDEO_BUBBLE_SIZE", "影片 Bubble 的 bubbleSize 必須是 kilo、mega 或 giga", "bubbleSize"));
      }
    }
  }
  else if (doc.type === "carousel") {
    if (doc.cards.length < 1) errors.push(issue("error", "E_CAROUSEL_EMPTY", "Carousel 至少需要 1 張卡片", "cards"));
    if (doc.cards.length > 5) errors.push(issue("error", "E_CAROUSEL_TOO_MANY", "Carousel 最多只能 5 張卡片", "cards"));

    // Check for video in carousel - NOT SUPPORTED by LINE
    doc.cards.forEach((c, i) => {
      if (c.section && "hero" in c.section) {
        const heroVideo = (c.section.hero || []).find((h: any) => h.enabled !== false && h.kind === "hero_video");
        if (heroVideo) {
          errors.push(issue("error", "E_VIDEO_IN_CAROUSEL", "LINE 不支援在 Carousel 中使用影片，請改用獨立 Bubble", `cards[${i}].section.hero`));
        }
      }
    });

    doc.cards.forEach((c, i) => checkSection(c.section, `cards[${i}].section`, true));
  }

  const status: ValidationReport["status"] =
    errors.length ? "draft" : warnings.some(w => w.code === "W_IMAGE_PUBLISH_BLOCK") ? "previewable" : "publishable";
  return { status, errors, warnings };
}

export function isPublishable(doc: DocModel): { ok: boolean; errors: ValidationIssue[] } {
  const rep = validateDoc(doc);
  const errors = [...rep.errors];
  rep.warnings.filter(w => w.code === "W_IMAGE_PUBLISH_BLOCK").forEach(w => errors.push({ ...w, level: "error", code: "E_IMAGE_PUBLISH_BLOCK" }));
  return { ok: errors.length === 0, errors };
}
