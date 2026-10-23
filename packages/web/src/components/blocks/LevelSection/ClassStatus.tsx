/** Whether the drafted class is still loading, and why it cannot take the level where it has no usable die. */
export function ClassStatus({ loading, noDie }: { loading: boolean; noDie: string | undefined }) {
  return (
    <>
      {loading && <p className="text-muted">Loading the class…</p>}
      {noDie && <p className="text-error">{noDie}</p>}
    </>
  );
}
