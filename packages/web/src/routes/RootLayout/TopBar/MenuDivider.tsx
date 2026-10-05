export interface MenuDividerProps {
  /** Extra classes, such as a grid span, for the menu it sits in. */
  className?: string;
}

/** The line between a top-bar menu's entries and the link that closes it. */
export function MenuDivider({ className = "" }: MenuDividerProps) {
  return <hr className={`mx-2.5 my-1 border-border ${className}`} />;
}
