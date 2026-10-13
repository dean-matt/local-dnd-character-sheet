import { screen, within } from "@testing-library/react";

/**
 * The toast region `SaveToasts` draws, for a test that rendered one beside the view. A modal
 * holds a second region, which mounts after the page's and so is the one that draws.
 */
export function saveToasts() {
  const regions = screen.getAllByRole("region", { name: "Save problems" });
  return within(regions.at(-1) as HTMLElement);
}
