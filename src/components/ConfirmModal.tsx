import React from "react";

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  open,
  title = "確認操作",
  description,
  confirmText = "確認",
  cancelText = "取消",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative w-[92%] max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-5">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {description && <div className="text-sm text-slate-600 mt-2 leading-relaxed">{description}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            {cancelText}
          </button>
          <button
            className={`px-3 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "處理中…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
