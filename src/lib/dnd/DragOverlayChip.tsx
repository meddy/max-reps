export type DragOverlayChipProps = {
  label: string;
};

export function DragOverlayChip({ label }: DragOverlayChipProps) {
  return (
    <div className="cursor-grabbing touch-none rounded-xl bg-white px-4 py-3 font-medium text-gray-900 shadow-md">
      {label}
    </div>
  );
}
