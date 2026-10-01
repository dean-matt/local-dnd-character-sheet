import { PROFICIENCY_MARK, type ProficiencyLevel } from "./proficiencyMark.ts";

export function ProficiencyRing({ level }: { level: ProficiencyLevel }) {
  const mark = PROFICIENCY_MARK[level];
  return (
    <span
      aria-hidden="true"
      title={mark.text}
      className={`size-[13px] shrink-0 rounded-full border-[1.5px] ${mark.className}`}
    />
  );
}
