import { ProficiencyRing } from "./ProficiencyRing.tsx";
import { PROFICIENCY_MARK, type ProficiencyLevel } from "./proficiencyMark.ts";

/** Spells out the marks a title tooltip alone would hide from a keyboard or touch reader. */
export function ProficiencyLegend() {
  return (
    <p aria-hidden="true" className="flex flex-wrap items-center gap-x-3 text-muted text-row">
      {(Object.keys(PROFICIENCY_MARK) as ProficiencyLevel[]).map((level) => (
        <span key={level} className="flex items-center gap-1">
          <ProficiencyRing level={level} />
          {PROFICIENCY_MARK[level].text}
        </span>
      ))}
      <span>* Overridden</span>
    </p>
  );
}
