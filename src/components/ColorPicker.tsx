import React, { useMemo } from "react";
import { PALETTE } from "@/lib/templates";
import { autoTextColor, isHexColor } from "@/lib/utils";

export default function ColorPicker({ label, value, onChange, allowCustom = true, colors }: {
  label: string; value: string; onChange: (v: string) => void; allowCustom?: boolean; colors?: string[];
}) {
  const palette = useMemo(() => colors || PALETTE, [colors]);
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {palette.map((c) => (
          <button key={c} type="button" className="h-9 w-9 rounded-full border border-white/30" style={{ background: c }} onClick={() => onChange(c)} title={c} />
        ))}
        {allowCustom ? (
          <label className="inline-flex items-center px-3 py-2 text-sm bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm cursor-pointer">
            自訂
            <input className="ml-2" type="color" value={isHexColor(value) ? value : "#0A84FF"} onChange={(e) => onChange(e.target.value.toUpperCase())} />
          </label>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs opacity-70">HEX</span>
        <input
          className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500/20 outline-none"
          value={value}
          onChange={(e) => {
            let v = e.target.value;
            if (!v.startsWith("#") && /^[0-9A-Fa-f]{0,6}$/.test(v)) v = "#" + v;
            onChange(v.toUpperCase());
          }}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

export function AutoTextColorHint({ bgColor, textColor }: { bgColor: string; textColor: string }) {
  const auto = autoTextColor(bgColor);
  const ok = auto.toLowerCase() === textColor.toLowerCase();
  return <div className="mt-2 text-xs opacity-70">建議文字色：{auto} {ok ? "（已最佳化）" : "（可按「自動」修正）"}</div>;
}
