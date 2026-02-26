import React, { useMemo } from "react";
import { DocModel } from "@/lib/types";
import { buildFlex } from "@/lib/buildFlex";

export default function FlexPreview({ doc, flex, selectedIndex, onIndexChange }: { doc?: DocModel; flex?: any; selectedIndex?: number; onIndexChange?: (i: number) => void }) {
  const content = useMemo(() => {
    if (flex) return flex;
    if (doc) return buildFlex(doc);
    return null;
  }, [doc, flex]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastIndexRef = React.useRef<number>(-1);
  const isScrollingFromClick = React.useRef(false);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Scroll to selected card when selectedIndex changes (from clicking card tabs)
  React.useEffect(() => {
    if (selectedIndex !== undefined && scrollRef.current && selectedIndex !== lastIndexRef.current) {
      isScrollingFromClick.current = true;
      const cardWidth = 280 + 12; // width + gap
      const target = selectedIndex * cardWidth;
      scrollRef.current.scrollTo({ left: target, behavior: "smooth" });
      lastIndexRef.current = selectedIndex;

      // Reset flag after scroll animation completes
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingFromClick.current = false;
      }, 350);
    }
  }, [selectedIndex]);

  // Handle manual scroll - debounced to avoid conflicts
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onIndexChange || isScrollingFromClick.current) return;

    const cardWidth = 280 + 12;
    const idx = Math.round(e.currentTarget.scrollLeft / cardWidth);

    if (idx !== lastIndexRef.current && idx >= 0) {
      lastIndexRef.current = idx;
      onIndexChange(idx);
    }
  };

  // Handle click on preview card
  const handleCardClick = (index: number) => {
    if (onIndexChange && index !== lastIndexRef.current) {
      onIndexChange(index);
    }
  };

  if (!content) return null;

  // Handle Flex Message Wrapper
  const root = content.type === "flex" ? content.contents : content;

  // 防止 root 為 null 或 undefined
  if (!root || !root.type) {
    return <div className="text-sm text-gray-500">無法解析 Flex 內容</div>;
  }

  if (root.type === "carousel") {
    return (
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto pb-4 snap-x px-4 no-scrollbar scroll-smooth"
      >
        {root.contents.map((bubble: any, i: number) => (
          <div
            key={i}
            className={`min-w-[280px] max-w-[280px] snap-center flex-shrink-0 cursor-pointer transition-all duration-200 ${
              selectedIndex === i ? "ring-2 ring-blue-400 ring-offset-2 rounded-[18px]" : "hover:opacity-90"
            }`}
            onClick={() => handleCardClick(i)}
          >
            <FlexBubble bubble={bubble} />
          </div>
        ))}
        <div className="min-w-[1px]" />
      </div>
    );
  }

  if (root.type === "bubble") {
    return <FlexBubble bubble={root} />;
  }

  return <div>Unsupported Flex Type</div>;
}

function FlexBubble({ bubble }: { bubble: any }) {
  // Check if body has paddingAll="0px" (special card style)
  const isFullBleed = bubble.body?.paddingAll === "0px";

  let heroEl = null;
  // ===== Hero (可選) =====
  if (bubble.hero) {
    const hero = bubble.hero;
    if (hero.type === "image") {
      // 將 LINE 的 aspectRatio 格式 (20:13) 轉換為 CSS 格式 (20/13)
      const cssAspectRatio = (hero.aspectRatio || "20:13").replace(":", "/");
      heroEl = (
        <div
          className="w-full bg-gray-100 overflow-hidden"
          style={{
            aspectRatio: cssAspectRatio,
            maxHeight: "400px"
          }}
        >
          <img
            src={hero.url}
            alt="Hero"
            className={`w-full h-full object-${hero.aspectMode || "cover"}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        </div>
      );
    } else if (hero.type === "video") {
      // 影片預覽：顯示預覽圖（點擊後可播放影片）
      const cssAspectRatio = (hero.aspectRatio || "16:9").replace(":", "/");
      heroEl = (
        <div
          className="w-full bg-gray-100 overflow-hidden relative group cursor-pointer"
          style={{
            aspectRatio: cssAspectRatio,
            maxHeight: "400px"
          }}
        >
          <img
            src={hero.previewUrl}
            alt="Video Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
          {/* 播放按鈕圖標 */}
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all">
            <div className="w-16 h-16 rounded-full bg-white bg-opacity-90 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="bg-white rounded-[16px] overflow-hidden border border-gray-100 font-sans">
      {heroEl}

      {/* Body */}
      {bubble.body && (
        <div className={isFullBleed ? "" : "px-5 py-4"} style={isFullBleed ? { position: "relative" } : undefined}>
          <FlexBox box={bubble.body} isRoot />
        </div>
      )}

      {/* Footer */}
      {bubble.footer && (
        <div className="px-5 pb-4">
          <FlexBox box={bubble.footer} />
        </div>
      )}
    </div>
  );
}

function FlexBox({ box, isRoot }: { box: any; isRoot?: boolean }) {
  if (!box.contents || !Array.isArray(box.contents)) return null;

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: box.layout === "vertical" ? "column" : "row",
    gap: getSize(box.spacing) || "8px",
    alignItems: box.layout === "baseline" ? "baseline" : box.alignItems === "center" ? "center" : box.layout === "horizontal" ? "center" : "stretch",
    justifyContent: box.justifyContent === "center" ? "center" : box.justifyContent === "flex-end" ? "flex-end" : undefined,
    backgroundColor: box.backgroundColor,
    borderRadius: box.cornerRadius ? getCornerRadius(box.cornerRadius) : undefined,
    padding: box.paddingAll,
    cursor: box.action ? "pointer" : undefined,
  };

  // Handle absolute positioning for overlay boxes
  if (box.position === "absolute") {
    style.position = "absolute";
    style.bottom = box.offsetBottom || undefined;
    style.left = box.offsetStart || undefined;
    style.right = box.offsetEnd || undefined;
    style.top = box.offsetTop || undefined;
    if (box.height) style.height = box.height;
  }

  // Root box needs relative positioning if it contains absolute children
  if (isRoot && box.contents.some((c: any) => c.position === "absolute")) {
    style.position = "relative";
  }

  const handleClick = () => {
    if (box.action) {
      if (box.action.type === "uri") window.open(box.action.uri, "_blank");
      if (box.action.type === "message") alert(`[模擬訊息] ${box.action.text}`);
    }
  };

  return (
    <div style={style} onClick={box.action ? handleClick : undefined}>
      {box.contents.map((node: any, i: number) => (
        <FlexNode key={i} node={node} />
      ))}
    </div>
  );
}

function FlexNode({ node }: { node: any }) {
  if (node.type === "box") return <FlexBox box={node} />;
  if (node.type === "text") return <FlexText node={node} />;
  if (node.type === "button") return <FlexButton node={node} />;
  if (node.type === "image") return <FlexImage node={node} />;
  if (node.type === "separator") return <div className="h-px bg-gray-200 my-2" />;
  if (node.type === "spacer") return <div style={{ height: getSize(node.size) || "16px" }} />;
  return null;
}

function FlexText({ node }: { node: any }) {
  const style: React.CSSProperties = {
    flex: node.flex,
    fontSize: getFontSize(node.size) || "15px",
    fontWeight: node.weight === "bold" ? 700 : 400,
    color: node.color || "#111111",
    textAlign: node.align || "left",
    whiteSpace: node.wrap ? "pre-wrap" : "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.5,
  };
  return <div style={style}>{node.text}</div>;
}

function FlexButton({ node }: { node: any }) {
  const handleClick = () => {
    if (node.action) {
      if (node.action.type === "uri") window.open(node.action.uri, "_blank");
      if (node.action.type === "message") alert(`[模擬訊息] ${node.action.text}`);
    }
  };

  const isPrimary = node.style === "primary";
  const bgColor = node.color || "#06C755";

  const style: React.CSSProperties = {
    width: "100%",
    height: node.height === "sm" ? "42px" : "52px",
    backgroundColor: isPrimary ? bgColor : "transparent",
    color: isPrimary ? "#FFFFFF" : (node.color || "#06C755"),
    border: isPrimary ? "none" : `1px solid ${node.color || "#06C755"}`,
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "opacity 0.15s",
  };

  return (
    <button
      style={style}
      onClick={handleClick}
      onMouseOver={(e) => e.currentTarget.style.opacity = "0.85"}
      onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
    >
      {node.action?.label || node.action?.text || "按鈕"}
    </button>
  );
}

function FlexImage({ node, className }: { node: any; className?: string }) {
  const style: React.CSSProperties = {
    width: "100%",
    aspectRatio: node.aspectRatio?.replace(":", "/") || "auto",
    objectFit: node.aspectMode || "cover",
  };
  return <img src={node.url} style={style} className={className} alt="" />;
}

function getFontSize(token: string) {
  // LINE Flex Message 標準文字大小
  const fontMap: Record<string, string> = {
    xxs: "11px",
    xs: "13px",
    sm: "14px",
    md: "16px",
    lg: "19px",
    xl: "22px",
    xxl: "26px",
    "3xl": "32px",
    "4xl": "40px",
    "5xl": "48px",
  };
  return fontMap[token] || token;
}

function getSize(token: string) {
  // Spacing 大小
  const spaceMap: Record<string, string> = {
    none: "0px",
    xs: "2px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    xxl: "24px",
  };
  return spaceMap[token] || token;
}

function getCornerRadius(token: string) {
  const radiusMap: Record<string, string> = {
    none: "0px",
    xs: "2px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    xxl: "24px",
  };
  return radiusMap[token] || token;
}
