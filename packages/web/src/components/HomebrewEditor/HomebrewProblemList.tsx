import type { HomebrewProblem } from "./homebrewDraft.ts";

/** Each problem, as `field: message`. */
export function HomebrewProblemList({ problems }: { problems: HomebrewProblem[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {problems.map(({ field, message }) => (
        <li key={`${field}: ${message}`}>{`${field}: ${message}`}</li>
      ))}
    </ul>
  );
}
