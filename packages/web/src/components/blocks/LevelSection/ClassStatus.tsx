/** The drafted class's loading note, and `noDie`, the reason it cannot take the level. */
export function ClassStatus({ loading, noDie }: { loading: boolean; noDie: string | undefined }) {
  return (
    <>
      {loading && <p className="text-muted">Loading the class…</p>}
      {noDie && <p className="text-error">{noDie}</p>}
    </>
  );
}
