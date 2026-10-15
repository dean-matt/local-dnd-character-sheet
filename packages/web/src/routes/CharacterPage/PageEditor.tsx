/**
 * Edits one page in place: its title, and the blocks on it — added from a picker, edited,
 * moved and removed. Every change saves as it is made, through the page list's one write
 * queue, and the undo button walks those changes back.
 *
 * Blocks move with up and down buttons rather than dragging, as pages do in Manage pages:
 * a button works the same from a pointer, a keyboard and a screen reader. A block carries
 * no id, so focus follows a moved block by its new position, and each change is announced
 * through one polite live region.
 */
import { type CharacterPageRecord, type PageBlock, pageTitleSchema } from "@dnd/character";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Field } from "../../components/Field/Field.tsx";
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

  const { slug, blocks } = page;

  /** The whole list with this page's blocks edited, read from the cache a write updates. */
  const withBlocks = (edit: (latest: PageBlock[]) => PageBlock[]) =>
    replace
      .current()
      .map((each) => (each.slug === slug ? { ...each, blocks: edit(each.blocks) } : each));

  const atIndex = (index: number, edit: (latest: PageBlock) => PageBlock) =>
    withBlocks((latest) => latest.map((block, at) => (at === index ? edit(block) : block)));

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    const block = blocks[index];
    if (!block || to < 0 || to >= blocks.length) return;
    replace.write(
      withBlocks((latest) => {
        const next = [...latest];
        const [moved] = next.splice(index, 1);
        if (moved) next.splice(to, 0, moved);
        return next;
      }),
    );
    setFocus(`[data-block="${to}"] [data-move="${by < 0 ? "up" : "down"}"]`);
    setAnnouncement(`${blockLabel(block)} moved to position ${to + 1} of ${blocks.length}.`);
  }

  function remove(index: number) {
    const block = blocks[index];
    if (!block) return;
    replace.write(withBlocks((latest) => latest.filter((_, at) => at !== index)));
    setFocus("[data-add-block]");
    setAnnouncement(`${blockLabel(block)} removed.`);
  }

  function add(block: PageBlock) {
    replace.write(withBlocks((latest) => [...latest, block]));
    setPicking(false);
    setFocus(`[data-block="${blocks.length}"] [data-move="up"]`);
    setAnnouncement(`${blockLabel(block)} added.`);
  }

  return (
    <div ref={root} className="flex flex-col gap-3">
      {replace.error && <ErrorState error={replace.error} />}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 grow">
          <Field
            mode="edit"
            label="Page title"
            current={page.title}
            format={(title) => title}
            parse={(raw) => raw}
            schema={pageTitleSchema}
            onSave={(title: string) =>
              replace.save(
                replace.current().map((each) => (each.slug === slug ? { ...each, title } : each)),
                `title:${slug}`,
              )
            }
          />
        </div>
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
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: a page's blocks carry no id of their own.
                key={index}
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
                  onChange={(edit) => replace.write(atIndex(index, edit))}
                  onSave={(edit) => replace.save(atIndex(index, edit), `block:${slug}:${index}`)}
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
