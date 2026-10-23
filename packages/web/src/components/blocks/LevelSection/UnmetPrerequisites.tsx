/** The multiclass prerequisites a change leaves unmet, which Notes will list. */
export function UnmetPrerequisites({ notes }: { notes: readonly string[] }) {
  return (
    <div aria-live="polite" className="text-row">
      {notes.length > 0 && (
        <>
          <p>A multiclass prerequisite is unmet, which Notes will list:</p>
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </>
      )}
    </div>
  );
}
