import { X } from "lucide-react";

/**
 * `busy` marks the button disabled while keeping its focus, for a list that drops clicks.
 * `verb` names the action in its label and tooltip.
 */
export function RemoveButton({
  name,
  onRemove,
  busy,
  verb = "Remove",
}: {
  name: string;
  onRemove: () => void;
  busy: boolean;
  verb?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${verb} ${name}`}
      title={verb}
      aria-disabled={busy || undefined}
      onClick={onRemove}
      className="relative flex size-4.5 shrink-0 items-center justify-center text-muted before:absolute before:-inset-1 hover:text-ink"
    >
      <X aria-hidden="true" size={12} />
    </button>
  );
}
