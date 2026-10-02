import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorState } from "./ErrorState.tsx";

describe("ErrorState", () => {
  it("announces itself as an alert", () => {
    render(<ErrorState message="Could not reach the server." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server.");
  });
});
