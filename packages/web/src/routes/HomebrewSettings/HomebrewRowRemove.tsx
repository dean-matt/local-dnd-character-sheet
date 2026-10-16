import { X } from "lucide-react";

/** The red × that drops one row of a homebrew row list, named for a screen reader by `name`. */
export function HomebrewRowRemove({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      title="Remove"
      onClick={onRemove}
      className="flex size-9 items-center justify-center self-end rounded-control text-error hover:bg-subtle"
    >
      <X aria-hidden size={16} />
    </button>
  );
}
