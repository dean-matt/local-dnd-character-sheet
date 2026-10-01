/** Marks a value the user typed over, and says what the sheet would have shown instead. */
export function OverrideMark({ computed }: { computed: string }) {
  return (
    <span title={`Overridden; computed ${computed}`}>
      <span aria-hidden="true" className="text-accent-text">
        *
      </span>
      <span className="sr-only">, overridden from {computed}</span>
    </span>
  );
}
