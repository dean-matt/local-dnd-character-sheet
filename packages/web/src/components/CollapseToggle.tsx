import { ChevronLeft } from "lucide-react";

/**
 * The control at a collapsible column's foot, labeled for the column `name` says. `edge` is
 * the side of the sheet the column sits on: its arrow points toward that edge to collapse
 * and away from it to expand.
 */
export function CollapseToggle({
  name,
  edge,
  collapsed,
  onToggle,
}: {
  name: string;
  edge: "left" | "right";
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pointsRight = collapsed === (edge === "left");
  return (
    <button
      type="button"
      aria-label={`${collapsed ? "Expand" : "Collapse"} ${name}`}
      aria-expanded={!collapsed}
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-sm font-medium text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
    >
      {/* The margin widens the 16px arrow to the rail rows' 19px icon column, so it centers under them. */}
      <ChevronLeft
        size={16}
        className="mx-[1.5px] shrink-0"
        style={{
          transform: pointsRight ? "rotate(180deg)" : undefined,
          transition: "transform var(--duration-standard)",
        }}
      />
      {!collapsed && <span>Collapse</span>}
    </button>
  );
}
