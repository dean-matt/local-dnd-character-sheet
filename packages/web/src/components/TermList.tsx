/** The terms behind a derived value, one per line — the content of a formula popover. */
export function TermList({ terms }: { terms: readonly { label: string; value: number }[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {terms.map((term, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a breakdown's terms never reorder.
        <li key={index} className="flex justify-between gap-4">
          <span>{term.label}</span>
          <span>{term.value}</span>
        </li>
      ))}
    </ul>
  );
}
