import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { characterRecord, identityRecord } from "../../test/records.ts";
import { AlignmentSection } from "./AlignmentSection.tsx";

describe("AlignmentSection", () => {
  it("shows the alignment, or that none is set", () => {
    const { unmount } = render(<AlignmentSection character={identityRecord()} />);
    expect(screen.getByRole("region", { name: "Alignment" })).toHaveTextContent("Chaotic Good");
    unmount();

    render(<AlignmentSection character={characterRecord("1", "Vex")} />);
    expect(screen.getByText("No alignment set.")).toBeInTheDocument();
  });
});
