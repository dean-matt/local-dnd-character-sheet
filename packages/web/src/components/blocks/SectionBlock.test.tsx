import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { characterRecord, derivedRecord } from "../../test/records.ts";
import { SectionBlockView } from "./SectionBlock.tsx";

describe("SectionBlockView", () => {
  it("names a section it stands in for, where nothing renders one yet", () => {
    render(
      <SectionBlockView
        block={{ kind: "section", section: "spells" }}
        character={undefined}
        derived={undefined}
      />,
    );
    expect(screen.getByText("Spells isn't built yet.")).toBeInTheDocument();
  });

  it("renders the abilities section from the character and its derived block", () => {
    render(
      <SectionBlockView
        block={{ kind: "section", section: "abilities" }}
        character={characterRecord("1", "Vex")}
        derived={derivedRecord()}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Vex" })).toBeInTheDocument();
  });

  it("renders the features section, which waits on the character", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SectionBlockView
          block={{ kind: "section", section: "features" }}
          character={undefined}
          derived={undefined}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Features isn't available yet.")).toBeInTheDocument();
  });

  it("renders nothing for a block of another kind", () => {
    const { container } = render(
      <SectionBlockView
        block={{ kind: "text", text: "note" }}
        character={undefined}
        derived={undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
