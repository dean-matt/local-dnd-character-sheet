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
