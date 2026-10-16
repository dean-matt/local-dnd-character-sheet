import { HomebrewProblemList } from "./HomebrewProblemList.tsx";
import type { HomebrewProblem } from "./homebrewDraft.ts";

/** The problems a form shows no control for, announced; nothing where there are none. */
export function HomebrewProblemAlert({ problems }: { problems: HomebrewProblem[] }) {
  if (problems.length === 0) return null;
  return (
    <div role="alert" className="text-error text-row">
      <HomebrewProblemList problems={problems} />
    </div>
  );
}
