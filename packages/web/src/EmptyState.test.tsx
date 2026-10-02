import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState.tsx";

describe("EmptyState", () => {
  it("renders its children", () => {
    render(<EmptyState>No characters yet.</EmptyState>);
    expect(screen.getByText("No characters yet.")).toBeInTheDocument();
  });
});
