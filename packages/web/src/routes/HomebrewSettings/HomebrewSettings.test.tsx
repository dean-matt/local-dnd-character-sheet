import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomebrewSettings } from "./HomebrewSettings.tsx";
import { ITEM_STARTERS } from "./homebrewStarters.ts";

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

  it("names the field a rejected value sits in, beside it in either view, and sends nothing", async () => {
    const fetchMock = stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Name" }), {
      target: { value: "" },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Save" }));
    expect(within(spells()).getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription();

    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as JSON" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: JSON.stringify({ ...ward, level: 12 }) },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Save" }));

    expect(
      within(spells()).getByRole("textbox", { name: "Spell JSON" }),
    ).toHaveAccessibleDescription(/^level: /);
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it("opens a new item on the weapon example's form, naming each code, and swaps it for the type picked", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    const picker = (name: string) => within(items()).getByRole("combobox", { name });
    expect(picker("Type")).toHaveTextContent("Melee weapon");
    expect(picker("Rarity")).toHaveTextContent("Rare");
    expect(picker("Damage type")).toHaveTextContent("Slashing");
    expect(within(items()).getByRole("checkbox", { name: "Versatile" })).toBeChecked();
    expect(within(items()).getByRole("textbox", { name: "Rules text" })).toHaveValue(
      (ITEM_STARTERS[0].entry.entries as string[]).join("\n\n"),
    );

    fireEvent.click(picker("Start from"));
    fireEvent.click(screen.getByRole("option", { name: "Armor" }));
    expect(picker("Type")).toHaveTextContent("Medium armor");
    expect(within(items()).getByRole("spinbutton", { name: "Armor class" })).toHaveValue(14);
    expect(within(items()).queryByRole("combobox", { name: "Damage type" })).toBeNull();
  });

  it("drops a weapon's attack when its type turns to armor", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    expect(within(items()).getByRole("spinbutton", { name: "Value (gp)" })).toHaveValue(1500);
    fireEvent.change(within(items()).getByRole("spinbutton", { name: "Value (gp)" }), {
      target: { value: "15.5" },
    });
    fireEvent.click(within(items()).getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Shield" }));
    fireEvent.click(within(items()).getByRole("button", { name: "Edit as JSON" }));

    const entry = JSON.parse(
      (within(items()).getByRole("textbox", { name: "Item JSON" }) as HTMLTextAreaElement).value,
    );
    expect(entry).toMatchObject({ type: "S", name: "Sunfire Blade", rarity: "rare", value: 1550 });
    expect(entry).not.toHaveProperty("dmg1");
    expect(entry).not.toHaveProperty("weaponCategory");
    expect(entry).not.toHaveProperty("bonusWeapon");
  });

  it("states the advantage an item grants through the form, and drops a roll's target when the roll changes", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    fireEvent.click(within(items()).getByRole("button", { name: "Add an effect" }));
    const picker = (name: string) => within(items()).getByRole("combobox", { name });
    fireEvent.click(picker("Effect 1 roll"));
    fireEvent.click(screen.getByRole("option", { name: "Skill" }));
    fireEvent.click(picker("Effect 1 skill"));
    fireEvent.click(screen.getByRole("option", { name: "Stealth" }));
    fireEvent.change(within(items()).getByRole("textbox", { name: "Effect 1 condition" }), {
      target: { value: "in dim light" },
    });
    const entry = () => {
      fireEvent.click(within(items()).getByRole("button", { name: "Edit as JSON" }));
      const text = (
        within(items()).getByRole("textbox", { name: "Item JSON" }) as HTMLTextAreaElement
      ).value;
      fireEvent.click(within(items()).getByRole("button", { name: "Edit as form" }));
      return JSON.parse(text);
    };
    expect(entry().advantage).toEqual([
      { mode: "advantage", roll: "skill", target: "Stealth", condition: "in dim light" },
    ]);

    fireEvent.click(picker("Effect 1 roll"));
    fireEvent.click(screen.getByRole("option", { name: "Saving throw" }));
    expect(entry().advantage).toEqual([
      { mode: "advantage", roll: "save", condition: "in dim light" },
    ]);

    fireEvent.click(within(items()).getByRole("button", { name: "Remove effect 1" }));
    expect(entry()).not.toHaveProperty("advantage");
  });

  it("offers no example to pick for a spell or a row being edited", async () => {
    stubApi({ items: [sunblade] });
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    expect(within(spells()).queryByRole("combobox", { name: "Start from" })).toBeNull();
    expect(within(spells()).getByRole("combobox", { name: "School" })).toHaveTextContent(
      "Evocation",
    );
    fireEvent.click(await within(items()).findByRole("button", { name: "Edit Sunblade" }));
    expect(within(items()).queryByRole("combobox", { name: "Start from" })).toBeNull();
  });

  it("previews the whole spell as its catalog detail shows it, and no rules text alone", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Rules text" }), {
      target: { value: "Brine deals {@damage 3d4} cold damage.\n\nIt stings." },
    });

    const preview = within(spells()).getByRole("tabpanel", { name: "Preview" });
    const roll = await within(preview).findByText("3d4");
    expect(roll).toHaveAttribute("data-rollable", "true");
    expect(within(preview).getByRole("heading", { name: "Brinelash" })).toBeInTheDocument();
    expect(preview).toHaveTextContent("Homebrew");
    expect(preview).toHaveTextContent("Level: 2nd");
    expect(preview).toHaveTextContent("School: Evocation");
    expect(preview).toHaveTextContent("Casting time: 1 action");
    expect(preview).toHaveTextContent("Range: 60 feet");
    expect(preview).toHaveTextContent("Components: V, S, M (a pinch of sea salt)");
    expect(preview).toHaveTextContent("Duration: Concentration, up to 1 minute");
    expect(preview).not.toHaveTextContent("{@damage");
    expect(preview).toHaveTextContent("It stings.");
    expect(preview).toHaveTextContent("Using a Higher-Level Spell Slot");
    expect(within(spells()).queryAllByRole("tabpanel", { name: /preview/i })).toHaveLength(1);
  });

  it("keeps the last valid entry in the preview while a field holds a problem, and follows the JSON view", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    const preview = within(items()).getByRole("tabpanel", { name: "Preview" });
    expect(within(preview).getByRole("heading", { name: "Sunfire Blade" })).toBeInTheDocument();
    expect(preview).toHaveTextContent("Attack bonus: +1");
    expect(preview).toHaveTextContent("Damage: 1d8 + 1 slashing (1d10 + 1 versatile)");
    expect(preview).toHaveTextContent("Value: 1500 gp");

    const name = within(items()).getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "Starfire Blade" } });
    fireEvent.change(name, { target: { value: "" } });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(within(preview).getByRole("heading", { name: "Starfire Blade" })).toBeInTheDocument();

    fireEvent.click(within(items()).getByRole("button", { name: "Edit as JSON" }));
    const box = within(items()).getByRole("textbox", { name: "Item JSON" }) as HTMLTextAreaElement;
    fireEvent.change(box, {
      target: { value: JSON.stringify({ ...JSON.parse(box.value), name: "Moonfire Blade" }) },
    });
    expect(
      await within(preview).findByRole("heading", { name: "Moonfire Blade" }),
    ).toBeInTheDocument();
  });

  it("switches between the form and the preview by a labelled tab, by keyboard too", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    const tabs = within(spells()).getByRole("tablist", { name: "Spell view" });
    const edit = within(tabs).getByRole("tab", { name: "Edit" });
    const preview = within(tabs).getByRole("tab", { name: "Preview" });
    expect(edit).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(edit, { key: "ArrowRight" });
    expect(preview).toHaveAttribute("aria-selected", "true");
    expect(preview).toHaveFocus();

    fireEvent.change(within(spells()).getByRole("textbox", { name: "Name" }), {
      target: { value: "" },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Save" }));
    expect(edit).toHaveAttribute("aria-selected", "true");
  });

  it("fills the form from a pasted entry, and creates it with the chosen edition, leaving its source to the server", async () => {
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
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as JSON" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: JSON.stringify({ ...ward, source: "PHB" }) },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as form" }));

    expect(within(spells()).getByRole("textbox", { name: "Name" })).toHaveValue("Coastal Ward");
    expect(within(spells()).getByRole("combobox", { name: "School" })).toHaveTextContent(
      "Abjuration",
    );
    expect(within(spells()).getByRole("combobox", { name: "Duration" })).toHaveTextContent(
      "Instantaneous",
    );
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
      expect(within(spells()).queryByRole("textbox", { name: "Name" })).toBeNull(),
    );
  });

  it("stays in the JSON view until its text parses", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as JSON" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: "{ name: " },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as form" }));

    expect(
      within(spells()).getByRole("textbox", { name: "Spell JSON" }),
    ).toHaveAccessibleDescription(/^entry: Not valid JSON/);
  });

  it("carries a change across both views, and keeps a field the form does not show", async () => {
    const charged = { ...sunblade, json: { ...sunblade.json, charges: 3 } };
    const fetchMock = stubApi({ items: [charged] }, [{ status: 200, body: charged }]);
    renderPage();

    fireEvent.click(await within(items()).findByRole("button", { name: "Edit Sunblade" }));
    fireEvent.change(within(items()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Moonblade" },
    });
    fireEvent.click(within(items()).getByRole("button", { name: "Edit as JSON" }));
    const box = within(items()).getByRole("textbox", { name: "Item JSON" }) as HTMLTextAreaElement;
    const entry = JSON.parse(box.value);
    expect(entry).toMatchObject({ name: "Moonblade", charges: 3 });

    fireEvent.change(box, { target: { value: JSON.stringify({ ...entry, rarity: "legendary" }) } });
    fireEvent.click(within(items()).getByRole("button", { name: "Edit as form" }));
    expect(within(items()).getByRole("combobox", { name: "Rarity" })).toHaveTextContent(
      "Legendary",
    );
    fireEvent.click(within(items()).getByRole("button", { name: "Save" }));

    const { source: _source, ...rest } = charged.json;
    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        {
          url: "/api/homebrew/items/i1",
          method: "PUT",
          body: { ...rest, name: "Moonblade", rarity: "legendary", edition: "one" },
        },
      ]),
    );
  });

  it("writes a spell's range, duration and upcast text in upstream's shapes", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    const pick = (name: string, option: string) => {
      fireEvent.click(within(spells()).getByRole("combobox", { name }));
      fireEvent.click(screen.getByRole("option", { name: option }));
    };
    pick("Range", "Feet");
    fireEvent.change(within(spells()).getByRole("spinbutton", { name: "Distance" }), {
      target: { value: "15" },
    });
    pick("Area", "Cone");
    pick("Range", "Miles");
    pick("Range", "Feet");
    pick("Duration", "Timed");
    pick("Duration", "Instantaneous");
    pick("Duration", "Timed");
    fireEvent.click(within(spells()).getByRole("checkbox", { name: "Concentration" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "At higher levels" }), {
      target: { value: "More cold." },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as JSON" }));

    const entry = JSON.parse(
      (within(spells()).getByRole("textbox", { name: "Spell JSON" }) as HTMLTextAreaElement).value,
    );
    expect(entry).toMatchObject({
      range: { type: "cone", distance: { type: "feet", amount: 15 } },
      duration: [{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }],
      entriesHigherLevel: [
        { type: "entries", name: "Using a Higher-Level Spell Slot", entries: ["More cold."] },
      ],
    });
  });

  it("keeps a casting time's trigger, and the rest of the entry's spans, through a cleared number", async () => {
    const shield = {
      ...ward,
      time: [
        { number: 1, unit: "reaction", condition: "when you are hit" },
        { number: 1, unit: "minute" },
      ],
      meta: { ritual: true },
      entriesHigherLevel: [
        { type: "entries", name: "Using a Higher-Level Spell Slot", entries: ["More."] },
      ],
    };
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as JSON" }));
    fireEvent.change(within(spells()).getByRole("textbox", { name: "Spell JSON" }), {
      target: { value: JSON.stringify(shield) },
    });
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as form" }));
    const time = within(spells()).getByRole("spinbutton", { name: "Casting time" });
    fireEvent.change(time, { target: { value: "" } });
    fireEvent.change(time, { target: { value: "1" } });
    fireEvent.click(within(spells()).getByRole("checkbox", { name: "Ritual" }));
    fireEvent.click(within(spells()).getByRole("combobox", { name: "Rules" }));
    fireEvent.click(screen.getByRole("option", { name: "2014" }));
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as JSON" }));

    const entry = JSON.parse(
      (within(spells()).getByRole("textbox", { name: "Spell JSON" }) as HTMLTextAreaElement).value,
    );
    expect(entry.time).toEqual(shield.time);
    expect(entry).not.toHaveProperty("meta");
    expect(entry.entriesHigherLevel[0].name).toBe("At Higher Levels");
  });

  it("shows a problem in rules text the form leaves to JSON, and names a cantrip's upgrade", async () => {
    const fetchMock = stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.click(within(spells()).getByRole("combobox", { name: "Level" }));
    fireEvent.click(screen.getByRole("option", { name: "Cantrip" }));
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as JSON" }));
    const box = within(spells()).getByRole("textbox", {
      name: "Spell JSON",
    }) as HTMLTextAreaElement;
    const entry = JSON.parse(box.value);
    expect(entry.entriesHigherLevel[0].name).toBe("Cantrip Upgrade");

    fireEvent.change(box, { target: { value: JSON.stringify({ ...entry, entries: "loose" }) } });
    fireEvent.click(within(spells()).getByRole("button", { name: "Edit as form" }));
    fireEvent.click(within(spells()).getByRole("button", { name: "Save" }));

    expect(within(spells()).getByText(/expected array/i)).toBeInTheDocument();
    expect(within(spells()).getByRole("textbox", { name: "Cantrip upgrade" })).toBeInTheDocument();
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it("edits a row in place, starting from its entry without the stamped source", async () => {
    const fetchMock = stubApi({ items: [sunblade] }, [{ status: 200, body: sunblade }]);
    renderPage();

    const edit = await within(items()).findByRole("button", { name: "Edit Sunblade" });
    edit.focus();
    fireEvent.click(edit);
    expect(within(items()).getByRole("textbox", { name: "Name" })).toHaveFocus();
    fireEvent.click(within(items()).getByRole("button", { name: "Edit as JSON" }));
    const box = within(items()).getByRole("textbox", { name: "Item JSON" });
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
  it("closes the editor of a row once that row is deleted, and says the list is empty", async () => {
    const lists: { items: unknown[] } = { items: [sunblade] };
    stubApi(lists, [{ status: 204 }]);
    renderPage();

    fireEvent.click(await within(items()).findByRole("button", { name: "Edit Sunblade" }));
    fireEvent.click(within(items()).getByRole("button", { name: "Delete Sunblade" }));
    lists.items = [];
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Delete Sunblade?" })).getByRole("button", {
        name: "Delete",
      }),
    );

    expect(await within(items()).findByText("No homebrew items yet.")).toBeInTheDocument();
    expect(within(items()).queryByRole("textbox", { name: "Name" })).toBeNull();
  });
});
