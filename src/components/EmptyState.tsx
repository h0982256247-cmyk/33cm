import React, { ReactNode } from "react";

type Props = {
  title: string;
  desc?: string;
  icon?: ReactNode;
  actions?: ReactNode;
};

export default function EmptyState({ title, desc, icon, actions }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">
        {icon || "📭"}
      </div>
      <div className="mt-4 text-lg font-semibold text-slate-900">{title}</div>
      {desc && <div className="mt-2 text-sm text-slate-600 max-w-md mx-auto">{desc}</div>}
      {actions && <div className="mt-6 flex items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
