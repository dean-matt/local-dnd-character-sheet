import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingState } from "./LoadingState.tsx";

describe("LoadingState", () => {
  it("announces itself politely", () => {
    render(<LoadingState label="Loading spells…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading spells…");
  });

  it("shows a spinner and keeps the label for screen readers alone", () => {
    const { container } = render(<LoadingState label="Loading spells…" />);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(container.querySelector("[aria-hidden='true']")).toHaveClass("animate-spin");
  });
});
