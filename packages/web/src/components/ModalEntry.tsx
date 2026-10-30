import { type ReactNode, useContext } from "react";
import { InModal } from "./inModalContext.ts";

/**
 * One entry in a `Modal`: a header naming the dialog, a body that alone scrolls, and an
 * optional `footer`. The header and footer stay put. The body's top padding leaves room for the
 * focus ring of a first field, which the scroll container would otherwise clip.
 */
export function ModalEntry({
  title,
  badge,
  meta,
  footer,
  contained,
  children,
}: {
  title: string;
  /** Sits beside the title, outside the heading that names the dialog. */
  badge?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  /** The body does not scroll; `children` fill it and scroll what overflows themselves. */
  contained?: boolean;
  children: ReactNode;
}) {
  const titleId = useContext(InModal)?.titleId;
  return (
    <>
      <div className="shrink-0 pt-5 pr-10 pb-2.5 pl-5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 id={titleId} className="font-bold text-title">
            {title}
          </h2>
          {badge}
        </div>
        {meta && <div className="mt-1 text-muted text-row">{meta}</div>}
      </div>
      <section
        aria-labelledby={titleId}
        // A scroll container takes focus so the keyboard can scroll it; the dialog opens with focus on the close button, outside it.
        {...(contained ? {} : { tabIndex: 0 })}
        className={`flex min-h-0 flex-1 flex-col gap-2 ${contained ? "overflow-hidden" : "overflow-auto"} px-5 pt-1 text-body leading-normal ${footer ? "pb-3" : "pb-5"}`}
      >
        {children}
      </section>
      {footer && (
        <div className="flex shrink-0 justify-end border-border border-t px-5 pt-3 pb-5">
          {footer}
        </div>
      )}
    </>
  );
}
