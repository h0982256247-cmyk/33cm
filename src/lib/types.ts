export type LayoutAlign = "start" | "center" | "end";
export type SizeToken = "xs" | "sm" | "md" | "lg" | "xl";
export type BubbleSize = "nano" | "micro" | "kilo" | "mega" | "giga";
export type ImgRatio = "1:1" | "16:9" | "4:3" | "20:13";
export type ImgMode = "cover" | "contain";

export type ImageCheckResult = { ok: boolean; level: "pass" | "warn" | "fail"; reasonCode?: string; checkedAt?: string };
export type ImageSource =
  | { kind: "upload"; assetId: string; url: string }
  | { kind: "external"; url: string; lastCheck?: ImageCheckResult };

export type VideoSource =
  | { kind: "upload"; assetId: string; url: string; previewAssetId: string; previewUrl: string }
  | { kind: "external"; url: string; previewUrl: string };

export type Action = { type: "uri"; uri: string } | { type: "message"; text: string } | { type: "share"; uri?: string };

export type ComponentBase = { id: string; kind: string; enabled: boolean };

export type HeroImage = ComponentBase & { kind: "hero_image"; image: ImageSource; ratio: ImgRatio; mode: ImgMode };
export type HeroVideo = ComponentBase & { kind: "hero_video"; video: VideoSource; ratio: ImgRatio | "1:1"; action?: Action };

export type BlockStyle = { backgroundColor?: string };
export type BubbleStyles = { header?: BlockStyle; hero?: BlockStyle; body?: BlockStyle; footer?: BlockStyle };

export type TitleText = ComponentBase & { kind: "title"; text: string; size: SizeToken; weight: "regular" | "bold"; color: string; align: LayoutAlign };
export type ParagraphText = ComponentBase & { kind: "paragraph"; text: string; size: SizeToken; weight?: "regular" | "bold"; color: string; wrap: true };
export type KeyValueRow = ComponentBase & { kind: "key_value"; label: string; value: string; action?: Action };
export type ListBlock = ComponentBase & { kind: "list"; items: { id: string; text: string }[] };
export type Divider = ComponentBase & { kind: "divider" };
export type Spacer = ComponentBase & { kind: "spacer"; size: "sm" | "md" | "lg" };

export type FooterButton = ComponentBase & { kind: "footer_button"; label: string; action: Action; style: "primary" | "secondary"; bgColor: string; textColor: string; autoTextColor: boolean };

export type Section = {
  hero: (HeroImage | HeroVideo)[];
  body: (TitleText | ParagraphText | KeyValueRow | ListBlock | Divider | Spacer)[];
  footer: FooterButton[];
  styles?: BubbleStyles;
};

// Special card section with full-bleed image and bottom overlay
export type OverlayConfig = {
  backgroundColor: string; // supports 8-digit hex for transparency (e.g., #03303Acc)
  height: "auto" | "30%" | "40%" | "50%" | "60%" | "70%";
};
export type SpecialSection = {
  kind: "special";
  image: ImageSource;
  ratio: ImgRatio | "2:3" | "9:16";
  overlay: OverlayConfig;
  body: (TitleText | ParagraphText | KeyValueRow | ListBlock | Divider | Spacer)[];
};

export type CardSection = Section | SpecialSection;
export type BubbleDoc = { type: "bubble"; title: string; section: Section; bubbleSize?: BubbleSize; folderId?: string };
export type CarouselDoc = { type: "carousel"; title: string; cards: { id: string; name?: string; section: CardSection }[]; bubbleSize?: BubbleSize; folderId?: string };
export type FolderDoc = { type: "folder"; id: string; name: string; parentId?: string };
export type DocModel = BubbleDoc | CarouselDoc | FolderDoc;

export type ValidationIssue = { code: string; level: "error" | "warn"; message: string; path: string };
export type ValidationReport = { status: "draft" | "previewable" | "publishable"; errors: ValidationIssue[]; warnings: ValidationIssue[] };
