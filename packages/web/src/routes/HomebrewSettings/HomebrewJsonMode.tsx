import type { ReactNode } from "react";
import { FormField } from "../../components/FormField.tsx";
import { HomebrewProblemList } from "./HomebrewProblemList.tsx";
import type { HomebrewProblem } from "./homebrewDraft.ts";

export interface HomebrewJsonModeProps {
  noun: string;
  reference: ReactNode;
  text: string;
  problems: HomebrewProblem[];
  onText: (next: string) => void;
}

/** The entry as JSON text, with the kind's field reference beside it where it has one. */
export function HomebrewJsonMode({
  noun,
  reference,
  text,
  problems,
  onText,
}: HomebrewJsonModeProps) {
  return (
    <div className="@container">
      <div
        className={`flex flex-col gap-4 ${reference ? "@2xl:grid @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @2xl:items-start" : ""}`}
      >
        {reference && <div className="min-w-0">{reference}</div>}
        <div className="flex min-w-0 flex-col">
          <FormField
            label={`${noun} JSON`}
            error={problems.length > 0 && <HomebrewProblemList problems={problems} />}
          >
            {(control) => (
              <textarea
                {...control}
                value={text}
                onChange={(event) => onText(event.target.value)}
                spellCheck={false}
                rows={20}
                className="resize-y rounded-control border border-border bg-surface px-2 py-1 font-mono text-row aria-invalid:border-error"
              />
            )}
          </FormField>
        </div>
      </div>
    </div>
  );
}
