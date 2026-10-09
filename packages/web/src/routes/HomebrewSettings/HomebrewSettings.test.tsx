import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomebrewSettings } from "./HomebrewSettings.tsx";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

const sunblade = {
  id: "i1",
  name: "Sunblade",
  edition: "one",
  type: "M",
  rarity: "rare",
  requiresAttunement: true,
  json: {
    name: "Sunblade",
    source: "HB",
    type: "M",
    rarity: "rare",
    reqAttune: true,
    weaponCategory: "martial",
    entries: ["A blade of radiance."],
  },
  createdAt: CREATED_AT,
};

const ward = {
  name: "Coastal Ward",
  level: 2,
  school: "A",
  duration: [{ type: "instant" }],
  entries: ["Brine deals {@damage 2d6} cold damage."],
};

type Answer = { status: number; body?: unknown };

/**
 * A fake API: a `GET` of a homebrew list answers from `lists`, and any other request under
 * `/api/homebrew` takes the next answer in `writes`.
 */
function stubApi(lists: { items?: unknown[]; spells?: unknown[] }, writes: Answer[] = []) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && url === "/api/homebrew/items") return json(200, lists.items ?? []);
    if (method === "GET" && url === "/api/homebrew/spells") return json(200, lists.spells ?? []);
    const answer = url.startsWith("/api/homebrew") ? writes.shift() : undefined;
    return answer ? json(answer.status, answer.body) : json(404, { error: `nothing at ${url}` });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomebrewSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const writesOf = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls
    .filter(([url, init]) => String(url).startsWith("/api/homebrew") && init?.method)
    .map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      body: init?.body && JSON.parse(String(init.body)),
    }));

const spells = () => screen.getByRole("region", { name: "Spells" });
const items = () => screen.getByRole("region", { name: "Items" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HomebrewSettings", () => {
  it("lists each homebrew row under its kind, with its edition and what it is", async () => {
    stubApi({ items: [sunblade] });
    renderPage();

    const row = (await within(items()).findByText("Sunblade")).closest("li");
    if (!row) throw new Error("no row");
    expect(row).toHaveTextContent("2024 rules");
    expect(row).toHaveTextContent("Martial melee weapon • Rare");
    expect(row).toHaveTextContent("A blade of radiance.");
    expect(await within(spells()).findByText("No homebrew spells yet.")).toBeInTheDocument();
  });

  it("chips a spell row with its level, school, concentration and ritual", async () => {
    const light = {
      id: "s2",
      name: "Glimmer",
      edition: "one",
      level: 0,
      school: "V",
      concentration: true,
      ritual: true,
      json: { ...ward, name: "Glimmer", level: 0, school: "V", source: "HB" },
      createdAt: CREATED_AT,
    };
    stubApi({ spells: [light] });
    renderPage();

    const row = (await within(spells()).findByText("Glimmer")).closest("li");
    expect(row).toHaveTextContent(/Cantrip.*Evocation.*Concentration.*Ritual/);
  });

  it("names the field a rejected value sits in, and sends nothing", async () => {
    const fetchMock = stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: JSON.stringify({ ...ward, level: 12 }) },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Save" }));

    expect(
      within(spells()).getByRole("textbox", { name: "Spell JSON" }),
    ).toHaveAccessibleDescription(/^level: /);
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it("opens a new item on a weapon example, and swaps it for the type picked", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    const box = () => within(items()).getByRole("textbox", { name: "Item JSON" });
    expect(JSON.parse((box() as HTMLTextAreaElement).value)).toMatchObject({ type: "M" });

    fireEvent.click(within(items()).getByRole("combobox", { name: "Start from" }));
    fireEvent.click(screen.getByRole("option", { name: "Armor" }));
    expect(JSON.parse((box() as HTMLTextAreaElement).value)).toMatchObject({ type: "MA" });
  });

  it("offers no example to pick for a spell or a row being edited", async () => {
    stubApi({ items: [sunblade] });
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    expect(within(spells()).queryByRole("combobox", { name: "Start from" })).toBeNull();
    fireEvent.click(await within(items()).findByRole("button", { name: "Edit Sunblade" }));
    expect(within(items()).queryByRole("combobox", { name: "Start from" })).toBeNull();
  });

  it("previews rules text as it renders, its markup a roll", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: JSON.stringify(ward) },
    });

    const preview = within(spells()).getByRole("region", { name: "Preview" });
    const roll = await within(preview).findByText("2d6");
    expect(roll).toHaveAttribute("data-rollable", "true");
    expect(preview).not.toHaveTextContent("{@damage");
  });

  it("creates a spell with the chosen edition, leaving its source to the server", async () => {
    const stored = {
      id: "s1",
      name: ward.name,
      edition: "classic",
      level: 2,
      school: "A",
      concentration: false,
      ritual: false,
      json: { ...ward, source: "HB" },
      createdAt: CREATED_AT,
    };
    const fetchMock = stubApi({}, [{ status: 201, body: stored }]);
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.click(within(spells()).getByRole("combobox", { name: "Rules" }));
    fireEvent.click(screen.getByRole("option", { name: "2014" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: JSON.stringify({ ...ward, source: "PHB" }) },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        {
          url: "/api/homebrew/spells",
          method: "POST",
          body: { ...ward, edition: "classic" },
        },
      ]),
    );
    await waitFor(() =>
      expect(within(spells()).queryByRole("textbox", { name: "Spell JSON" })).toBeNull(),
    );
  });

  it("edits a row in place, starting from its entry without the stamped source", async () => {
    const fetchMock = stubApi({ items: [sunblade] }, [{ status: 200, body: sunblade }]);
    renderPage();

    const edit = await within(items()).findByRole("button", { name: "Edit Sunblade" });
    edit.focus();
    fireEvent.click(edit);
    const box = within(items()).getByRole("textbox", { name: "Item JSON" });
    expect(box).toHaveFocus();
    const { source: _source, ...entry } = sunblade.json;
    expect(JSON.parse((box as HTMLTextAreaElement).value)).toEqual(entry);
    fireEvent.click(within(items()).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        { url: "/api/homebrew/items/i1", method: "PUT", body: { ...entry, edition: "one" } },
      ]),
    );
    await waitFor(() => expect(edit).toHaveFocus());
  });

  it("says why a save failed, such as a name another row holds", async () => {
    stubApi({}, [
      { status: 409, body: { error: 'The homebrew spell s9 is already named "Coastal Ward"' } },
    ]);
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: JSON.stringify(ward) },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Save" }));

    expect(await within(spells()).findByText(/^Save failed: .*already named/)).toBeInTheDocument();
  });

  it("refuses to delete a row a character holds, naming each character", async () => {
    const fetchMock = stubApi({ items: [sunblade] }, [
      {
        status: 409,
        body: {
          error: "This item is referenced by a character and cannot be deleted",
          characters: [{ id: "c1", name: "Vex" }],
        },
      },
    ]);
    renderPage();

    fireEvent.click(await within(items()).findByRole("button", { name: "Delete Sunblade" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Sunblade?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("link", { name: "Vex" })).toHaveAttribute(
      "href",
      "/characters/c1",
    );
    expect(within(dialog).getByRole("button", { name: "Delete" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(writesOf(fetchMock)).toEqual([
      { url: "/api/homebrew/items/i1", method: "DELETE", body: undefined },
    ]);
  });

  it("deletes a row nothing holds once asked to", async () => {
    const fetchMock = stubApi({ items: [sunblade] }, [{ status: 204 }]);
    renderPage();

    fireEvent.click(await within(items()).findByRole("button", { name: "Delete Sunblade" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Delete Sunblade?" })).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writesOf(fetchMock)).toEqual([
      { url: "/api/homebrew/items/i1", method: "DELETE", body: undefined },
    ]);
  });
});
