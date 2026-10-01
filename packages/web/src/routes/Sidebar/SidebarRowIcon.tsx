export function SidebarRowIcon({
  paths,
  active,
}: {
  paths: readonly string[] | undefined;
  active: boolean;
}) {
  const stroke = active ? "var(--color-accent)" : "var(--color-muted)";
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      className="shrink-0"
      aria-hidden
    >
      {paths ? (
        paths.map((d) => <path key={d} d={d} />)
      ) : (
        <>
          <path d="M12 8v8M8 12h8" />
          <circle cx="12" cy="12" r="9" />
        </>
      )}
    </svg>
  );
}
