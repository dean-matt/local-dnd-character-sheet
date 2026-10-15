const names = new Intl.ListFormat("en", { type: "conjunction" });

/** Why the character cannot cast spells, naming the armor worn without proficiency; nothing while they can. */
export function CastingBlockedNote({ armor }: { armor: readonly string[] }) {
  if (armor.length === 0) return null;
  return (
    <p className="text-accent-text text-label">
      Can't cast spells while wearing {names.format(armor)} without proficiency.
    </p>
  );
}
