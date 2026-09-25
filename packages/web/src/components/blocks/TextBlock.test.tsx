import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { TextBlockView } from "./TextBlock.tsx";

describe("TextBlockView", () => {
  it("renders its text through the token renderer, so a note can name a spell", () => {
    renderWithClient(
      <TextBlockView
        block={{ kind: "text", text: "Cast {@spell fireball} first." }}
        character={undefined}
        derived={undefined}
      />,
    );
    const ref = screen.getByText("fireball");
    expect(ref).toHaveAttribute("data-tag", "spell");
  });
});
