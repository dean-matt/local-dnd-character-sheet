const WORDS: Readonly<Record<string, string>> = {
  lawful: "L",
  neutral: "N",
  chaotic: "C",
  good: "G",
  evil: "E",
};

/**
 * An alignment as a code, `LG` or `N`, from the codes or words either side writes: `Lawful
 * Good`, `LG`, `true neutral`, `TN`. `undefined` for text naming none, such as `Unaligned`.
 */
export function alignmentCode(text: string): string | undefined {
  const lower = text.trim().toLowerCase();
  if (lower === "tn" || lower === "neutral" || lower === "true neutral") return "N";
  const code = /^[lcn][gne]?$/.test(lower)
    ? lower.toUpperCase()
    : lower
        .split(/[\s-]+/)
        .map((word) => WORDS[word] ?? "?")
        .join("");
  return /^[LCN][GNE]?$/.test(code) && code !== "NN" ? code : undefined;
}

/** The alignment a deity row holds, from upstream's letter list such as `["N", "G"]`. */
export function deityAlignmentCode(json: unknown): string | undefined {
  const letters = (json as { alignment?: unknown } | null)?.alignment;
  return Array.isArray(letters) && letters.every((l) => typeof l === "string")
    ? alignmentCode(letters.join(""))
    : undefined;
}
