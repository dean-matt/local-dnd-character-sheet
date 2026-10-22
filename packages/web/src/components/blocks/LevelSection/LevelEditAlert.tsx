/** The Edit dialog's alert line: a failed save, offering Reload where that is the way past it, then each other line. */
export function LevelEditAlert({
  error,
  onReload,
  lines,
}: {
  error: string | undefined;
  onReload?: () => void;
  lines: readonly string[];
}) {
  return (
    <div role="alert" className="flex-1 text-error text-row">
      {error && (
        <p>
          Couldn't save the level: {error}
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              className="ml-2 font-semibold text-accent underline hover:text-accent-hover"
            >
              Reload
            </button>
          )}
        </p>
      )}
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
