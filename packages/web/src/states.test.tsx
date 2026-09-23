import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "./states.tsx";

describe("LoadingState", () => {
  it("announces itself politely", () => {
    render(<LoadingState label="Loading spells…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading spells…");
  });
});

describe("ErrorState", () => {
  it("announces itself as an alert", () => {
    render(<ErrorState message="Could not reach the server." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server.");
  });
});

describe("EmptyState", () => {
  it("renders its children", () => {
    render(<EmptyState>No characters yet.</EmptyState>);
    expect(screen.getByText("No characters yet.")).toBeInTheDocument();
  });
});
