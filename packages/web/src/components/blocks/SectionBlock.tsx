import type { SheetSection } from "@dnd/character";
import { EmptyState } from "../../states.tsx";
import { AbilitiesSection } from "./AbilitiesSection.tsx";
import { FeaturesSection } from "./FeaturesSection.tsx";
import { SpellsSection } from "./SpellsSection.tsx";
import type { BlockViewProps } from "./types.ts";

const SECTION_LABELS: Record<SheetSection, string> = {
  abilities: "Abilities",
  spells: "Spells",
  inventory: "Inventory",
  features: "Features",
};

/** A whole sheet section. Each one renders for real once its own issue ships it. */
export function SectionBlockView({ block, character, derived }: BlockViewProps) {
  if (block.kind !== "section") return null;
  if (block.section === "abilities") {
    return <AbilitiesSection character={character} derived={derived} />;
  }
  if (block.section === "spells") {
    return <SpellsSection character={character} derived={derived} />;
  }
  if (block.section === "features") return <FeaturesSection character={character} />;
  return <EmptyState>{SECTION_LABELS[block.section]} isn't built yet.</EmptyState>;
}
