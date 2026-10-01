import type { Token } from "@dnd/tags";
import type { ElementType } from "react";
import { RulesTokens } from "./RulesTokens.tsx";

type StyleToken = Extract<Token, { kind: "style" }>;
type Emphasis = StyleToken["style"];

const STYLE_ELEMENTS: Record<Emphasis, { as: ElementType; className?: string }> = {
  bold: { as: "strong" },
  italic: { as: "em" },
  underline: { as: "u" },
  underlineDouble: { as: "u", className: "decoration-double" },
  strike: { as: "s" },
  strikeDouble: { as: "s", className: "decoration-double" },
  highlight: { as: "mark" },
  superscript: { as: "sup" },
  subscript: { as: "sub" },
  keyboard: { as: "kbd" },
  code: { as: "code" },
};

export function StyleSpan({ token, keyPrefix }: { token: StyleToken; keyPrefix: string }) {
  const { as: Element, className } = STYLE_ELEMENTS[token.style];
  return (
    <Element className={className}>
      <RulesTokens tokens={token.children} keyPrefix={keyPrefix} />
    </Element>
  );
}
