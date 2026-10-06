import { SourceIncreases } from "./SourceIncreases.tsx";
import type { IncreaseSource } from "./useIncreaseOptions.ts";

/** The increases the race and the background grant, for each that grants any. */
export function AbilityIncreasesField({ sources }: { sources: readonly IncreaseSource[] }) {
  const granting = sources.filter((source) => source.alternatives.length > 0);
  if (granting.length === 0) return null;
  return (
    <section aria-labelledby="ability-increases" className="flex flex-col gap-3">
      <h2
        id="ability-increases"
        className="font-semibold text-label text-muted uppercase tracking-label"
      >
        Increases
      </h2>
      {granting.map((source) => (
        <SourceIncreases key={`${source.grantedBy}|${source.name}`} source={source} />
      ))}
    </section>
  );
}
