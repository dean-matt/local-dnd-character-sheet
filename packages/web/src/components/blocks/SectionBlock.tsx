import { AbilitiesSection } from "./AbilitiesSection.tsx";
import { FeaturesSection } from "./FeaturesSection.tsx";
import { InventorySection } from "./InventorySection.tsx";
import { SpellsSection } from "./SpellsSection.tsx";
import type { BlockViewProps } from "./types.ts";

/** A whole sheet section. */
export function SectionBlockView({ block, character, derived }: BlockViewProps) {
  if (block.kind !== "section") return null;
  switch (block.section) {
    case "abilities":
      return <AbilitiesSection character={character} derived={derived} />;
    case "spells":
      return <SpellsSection character={character} derived={derived} />;
    case "inventory":
      return <InventorySection character={character} derived={derived} />;
    case "features":
      return <FeaturesSection character={character} />;
  }
}
