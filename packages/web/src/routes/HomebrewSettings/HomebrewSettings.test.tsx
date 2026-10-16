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
const editor = () => screen.getByRole("dialog");
const field = (role: "textbox" | "combobox" | "checkbox" | "spinbutton", name: string) =>
  within(editor()).getByRole(role, { name });
const click = (name: string) => {
  const button = within(editor()).getByRole("button", { name });
  fireEvent.click(button);
  return button;
};
const mode = (name: "Step by step" | "JSON" | "Preview") =>
  fireEvent.click(within(editor()).getByRole("tab", { name }));
const stepTo = (name: string) =>
  fireEvent.click(
    within(within(editor()).getByRole("navigation", { name: "Steps" })).getByRole("button", {
      name,
    }),
  );
const pick = (name: string, option: string) => {
  fireEvent.click(field("combobox", name));
  fireEvent.click(screen.getByRole("option", { name: option }));
};
const jsonText = (name: string) => (field("textbox", name) as HTMLTextAreaElement).value;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("names the field a rejected value sits in, beside it in either mode, and sends nothing", async () => {
    const fetchMock = stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.change(field("textbox", "Name"), { target: { value: "" } });
    click("Save");
    expect(field("textbox", "Name")).toHaveAccessibleDescription();

    mode("JSON");
    fireEvent.change(field("textbox", "Spell JSON"), {
      target: { value: JSON.stringify({ ...ward, level: 12 }) },
    });
    click("Save");

    expect(field("textbox", "Spell JSON")).toHaveAccessibleDescription(/^level: /);
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it("holds a step whose field fails until it is fixed, then walks on to a review of the entry", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    expect(editor()).toHaveTextContent("Step 1 of 3");
    expect(click("Previous")).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(field("textbox", "Name"), { target: { value: "" } });
    click("Next");
    expect(editor()).toHaveTextContent("Step 1 of 3");
    expect(field("textbox", "Name")).toHaveAccessibleDescription();
    expect(field("textbox", "Name")).toHaveFocus();

    fireEvent.change(field("textbox", "Name"), { target: { value: "Brineburst" } });
    fireEvent.keyDown(field("textbox", "Name"), { key: "Enter" });
    expect(within(editor()).getByRole("heading", { name: "Casting" })).toBeInTheDocument();
    expect(field("textbox", "Material component")).not.toHaveAccessibleDescription();
    click("Next");
    expect(within(editor()).getByRole("heading", { name: "Effect" })).toBeInTheDocument();
    expect(editor()).toHaveTextContent("Step 3 of 3");
    click("Next");
    expect(within(editor()).getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(editor()).getByRole("tab", { name: "Preview" })).toHaveFocus();
    expect(within(editor()).getByRole("heading", { name: "Brineburst" })).toBeInTheDocument();
    mode("Step by step");
    expect(within(editor()).getByRole("heading", { name: "Effect" })).toBeInTheDocument();
  });

  it("jumps to a step by its named button, and holds a jump past a step whose field fails", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    const steps = within(editor()).getByRole("navigation", { name: "Steps" });
    expect(within(steps).getByRole("button", { name: "Basics" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    fireEvent.click(within(steps).getByRole("button", { name: "Effect" }));
    expect(within(editor()).getByRole("heading", { name: "Effect" })).toBeInTheDocument();
    expect(within(steps).getByRole("button", { name: "Effect" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    fireEvent.click(within(steps).getByRole("button", { name: "Basics" }));
    fireEvent.change(field("textbox", "Name"), { target: { value: "" } });
    fireEvent.click(within(steps).getByRole("button", { name: "Preview" }));
    expect(within(editor()).getByRole("heading", { name: "Basics" })).toBeInTheDocument();
    expect(field("textbox", "Name")).toHaveFocus();
  });

  it("cancels from the footer, asking first where the entry changed", () => {
    stubApi({});
    renderPage();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    click("Cancel");
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    fireEvent.change(field("textbox", "Name"), { target: { value: "Brineburst" } });
    click("Cancel");
    expect(confirm).toHaveBeenCalledOnce();
    expect(editor()).toBeInTheDocument();
  });

  it("opens a new item on the weapon example's form, naming each code, and swaps it for the type picked", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    expect(field("combobox", "Type")).toHaveTextContent("Melee weapon");
    expect(within(editor()).queryByRole("combobox", { name: "Damage type" })).toBeNull();
    click("Next");
    expect(field("combobox", "Damage type")).toHaveTextContent("Slashing");
    expect(field("checkbox", "Versatile")).toBeChecked();

    click("Previous");
    pick("Start from", "Armor");
    expect(field("combobox", "Type")).toHaveTextContent("Medium armor");
    click("Next");
    expect(field("spinbutton", "Armor class")).toHaveValue(14);
    expect(within(editor()).queryByRole("combobox", { name: "Damage type" })).toBeNull();

    click("Previous");
    pick("Start from", "Gear");
    click("Next");
    expect(editor()).toHaveTextContent("Only a weapon or armor has fields here.");

    click("Previous");
    pick("Start from", "Weapon");
    stepTo("Magic");
    expect(field("combobox", "Rarity")).toHaveTextContent("Rare");
    expect(field("spinbutton", "Bonus to attack and damage")).toHaveValue(1);
    stepTo("Rules text");
    expect(field("textbox", "Rules text")).toHaveValue(
      (ITEM_STARTERS[0].entry.entries as string[]).join("\n\n"),
    );
  });

  it("shows the wondrous example's effects on the Magic step, and writes each in upstream's shape", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    pick("Start from", "Wondrous item");
    stepTo("Magic");
    expect(field("checkbox", "Requires attunement")).toBeChecked();
    expect(field("spinbutton", "Bonus to saving throws")).toHaveValue(1);
    expect(field("spinbutton", "Bonus to concentration saves")).toHaveValue(2);
    expect(field("spinbutton", "Critical hit on")).toHaveValue(19);
    expect(field("spinbutton", "Wisdom bonus")).toHaveValue(1);
    expect(field("spinbutton", "Flying set to (ft.)")).toHaveValue(30);
    expect(
      within(editor()).queryByRole("spinbutton", { name: "Bonus to attack and damage" }),
    ).toBeNull();

    fireEvent.change(field("spinbutton", "Bonus to spell save DC"), { target: { value: "2" } });
    fireEvent.change(field("spinbutton", "Wisdom bonus"), { target: { value: "" } });
    fireEvent.change(field("spinbutton", "Strength set to"), { target: { value: "19" } });
    fireEvent.change(field("spinbutton", "Flying set to (ft.)"), { target: { value: "" } });
    pick("Flying equal to", "Walking");
    fireEvent.change(field("spinbutton", "Bonus to every speed (ft.)"), {
      target: { value: "10" },
    });
    stepTo("Defenses");
    const vulnerable = within(editor()).getByRole("group", { name: "Damage vulnerabilities" });
    expect(within(vulnerable).getByRole("checkbox", { name: "Thunder" })).toBeChecked();
    mode("JSON");

    const entry = JSON.parse(jsonText("Item JSON"));
    expect(entry).toMatchObject({
      bonusSpellSaveDc: "+2",
      ability: { static: { str: 19 } },
      modifySpeed: { equal: { fly: "walk" }, bonus: { "*": 10 } },
      vulnerable: ["thunder"],
    });
    expect(entry.ability).not.toHaveProperty("wis");
    expect(entry.modifySpeed).not.toHaveProperty("static");
  });

  it("drops a weapon's attack when its type turns to armor", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    expect(field("spinbutton", "Value (gp)")).toHaveValue(1500);
    fireEvent.change(field("spinbutton", "Value (gp)"), { target: { value: "15.5" } });
    pick("Type", "Shield");
    mode("JSON");

    const entry = JSON.parse(jsonText("Item JSON"));
    expect(entry).toMatchObject({ type: "S", name: "Sunfire Blade", rarity: "rare", value: 1550 });
    expect(entry).not.toHaveProperty("dmg1");
    expect(entry).not.toHaveProperty("weaponCategory");
    expect(entry).not.toHaveProperty("bonusWeapon");
  });

  it("states the advantage an item grants through the form, and drops a roll's target when the roll changes", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    stepTo("Defenses");
    click("Add an effect");
    pick("Effect 1 roll", "Skill");
    pick("Effect 1 skill", "Stealth");
    fireEvent.change(field("textbox", "Effect 1 condition"), {
      target: { value: "in dim light" },
    });
    const entry = () => {
      mode("JSON");
      const text = jsonText("Item JSON");
      mode("Step by step");
      return JSON.parse(text);
    };
    expect(entry().advantage).toEqual([
      { mode: "advantage", roll: "skill", target: "Stealth", condition: "in dim light" },
    ]);

    pick("Effect 1 roll", "Saving throw");
    expect(entry().advantage).toEqual([
      { mode: "advantage", roll: "save", condition: "in dim light" },
    ]);

    click("Remove effect 1");
    expect(entry()).not.toHaveProperty("advantage");
  });

  it("lists the fields the sheet reads, and the rules text, by name ahead of an item's JSON, and none beside a spell's", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    expect(within(editor()).queryByText("Field Reference")).toBeNull();
    mode("JSON");
    const reference = within(editor()).getByRole("region", { name: "Field Reference" });
    const keys = within(reference)
      .getAllByRole("term")
      .map((term) => term.textContent ?? "");
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    expect(within(reference).getByText("entries").nextSibling).toHaveTextContent(/only displays/);
    expect(within(reference).getByText("value").nextSibling).toHaveTextContent(/copper/);
    expect(within(reference).getByText("ability")).toBeInTheDocument();
    expect(
      reference.compareDocumentPosition(field("textbox", "Item JSON")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    click("Close");

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    mode("JSON");
    expect(within(editor()).queryByText("Field Reference")).toBeNull();
  });

  it("offers no example to pick for a spell or a row being edited", async () => {
    stubApi({ items: [sunblade] });
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    expect(within(editor()).queryByRole("combobox", { name: "Start from" })).toBeNull();
    expect(field("combobox", "School")).toHaveTextContent("Evocation");
    click("Close");
    fireEvent.click(await within(items()).findByRole("button", { name: "Edit Sunblade" }));
    expect(within(editor()).queryByRole("combobox", { name: "Start from" })).toBeNull();
  });

  it("previews the whole spell as its catalog detail shows it, and returns to the same step", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    click("Next");
    click("Next");
    fireEvent.change(field("textbox", "Rules text"), {
      target: { value: "Brine deals {@damage 3d4} cold damage.\n\nIt stings." },
    });
    mode("Preview");

    const preview = editor();
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
    expect(within(preview).queryByRole("textbox")).toBeNull();

    mode("Step by step");
    expect(editor()).toHaveTextContent("Step 3 of 3");
    expect(field("textbox", "Rules text")).toHaveValue(
      "Brine deals {@damage 3d4} cold damage.\n\nIt stings.",
    );
  });

  it("previews the JSON draft as it stands, says so while it holds a problem, and returns to JSON", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    mode("JSON");
    const box = field("textbox", "Item JSON");
    fireEvent.change(box, {
      target: {
        value: JSON.stringify({
          ...JSON.parse(jsonText("Item JSON")),
          name: "Moonfire Blade",
          optionalfeatures: ["replicate magic item|tce"],
        }),
      },
    });
    mode("Preview");
    expect(
      await within(editor()).findByRole("heading", { name: "Moonfire Blade" }),
    ).toBeInTheDocument();
    expect(editor()).toHaveTextContent("Attack bonus: +1");
    expect(editor()).toHaveTextContent("Damage: 1d8 + 1 slashing (1d10 + 1 versatile)");
    expect(editor()).toHaveTextContent(
      "An Artificer can replicate this item with the Replicate Magic Item infusion.",
    );

    mode("JSON");
    expect(within(editor()).getByRole("tab", { name: "JSON" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.change(field("textbox", "Item JSON"), { target: { value: "{" } });
    mode("Preview");
    expect(editor()).toHaveTextContent("Nothing to preview until the item has no problems.");
  });

  it("switches between step by step and JSON by a labelled tab, by keyboard too", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    const tabs = within(editor()).getByRole("tablist", { name: "Spell editor" });
    const steps = within(tabs).getByRole("tab", { name: "Step by step" });
    const json = within(tabs).getByRole("tab", { name: "JSON" });
    expect(steps).toHaveAttribute("aria-selected", "true");
    expect(within(editor()).getByRole("tabpanel", { name: "Step by step" })).toBeInTheDocument();

    fireEvent.keyDown(steps, { key: "ArrowRight" });
    expect(json).toHaveAttribute("aria-selected", "true");
    expect(json).toHaveFocus();
    expect(within(editor()).getByRole("tabpanel", { name: "JSON" })).toContainElement(
      field("textbox", "Spell JSON"),
    );

    fireEvent.change(field("textbox", "Spell JSON"), { target: { value: "{" } });
    fireEvent.keyDown(json, { key: "Home" });
    expect(json).toHaveAttribute("aria-selected", "true");
    expect(json).toHaveFocus();

    fireEvent.change(field("textbox", "Spell JSON"), { target: { value: JSON.stringify(ward) } });
    fireEvent.keyDown(json, { key: "Home" });
    expect(steps).toHaveAttribute("aria-selected", "true");
    expect(steps).toHaveFocus();
    expect(field("textbox", "Name")).toHaveValue("Coastal Ward");
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
    pick("Rules", "2014");
    mode("JSON");
    fireEvent.change(field("textbox", "Spell JSON"), {
      target: { value: JSON.stringify({ ...ward, source: "PHB" }) },
    });
    mode("Step by step");

    expect(field("textbox", "Name")).toHaveValue("Coastal Ward");
    expect(field("combobox", "School")).toHaveTextContent("Abjuration");
    click("Next");
    expect(field("combobox", "Duration")).toHaveTextContent("Instantaneous");
    click("Save");

    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        {
          url: "/api/homebrew/spells",
          method: "POST",
          body: { ...ward, edition: "classic" },
        },
      ]),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays in JSON until its text parses", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    mode("JSON");
    fireEvent.change(field("textbox", "Spell JSON"), { target: { value: "{ name: " } });
    mode("Step by step");

    expect(field("textbox", "Spell JSON")).toHaveAccessibleDescription(/^entry: Not valid JSON/);
  });

  it("carries a change across both modes, and keeps a field the form does not show", async () => {
    const charged = { ...sunblade, json: { ...sunblade.json, charges: 3 } };
    const fetchMock = stubApi({ items: [charged] }, [{ status: 200, body: charged }]);
    renderPage();

    fireEvent.click(await within(items()).findByRole("button", { name: "Edit Sunblade" }));
    fireEvent.change(field("textbox", "Name"), { target: { value: "Moonblade" } });
    mode("JSON");
    const entry = JSON.parse(jsonText("Item JSON"));
    expect(entry).toMatchObject({ name: "Moonblade", charges: 3 });

    fireEvent.change(field("textbox", "Item JSON"), {
      target: { value: JSON.stringify({ ...entry, rarity: "legendary" }) },
    });
    mode("Step by step");
    stepTo("Magic");
    expect(field("combobox", "Rarity")).toHaveTextContent("Legendary");
    click("Save");

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
    click("Next");
    pick("Range", "Feet");
    fireEvent.change(field("spinbutton", "Distance"), { target: { value: "15" } });
    pick("Area", "Cone");
    pick("Range", "Miles");
    pick("Range", "Feet");
    pick("Duration", "Timed");
    pick("Duration", "Instantaneous");
    pick("Duration", "Timed");
    fireEvent.click(field("checkbox", "Concentration"));
    click("Next");
    fireEvent.change(field("textbox", "At higher levels"), { target: { value: "More cold." } });
    mode("JSON");

    expect(JSON.parse(jsonText("Spell JSON"))).toMatchObject({
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
    mode("JSON");
    fireEvent.change(field("textbox", "Spell JSON"), {
      target: { value: JSON.stringify(shield) },
    });
    mode("Step by step");
    click("Next");
    const time = field("spinbutton", "Casting time");
    fireEvent.change(time, { target: { value: "" } });
    fireEvent.change(time, { target: { value: "1" } });
    fireEvent.click(field("checkbox", "Ritual"));
    click("Previous");
    pick("Rules", "2014");
    mode("JSON");

    const entry = JSON.parse(jsonText("Spell JSON"));
    expect(entry.time).toEqual(shield.time);
    expect(entry).not.toHaveProperty("meta");
    expect(entry.entriesHigherLevel[0].name).toBe("At Higher Levels");
  });

  it("takes a save holding a problem to the step that shows it, and names a cantrip's upgrade", async () => {
    const fetchMock = stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    pick("Level", "Cantrip");
    mode("JSON");
    const entry = JSON.parse(jsonText("Spell JSON"));
    expect(entry.entriesHigherLevel[0].name).toBe("Cantrip Upgrade");

    fireEvent.change(field("textbox", "Spell JSON"), {
      target: { value: JSON.stringify({ ...entry, entries: "loose" }) },
    });
    mode("Step by step");
    click("Save");

    expect(within(editor()).getByRole("heading", { name: "Effect" })).toBeInTheDocument();
    expect(within(editor()).getByText(/expected array/i)).toBeInTheDocument();
    expect(field("textbox", "Cantrip upgrade")).toBeInTheDocument();
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it("edits a row in a modal, starting from its entry without the stamped source, and returns focus", async () => {
    const fetchMock = stubApi({ items: [sunblade] }, [{ status: 200, body: sunblade }]);
    renderPage();

    const edit = await within(items()).findByRole("button", { name: "Edit Sunblade" });
    edit.focus();
    fireEvent.click(edit);
    expect(screen.getByRole("dialog", { name: "Edit Sunblade" })).toBeInTheDocument();
    mode("JSON");
    const { source: _source, ...entry } = sunblade.json;
    expect(JSON.parse(jsonText("Item JSON"))).toEqual(entry);
    click("Save");

    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        { url: "/api/homebrew/items/i1", method: "PUT", body: { ...entry, edition: "one" } },
      ]),
    );
    await waitFor(() => expect(edit).toHaveFocus());
  });

  it("asks before closing over unsaved changes, and closes without asking where there are none", () => {
    stubApi({});
    renderPage();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const add = within(items()).getByRole("button", { name: "Add item" });
    add.focus();
    fireEvent.click(add);
    mode("JSON");
    mode("Step by step");
    click("Close");
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(add).toHaveFocus();

    fireEvent.click(add);
    fireEvent.change(field("textbox", "Name"), { target: { value: "Moonfire Blade" } });
    click("Close");
    expect(confirm).toHaveBeenCalledWith("Discard your changes to New item?");
    expect(field("textbox", "Name")).toHaveValue("Moonfire Blade");

    confirm.mockReturnValue(true);
    click("Close");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(add).toHaveFocus();
  });

  it("says why a save failed, such as a name another row holds", async () => {
    stubApi({}, [
      { status: 409, body: { error: 'The homebrew spell s9 is already named "Coastal Ward"' } },
    ]);
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    click("Save");

    expect(await within(editor()).findByText(/^Save failed: .*already named/)).toBeInTheDocument();
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
