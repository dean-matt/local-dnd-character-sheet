import { RulesText } from "../../../../RulesText/RulesText.tsx";

/** A fact the spell leaves out shows as a dash, spoken as "none". A trigger can carry markup. */
export function SpellFact({ label, value }: { label: string; value: string | undefined }) {
  return (
    <span>
      <span className="sr-only">{label}: </span>
      {value !== undefined ? (
        <RulesText text={value} />
      ) : (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">none</span>
        </>
      )}
      <span className="sr-only">.</span>
    </span>
  );
}
