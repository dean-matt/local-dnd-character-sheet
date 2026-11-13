import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { when } from "../../../lib/when.ts";
import { characterRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../../test/stubFetch.ts";
import { RollLog } from "./RollLog.tsx";

afterEach(() => vi.unstubAllGlobals());

const roll = (id: number, characterId: string, characterName: string) => ({
  id,
  characterId,
  characterName,
  rolledAt: "2026-01-01T00:00:00.000Z",
  label: `${characterName} roll`,
  notation: "1d4",
  total: 3,
  dice: [],
  modifier: 0,
  critical: false,
});

describe("RollLog's row", () => {
  const time = when.format(new Date("2026-01-01T00:00:00.000Z"));
  const listed = async (rolls: unknown[]) => {
    stubFetchByUrl({ "/api/rolls": rolls, "/api/characters": [characterRecord("1", "Vex")] });
    renderWithClient(<RollLog latest={null} />);
    return screen.findAllByRole("listitem");
  };

  it("shows the time it was rolled", async () => {
    const [row] = await listed([roll(1, "1", "Vex")]);
    const shown = row?.querySelector("time");
    expect(shown).toHaveAttribute("datetime", "2026-01-01T00:00:00.000Z");
    expect(shown).toHaveTextContent(time);
  });

  it("shows its origin, and none where it was stored without one", async () => {
    const [withOrigin, without] = await listed([
      { ...roll(2, "1", "Vex"), label: "Longsword attack", origin: "Longsword" },
      { ...roll(1, "1", "Vex"), label: "Pit trap" },
    ]);
    expect(withOrigin?.textContent).toBe(`Longsword attack${time}LongswordVex · 1d43`);
    expect(without?.textContent).toBe(`Pit trap${time}Vex · 1d43`);
  });

  it("lists an attack's mode and dice, a discarded one struck through, so the total can be checked", async () => {
    const [row] = await listed([
      {
        ...roll(1, "1", "Vex"),
        type: "attack",
        notation: "1d20+5",
        total: 19,
        mode: "advantage",
        modifier: 5,
        dice: [
          { faces: 20, value: 14, kept: true, sign: 1 },
          { faces: 20, value: 3, kept: false, sign: 1 },
        ],
      },
    ]);
    expect(row).toHaveTextContent("advantage143 discarded+ 5");
    expect(row?.querySelector('[title="d20, discarded"]')).toHaveClass("line-through");
  });

  it("tags a roll with its type, and an untyped one with nothing", async () => {
    const [typed, hitDie, untyped] = await listed([
      { ...roll(3, "1", "Vex"), type: "spell-attack" },
      { ...roll(2, "1", "Vex"), type: "hit-die" },
      roll(1, "1", "Vex"),
    ]);
    expect(typed?.textContent).toBe(`Vex roll${time}Spell attackVex · 1d43`);
    expect(hitDie?.textContent).toBe(`Vex roll${time}Hit DieVex · 1d43`);
    expect(untyped?.textContent).toBe(`Vex roll${time}Vex · 1d43`);
  });
});

describe("RollLog with no open character", () => {
  it("starts the Character facet at All characters", async () => {
    stubFetchByUrl({
      "/api/rolls": [roll(2, "2", "Mira"), roll(1, "1", "Vex")],
      "/api/characters": [characterRecord("1", "Vex"), characterRecord("2", "Mira")],
    });
    renderWithClient(<RollLog latest={null} />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Filter Roll Log" }));
    expect(screen.getByRole("combobox", { name: "Character" })).toHaveTextContent("All characters");
  });
});

describe("RollLog when the characters fail to load", () => {
  it("shows the error in place of the Character select", async () => {
    stubFetchByUrl({ "/api/rolls": [roll(1, "1", "Vex")] });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RollLog latest={null} characterId="1" />
      </QueryClientProvider>,
    );
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Filter Roll Log (1 active)" }));
    expect(await screen.findByText("nothing at /api/characters")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Character" })).toBeNull();
  });
});

describe("RollLog's Clear button", () => {
  it("empties every character's rolls, whatever the filter shows, and focuses the heading", async () => {
    let rolls: unknown[] = [roll(2, "2", "Mira"), roll(1, "1", "Vex")];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/rolls" && init?.method === "DELETE") {
        rolls = [];
        return new Response(null, { status: 204 });
      }
      if (url === "/api/rolls") return new Response(JSON.stringify(rolls), { status: 200 });
      return new Response(JSON.stringify([characterRecord("1", "Vex")]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<RollLog latest={null} characterId="1" />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);

    const clear = screen.getByRole("button", { name: "Clear Roll Log" });
    clear.focus();
    fireEvent.click(clear);

    expect(await screen.findByText("No rolls yet.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rolls",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(screen.queryByRole("button", { name: "Clear Roll Log" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Roll Log" })).toHaveFocus());
  });

  it("shows the error and keeps the rolls when the clear fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return new Response(JSON.stringify({ error: "disk full" }), { status: 500 });
        }
        const body = String(input) === "/api/rolls" ? [roll(1, "1", "Vex")] : [];
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
    renderWithClient(<RollLog latest={null} />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Clear Roll Log" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("stays focusable and ignores a second click while the clear is pending", async () => {
    let finish = (_: Response) => {};
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Promise<Response>((resolve) => (finish = resolve));
      const body = String(input) === "/api/rolls" ? [roll(1, "1", "Vex")] : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<RollLog latest={null} />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);

    const clear = screen.getByRole("button", { name: "Clear Roll Log" });
    fireEvent.click(clear);
    await waitFor(() => expect(clear).toHaveAttribute("aria-disabled", "true"));
    expect(clear).not.toBeDisabled();
    fireEvent.click(clear);
    finish(new Response(JSON.stringify({ error: "disk full" }), { status: 500 }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
    const deletes = fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deletes).toHaveLength(1);
  });
});
