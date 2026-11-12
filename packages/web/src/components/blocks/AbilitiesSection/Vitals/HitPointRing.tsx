import type { ReactNode } from "react";
import { hitPointRing, ringBackground } from "./hitPointRing.ts";

/** Cuts the center out of a disc, leaving a band a fifth of its radius. */
const BAND = "radial-gradient(farthest-side, transparent 79%, #000 80%)";

/**
 * Current, temporary and reduced hit points drawn as a ring by `hitPointRing`, named in words
 * for a screen reader, with `children` in its center.
 */
export function HitPointRing({
  current,
  temporary,
  maximum,
  unreduced,
  children,
}: {
  current: number;
  temporary: number;
  maximum: number;
  unreduced: number;
  children: ReactNode;
}) {
  const reduction = unreduced - maximum;
  const label = [
    `${current} of ${maximum} hit points`,
    reduction > 0 && `maximum reduced by ${reduction}`,
    temporary > 0 && `${temporary} temporary`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="relative size-28 flex-none sm:size-33">
      <div
        role="img"
        aria-label={label}
        className="absolute inset-0 rounded-full"
        style={{
          background: ringBackground(hitPointRing({ current, temporary, maximum, unreduced })),
          mask: BAND,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center gap-1">{children}</div>
    </div>
  );
}
