import { isRollable } from "@dnd/dice";
import type { Token } from "@dnd/tags";
import { type ReactNode, useContext } from "react";
import { RollingFor } from "../../rollerContext.ts";
import { RollButton } from "./RollButton.tsx";
import { RulesRef } from "./RulesRef.tsx";
import { StyleSpan } from "./StyleSpan.tsx";

function renderToken(token: Token, key: string, characterId: string | null): ReactNode {
  switch (token.kind) {
    case "text":
      return token.value;
    case "ref":
      return <RulesRef key={key} token={token} />;
    case "roll":
      if (characterId !== null && token.rollable && isRollable(token.notation)) {
        return (
          <RollButton
            key={key}
            characterId={characterId}
            notation={token.notation}
            display={token.display}
          />
        );
      }
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
 * text, its notation carried in data attributes, unless a character's sheet is open and the
 * notation rolls: then it is a button.
 */
export function RulesTokens({ tokens, keyPrefix }: { tokens: Token[]; keyPrefix: string }) {
  const characterId = useContext(RollingFor);
  return tokens.map((token, index) => renderToken(token, `${keyPrefix}-${index}`, characterId));
}
