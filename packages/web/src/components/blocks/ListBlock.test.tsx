import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListBlockView } from "./ListBlock.tsx";

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
});
