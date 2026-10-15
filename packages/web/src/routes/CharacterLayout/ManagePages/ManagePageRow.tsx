import { type CharacterPageRecord, pageTitleSchema } from "@dnd/character";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { Field } from "../../../components/Field/Field.tsx";

const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * One page in Manage pages: move it, show or hide it, and rename and delete it where the
 * user wrote it. `lastVisible` holds hiding and deleting, which would leave no page to land on.
 */
export function ManagePageRow({
  page,
  first,
  last,
  lastVisible,
  lastVisibleId,
  busy,
  onShift,
  onToggle,
  onRemove,
  onRename,
}: {
  page: CharacterPageRecord;
  first: boolean;
  last: boolean;
  lastVisible: boolean;
  /** The note saying why, which a held button points at. */
  lastVisibleId: string;
  busy: boolean;
  onShift: (by: -1 | 1) => void;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (title: string) => Promise<void>;
}) {
  const held = lastVisible || busy;
  const heldBy = lastVisible ? lastVisibleId : undefined;
  return (
    <li
      data-page={page.slug}
      className="flex items-center gap-1.5 rounded-control border border-border px-2 py-1.5"
    >
      <button
        type="button"
        className={iconBtn}
        aria-label={`Move ${page.title} up`}
        aria-disabled={first || busy}
        onClick={() => onShift(-1)}
      >
        <ArrowUp size={13} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={iconBtn}
        aria-label={`Move ${page.title} down`}
        aria-disabled={last || busy}
        onClick={() => onShift(1)}
      >
        <ArrowDown size={13} strokeWidth={2.5} />
      </button>
      {page.preset ? (
        <span className={`flex-1 truncate text-row ${page.hidden ? "text-muted" : "text-ink"}`}>
          {page.title}
          {page.hidden && <span className="sr-only"> (hidden)</span>}
        </span>
      ) : (
        <div className="min-w-0 flex-1">
          <Field
            mode="edit"
            label={`Rename ${page.title}${page.hidden ? " (hidden)" : ""}`}
            labelHidden
            inputClassName={`py-1 text-row ${page.hidden ? "text-muted" : ""}`}
            current={page.title}
            format={(title) => title}
            parse={(raw) => raw}
            schema={pageTitleSchema}
            onSave={onRename}
          />
        </div>
      )}
      <button
        type="button"
        className={iconBtn}
        aria-label={`${page.hidden ? "Show" : "Hide"} ${page.title}`}
        aria-disabled={held}
        aria-describedby={heldBy}
        onClick={onToggle}
      >
        {page.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      {!page.preset && (
        <button
          type="button"
          className={iconBtn}
          aria-label={`Delete ${page.title}`}
          aria-disabled={held}
          aria-describedby={heldBy}
          onClick={onRemove}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
