// src/lib/renderLineFlex.ts
type Action =
  | { type: "uri"; uri: string; label?: string }
  | { type: "postback"; data: string; displayText?: string; label?: string }
  | { type: "message"; text: string; label?: string };

type SchemaBase = {
  type: "bubble";
  title?: string;
  section: {
    hero?: any[];   // your schema uses array
    body?: any[];
    footer?: any[];
  };
};

type CarouselSchema = {
  type: "carousel";
  title?: string;
  bubbles: SchemaBase[];
};

type LineMessage =
  | { type: "flex"; altText: string; contents: any }
  | { type: "text"; text: string };

const safeAltText = (s?: string) => (s && s.trim() ? s.trim().slice(0, 400) : "訊息");

function mapAction(a: any): Action | undefined {
  if (!a) return undefined;

  // your schema example: { type:"uri", uri:"https://..." }
  if (a.type === "uri" && typeof a.uri === "string") return { type: "uri", uri: a.uri };
  if (a.type === "message" && typeof a.text === "string") return { type: "message", text: a.text };
  if (a.type === "postback" && typeof a.data === "string") {
    const act: any = { type: "postback", data: a.data };
    if (typeof a.displayText === "string") act.displayText = a.displayText;
    return act;
  }

  // fallback: if schema uses { uri: "...", type:"uri" } already ok
  return undefined;
}

function toTextComponent(node: any) {
  // title / paragraph
  const text = String(node?.text ?? "");
  if (!text) return null;

  const comp: any = {
    type: "text",
    text,
    wrap: node?.wrap ?? true,
  };

  // map some styling
  if (node?.size) comp.size = node.size; // LINE sizes: xs, sm, md, lg, xl, xxl, 3xl, 4xl, 5xl
  if (node?.align) comp.align = node.align; // start/center/end
  if (node?.color) comp.color = node.color;
  if (node?.weight) comp.weight = node.weight; // regular/bold
  return comp;
}

function toSeparatorComponent() {
  return { type: "separator" };
}

function toKeyValueComponent(node: any) {
  // Render key_value as horizontal box: label (left) + value (right)
  const label = String(node?.label ?? "");
  const value = String(node?.value ?? "");

  const rightText: any = {
    type: "text",
    text: value,
    wrap: true,
    align: "end",
    color: "#111111",
    flex: 3,
  };

  const action = mapAction(node?.action);
  // In LINE Flex, action is available on text component
  if (action) rightText.action = action;

  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      {
        type: "text",
        text: label,
        wrap: true,
        color: "#666666",
        flex: 2,
      },
      rightText,
    ],
  };
}

function toFooterButtonComponent(node: any) {
  const label = String(node?.label ?? "按鈕").slice(0, 20);

  const action = mapAction(node?.action) ?? { type: "uri", uri: "https://example.com" };

  const btn: any = {
    type: "button",
    action: { ...action, label }, // LINE button action needs label
  };

  // style: primary/secondary/link
  if (node?.style) btn.style = node.style;
  if (node?.bgColor) btn.color = node.bgColor;

  return btn;
}

function compileBubble(schema: SchemaBase) {
  const heroNode = schema?.section?.hero?.find((x: any) => x?.enabled !== false);
  const bodyNodes = (schema?.section?.body ?? []).filter((x: any) => x?.enabled !== false);
  const footerNodes = (schema?.section?.footer ?? []).filter((x: any) => x?.enabled !== false);

  const bubble: any = { type: "bubble" };

  // HERO: your schema hero_image -> LINE image
  if (heroNode?.kind === "hero_image") {
    const url = heroNode?.image?.url;
    if (typeof url === "string" && url.startsWith("http")) {
      bubble.hero = {
        type: "image",
        url,
        size: "full",
        aspectRatio: heroNode?.ratio ?? "16:9",
        aspectMode: heroNode?.mode ?? "cover",
      };
    }
  }

  // BODY: convert each node
  const bodyContents: any[] = [];
  for (const n of bodyNodes) {
    if (n.kind === "divider") bodyContents.push(toSeparatorComponent());
    else if (n.kind === "title" || n.kind === "paragraph") {
      const t = toTextComponent(n);
      if (t) bodyContents.push(t);
    } else if (n.kind === "key_value") {
      bodyContents.push(toKeyValueComponent(n));
    }
  }

  bubble.body = {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: bodyContents.length ? bodyContents : [{ type: "text", text: " " }],
  };

  // FOOTER: buttons in a vertical box
  const footerButtons: any[] = [];
  for (const n of footerNodes) {
    if (n.kind === "footer_button") footerButtons.push(toFooterButtonComponent(n));
  }
  if (footerButtons.length) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons,
    };
  }

  return bubble;
}

/** ✅ 單一 bubble：回傳可直接丟 shareTargetPicker 的 messages */
export function compileToLineMessages(input: SchemaBase, opts?: { altText?: string }): LineMessage[] {
  const altText = safeAltText(opts?.altText ?? input?.title ?? "Flex 訊息");
  return [
    {
      type: "flex",
      altText,
      contents: compileBubble(input),
    },
  ];
}

/** ✅ 多頁（carousel）：回傳可直接丟 shareTargetPicker 的 messages */
export function compileCarouselToLineMessages(input: CarouselSchema, opts?: { altText?: string }): LineMessage[] {
  const altText = safeAltText(opts?.altText ?? input?.title ?? "Flex 訊息");
  const bubbles = (input?.bubbles ?? []).slice(0, 10).map(compileBubble); // carousel bubbles can be multiple
  return [
    {
      type: "flex",
      altText,
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    },
  ];
}
