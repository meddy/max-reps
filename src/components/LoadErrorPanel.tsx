type LoadErrorPanelProps = {
  title: string;
  message: string;
  onRetry: () => void;
};

export function LoadErrorPanel({
  title,
  message,
  onRetry,
}: LoadErrorPanelProps) {
  return (
    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Retry
      </button>
    </div>
  );
}
