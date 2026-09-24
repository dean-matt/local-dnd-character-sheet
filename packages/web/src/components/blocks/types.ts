import type { CharacterDerived, PageBlock } from "@dnd/character";

/**
 * What every block view takes. `derived` reaches every kind alike, even the ones that
 * ignore it, so a new kind that needs it costs nothing to wire up.
 */
export interface BlockViewProps {
  block: PageBlock;
  derived: CharacterDerived | undefined;
}
