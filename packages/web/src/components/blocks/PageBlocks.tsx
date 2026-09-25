/**
 * The one place a page's blocks turn into elements, in the order they came in — the
 * renderer both a preset and a page the user writes go through. A block kind is added
 * by adding one entry to `REGISTRY` and one branch to `@dnd/character`'s
 * `pageBlockSchema`, never a switch here.
 */
import type { CharacterDerived, CharacterRecord, PageBlock } from "@dnd/character";
import type { FunctionComponent } from "react";
import { ListBlockView } from "./ListBlock.tsx";
import { SectionBlockView } from "./SectionBlock.tsx";
import { TextBlockView } from "./TextBlock.tsx";
import type { BlockViewProps } from "./types.ts";
import { UnknownBlockView } from "./UnknownBlock.tsx";
import { ValueBlockView } from "./ValueBlock.tsx";

const REGISTRY: Record<PageBlock["kind"], FunctionComponent<BlockViewProps>> = {
  section: SectionBlockView,
  value: ValueBlockView,
  list: ListBlockView,
  text: TextBlockView,
  unknown: UnknownBlockView,
};

export function PageBlocks({
  blocks,
  character,
  derived,
}: {
  blocks: PageBlock[];
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        const View = REGISTRY[block.kind];
        // biome-ignore lint/suspicious/noArrayIndexKey: a page's blocks carry no id of their own.
        return <View key={index} block={block} character={character} derived={derived} />;
      })}
    </div>
  );
}
