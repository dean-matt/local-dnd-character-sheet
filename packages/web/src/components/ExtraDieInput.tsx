/** The field a player types a die into to add or subtract from a d20 roll, such as +1d4 for Bless. */
export function ExtraDieInput({
  label,
  value,
  onChange,
  error,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  describedBy?: string;
}) {
  return (
    <input
      type="text"
      aria-label={`${label} extra die`}
      aria-invalid={error !== undefined}
      aria-describedby={error ? describedBy : undefined}
      placeholder="+1d4"
      size={4}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-6 w-12 min-w-0 rounded-control border border-border bg-surface px-1 text-label"
    />
  );
}
