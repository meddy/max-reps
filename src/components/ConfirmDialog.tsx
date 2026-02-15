import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = "danger",
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "primary";
}) {
  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-500 focus:ring-red-500"
      : "bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500";

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white px-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`min-h-[44px] flex-1 rounded-xl px-4 font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
