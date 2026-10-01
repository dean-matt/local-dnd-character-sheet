export function ChevronDownIcon({ rotated, className }: { rotated: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
      style={{ transform: rotated ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
