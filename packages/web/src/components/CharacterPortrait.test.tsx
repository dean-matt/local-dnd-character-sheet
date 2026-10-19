import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { avatarColor } from "../lib/avatarColor.ts";
import { CharacterPortrait } from "./CharacterPortrait.tsx";

const vex = { id: "1", name: "vex", portraitUpdatedAt: null };
const AT = "2026-10-19T12:00:00.000Z";

describe("CharacterPortrait", () => {
  it("draws the initial on the id's color where no portrait is set", () => {
    const { container } = render(<CharacterPortrait character={vex} className="size-8" />);
    const avatar = container.firstElementChild;
    expect(avatar).toHaveTextContent("V");
    expect(avatar).toHaveStyle({ background: avatarColor("1") });
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the portrait, its URL keyed on when it last changed", () => {
    const { container } = render(
      <CharacterPortrait character={{ ...vex, portraitUpdatedAt: AT }} className="size-8" />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", `/api/characters/1/portrait?v=${encodeURIComponent(AT)}`);
    expect(image).toHaveAttribute("aria-hidden", "true");
  });

  it("falls back to the initial where the image fails to load, until a newer one arrives", () => {
    const { container, rerender } = render(
      <CharacterPortrait character={{ ...vex, portraitUpdatedAt: AT }} className="size-8" />,
    );
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveTextContent("V");

    rerender(
      <CharacterPortrait
        character={{ ...vex, portraitUpdatedAt: "2026-10-19T12:00:01.000Z" }}
        className="size-8"
      />,
    );
    expect(container.querySelector("img")).not.toBeNull();
  });
});
