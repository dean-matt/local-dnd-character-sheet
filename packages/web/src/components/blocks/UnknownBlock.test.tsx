import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnknownBlockView } from "./UnknownBlock.tsx";

describe("UnknownBlockView", () => {
  it("renders inertly rather than the raw data it carries", () => {
    render(
      <UnknownBlockView
        block={{ kind: "unknown", raw: { kind: "tarot", deck: "Many Things" } }}
        derived={undefined}
      />,
    );
    expect(screen.getByText("This block isn't recognized by this build.")).toBeInTheDocument();
    expect(screen.queryByText("Many Things")).not.toBeInTheDocument();
  });
});
