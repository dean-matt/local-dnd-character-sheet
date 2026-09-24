import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionBlockView } from "./SectionBlock.tsx";

describe("SectionBlockView", () => {
  it("names the section it stands in for, since nothing renders one yet", () => {
    render(
      <SectionBlockView block={{ kind: "section", section: "abilities" }} derived={undefined} />,
    );
    expect(screen.getByText("Abilities isn't built yet.")).toBeInTheDocument();
  });

  it("renders nothing for a block of another kind", () => {
    const { container } = render(
      <SectionBlockView block={{ kind: "text", text: "note" }} derived={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
