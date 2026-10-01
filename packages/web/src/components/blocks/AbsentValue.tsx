/** A value the rules leave unset, shown as a dash and spoken as "none" rather than as zero. */
export function AbsentValue() {
  return (
    <span>
      <span aria-hidden="true">—</span>
      <span className="sr-only">None</span>
    </span>
  );
}
