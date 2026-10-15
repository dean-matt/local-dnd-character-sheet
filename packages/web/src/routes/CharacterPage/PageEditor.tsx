/**
 * Edits the blocks on one page in place — added from a picker, edited, moved and removed.
 * The page's title renames in Manage pages, not here. Every change saves as it is made,
 * through the page list's one write queue, and the undo button walks those changes back.
 *
 * Blocks move with up and down buttons rather than dragging, as pages do in Manage pages:
 * a button works the same from a pointer, a keyboard and a screen reader. Focus follows a
 * moved block by its new position, and each change is announced through one polite live
 * region.
 *
 * A stored block carries no id, so the editor gives each one an id of its own. A field
 * queues a save behind its last one, and that save finds its block by id when its turn
 * comes, so a move or a remove in between cannot point it at another block.
 */
import type { CharacterPageRecord, PageBlock } from "@dnd/character";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { PagesUndoButton } from "../../components/PagesUndoButton.tsx";
import { RemoveButton } from "../../components/RemoveButton.tsx";
import { ErrorState } from "../../ErrorState.tsx";
import { useReplaceCharacterPages } from "../../hooks/useReplaceCharacterPages.ts";
import { blockLabel } from "../../lib/blockLabels.ts";
import { BlockPicker } from "./BlockPicker.tsx";
import { BlockSettings } from "./BlockSettings.tsx";

const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export function PageEditor({ id, page }: { id: string; page: CharacterPageRecord }) {
  const replace = useReplaceCharacterPages(id);
  const [announcement, setAnnouncement] = useState("");
  const [picking, setPicking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // What takes focus once it renders: a block just added or moved sits where it lands.
  const [focus, setFocus] = useState<string>();

  useEffect(() => {
    if (focus === undefined) return;
    const target = root.current?.querySelector<HTMLElement>(focus);
    if (!target) return;
    target.focus();
    setFocus(undefined);
  });

  const { slug } = page;
  // Read from the cache a write updates, since the `page` the route passes can trail it
  // by a render, and the ids below must follow the list a queued save edits.
  const { blocks } = replace.current().find((each) => each.slug === slug) ?? page;

  // The ids in the cache's block order. The editor's own moves, removes and adds keep them
  // in step as they write; any other change, such as an undo, realigns them here by the
  // block objects they last named, or keeps them by position where the count still matches.
  const ids = useRef<number[]>([]);
  const named = useRef(new WeakMap<PageBlock, number>());
  const nextId = useRef(0);
  const known = blocks.map((block) => named.current.get(block));
  if (known.every((each) => each !== undefined) && new Set(known).size === known.length) {
    ids.current = known as number[];
  } else if (ids.current.length !== blocks.length) {
    ids.current = blocks.map(() => nextId.current++);
  }
  blocks.forEach((block, index) => {
    named.current.set(block, ids.current[index] as number);
  });
  // Scopes each field's undo key to this opening of the editor, so an edit after closing
  // and reopening it undoes on its own rather than with the one before.
  const session = useId();

  /** The whole list with this page's blocks edited, read from the cache a write updates. */
  const withBlocks = (edit: (latest: PageBlock[]) => PageBlock[]) =>
    replace
      .current()
      .map((each) => (each.slug === slug ? { ...each, blocks: edit(each.blocks) } : each));

  const byId = (id: number, edit: (latest: PageBlock) => PageBlock) =>
    withBlocks((latest) =>
      latest.map((block, at) => (ids.current[at] === id ? edit(block) : block)),
    );

  /** A save that lands after its block was removed writes nothing, so it leaves no undo entry. */
  async function saveBlock(id: number, edit: (latest: PageBlock) => PageBlock) {
    if (ids.current.includes(id))
      await replace.save(byId(id, edit), `${session}:block:${slug}:${id}`);
  }

  function reorder<T>(list: T[], from: number, to: number) {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    return next;
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    const block = blocks[index];
    if (!block || to < 0 || to >= blocks.length) return;
    replace.write(withBlocks((latest) => reorder(latest, index, to)));
    ids.current = reorder(ids.current, index, to);
    setFocus(`[data-block="${to}"] [data-move="${by < 0 ? "up" : "down"}"]`);
    setAnnouncement(`${blockLabel(block)} moved to position ${to + 1} of ${blocks.length}.`);
  }

  function remove(index: number) {
    const block = blocks[index];
    if (!block) return;
    replace.write(withBlocks((latest) => latest.filter((_, at) => at !== index)));
    ids.current = ids.current.filter((_, at) => at !== index);
    setFocus("[data-add-block]");
    setAnnouncement(`${blockLabel(block)} removed.`);
  }

  function add(block: PageBlock) {
    replace.write(withBlocks((latest) => [...latest, block]));
    ids.current = [...ids.current, nextId.current++];
    setPicking(false);
    setFocus(`[data-block="${blocks.length}"] [data-move="up"]`);
    setAnnouncement(`${blockLabel(block)} added.`);
  }

  return (
    <div ref={root} className="flex flex-col gap-3">
      {replace.error && <ErrorState error={replace.error} />}
      <div className="flex justify-end">
        <PagesUndoButton
          replace={replace}
          onUndone={() => setAnnouncement("Undid the last page change.")}
        />
      </div>

      {blocks.length === 0 ? (
        <p className="text-muted text-row">No blocks on this page yet.</p>
      ) : (
        <ol aria-label="Blocks" className="flex flex-col gap-2">
          {blocks.map((block, index) => {
            const name = blockLabel(block);
            const id = ids.current[index] as number;
            return (
              <li
                key={id}
                data-block={index}
                aria-label={`${name}, block ${index + 1} of ${blocks.length}`}
                className="flex flex-col gap-2 rounded-card border border-border border-dashed p-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-move="up"
                    className={iconBtn}
                    aria-label={`Move ${name} up`}
                    aria-disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" size={13} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    data-move="down"
                    className={iconBtn}
                    aria-label={`Move ${name} down`}
                    aria-disabled={index === blocks.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" size={13} strokeWidth={2.5} />
                  </button>
                  <span className="grow truncate font-semibold text-ink text-row">{name}</span>
                  <RemoveButton name={name} busy={false} onRemove={() => remove(index)} />
                </div>
                <BlockSettings
                  block={block}
                  onChange={(edit) => replace.write(byId(id, edit))}
                  onSave={(edit) => saveBlock(id, edit)}
                />
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        data-add-block
        onClick={() => setPicking(true)}
        className="flex items-center justify-center gap-1 rounded-card border border-border border-dashed px-3 py-2 font-semibold text-accent-text text-row hover:bg-subtle"
      >
        <Plus aria-hidden="true" size={14} />
        Add block
      </button>

      {picking && (
        <BlockPicker
          onAdd={add}
          onClose={() => {
            setPicking(false);
            setFocus("[data-add-block]");
          }}
        />
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
