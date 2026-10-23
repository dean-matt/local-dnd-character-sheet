import { refKey } from "@dnd/character";
import { EntryPickField } from "./EntryPickField.tsx";
import type { useClassChangeGrants } from "./useClassChangeGrants.ts";

export function ClassPicksFields({
  name,
  picks,
}: {
  name: string;
  picks: NonNullable<ReturnType<typeof useClassChangeGrants>["picks"]>;
}) {
  const { skillPick, toolPicks, pickedSkills, pickedTools } = picks;
  return (
    <>
      {skillPick && (
        <EntryPickField
          legend={`Skills from ${name}`}
          count={skillPick.count}
          options={skillPick.options.map((ref) => ({ key: refKey(ref), label: ref.name }))}
          picked={new Set(pickedSkills.map(refKey))}
          onToggle={(key) => {
            const ref = skillPick.options.find((each) => refKey(each) === key);
            if (ref) picks.toggleSkill(ref);
          }}
        />
      )}
      {toolPicks.map((pick, index) => (
        <EntryPickField
          // biome-ignore lint/suspicious/noArrayIndexKey: a class's picks never reorder.
          key={index}
          legend={`Tools from ${name}`}
          count={pick.count}
          options={pick.options.map((tool) => ({ key: tool, label: tool }))}
          picked={new Set(pickedTools[index])}
          onToggle={(tool) => picks.toggleTool(index, tool)}
        />
      ))}
    </>
  );
}
