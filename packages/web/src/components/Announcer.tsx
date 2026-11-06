/**
 * A polite live region speaking `announced.text`. Mount it while empty: a live region added
 * with its text is often not announced. The child is keyed by `count`, so a repeated text
 * replaces its node and is announced again.
 */
export function Announcer({ announced }: { announced: { text: string; count: number } }) {
  return (
    <span role="status" className="sr-only">
      <span key={announced.count}>{announced.text}</span>
    </span>
  );
}
