import { X } from "lucide-react";

export function RemoveItemButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      title="Remove"
      onClick={onRemove}
      className="relative flex size-4.5 shrink-0 items-center justify-center text-muted before:absolute before:-inset-1 hover:text-ink"
    >
      <X aria-hidden="true" size={12} />
    </button>
  );
}
