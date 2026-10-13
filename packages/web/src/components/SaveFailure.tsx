/**
 * A field's error line for a write that did not land, which a retry can. The message keeps its
 * full text in `title` for a slot that cuts it short, such as a card's title row.
 */
export function SaveFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <span title={message}>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 underline">
        Retry
      </button>
    </>
  );
}
