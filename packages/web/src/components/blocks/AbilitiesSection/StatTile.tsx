import type { Derived } from "@dnd/character";
import type { ReactNode } from "react";
import type { Rules } from "./abilityRules.ts";
import { DetailName } from "./DetailName/DetailName.tsx";

export function StatTile({
  label,
  name,
  labelClassName,
  detail,
  children,
}: {
  label: string;
  name: string;
  labelClassName: string;
  detail?: { title: string; meta: string; value: Derived<number>; rules: Rules | undefined };
  children: ReactNode;
}) {
  const heading = (
    <>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{name}</span>
    </>
  );
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-control bg-subtle px-1 py-2">
      <dt className={`font-semibold text-muted uppercase ${labelClassName}`}>
        {detail ? (
          <DetailName {...detail} className="uppercase hover:underline">
            {heading}
          </DetailName>
        ) : (
          heading
        )}
      </dt>
      <dd className="flex flex-col items-center font-bold text-number">{children}</dd>
    </div>
  );
}
