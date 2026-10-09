/**
 * The one grid every homebrew form lays its fields on, and the span each kind of field
 * takes. A field's kind sets its width, never its content, so a short number and a select
 * line up across the item and spell forms. The grid reads its container's width, so the
 * form holding it sets `@container`.
 */
export const FORM_GRID = "grid grid-cols-2 gap-3 @2xl:grid-cols-4";

/** A short number or a select. */
export const SHORT = "col-span-1";

/** A text input. */
export const TEXT = "col-span-2";

/** A text area, or a group of checkboxes. */
export const WHOLE = "col-span-full";
