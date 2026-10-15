import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListBlockView } from "./ListBlockView.tsx";

describe("ListBlockView", () => {
  it("names the list it would narrow, since the list itself doesn't render yet", () => {
    render(
      <ListBlockView
        block={{ kind: "list", source: "spells", filter: {} }}
        character={undefined}
        derived={undefined}
      />,
    );
    expect(screen.getByText("Spells isn't available yet.")).toBeInTheDocument();
  });

  it("names the filter it saved, so a page shows what it will narrow to", () => {
    render(
      <ListBlockView
        block={{
          kind: "list",
          source: "spells",
          filter: { prepared: true, levels: [0, 3], search: "fire" },
        }}
        character={undefined}
        derived={undefined}
      />,
    );
    expect(
      screen.getByText(
        "Spells (prepared, Cantrips, 3rd Level, matching “fire”) isn't available yet.",
      ),
    ).toBeInTheDocument();
  });
});
