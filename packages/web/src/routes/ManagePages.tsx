/**
 * Reorders and hides a character's pages with move and hide buttons rather than
 * dragging: a button works the same from a pointer, a keyboard and a screen reader,
 * where a drag needs a hand-built keyboard path beside it. Each change is announced
 * through one polite live region, since a row that moves makes no sound on its own.
 *
 * Renders as a modal dialog: focus is trapped inside while open, Escape closes it,
 * and focus returns to the trigger button on close.
 */
import type { CharacterPageRecord } from "@dnd/character";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useCharacterPages,
  useReplaceCharacterPages,
  useRestoreDefaultPages,
} from "../hooks/useCharacterPages.ts";
import { ErrorState } from "../states.tsx";

const secondaryBtn =
  "rounded-control border border-border px-3 py-1.5 text-row text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

function ArrowUp() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.6 10.6 0 0112 5c6 0 10 6 10 6a17.5 17.5 0 01-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s4 6 10 6a9.8 9.8 0 004.4-1" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </svg>
  );
}

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

  // Open as a modal when mounted; return focus on close is handled by the caller.
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
      className="m-auto rounded-card border-0 bg-surface p-0 shadow-modal print:hidden"
      style={{ width: "360px" }}
    >
      <div className="flex flex-col gap-3 p-5">
        {/* Title row */}
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M4 4l16 16M20 4L4 20" />
            </svg>
          </button>
        </div>

        <p id={descId} className="text-[11px] text-muted">
          Reorder or show/hide any page.
        </p>

        {error && <ErrorState message={error.message} />}

        {/* Page rows */}
        <ol className="flex flex-col gap-1">
          {pages.map((page, index) => {
            const lastVisible = !page.hidden && visible.length === 1;
            return (
              <li
                key={page.slug}
                className="flex items-center gap-1.5 rounded-control border border-border px-2 py-1.5"
              >
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Move ${page.title} up`}
                  aria-disabled={index === 0 || busy}
                  onClick={() => shift(page.slug, -1)}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Move ${page.title} down`}
                  aria-disabled={index === pages.length - 1 || busy}
                  onClick={() => shift(page.slug, 1)}
                >
                  <ArrowDown />
                </button>
                <span
                  className={`flex-1 truncate text-row ${page.hidden ? "text-muted" : "text-ink"}`}
                >
                  {page.title}
                  {page.hidden && <span className="sr-only"> (hidden)</span>}
                </span>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`${page.hidden ? "Show" : "Hide"} ${page.title}`}
                  aria-disabled={lastVisible || busy}
                  aria-describedby={lastVisible ? lastVisibleId : undefined}
                  onClick={() => toggle(page.slug)}
                >
                  {page.hidden ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </li>
            );
          })}
        </ol>

        {/* Footer */}
        <button
          type="button"
          className={secondaryBtn}
          aria-disabled={busy || replace.isPending}
          onClick={restoreDefaults}
        >
          Restore defaults
        </button>

        <p id={lastVisibleId} hidden={visible.length !== 1} className="text-muted text-row">
          The last visible page cannot be hidden.
        </p>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </dialog>
  );
}
