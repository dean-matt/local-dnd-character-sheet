import type { Derived } from "@dnd/character";
import type { ReactNode } from "react";
import { DetailTrigger } from "../DetailTrigger.tsx";
import type { Rules } from "./abilityRules.ts";
import { CatalogRules } from "./CatalogRules.tsx";
import { ValueDetail } from "./ValueDetail.tsx";

/** A name that opens the value's terms above the catalog's rules text. */
export function DetailName({
  title,
  meta,
  value,
  rules,
  className,
  children,
}: {
  title: string;
  meta?: string;
  value: Derived<number>;
  rules: Rules | undefined;
  className?: string;
  children: ReactNode;
}) {
  return (
    <DetailTrigger
      title={title}
      meta={meta}
      detail={
        <>
          <ValueDetail value={value} />
          {rules && <CatalogRules {...rules} />}
        </>
      }
      className={className}
    >
      {children}
    </DetailTrigger>
  );
}
