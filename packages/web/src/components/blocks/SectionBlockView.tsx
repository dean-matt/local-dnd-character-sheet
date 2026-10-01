import { AbilitiesSection } from "./AbilitiesSection.tsx";
import { AlignmentSection } from "./AlignmentSection.tsx";
import { FeaturesSection } from "./FeaturesSection.tsx";
import { IdentitySection } from "./IdentitySection.tsx";
import { InventorySection } from "./InventorySection.tsx";
import { LevelSection } from "./LevelSection.tsx";
import { NotesSection } from "./NotesSection.tsx";
import { SpellsSection } from "./SpellsSection.tsx";
import type { BlockViewProps } from "./types.ts";

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
    case "identity":
      return <IdentitySection character={character} />;
    case "level":
      return <LevelSection character={character} />;
    case "alignment":
      return <AlignmentSection character={character} />;
    case "notes":
      return <NotesSection character={character} />;
  }
}
