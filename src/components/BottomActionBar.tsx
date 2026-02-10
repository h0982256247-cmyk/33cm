import React, { ReactNode } from "react";

type Props = {
  left?: ReactNode;
  right?: ReactNode;
  note?: ReactNode;
};

export default function BottomActionBar({ left, right, note }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {note && (
        <div className="mx-auto max-w-5xl px-4 pb-2">
          <div className="text-xs text-slate-500 bg-white/80 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            {note}
          </div>
        </div>
      )}
      <div className="bg-white/90 backdrop-blur border-t border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">{left}</div>
          <div className="flex items-center gap-2">{right}</div>
        </div>
      </div>
    </div>
  );
}
