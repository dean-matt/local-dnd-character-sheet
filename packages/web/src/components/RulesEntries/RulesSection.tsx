import { useContext } from "react";
import { type EntryNode, isEntries, str } from "../../lib/entryGuards.ts";
import { HeadingLevel } from "./headingLevelContext.ts";
import { RulesEntries } from "./RulesEntries.tsx";

const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** A named subsection of `entries`, its heading one level below the section around it. */
export function RulesSection({ entry }: { entry: EntryNode }) {
  const level = useContext(HeadingLevel);
  const Heading = HEADINGS[level - 1] ?? "h6";
  const name = str(entry.name);
  const children = isEntries(entry.entries) ? entry.entries : [];
  return (
    <section className="flex flex-col gap-2">
      {name && <Heading className="font-semibold">{name}</Heading>}
      <HeadingLevel value={name ? level + 1 : level}>
        <RulesEntries entries={children} />
      </HeadingLevel>
    </section>
  );
}
