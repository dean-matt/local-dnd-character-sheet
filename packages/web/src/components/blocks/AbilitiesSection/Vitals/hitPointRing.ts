/** Where a segment starts along the ring and how far it runs, each a fraction of the circle. */
type Arc = { start: number; length: number };

type Ring = { current: Arc; temporary: Arc; reduction: Arc };

/**
 * The hit point ring's segments: current hit points from the top, temporary hit points
 * straight after, and the reduction at the end of the unreduced maximum, less what temporary
 * hit points already cover. The circle stands for the unreduced maximum, or for current plus
 * temporary hit points where they run past it, so no segment wraps over another.
 */
export function hitPointRing({
  current,
  temporary,
  maximum,
  unreduced,
}: {
  current: number;
  temporary: number;
  maximum: number;
  unreduced: number;
}): Ring {
  const held = Math.max(0, current);
  const shielded = held + temporary;
  const scale = Math.max(unreduced, shielded, 1);
  const reduced = Math.max(maximum, shielded);
  const arc = (from: number, to: number) => ({
    start: from / scale,
    length: Math.max(0, to - from) / scale,
  });
  return {
    current: arc(0, held),
    temporary: arc(held, shielded),
    reduction: arc(reduced, unreduced),
  };
}

export const HATCH =
  "repeating-linear-gradient(45deg, var(--color-muted) 0 2px, var(--color-subtle) 2px 5px)";

/**
 * The ring's CSS background: the segments over the empty track, with the track cut away along
 * the reduction to show hatching beneath, so the reduction differs from empty by pattern.
 */
export function ringBackground({ current, temporary, reduction }: Ring): string {
  const at = (fraction: number) => `${fraction * 100}%`;
  const end = (arc: Arc) => at(arc.start + arc.length);
  const segments = [
    `var(--color-accent) 0 ${end(current)}`,
    `var(--color-temporary) ${at(temporary.start)} ${end(temporary)}`,
    `var(--color-subtle) ${end(temporary)} ${at(reduction.start)}`,
    `transparent ${at(reduction.start)} ${end(reduction)}`,
    `var(--color-subtle) ${end(reduction)} 100%`,
  ];
  return `conic-gradient(${segments.join(", ")}), ${HATCH}`;
}
