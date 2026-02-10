import React, { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  title?: string;
  backTo?: string;
  backLabel?: string;
  left?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function TopActionBar({
  title,
  backTo,
  backLabel = "返回",
  left,
  actions,
  className = "",
}: Props) {
  const nav = useNavigate();

  return (
    <div className={`sticky top-0 z-50 bg-white border-b border-slate-200 ${className}`}>
      <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <button
              onClick={() => nav(backTo)}
              className="text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-md transition-colors whitespace-nowrap"
              title={backLabel}
            >
              ← {backLabel}
            </button>
          )}
          {left}
          {title && (
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900 truncate">{title}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      </div>
    </div>
  );
}
