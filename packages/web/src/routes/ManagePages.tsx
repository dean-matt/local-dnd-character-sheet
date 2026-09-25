/**
 * Reorders and hides a character's pages with move and hide buttons rather than
 * dragging: a button works the same from a pointer, a keyboard and a screen reader,
 * where a drag needs a hand-built keyboard path beside it. Each change is announced
 * through one polite live region, since a row that moves makes no sound on its own.
 */
import type { CharacterPageRecord } from "@dnd/character";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useCharacterPages,
  useReplaceCharacterPages,
  useRestoreDefaultPages,
} from "../hooks/useCharacterPages.ts";
import { ErrorState } from "../states.tsx";

const control =
  "rounded-card border border-border px-2 py-0.5 text-row aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

function move(pages: CharacterPageRecord[], from: number, to: number) {
  const next = [...pages];
  const [page] = next.splice(from, 1);
  if (page) next.splice(to, 0, page);
  return next;
}

export function ManagePages({ id }: { id: string }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const pages = useCharacterPages(id).data ?? [];
  const replace = useReplaceCharacterPages(id);
  const restore = useRestoreDefaultPages(id);
  const [announcement, setAnnouncement] = useState("");
  const visible = pages.filter((page) => !page.hidden);
  const busy = restore.isPending;

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
    <section aria-labelledby="manage-pages-heading" className="flex flex-col gap-2">
      <h2 id="manage-pages-heading" className="font-semibold text-row">
        Manage pages
      </h2>
      {error && <ErrorState message={error.message} />}
      <ol className="flex flex-col gap-1">
        {pages.map((page, index) => {
          const lastVisible = !page.hidden && visible.length === 1;
          return (
            <li key={page.slug} className="flex flex-wrap items-center gap-1">
              <span className={`flex-1 text-row ${page.hidden ? "text-muted" : ""}`}>
                {page.title}
                {page.hidden && <span className="sr-only"> (hidden)</span>}
              </span>
              <button
                type="button"
                className={control}
                aria-label={`Move ${page.title} up`}
                aria-disabled={index === 0 || busy}
                onClick={() => shift(page.slug, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className={control}
                aria-label={`Move ${page.title} down`}
                aria-disabled={index === pages.length - 1 || busy}
                onClick={() => shift(page.slug, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className={control}
                aria-label={`${page.hidden ? "Show" : "Hide"} ${page.title}`}
                aria-disabled={lastVisible || busy}
                title={lastVisible ? "The last visible page cannot be hidden" : undefined}
                onClick={() => toggle(page.slug)}
              >
                {page.hidden ? "Show" : "Hide"}
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className={control}
        aria-disabled={busy || replace.isPending}
        onClick={restoreDefaults}
      >
        Restore defaults
      </button>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
