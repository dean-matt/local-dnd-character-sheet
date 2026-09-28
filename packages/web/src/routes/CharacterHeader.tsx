import { type CharacterRecord, classLevels, displayName } from "@dnd/character";
import { avatarColor } from "../lib/avatarColor.ts";

/** Race, classes with levels, then background and whatever else the player set, in one line. */
export function characterSubtitle({ definition, raceSummary }: CharacterRecord): string {
  const classes = classLevels(definition)
    .map((group) => {
      const subclass = group.subclass ? ` (${group.subclass.name})` : "";
      return `${displayName(group.class)} ${group.level}${subclass}`;
    })
    .join(" / ");
  const { alignment, deity } = definition;
  return [
    [raceSummary, classes].filter(Boolean).join(" "),
    displayName(definition.background),
    alignment,
    deity && `${deity.name} (${deity.pantheon})`,
  ]
    .filter(Boolean)
    .join(" • ");
}

/** Sits above every page of a character on screen; print carries `PrintTitle` instead. */
export function CharacterHeader({ character }: { character: CharacterRecord }) {
  return (
    <div className="flex items-center gap-5 border-b border-border bg-surface px-10 py-5 print:hidden">
      <span
        aria-hidden="true"
        className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full font-semibold text-3xl text-white"
        style={{ background: avatarColor(character.id) }}
      >
        {[...character.name][0]?.toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="font-bold text-[28px] leading-tight">{character.name}</h1>
        <p className="text-muted text-sm">{characterSubtitle(character)}</p>
      </div>
    </div>
  );
}

/** The head of the first printed page: name and subtitle, no avatar. */
export function PrintTitle({ character }: { character: CharacterRecord }) {
  return (
    <div className="mb-4">
      <p className="font-bold text-[28px] leading-tight">{character.name}</p>
      <p className="text-muted text-sm">{characterSubtitle(character)}</p>
    </div>
  );
}
