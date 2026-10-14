import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppVersion } from "./AppVersion.tsx";

describe("AppVersion", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_VERSION", "0.5.1");
    vi.stubEnv("VITE_APP_COMMIT", "41d05f0");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows the version with the commit it was built from", () => {
    render(<AppVersion collapsed={false} />);

    expect(screen.getByRole("button", { name: "0.5.1 (41d05f0)" })).toBeInTheDocument();
  });

  it("copies that text and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<AppVersion collapsed={false} />);

    fireEvent.click(screen.getByRole("button", { name: "0.5.1 (41d05f0)" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Copied");
    expect(writeText).toHaveBeenCalledWith("0.5.1 (41d05f0)");
  });

  it("names the version on the icon alone while the rail is collapsed", () => {
    render(<AppVersion collapsed />);

    expect(
      screen.getByRole("button", { name: "Copy version 0.5.1 (41d05f0)" }),
    ).toBeInTheDocument();
  });

  it("says so where the clipboard refuses", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    });
    render(<AppVersion collapsed={false} />);

    fireEvent.click(screen.getByRole("button", { name: "0.5.1 (41d05f0)" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Could not copy");
  });
});
