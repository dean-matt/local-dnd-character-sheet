import type { CharacterRecord } from "@dnd/character";
import type { ReactNode } from "react";

/** The shape every chip shares, whatever its colors. */
export const CHIP = "rounded-chip border px-1.25 py-0.5 font-bold text-chip tracking-chip";

/** A chip, such as Prepared or Equipped beside a row's name. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className={`${CHIP} border-border bg-surface text-muted uppercase`}>{children}</span>
  );
}

export const EDITION_LABELS: Record<CharacterRecord["edition"], string> = {
  classic: "2014",
  one: "2024",
};

/** A character's edition as its year, which a screen reader hears as the year's rules. */
export function EditionTag({ edition }: { edition: CharacterRecord["edition"] }) {
  const year = EDITION_LABELS[edition];
  return (
    <span title={`This character uses the ${year} rules`} className="shrink-0 self-center">
      <Tag>
        {year}
        <span className="sr-only"> rules</span>
      </Tag>
    </span>
  );
}
