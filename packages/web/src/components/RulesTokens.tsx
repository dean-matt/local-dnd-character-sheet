import type { Token } from "@dnd/tags";
import type { ReactNode } from "react";
import { RulesRef } from "./RulesRef.tsx";
import { StyleSpan } from "./StyleSpan.tsx";

function renderToken(token: Token, key: string): ReactNode {
  switch (token.kind) {
    case "text":
      return token.value;
    case "ref":
      return <RulesRef key={key} token={token} />;
    case "roll":
      return (
        <span key={key} data-notation={token.notation} data-rollable={token.rollable}>
          {token.display}
        </span>
      );
    case "style":
      return <StyleSpan key={key} token={token} keyPrefix={key} />;
  }
}

/**
 * A parsed markup string's tokens, as the elements each one means. A roll renders as its
 * text until a later tier makes it clickable.
 */
export function RulesTokens({ tokens, keyPrefix }: { tokens: Token[]; keyPrefix: string }) {
  return tokens.map((token, index) => renderToken(token, `${keyPrefix}-${index}`));
}
