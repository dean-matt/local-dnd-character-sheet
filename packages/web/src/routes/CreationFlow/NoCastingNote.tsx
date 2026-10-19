/** What a class that casts nothing at its level picks here: its rows' offers, or nothing. */
export function NoCastingNote({
  className,
  level,
  offersAny,
}: {
  className: string;
  level: number;
  offersAny: boolean;
}) {
  return (
    <p className="text-muted text-row">
      {className} doesn't cast spells at level {level}.{" "}
      {offersAny
        ? "Pick here only the spells its subclass, race, background or feats offer."
        : "Nothing to choose here — select Finish to create the character."}
    </p>
  );
}
