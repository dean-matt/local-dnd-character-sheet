/**
 * Renders 5etools rules text: `RulesText` turns one markup string into its tokens, and
 * `RulesEntries` walks the recursive `entries` structure around it — prose, lists, tables
 * and named subsections — down to the strings `RulesText` renders.
 */
import { parseTags } from "@dnd/tags";
import { RulesBlock } from "./RulesBlock.tsx";
import { RulesTokens } from "./RulesTokens.tsx";

/** One string of upstream `{@tag}` markup, rendered as the elements its tokens mean. */
export function RulesText({ text }: { text: string }) {
  return (
    <RulesBlock content={text}>
      <RulesTokens tokens={parseTags(text)} keyPrefix="t" />
    </RulesBlock>
  );
}
