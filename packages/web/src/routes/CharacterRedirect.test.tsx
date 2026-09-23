import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, it, vi } from "vitest";
import { CharacterRedirect } from "./CharacterRedirect.tsx";

vi.mock("../pages.ts", () => ({
  getCharacterPages: () => [{ slug: "hidden", title: "Hidden", hidden: true }],
  visiblePages: (pages: { hidden: boolean }[]) => pages.filter((page) => !page.hidden),
}));

describe("CharacterRedirect", () => {
  it("shows the not-found state for a character with no visible page", async () => {
    const router = createMemoryRouter(
      [{ path: "/characters/:id", element: <CharacterRedirect /> }],
      { initialEntries: ["/characters/abc"] },
    );
    render(<RouterProvider router={router} />);

    await screen.findByRole("heading", { level: 1, name: "Page not found" });
  });
});
