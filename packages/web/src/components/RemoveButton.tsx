import { X } from "lucide-react";

/** `busy` marks the button disabled while keeping its focus, for a list that drops clicks. */
export function RemoveButton({
  name,
  onRemove,
  busy,
}: {
  name: string;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      title="Remove"
      aria-disabled={busy || undefined}
      onClick={onRemove}
      className="relative flex size-4.5 shrink-0 items-center justify-center text-muted before:absolute before:-inset-1 hover:text-ink"
    >
      <X aria-hidden="true" size={12} />
    </button>
  );
}
