/**
 * Creates, deletes and hides a character's pages, and reorders them with move buttons rather
 * than dragging: a button works the same from a pointer, a keyboard and a screen reader,
 * where a drag needs a hand-built keyboard path beside it. Each change is announced
 * through one polite live region, since a row that moves makes no sound on its own.
 * New page adds a page behind the dialog and focuses its title for renaming there. Every
 * page renames in its row, here and nowhere else; only a page the user wrote deletes.
 *
 * Renders as a modal dialog: focus is trapped inside while open, Escape closes it,
 * and focus returns to the trigger button on close.
 */
import { type CharacterPageRecord, newPageSlug } from "@dnd/character";
import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PagesUndoButton } from "../../../components/PagesUndoButton.tsx";
import { ErrorState } from "../../../ErrorState.tsx";
import { useCharacterPages } from "../../../hooks/useCharacterPages.ts";
import { useReplaceCharacterPages } from "../../../hooks/useReplaceCharacterPages.ts";
import { useRestoreDefaultPages } from "../../../hooks/useRestoreDefaultPages.ts";
import { ManagePageRow } from "./ManagePageRow.tsx";

const secondaryBtn =
  "rounded-control border border-border px-3 py-1.5 text-row text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

function move(pages: CharacterPageRecord[], from: number, to: number) {
  const next = [...pages];
  const [page] = next.splice(from, 1);
  if (page) next.splice(to, 0, page);
  return next;
}

export function ManagePages({ id, onClose }: { id: string; onClose: () => void }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const pages = useCharacterPages(id).data ?? [];
  const replace = useReplaceCharacterPages(id);
  const restore = useRestoreDefaultPages(id);
  const [announcement, setAnnouncement] = useState("");
  const visible = pages.filter((page) => !page.hidden);
  const busy = restore.isPending;
  const lastVisibleId = useId();
  const headingId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Scopes each title's undo key to this opening of the dialog, as the page editor does.
  const session = useId();
  // The page whose title takes focus once its row renders.
  const [renaming, setRenaming] = useState<string>();

  useEffect(() => {
    if (renaming === undefined) return;
    const input = dialogRef.current?.querySelector<HTMLInputElement>(
      `[data-page="${renaming}"] input`,
    );
    if (!input) return;
    input.focus();
    input.select();
    setRenaming(undefined);
  });

  // Opens as a modal on mount; the caller returns focus on close.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    try {
      el.showModal();
    } catch {
      el.setAttribute("open", "");
    }
  }, []);

  function write(next: CharacterPageRecord[], message: string) {
    replace.write(next);
    setAnnouncement(message);
  }

  // Both read the cache rather than `pages`, which trails a press until React renders.
  function shift(target: string, by: -1 | 1) {
    const current = replace.current();
    const index = current.findIndex((page) => page.slug === target);
    const page = current[index];
    const to = index + by;
    if (busy || !page || to < 0 || to >= current.length) return;
    write(
      move(current, index, to),
      `${page.title} moved to position ${to + 1} of ${current.length}.`,
    );
  }

  function toggle(target: string) {
    const current = replace.current();
    const page = current.find((candidate) => candidate.slug === target);
    if (busy || !page) return;
    const hidden = !page.hidden;
    if (hidden && current.filter((candidate) => !candidate.hidden).length === 1) return;
    const next = current.map((candidate) =>
      candidate.slug === target ? { ...candidate, hidden } : candidate,
    );
    write(next, `${page.title} ${hidden ? "hidden" : "shown"}.`);
    if (hidden && target === slug) {
      const landing = next.find((candidate) => !candidate.hidden);
      if (landing) navigate(`/characters/${id}/p/${landing.slug}`, { replace: true });
    }
  }

  function create() {
    const current = replace.current();
    if (busy) return;
    const title = "New page";
    const created = newPageSlug(
      title,
      current.map((page) => page.slug),
    );
    write(
      [...current, { slug: created, title, hidden: false, blocks: [], preset: false }],
      `${title} added.`,
    );
    setRenaming(created);
    navigate(`/characters/${id}/p/${created}`);
  }

  function rename(target: string, title: string) {
    return replace.save(
      replace
        .current()
        .map((candidate) => (candidate.slug === target ? { ...candidate, title } : candidate)),
      `${session}:title:${target}`,
    );
  }

  function remove(target: string) {
    const current = replace.current();
    const page = current.find((candidate) => candidate.slug === target);
    if (busy || !page || page.preset) return;
    const next = current.filter((candidate) => candidate.slug !== target);
    if (!next.some((candidate) => !candidate.hidden)) return;
    write(next, `${page.title} deleted.`);
    if (target === slug) {
      const landing = next.find((candidate) => !candidate.hidden);
      if (landing) navigate(`/characters/${id}/p/${landing.slug}`, { replace: true });
    }
  }

  function restoreDefaults() {
    if (busy || replace.isPending) return;
    restore.mutate(undefined, {
      onSuccess: () => setAnnouncement("Default pages restored."),
    });
  }

  const error = replace.error ?? restore.error;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[360px] rounded-card border-0 bg-surface p-0 shadow-modal print:hidden"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 id={headingId} className="text-sm font-bold text-ink">
            Manage pages
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-control border-0 bg-transparent text-muted hover:bg-subtle"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <p id={descId} className="text-[11px] text-muted">
          Add a page, reorder, rename or show/hide any page, and delete one you added.
        </p>

        {error && <ErrorState error={error} />}

        <ol className="flex flex-col gap-1">
          {pages.map((page, index) => (
            <ManagePageRow
              key={page.slug}
              page={page}
              first={index === 0}
              last={index === pages.length - 1}
              lastVisible={!page.hidden && visible.length === 1}
              lastVisibleId={lastVisibleId}
              busy={busy}
              onShift={(by) => shift(page.slug, by)}
              onToggle={() => toggle(page.slug)}
              onRemove={() => remove(page.slug)}
              onRename={(title) => rename(page.slug, title)}
            />
          ))}
        </ol>

        <button
          type="button"
          className={`${secondaryBtn} flex items-center justify-center gap-1`}
          aria-disabled={busy}
          onClick={create}
        >
          <Plus size={13} aria-hidden="true" />
          New page
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryBtn}
            aria-disabled={busy || replace.isPending}
            onClick={restoreDefaults}
          >
            Restore defaults
          </button>
          <PagesUndoButton
            replace={replace}
            held={busy}
            onUndone={() => setAnnouncement("Undid the last page change.")}
          />
        </div>

        <p id={lastVisibleId} hidden={visible.length !== 1} className="text-muted text-row">
          The last visible page cannot be hidden or deleted.
        </p>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </dialog>
  );
}
