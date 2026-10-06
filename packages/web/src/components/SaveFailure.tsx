/** A field's error line for a write that did not land, which a retry can. */
export function SaveFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      {message}
      <button type="button" onClick={onRetry} className="underline">
        Retry
      </button>
    </>
  );
}
