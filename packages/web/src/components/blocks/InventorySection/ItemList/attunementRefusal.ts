/** "A", "A and B", "A, B and C". */
function list(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const slotCount = (slots: number) => (slots === 1 ? "one slot" : `${slots} slots`);

/**
 * Why one more item cannot be attuned, or `undefined` where a slot is free. `attuned`
 * names the items holding the slots, so the player knows which to give up. An override can
 * lower the slots below the items already attuned, and the message then says so.
 */
export function attunementRefusal(slots: number, attuned: readonly string[]): string | undefined {
  if (attuned.length < slots) return undefined;
  if (attuned.length === 0) return "This character has no attunement slots.";
  const names = list(attuned);
  if (attuned.length === slots) {
    const held = slots === 1 ? "The one attunement slot is" : `All ${slots} attunement slots are`;
    return `${held} taken by ${names}. End attunement to one of them first.`;
  }
  const verb = attuned.length === 1 ? "is" : "are";
  const over = attuned.length - slots + 1;
  return `${names} ${verb} attuned, more than the ${slotCount(slots)} this character has. End attunement to ${over} of them first.`;
}
