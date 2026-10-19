import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveToasts } from "../../components/SaveToasts.tsx";
import { avatarColor } from "../../lib/avatarColor.ts";
import { warlockRecord } from "../../test/records.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetch } from "../../test/stubFetch.ts";
import { CharacterHeader } from "./CharacterHeader.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterHeader", () => {
  it("capitalizes the initial of a lowercase name and keeps a whole astral character", () => {
    const { container, rerender } = renderWithClient(
      <CharacterHeader character={{ ...warlockRecord(), name: "vex" }} />,
    );
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("V");

    rerender(<CharacterHeader character={{ ...warlockRecord(), name: "\u{1D504}nna" }} />);
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("\u{1D504}");
  });

  it("titles the page with the character's name above their subtitle", () => {
    renderWithClient(<CharacterHeader character={warlockRecord()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Vex" })).toBeInTheDocument();
    expect(screen.getByText("Lv. 3 · Half-Elf · Warlock")).toBeInTheDocument();
  });

  it("draws the initial in a color derived from the id, hidden from a screen reader", () => {
    const { container } = renderWithClient(<CharacterHeader character={warlockRecord()} />);

    const avatar = container.querySelector<HTMLElement>("[aria-hidden='true']");
    expect(avatar).toHaveTextContent("V");
    expect(avatar).toHaveStyle({ background: avatarColor("1") });
  });

  it("carries the full name and subtitle on hover, for when they truncate", () => {
    renderWithClient(<CharacterHeader character={warlockRecord()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("title", "Vex");
    expect(screen.getByText("Lv. 3 · Half-Elf · Warlock")).toHaveAttribute(
      "title",
      "Lv. 3 · Half-Elf · Warlock",
    );
  });

  it("names the character's edition as its year's rules", () => {
    const { rerender } = renderWithClient(<CharacterHeader character={warlockRecord()} />);
    const year = screen.getByTitle("This character uses the 2024 rules");
    expect(year).toHaveTextContent(/^2024$/);
    expect(year).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("2024 rules")).toHaveClass("sr-only");

    rerender(<CharacterHeader character={{ ...warlockRecord(), edition: "classic" }} />);
    expect(screen.getByTitle("This character uses the 2014 rules")).toHaveTextContent(/^2014$/);
    expect(screen.getByText("2014 rules")).toHaveClass("sr-only");
  });

  it("holds the save status between the name and the actions", () => {
    renderWithClient(
      <CharacterHeader character={warlockRecord()} actions={<button type="button">Undo</button>} />,
    );

    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(status.nextElementSibling).toBe(screen.getByRole("button", { name: "Undo" }));
  });

  it("leaves the printed page to the print title", () => {
    const { container } = renderWithClient(<CharacterHeader character={warlockRecord()} />);
    expect(container.firstElementChild).toHaveClass("print:hidden");
  });

  it("uploads the image the camera badge picks", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    const { container } = renderWithClient(<CharacterHeader character={warlockRecord()} />);
    const badge = screen.getByRole("button", { name: "Upload portrait" });
    expect(badge.tagName).toBe("BUTTON");

    const file = new File([new Uint8Array([0x89])], "face.png", { type: "image/png" });
    const picker = container.querySelector<HTMLInputElement>("input[type=file]");
    if (!picker) throw new Error("no file input");
    fireEvent.change(picker, { target: { files: [file] } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/portrait", {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: file,
      }),
    );
  });

  it("names the badge for a change where a portrait is set", () => {
    renderWithClient(
      <CharacterHeader
        character={{ ...warlockRecord(), portraitUpdatedAt: "2026-10-19T12:00:00.000Z" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Change portrait" })).toBeInTheDocument();
  });

  it("raises a toast naming why an upload was refused", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "Upload a PNG, JPEG, GIF or WebP image" }), {
        status: 415,
      }),
    );
    const { container } = renderWithClient(
      <>
        <CharacterHeader character={warlockRecord()} />
        <SaveToasts />
      </>,
    );
    const picker = container.querySelector<HTMLInputElement>("input[type=file]");
    if (!picker) throw new Error("no file input");
    const file = new File(["<svg/>"], "face.svg", { type: "image/svg+xml" });
    fireEvent.change(picker, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Save problems" })).toHaveTextContent(
        "Portrait: Couldn't upload the image: Upload a PNG, JPEG, GIF or WebP image",
      ),
    );
  });
});
