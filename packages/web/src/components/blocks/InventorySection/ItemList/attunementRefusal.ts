/** "A", "A and B", "A, B and C". */
function list(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * Why one more item cannot be attuned, or `undefined` where a slot is free. `attuned`
 * names the items holding the slots, so the player knows which to give up.
 */
export function attunementRefusal(slots: number, attuned: readonly string[]): string | undefined {
  if (attuned.length < slots) return undefined;
  if (slots === 0) return "This character has no attunement slots.";
  const held = slots === 1 ? "The one attunement slot is" : `All ${slots} attunement slots are`;
  return `${held} taken by ${list(attuned)}. End attunement to one of them first.`;
}
