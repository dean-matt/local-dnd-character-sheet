import type { Term } from "@dnd/rules";
import type { Speed } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";

/** `speed` with every mode at 0 while the character is Restrained, one term per mode it zeroed. */
export function speedWithConditions(
  speed: Speed,
  conditions: readonly { name: string }[],
): { speed: Speed; terms: Term<TermReference>[] } {
  if (!conditions.some(({ name }) => name === "Restrained")) return { speed, terms: [] };
  const zeroed: Speed = { ...speed };
  const terms: Term<TermReference>[] = [];
  for (const mode of Object.keys(speed) as (keyof Speed)[]) {
    const before = speed[mode] ?? 0;
    zeroed[mode] = 0;
    if (before > 0) terms.push({ label: `Restrained: ${mode} ${before} to 0`, value: -before });
  }
  return { speed: zeroed, terms };
}
