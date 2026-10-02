import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { SettingsLayout } from "./SettingsLayout.tsx";

describe("SettingsLayout", () => {
  it("does not mark Display current on a section beneath /settings", () => {
    render(
      <MemoryRouter initialEntries={["/settings/homebrew"]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    expect(within(nav).getByRole("link", { name: "Display" })).not.toHaveAttribute("aria-current");
  });
});
