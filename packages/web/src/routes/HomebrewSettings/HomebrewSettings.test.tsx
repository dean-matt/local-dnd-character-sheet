import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "codemirror";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { charactersKey } from "../../hooks/characterKeys.ts";
import {
  BACKGROUND_STARTERS,
  CLASS_STARTERS,
  FEAT_STARTERS,
  ITEM_STARTERS,
  RACE_STARTERS,
} from "../../lib/homebrewStarters.ts";
import { characterRecord } from "../../test/records.ts";
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

const sailing = {
  id: "k1",
  name: "Sailing",
  edition: "one",
  json: { name: "Sailing", source: "HB", ability: "wis" },
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
 * A fake API: a `GET` of a homebrew list or of `/characters` answers from `lists`, and any
 * other request under `/api/homebrew` takes the next answer in `writes`.
 */
function stubApi(lists: Record<string, unknown[]>, writes: Answer[] = [], holders?: Answer) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (holders && /^\/api\/homebrew\/skills\/[^/]+\/holders$/.test(url)) {
      return json(holders.status, holders.body);
    }
    const match = /^\/api\/(?:homebrew\/(\w+)|(characters))$/.exec(url);
    const listed = match?.[1] ?? match?.[2];
    if (method === "GET" && listed) return json(200, lists[listed] ?? []);
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
  return client;
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
/** The open dialog by tag: `getByRole("dialog")` walks the whole page's accessibility tree on every helper call. */
const editor = () => {
  const open = document.querySelector<HTMLElement>("dialog[open]");
  if (!open) throw new Error("no dialog is open");
  return open;
};
const FIELD_SELECTOR = {
  textbox: '[role="textbox"], textarea, input:not([type]), input[type="text"]',
  combobox: '[role="combobox"], select',
  checkbox: '[role="checkbox"], input[type="checkbox"]',
  spinbutton: '[role="spinbutton"], input[type="number"]',
};
/** By label and tag rather than `getByRole`, which computes the name of every element of that role in the form. */
const field = (role: keyof typeof FIELD_SELECTOR, name: string) =>
  within(editor()).getByLabelText(name, { selector: FIELD_SELECTOR[role] });
const click = (name: string) => {
  const button = within(editor()).getByRole("button", { name });
  fireEvent.click(button);
  return button;
};
const mode = (name: "Step by step" | "JSON" | "Preview") =>
  fireEvent.click(within(editor()).getByRole("tab", { name }));
/** Goes to the step holding the section `name`, a step being titled by its sections. */
const stepTo = (name: string) =>
  fireEvent.click(
    within(within(editor()).getByRole("navigation", { name: "Steps" })).getByRole("button", {
      name: new RegExp(`(^| & )${name}( & |$)`),
    }),
  );
const pick = (name: string, option: string) => {
  fireEvent.click(field("combobox", name));
  fireEvent.click(screen.getByRole("option", { name: option }));
};
/** The CodeMirror view behind a JSON editor, which jsdom cannot type into. */
const jsonView = (name: string) => {
  const view = EditorView.findFromDOM(field("textbox", name));
  if (!view) throw new Error(`no editor for ${name}`);
  return view;
};
const jsonText = (name: string) => jsonView(name).state.doc.toString();
const typeJson = (name: string, text: string) => {
  const view = jsonView(name);
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HomebrewSettings", () => {
  it("says search and the pickers offer every kind beside the catalog's", () => {
    stubApi({});
    renderPage();

    expect(
      screen.getByText(
        /^Your own items, spells, races, classes, backgrounds and feats\. Search and the pickers offer them beside the catalog's\./,
      ),
    ).toBeVisible();
  });

  it("lists the kinds in a fixed order", () => {
    stubApi({});
    renderPage();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Items",
      "Spells",
      "Races",
      "Classes",
      "Backgrounds",
      "Feats",
      "Skills",
    ]);
  });

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
    typeJson("Spell JSON", JSON.stringify({ ...ward, level: 12 }));
    click("Save");

    expect(field("textbox", "Spell JSON")).toHaveAccessibleDescription(/^level: /);
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it("holds a step whose field fails until it is fixed, then walks on to a review of the entry", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(spells()).getByRole("button", { name: "Add spell" }));
    expect(editor()).toHaveTextContent("Step 1 of 2");
    expect(within(editor()).getByRole("heading", { name: "Basics" })).toBeInTheDocument();
    expect(within(editor()).getByRole("heading", { name: "Casting" })).toBeInTheDocument();
    expect(click("Previous")).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(field("textbox", "Name"), { target: { value: "" } });
    click("Next");
    expect(editor()).toHaveTextContent("Step 1 of 2");
    expect(field("textbox", "Name")).toHaveAccessibleDescription();
    expect(field("textbox", "Name")).toHaveFocus();
    expect(field("textbox", "Material component")).not.toHaveAccessibleDescription();

    fireEvent.change(field("textbox", "Name"), { target: { value: "Brineburst" } });
    fireEvent.keyDown(field("textbox", "Name"), { key: "Enter" });
    expect(within(editor()).getByRole("heading", { name: "Effect" })).toBeInTheDocument();
    expect(editor()).toHaveTextContent("Step 2 of 2");
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
    expect(within(steps).getByRole("button", { name: "Basics & Casting" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    fireEvent.click(within(steps).getByRole("button", { name: "Effect" }));
    expect(within(editor()).getByRole("heading", { name: "Effect" })).toBeInTheDocument();
    expect(within(steps).getByRole("button", { name: "Effect" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    fireEvent.click(within(steps).getByRole("button", { name: "Basics & Casting" }));
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
    const basics = within(editor()).getByRole("region", { name: "Basics" });
    expect(within(basics).queryByRole("combobox", { name: "Rules" })).toBeNull();
    mode("Preview");
    expect(field("combobox", "Rules")).toHaveTextContent("2024");
    mode("Step by step");
    stepTo("Combat");
    expect(field("combobox", "Damage type")).toHaveTextContent("Slashing");
    fireEvent.change(field("combobox", "Damage"), { target: { value: "1d" } });
    click("Next");
    expect(field("combobox", "Damage")).toHaveAccessibleDescription(
      "Not dice notation, such as 1d8 or 2d6",
    );
    expect(field("combobox", "Damage")).toHaveFocus();
    fireEvent.change(field("combobox", "Damage"), { target: { value: "1d8" } });
    expect(field("combobox", "Damage")).not.toHaveAccessibleDescription();
    expect(
      within(editor()).getByRole("button", { name: "Properties Versatile" }),
    ).toBeInTheDocument();

    pick("Start from", "Armor");
    expect(field("spinbutton", "Armor class")).toHaveValue(14);
    expect(within(editor()).queryByRole("combobox", { name: "Damage type" })).toBeNull();

    pick("Start from", "Gear");
    expect(editor()).toHaveTextContent("Only a weapon or armor has fields here.");

    pick("Start from", "Weapon");
    stepTo("Magic");
    expect(field("combobox", "Rarity")).toHaveTextContent("Rare");
    expect(field("combobox", "Bonus 1 to")).toHaveTextContent("Attack and damage");
    expect(field("spinbutton", "Bonus 1 amount")).toHaveValue(1);
    stepTo("Rules text");
    expect(field("textbox", "Rules text")).toHaveValue(
      (ITEM_STARTERS[0].entry.entries as string[]).join("\n\n"),
    );
  });

  it("shows the wondrous example's bonuses and attunement on the Magic step, and writes each in upstream's shape", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    pick("Start from", "Wondrous item");
    stepTo("Magic");
    expect(field("combobox", "Attunement")).toHaveTextContent("Required");
    expect(field("combobox", "Bonus 1 to")).toHaveTextContent("Saving throws");
    expect(field("combobox", "Bonus 2 to")).toHaveTextContent("Concentration saves");
    expect(field("spinbutton", "Bonus 2 amount")).toHaveValue(2);
    expect(field("combobox", "Bonus 6 to")).toHaveTextContent("Spell save DC");
    expect(field("combobox", "Bonus 8 to")).toHaveTextContent("Critical hit on");
    expect(field("spinbutton", "Bonus 8 amount")).toHaveValue(19);
    fireEvent.change(field("spinbutton", "Bonus 6 amount"), { target: { value: "2" } });

    fireEvent.click(within(editor()).getByRole("button", { name: "Remove bonus 3" }));
    click("Add a bonus");
    fireEvent.click(field("combobox", "Bonus 8 to"));
    expect(screen.queryByRole("option", { name: "Attack and damage" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Saving throws" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "AC" }));
    fireEvent.change(field("spinbutton", "Bonus 8 amount"), { target: { value: "1" } });
    expect(within(editor()).queryByRole("button", { name: "Add a bonus" })).toBeInTheDocument();

    pick("Attunement", "Required by…");
    fireEvent.change(field("textbox", "Attuned by"), { target: { value: "by a sorcerer" } });

    mode("JSON");
    const entry = JSON.parse(jsonText("Item JSON"));
    expect(entry).toMatchObject({
      reqAttune: "by a sorcerer",
      bonusAc: "+1",
      bonusSpellSaveDc: "+2",
      critThreshold: 19,
    });
    expect(entry).not.toHaveProperty("bonusAbilityCheck");
  });

  it("shows the wondrous example's ability and speed changes as rows, and writes each in upstream's shape", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    pick("Start from", "Wondrous item");
    stepTo("Effects");
    expect(field("combobox", "Ability change 1 ability")).toHaveTextContent("Wisdom");
    expect(field("combobox", "Ability change 1 rule")).toHaveTextContent("Raises by");
    expect(field("spinbutton", "Ability change 1 amount")).toHaveValue(1);
    expect(field("combobox", "Speed change 1 speed")).toHaveTextContent("Flying");
    expect(field("spinbutton", "Speed change 1 feet")).toHaveValue(30);

    pick("Ability change 1 rule", "Sets to");
    pick("Ability change 1 ability", "Strength");
    fireEvent.change(field("spinbutton", "Ability change 1 amount"), { target: { value: "19" } });
    click("Add an ability change");
    pick("Ability change 2 ability", "Dexterity");
    pick("Speed change 1 rule", "Equal to");
    pick("Speed change 1 matches", "Walking");
    click("Add a speed change");
    pick("Speed change 2 speed", "Every speed");
    fireEvent.change(field("spinbutton", "Speed change 2 feet"), { target: { value: "10" } });
    mode("JSON");
    const entry = JSON.parse(jsonText("Item JSON"));
    expect(entry.ability).toEqual({ static: { str: 19 } });
    expect(entry.modifySpeed).toEqual({ equal: { fly: "walk" }, bonus: { "*": 10 } });
  });

  it("shows the wondrous example's vulnerability, and adds another", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    pick("Start from", "Wondrous item");
    stepTo("Defenses");
    const vulnerable = within(editor()).getByRole("button", {
      name: "Damage vulnerabilities Thunder",
    });
    expect(within(editor()).getByRole("button", { name: "Resistances None" })).toBeInTheDocument();
    fireEvent.click(vulnerable);
    fireEvent.click(within(editor()).getByRole("checkbox", { name: "Cold" }));
    expect(
      within(editor()).getByRole("button", { name: "Damage vulnerabilities Thunder, Cold" }),
    ).toBeInTheDocument();
    mode("JSON");
    const entry = JSON.parse(jsonText("Item JSON"));
    expect(entry.vulnerable).toEqual(["thunder", "cold"]);
  });

  it("opens the JSON with every object's fields in alphabetical order", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    pick("Start from", "Wondrous item");
    mode("JSON");
    const keysOf = (value: unknown): string[][] =>
      value && typeof value === "object" && !Array.isArray(value)
        ? [Object.keys(value), ...Object.values(value).flatMap(keysOf)]
        : Array.isArray(value)
          ? value.flatMap(keysOf)
          : [];
    for (const keys of keysOf(JSON.parse(jsonText("Item JSON")))) {
      expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    }
  });

  it("lists a problem in a field the step shows no control for, as a gear item's pasted damage", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    pick("Start from", "Gear");
    mode("JSON");
    typeJson(
      "Item JSON",
      JSON.stringify({
        ...JSON.parse(jsonText("Item JSON")),
        dmg1: "1d",
        critThreshold: "x",
      }),
    );
    mode("Step by step");
    click("Save");

    expect(within(editor()).getByRole("heading", { name: "Combat" })).toBeInTheDocument();
    expect(within(editor()).queryByRole("combobox", { name: "Damage" })).toBeNull();
    const alerts = within(editor())
      .getAllByRole("alert")
      .map((alert) => alert.textContent);
    expect(alerts.some((text) => text?.includes("dmg1"))).toBe(true);

    mode("JSON");
    const { dmg1: _dmg1, ...rest } = JSON.parse(jsonText("Item JSON"));
    typeJson("Item JSON", JSON.stringify(rest));
    mode("Step by step");
    click("Save");
    expect(within(editor()).getByRole("heading", { name: "Magic" })).toBeInTheDocument();
    const shown = within(editor())
      .getAllByRole("alert")
      .map((alert) => alert.textContent);
    expect(shown.some((text) => text?.includes("critThreshold"))).toBe(true);
  });

  it("shows a versatile die only for a Versatile weapon, and drops it with the property", () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    stepTo("Combat");
    expect(field("combobox", "Versatile damage")).toHaveValue("1d10");
    fireEvent.click(within(editor()).getByRole("button", { name: "Properties Versatile" }));
    fireEvent.click(within(editor()).getByRole("checkbox", { name: /^Versatile/ }));
    expect(within(editor()).queryByRole("combobox", { name: "Versatile damage" })).toBeNull();
    mode("JSON");
    expect(JSON.parse(jsonText("Item JSON"))).not.toHaveProperty("dmg2");
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
    stepTo("Effects");
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

  it("lists a homebrew skill after the built-in skills in an item's advantage picker", async () => {
    stubApi({ skills: [sailing] });
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    stepTo("Effects");
    click("Add an effect");
    pick("Effect 1 roll", "Skill");
    fireEvent.click(field("combobox", "Effect 1 skill"));
    await screen.findByRole("option", { name: "Sailing" });
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options.slice(-2)).toEqual(["Survival", "Sailing"]);
  });

  it("states an item's senses through the form, one range each, and drops the field when none is left", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    stepTo("Effects");
    fireEvent.change(field("spinbutton", "Truesight (ft.)"), { target: { value: "30" } });
    fireEvent.change(field("spinbutton", "Darkvision (ft.)"), { target: { value: "120" } });
    const entry = () => {
      mode("JSON");
      const text = jsonText("Item JSON");
      mode("Step by step");
      return JSON.parse(text);
    };
    expect(entry().senses).toEqual([{ darkvision: 120 }, { truesight: 30 }]);

    fireEvent.change(field("spinbutton", "Darkvision (ft.)"), { target: { value: "" } });
    expect(entry().senses).toEqual([{ truesight: 30 }]);

    fireEvent.change(field("spinbutton", "Truesight (ft.)"), { target: { value: "0" } });
    expect(entry()).not.toHaveProperty("senses");
  });

  it("sets an item's skill proficiency and expertise through the form, and drops the field when none is left", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    stepTo("Effects");
    fireEvent.click(within(editor()).getByRole("button", { name: "Skill proficiencies None" }));
    fireEvent.click(within(editor()).getByRole("checkbox", { name: "Intimidation" }));
    fireEvent.click(within(editor()).getByRole("checkbox", { name: "Stealth" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.click(within(editor()).getByRole("button", { name: "Skill expertise None" }));
    fireEvent.click(within(editor()).getByRole("checkbox", { name: "Intimidation" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    const entry = () => {
      mode("JSON");
      const text = jsonText("Item JSON");
      mode("Step by step");
      return JSON.parse(text);
    };
    expect(entry().skillProficiencies).toEqual([{ intimidation: true, stealth: true }]);
    expect(entry().expertise).toEqual([{ intimidation: true }]);

    fireEvent.click(within(editor()).getByRole("button", { name: "Skill expertise Intimidation" }));
    fireEvent.click(within(editor()).getByRole("checkbox", { name: "Intimidation" }));
    expect(entry()).not.toHaveProperty("expertise");
  });

  it("leaves skills stated as alternatives to the JSON, and does not flatten them", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    mode("JSON");
    const picked = {
      ...JSON.parse(jsonText("Item JSON")),
      skillProficiencies: [{ any: 1 }],
    };
    typeJson("Item JSON", JSON.stringify(picked));
    mode("Step by step");
    stepTo("Effects");

    expect(within(editor()).getByText(/skill proficiencies as alternatives/)).toBeInTheDocument();
    expect(
      within(editor()).queryByRole("button", { name: /^Skill proficiencies/ }),
    ).not.toBeInTheDocument();
  });

  it("adds and removes an item's spells through the form, and drops the field when none is left", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    stepTo("Effects");
    fireEvent.change(field("textbox", "Spell"), { target: { value: "Fireball" } });
    click("Add a spell");
    fireEvent.change(field("textbox", "Spell"), { target: { value: "shield|phb" } });
    click("Add a spell");
    const entry = () => {
      mode("JSON");
      const text = jsonText("Item JSON");
      mode("Step by step");
      return JSON.parse(text);
    };
    expect(entry().attachedSpells).toEqual(["Fireball", "shield|phb"]);

    click("Remove Fireball");
    expect(entry().attachedSpells).toEqual(["shield|phb"]);

    click("Remove shield|phb");
    expect(entry()).not.toHaveProperty("attachedSpells");
  });

  it("leaves spells grouped by frequency to the JSON, and does not flatten them", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    mode("JSON");
    const grouped = {
      ...JSON.parse(jsonText("Item JSON")),
      attachedSpells: { will: ["mage hand"] },
    };
    typeJson("Item JSON", JSON.stringify(grouped));
    mode("Step by step");
    stepTo("Effects");

    expect(within(editor()).queryByRole("textbox", { name: "Spell" })).toBeNull();
    expect(within(editor()).getByText(/groups its spells/)).toBeInTheDocument();
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
    expect(reference).not.toHaveTextContent(/not listed/);

    fireEvent.change(within(reference).getByRole("searchbox", { name: "Search fields" }), {
      target: { value: "copper" },
    });
    expect(
      within(reference)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["value"]);
    fireEvent.change(within(reference).getByRole("searchbox", { name: "Search fields" }), {
      target: { value: "nothing like this" },
    });
    expect(reference).toHaveTextContent("No field matches");
    fireEvent.change(within(reference).getByRole("searchbox", { name: "Search fields" }), {
      target: { value: "" },
    });

    const hide = within(editor()).getByRole("button", { name: "Hide field reference" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(hide);
    expect(within(editor()).queryByRole("region", { name: "Field Reference" })).toBeNull();
    const show = within(editor()).getByRole("button", { name: "Show field reference" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(show);
    const reopened = within(editor()).getByRole("region", { name: "Field Reference" });
    expect(within(reopened).getByText("value").nextSibling).toHaveTextContent(/copper/);
    expect(within(reopened).getByText("ability")).toBeInTheDocument();
    expect(
      reopened.compareDocumentPosition(field("textbox", "Item JSON")) &
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
    expect(editor()).toHaveTextContent("Step 2 of 2");
    expect(field("textbox", "Rules text")).toHaveValue(
      "Brine deals {@damage 3d4} cold damage.\n\nIt stings.",
    );
  });

  it("previews the JSON draft as it stands, says so while it holds a problem, and returns to JSON", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    mode("JSON");
    typeJson(
      "Item JSON",
      JSON.stringify({
        ...JSON.parse(jsonText("Item JSON")),
        name: "Moonfire Blade",
        optionalfeatures: ["replicate magic item|tce"],
      }),
    );
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
    typeJson("Item JSON", "{");
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

    typeJson("Spell JSON", "{");
    fireEvent.keyDown(json, { key: "Home" });
    expect(json).toHaveAttribute("aria-selected", "true");
    expect(json).toHaveFocus();

    typeJson("Spell JSON", JSON.stringify(ward));
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
    typeJson("Spell JSON", JSON.stringify({ ...ward, source: "PHB" }));
    mode("Step by step");

    expect(field("textbox", "Name")).toHaveValue("Coastal Ward");
    expect(field("combobox", "School")).toHaveTextContent("Abjuration");
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
    typeJson("Spell JSON", "{ name: ");
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

    typeJson("Item JSON", JSON.stringify({ ...entry, rarity: "legendary" }));
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
    typeJson("Spell JSON", JSON.stringify(shield));
    mode("Step by step");
    const time = field("spinbutton", "Casting time");
    fireEvent.change(time, { target: { value: "" } });
    fireEvent.change(time, { target: { value: "1" } });
    fireEvent.click(field("checkbox", "Ritual"));
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

    typeJson("Spell JSON", JSON.stringify({ ...entry, entries: "loose" }));
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
    expect(editor()).not.toHaveTextContent("apply to every character");
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

  describe("a held class's hit die", () => {
    const stored = { ...CLASS_STARTERS[0].entry, source: "HB" };
    const { source: _source, ...entry } = stored;
    const warden = {
      id: "c1",
      name: "Warden",
      edition: "one",
      json: stored,
      createdAt: CREATED_AT,
      hitDie: 10,
    };
    /** A character holding `classId`, or a catalog class without one. */
    const holder = (id: string, name: string, classId?: string) => {
      const record = characterRecord(id, name);
      return classId
        ? {
            ...record,
            definition: { ...record.definition, levels: [{ class: { homebrewId: classId } }] },
          }
        : record;
    };
    const editWarden = async (faces: number) => {
      fireEvent.click(
        await within(screen.getByRole("region", { name: "Classes" })).findByRole("button", {
          name: "Edit Warden",
        }),
      );
      const draft = JSON.stringify({ ...entry, hd: { number: 1, faces } });
      typeJson("Class JSON", draft);
      return draft;
    };
    const save = () => within(editor()).getByRole("button", { name: "Save" });
    const note = () => within(editor()).queryByRole("button", { name: "Why Save is unavailable" });
    const ok = { status: 200, body: warden };
    /** Waits for the character list the hold reads to settle as `status`. */
    const charactersRead = (client: QueryClient, status: "success" | "error") =>
      waitFor(() => expect(client.getQueryState(charactersKey)?.status).toBe(status));

    it("holds Save on a new die, naming and linking the character that holds the class", async () => {
      stubApi({ classes: [warden], characters: [holder("x1", "Vex", "c1")] }, [ok]);
      renderPage();

      await editWarden(8);
      await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "true"));
      fireEvent.click(save());
      fireEvent.click(note() as HTMLElement);

      expect(
        within(editor()).getByText(
          "Warden is held by this character, so its hit die stays d10. Keep d10, or add a class with another name for the new die.",
        ),
      ).toBeVisible();
      expect(within(editor()).getByRole("link", { name: "Vex" })).toHaveAttribute(
        "href",
        "/characters/x1",
      );
    });

    it("links every holder and no other character, in three columns", async () => {
      stubApi({
        classes: [warden],
        characters: [holder("a", "Vex", "c1"), holder("b", "Ash", "c1"), holder("c", "Bram")],
      });
      renderPage();

      await editWarden(8);
      fireEvent.click(
        await within(editor()).findByRole("button", { name: "Why Save is unavailable" }),
      );

      expect(within(editor()).getByText(/^Warden is held by these characters,/)).toBeVisible();
      expect(
        within(editor())
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(["Vex", "Ash"]);
      expect(within(editor()).getByRole("list")).toHaveClass("columns-3", "gap-x-4");
    });

    it("frees Save once the die matches the stored one", async () => {
      const fetchMock = stubApi({ classes: [warden], characters: [holder("x1", "Vex", "c1")] }, [
        ok,
      ]);
      renderPage();

      await editWarden(8);
      await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "true"));
      // The PUT this click must not send would show up in the one write counted below.
      fireEvent.click(save());
      typeJson(
        "Class JSON",
        JSON.stringify({ ...entry, name: "Keeper", hd: { number: 1, faces: 10 } }),
      );

      expect(note()).toBeNull();
      expect(save()).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(save());
      await waitFor(() => expect(document.querySelector("dialog[open]")).toBeNull());
      expect(writesOf(fetchMock)).toMatchObject([
        { method: "PUT", url: "/api/homebrew/classes/c1" },
      ]);
    });

    it("saves a new die on a class no character holds", async () => {
      const fetchMock = stubApi({ classes: [warden], characters: [holder("c", "Bram")] }, [ok]);
      const client = renderPage();

      await editWarden(8);
      await charactersRead(client, "success");
      expect(note()).toBeNull();
      fireEvent.click(save());

      await waitFor(() => expect(writesOf(fetchMock)).toHaveLength(1));
    });

    it("holds Save for a character holding the class at a later level", async () => {
      const multiclass = characterRecord("m1", "Ash");
      stubApi({
        classes: [warden],
        characters: [
          {
            ...multiclass,
            definition: {
              ...multiclass.definition,
              levels: [...multiclass.definition.levels, { class: { homebrewId: "c1" } }],
            },
          },
        ],
      });
      renderPage();

      await editWarden(8);

      await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "true"));
    });

    it("orders the footer Cancel, the info button, then Save", async () => {
      stubApi({ classes: [warden], characters: [holder("x1", "Vex", "c1")] });
      renderPage();

      await editWarden(8);
      const info = await within(editor()).findByRole("button", { name: "Why Save is unavailable" });
      const cancel = within(editor()).getByRole("button", { name: "Cancel" });

      expect(cancel.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(info.compareDocumentPosition(save()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows no info button while the draft does not parse", async () => {
      stubApi({ classes: [warden], characters: [holder("x1", "Vex", "c1")] });
      renderPage();

      await editWarden(8);
      await within(editor()).findByRole("button", { name: "Why Save is unavailable" });
      typeJson("Class JSON", "{");

      expect(note()).toBeNull();
      expect(save()).not.toHaveAttribute("aria-disabled", "true");
    });

    it("leaves Save available, with no info button, while the holders load", async () => {
      const fetchMock = stubApi({ classes: [warden] });
      const answer = fetchMock.getMockImplementation();
      fetchMock.mockImplementation((input, init) =>
        String(input) === "/api/characters"
          ? new Promise<Response>(() => {})
          : (answer as NonNullable<typeof answer>)(input, init),
      );
      const client = renderPage();

      await editWarden(8);
      await waitFor(() =>
        expect(client.getQueryState(charactersKey)?.fetchStatus).toBe("fetching"),
      );

      expect(note()).toBeNull();
      expect(within(editor()).queryByRole("button", { name: "Who holds this class" })).toBeNull();
      expect(save()).not.toHaveAttribute("aria-disabled", "true");
    });

    it("says the holders went unchecked, and leaves Save to the server, when the characters cannot be read", async () => {
      const fetchMock = stubApi({ classes: [warden] }, [ok]);
      const answer = fetchMock.getMockImplementation();
      fetchMock.mockImplementation(async (input, init) =>
        String(input) === "/api/characters"
          ? json(500, { error: "down" })
          : (answer as NonNullable<typeof answer>)(input, init),
      );
      const client = renderPage();

      await editWarden(8);
      await charactersRead(client, "error");
      fireEvent.click(within(editor()).getByRole("button", { name: "Who holds this class" }));

      expect(note()).toBeNull();
      expect(
        within(editor()).getByText(
          "Couldn't check which characters hold this class. If any do, Save fails and its hit die stays d10.",
        ),
      ).toBeVisible();
      expect(save()).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(save());
      await waitFor(() => expect(writesOf(fetchMock)).toHaveLength(1));
    });

    it("never reads the characters to edit an item", async () => {
      const fetchMock = stubApi({ items: [sunblade] });
      renderPage();

      fireEvent.click(await within(items()).findByRole("button", { name: "Edit Sunblade" }));

      expect(within(editor()).getByRole("button", { name: "Save" })).toBeVisible();
      expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/characters")).toBe(false);
    });

    describe("refused by the API on a list that missed the holder", () => {
      const error =
        "Warden is held by Vex, so its hit die stays d10. Keep d10, or add a class with another name for the new die.";
      /** Edits Warden onto d8 against a list naming no holder, and saves into the refusal. */
      const refuse = async () => {
        const fetchMock = stubApi({ classes: [warden], characters: [holder("c", "Bram")] }, [
          { status: 409, body: { error, characters: [{ id: "x1", name: "Vex" }] } },
          ok,
        ]);
        const client = renderPage();
        const draft = await editWarden(8);
        await charactersRead(client, "success");
        fireEvent.click(save());
        return { fetchMock, draft };
      };

      it("keeps the draft, holds Save and links the holders the refusal names", async () => {
        const { fetchMock, draft } = await refuse();

        expect(await within(editor()).findByRole("alert")).toHaveTextContent(
          `Save failed: ${error}`,
        );
        expect(jsonText("Class JSON")).toBe(draft);
        expect(save()).toHaveAttribute("aria-disabled", "true");
        fireEvent.click(save());
        fireEvent.click(note() as HTMLElement);
        expect(within(editor()).getByRole("link", { name: "Vex" })).toHaveAttribute(
          "href",
          "/characters/x1",
        );
        expect(writesOf(fetchMock)).toHaveLength(1);
      });

      it("frees Save once the die is back to the stored one", async () => {
        const { fetchMock } = await refuse();
        await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "true"));
        typeJson("Class JSON", JSON.stringify({ ...entry, hd: { number: 1, faces: 10 } }));

        expect(note()).toBeNull();
        expect(save()).not.toHaveAttribute("aria-disabled", "true");
        fireEvent.click(save());
        await waitFor(() => expect(writesOf(fetchMock)).toHaveLength(2));
      });
    });
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

  it("creates a skill from its name and ability, and chips the ability", async () => {
    const fetchMock = stubApi({}, [{ status: 201, body: sailing }]);
    renderPage();

    fireEvent.click(
      within(screen.getByRole("region", { name: "Skills" })).getByRole("button", {
        name: "Add skill",
      }),
    );
    fireEvent.change(field("textbox", "Name"), { target: { value: "Sailing" } });
    pick("Ability", "Wisdom");
    click("Save");

    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        {
          url: "/api/homebrew/skills",
          method: "POST",
          body: expect.objectContaining({ name: "Sailing", ability: "wis", edition: "one" }),
        },
      ]),
    );
  });

  it("creates a flat skill from its name and Flat bonus", async () => {
    const fetchMock = stubApi({}, [{ status: 201, body: sailing }]);
    renderPage();

    fireEvent.click(
      within(screen.getByRole("region", { name: "Skills" })).getByRole("button", {
        name: "Add skill",
      }),
    );
    fireEvent.change(field("textbox", "Name"), { target: { value: "Cartography" } });
    pick("Ability", "Flat bonus");
    click("Save");

    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        {
          url: "/api/homebrew/skills",
          method: "POST",
          body: expect.objectContaining({ name: "Cartography", ability: "flat" }),
        },
      ]),
    );
  });

  describe("a skill's Ability select", () => {
    const openSailing = async () => {
      fireEvent.click(
        await within(screen.getByRole("region", { name: "Skills" })).findByRole("button", {
          name: "Edit Sailing",
        }),
      );
      return field("combobox", "Ability");
    };
    const holdersNote = async () => {
      fireEvent.click(
        await within(editor()).findByRole("button", { name: "Who holds this skill" }),
      );
      return within(editor());
    };

    it("stays open, and the info icon lists the holders as links with the reset warning", async () => {
      stubApi({ skills: [sailing] }, [], {
        status: 200,
        body: [
          { id: "a", name: "Vex" },
          { id: "b", name: "Ash" },
        ],
      });
      renderPage();

      const select = await openSailing();
      const note = await holdersNote();

      expect(select).toBeEnabled();
      expect(
        note.getByText("Held by the following characters, changing will reset custom values"),
      ).toBeVisible();
      expect(note.getByRole("link", { name: "Vex" })).toHaveAttribute("href", "/characters/a");
      expect(note.getByRole("link", { name: "Ash" })).toHaveAttribute("href", "/characters/b");
    });

    it("shows no icon with no holder", async () => {
      stubApi({ skills: [sailing] }, [], { status: 200, body: [] });
      renderPage();

      const select = await openSailing();

      await waitFor(() => expect(select).toBeEnabled());
      expect(within(editor()).queryByRole("button", { name: "Who holds this skill" })).toBeNull();
    });

    it("says so, with the select still open, when the holders cannot be read", async () => {
      stubApi({ skills: [sailing] }, [], { status: 500, body: { error: "down" } });
      renderPage();

      const select = await openSailing();
      const note = await holdersNote();

      expect(note.getByText(/Couldn't check which characters hold this skill/)).toBeVisible();
      expect(select).toBeEnabled();
    });

    it("shows no icon for a skill not yet saved", () => {
      stubApi({});
      renderPage();

      fireEvent.click(
        within(screen.getByRole("region", { name: "Skills" })).getByRole("button", {
          name: "Add skill",
        }),
      );

      expect(field("combobox", "Ability")).toBeEnabled();
      expect(within(editor()).queryByRole("button", { name: "Who holds this skill" })).toBeNull();
    });
  });

  it("refuses to delete a skill an item names, naming the item beside any character", async () => {
    stubApi({ skills: [sailing] }, [
      {
        status: 409,
        body: {
          error: "This skill is cited by Vex, Compass and cannot be deleted",
          characters: [{ id: "c1", name: "Vex" }],
          items: [{ id: "i2", name: "Compass" }],
        },
      },
    ]);
    renderPage();

    fireEvent.click(
      await within(screen.getByRole("region", { name: "Skills" })).findByRole("button", {
        name: "Delete Sailing",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete Sailing?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("link", { name: "Vex" })).toBeVisible();
    expect(within(dialog).getByText("Compass")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
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

  it("loads a starter picked while the JSON editor is open, and keeps it through the next edit", async () => {
    stubApi({});
    renderPage();

    fireEvent.click(within(items()).getByRole("button", { name: "Add item" }));
    mode("JSON");
    pick("Start from", "Gear");
    const gear = ITEM_STARTERS.find(({ label }) => label === "Gear");
    expect(JSON.parse(jsonText("Item JSON")).name).toBe(gear?.entry.name);

    typeJson("Item JSON", jsonText("Item JSON").replace(`"${gear?.entry.name}"`, '"Lamp"'));
    mode("Step by step");
    expect(field("textbox", "Name")).toHaveValue("Lamp");
  });

  it("chips a race, a class, a background and a feat as their entries state them", async () => {
    const row = (id: string, json: Record<string, unknown>, extra = {}) => ({
      id,
      name: json.name,
      edition: "one",
      json: { ...json, source: "HB" },
      createdAt: CREATED_AT,
      ...extra,
    });
    stubApi({
      races: [row("r1", RACE_STARTERS[0].entry)],
      classes: [row("c1", CLASS_STARTERS[0].entry, { hitDie: 10 })],
      backgrounds: [row("b1", BACKGROUND_STARTERS[0].entry)],
      feats: [row("f1", FEAT_STARTERS[0].entry)],
    });
    renderPage();

    const chips = async (region: string, name: string) =>
      (await within(screen.getByRole("region", { name: region })).findByText(name)).closest("li");
    expect(await chips("Races", "Duskling")).toHaveTextContent(/Medium.*30 ft\..*\+2 DEX \+1 CHA/);
    expect(await chips("Classes", "Warden")).toHaveTextContent(/d10.*STR.*STR\/CON/);
    expect(await chips("Backgrounds", "Wayfarer")).toHaveTextContent("Insight, Survival");
    expect(await chips("Feats", "Ironbound")).toHaveTextContent("STR 13");
  });

  it("shows both chips of a class whose one save matches its primary ability", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const json = { ...CLASS_STARTERS[0].entry, proficiency: ["str"], source: "HB" };
    stubApi({
      classes: [
        { id: "c1", name: "Warden", edition: "one", json, createdAt: CREATED_AT, hitDie: 10 },
      ],
    });
    renderPage();

    const row = (
      await within(screen.getByRole("region", { name: "Classes" })).findByText("Warden")
    ).closest("li");
    expect(within(row as HTMLElement).getAllByText("STR")).toHaveLength(2);
    expect(error.mock.calls.filter(([message]) => String(message).includes("same key"))).toEqual(
      [],
    );
  });

  it("creates a race from pasted JSON alone, naming a field that fails rather than the whole paste", async () => {
    const fetchMock = stubApi({}, [{ status: 201, body: {} }]);
    renderPage();

    fireEvent.click(
      within(screen.getByRole("region", { name: "Races" })).getByRole("button", {
        name: "Add race",
      }),
    );
    expect(within(editor()).queryByRole("tab", { name: "Step by step" })).toBeNull();
    const { size: _size, ...sizeless } = RACE_STARTERS[0].entry;
    typeJson("Race JSON", JSON.stringify(sizeless));
    click("Save");
    expect(field("textbox", "Race JSON")).toHaveAccessibleDescription(/^size: /);
    expect(writesOf(fetchMock)).toEqual([]);

    typeJson("Race JSON", JSON.stringify({ ...RACE_STARTERS[0].entry, source: "PHB" }));
    mode("Preview");
    expect(editor()).toHaveTextContent(/Size: Medium.*Speed: 30 ft\./);
    click("Save");

    await waitFor(() =>
      expect(writesOf(fetchMock)).toEqual([
        {
          url: "/api/homebrew/races",
          method: "POST",
          body: { ...RACE_STARTERS[0].entry, edition: "one" },
        },
      ]),
    );
  });

  describe("a feat's form", () => {
    const feats = () => screen.getByRole("region", { name: "Feats" });
    const addFeat = () =>
      fireEvent.click(within(feats()).getByRole("button", { name: "Add feat" }));
    const group = (name: string) => within(within(editor()).getByRole("group", { name }));
    const pickIn = (name: string, label: string, option: string) => {
      fireEvent.click(group(name).getByLabelText(label, { selector: FIELD_SELECTOR.combobox }));
      fireEvent.click(screen.getByRole("option", { name: option }));
    };
    const tickIn = (name: string, list: string, ...options: string[]) => {
      fireEvent.click(group(name).getByRole("button", { name: new RegExp(`^${list} `) }));
      for (const option of options) {
        fireEvent.click(within(editor()).getByRole("checkbox", { name: option }));
      }
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    };
    const typeIn = (name: string, label: string, value: string) =>
      fireEvent.change(group(name).getByLabelText(label, { selector: FIELD_SELECTOR.spinbutton }), {
        target: { value },
      });
    const preview = () => {
      mode("Preview");
      const text = editor().querySelector('[role="tabpanel"]')?.textContent;
      mode("Step by step");
      return text;
    };

    const built = {
      name: "Stonewarden",
      entries: FEAT_STARTERS[0].entry.entries,
      prerequisite: [
        { ability: [{ str: 13 }], level: 4 },
        { proficiency: [{ armor: "heavy" }], spellcasting: true },
      ],
      ability: [{ choose: { from: ["str", "dex", "con", "int", "wis", "cha"], count: 1 } }],
      savingThrowProficiencies: [{ choose: { from: ["str", "con"], count: 1 } }],
      skillProficiencies: [{ athletics: true }],
      expertise: [{ anyProficientSkill: 1 }],
      armorProficiencies: [{ heavy: true }],
      languageProficiencies: [{ any: 2 }],
    };

    it("offers its steps beside JSON and Preview", () => {
      stubApi({});
      renderPage();

      addFeat();
      for (const name of ["Step by step", "JSON", "Preview"]) {
        expect(within(editor()).getByRole("tab", { name })).toBeInTheDocument();
      }
      const steps = within(editor()).getByRole("navigation", { name: "Steps" });
      expect(
        within(steps)
          .getAllByRole("button")
          .map((button) => button.textContent),
      ).toEqual([
        "Basics & Rules text",
        "Prerequisites & Ability scores",
        "Proficiencies",
        "Preview",
      ]);
      expect(field("textbox", "Name")).toHaveValue("Ironbound");
    });

    it("builds alternatives, increases and proficiencies in upstream's shapes, and saves what the same JSON pasted saves", async () => {
      const stored = {
        id: "f1",
        name: built.name,
        edition: "one",
        json: { ...built, source: "HB" },
        createdAt: CREATED_AT,
      };
      const fetchMock = stubApi({}, [
        { status: 201, body: stored },
        { status: 201, body: stored },
      ]);
      renderPage();

      addFeat();
      fireEvent.change(field("textbox", "Name"), { target: { value: "Stonewarden" } });
      stepTo("Prerequisites");
      typeIn("Prerequisite 1", "Character level", "4");
      click("Add an alternative");
      tickIn("Prerequisite 2", "Armor or weapon proficiency", "Heavy armor");
      fireEvent.click(group("Prerequisite 2").getByLabelText("Can cast at least one spell"));
      pickIn("Ability score increases", "Granted as", "Choice of any");
      pickIn("Saving throws", "Granted as", "Choice from a list");
      tickIn("Saving throws", "Choose from", "Strength", "Constitution");
      stepTo("Proficiencies");
      pickIn("Skills", "Granted as", "Fixed");
      tickIn("Skills", "Granted", "Athletics");
      pickIn("Expertise", "Granted as", "Choice of any");
      fireEvent.click(within(editor()).getByRole("button", { name: /^Armor / }));
      fireEvent.click(within(editor()).getByRole("checkbox", { name: "Heavy armor" }));
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      pickIn("Languages", "Granted as", "Choice of any");
      typeIn("Languages", "How many", "2");
      const formPreview = preview();
      expect(formPreview).toContain(
        "Prerequisite: Level 4, STR 13; or Heavy armor proficiency, Spellcasting",
      );
      click("Save");
      await waitFor(() => expect(writesOf(fetchMock)).toHaveLength(1));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      addFeat();
      mode("JSON");
      typeJson("Feat JSON", JSON.stringify(built));
      expect(preview()).toBe(formPreview);
      click("Save");

      await waitFor(() => expect(writesOf(fetchMock)).toHaveLength(2));
      const [fromForm, fromJson] = writesOf(fetchMock);
      expect(fromForm?.body).toEqual({ ...built, edition: "one" });
      expect(fromJson?.body).toEqual(fromForm?.body);
    });

    it("writes a race, a feat and score minimums from the edition's lists", async () => {
      const fetchMock = stubApi({});
      const listed = (url: string) => {
        if (url.startsWith("/api/search?") && url.includes("type=race")) {
          const hit = { type: "race", name: "Elf", source: "XPHB", edition: "one" };
          return { items: [hit], total: 1, limit: 200, offset: 0 };
        }
        if (url.startsWith("/api/feats?")) {
          const json = { name: "Alert", source: "XPHB" };
          return { items: [{ ...json, edition: "one", json }], total: 1 };
        }
        return undefined;
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const body = listed(String(input));
          return body ? json(200, body) : fetchMock(input, init);
        }),
      );
      renderPage();

      addFeat();
      stepTo("Prerequisites");
      fireEvent.click(group("Prerequisite 1").getByRole("button", { name: "Add a score minimum" }));
      const minimums = group("Prerequisite 1").getAllByLabelText("Minimum score", {
        selector: FIELD_SELECTOR.spinbutton,
      });
      expect(minimums).toHaveLength(2);
      fireEvent.change(minimums[1] as HTMLElement, { target: { value: "15" } });
      fireEvent.click(
        group("Prerequisite 1").getByRole("button", {
          name: "Remove prerequisite 1 score minimum 1",
        }),
      );
      await waitFor(() =>
        expect(group("Prerequisite 1").getByRole("button", { name: /^Race / })).toBeEnabled(),
      );
      tickIn("Prerequisite 1", "Race", "Elf");
      await within(editor()).findByRole("button", { name: /^Feat / });
      fireEvent.click(group("Prerequisite 1").getByRole("button", { name: /^Feat / }));
      fireEvent.click(await within(editor()).findByRole("checkbox", { name: "Alert (XPHB)" }));
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

      mode("JSON");
      expect(JSON.parse(jsonText("Feat JSON")).prerequisite).toEqual([
        { ability: [{ str: 15 }], race: [{ name: "elf" }], feat: ["alert|xphb"] },
      ]);
    });

    it("names a count problem beside its own input", () => {
      stubApi({});
      renderPage();

      addFeat();
      stepTo("Proficiencies");
      pickIn("Languages", "Granted as", "Choice of any");
      typeIn("Languages", "How many", "");
      click("Next");

      expect(
        group("Languages").getByLabelText("How many", { selector: FIELD_SELECTOR.spinbutton }),
      ).toHaveAccessibleDescription("How many: a whole number of at least 1");
      expect(
        group("Languages").getByLabelText("Granted as", { selector: FIELD_SELECTOR.combobox }),
      ).not.toHaveAccessibleDescription();

      stepTo("Ability scores");
      pickIn("Ability score increases", "Granted as", "Fixed");
      tickIn("Ability score increases", "Granted", "Constitution");
      typeIn("Ability score increases", "Increase by", "");
      click("Next");
      expect(
        group("Ability score increases").getByLabelText("Increase by", {
          selector: FIELD_SELECTOR.spinbutton,
        }),
      ).toHaveAccessibleDescription("Increase by: a whole number of at least 1");
    });

    it("chips a feat's alternatives as its entry states them", async () => {
      stubApi({
        feats: [
          {
            id: "f1",
            name: built.name,
            edition: "one",
            json: { ...built, source: "HB" },
            createdAt: CREATED_AT,
          },
        ],
      });
      renderPage();

      const row = (await within(feats()).findByText("Stonewarden")).closest("li");
      expect(row).toHaveTextContent("Level 4, STR 13; or Heavy armor proficiency, Spellcasting");
    });

    it("holds a step while a field it shows has a problem, naming it beside the field", () => {
      stubApi({});
      renderPage();

      addFeat();
      stepTo("Prerequisites");
      typeIn("Prerequisite 1", "Character level", "25");
      pickIn("Saving throws", "Granted as", "Choice from a list");
      click("Next");

      expect(within(editor()).getByRole("heading", { name: "Ability scores" })).toBeInTheDocument();
      expect(
        group("Prerequisite 1").getByLabelText("Character level", {
          selector: FIELD_SELECTOR.spinbutton,
        }),
      ).toHaveAccessibleDescription("Prerequisite 1: a character level from 1 to 20");
      const mode = group("Saving throws").getByLabelText("Granted as", {
        selector: FIELD_SELECTOR.combobox,
      });
      expect(mode).toHaveAccessibleDescription("Pick at least one to choose from");

      typeIn("Prerequisite 1", "Character level", "4");
      typeIn("Prerequisite 1", "Minimum score", "31");
      click("Add an alternative");
      click("Next");
      expect(
        group("Prerequisite 1").getByLabelText("Minimum score", {
          selector: FIELD_SELECTOR.spinbutton,
        }),
      ).toHaveAccessibleDescription("Prerequisite 1: a score minimum from 1 to 30");
      expect(group("Prerequisite 2").getByRole("alert")).toHaveTextContent(
        "Prerequisite 2: set at least one requirement",
      );

      typeIn("Prerequisite 1", "Minimum score", "13");
      click("Remove prerequisite 2");
      tickIn("Saving throws", "Choose from", "Wisdom");
      click("Next");
      expect(within(editor()).getByRole("heading", { name: "Proficiencies" })).toBeInTheDocument();
    });

    it("keeps every field and part the form has no control for through an edit", async () => {
      const json = {
        name: "Marked",
        source: "HB",
        category: "G",
        repeatable: true,
        prerequisite: [{ level: 4, campaign: ["Eberron"] }],
        languageProficiencies: [{ draconic: true }, { any: 1 }],
      };
      const stored = { id: "f1", name: "Marked", edition: "one", json, createdAt: CREATED_AT };
      const fetchMock = stubApi({ feats: [stored] }, [{ status: 200, body: stored }]);
      renderPage();

      fireEvent.click(await within(feats()).findByRole("button", { name: "Edit Marked" }));
      fireEvent.change(field("textbox", "Name"), { target: { value: "Twice Marked" } });
      stepTo("Prerequisites");
      expect(group("Prerequisite 1").getByText(/cannot show/)).toBeInTheDocument();
      typeIn("Prerequisite 1", "Character level", "5");
      stepTo("Proficiencies");
      expect(within(editor()).getByText(/languages as alternatives/)).toBeInTheDocument();
      click("Save");

      const { source: _source, ...rest } = json;
      await waitFor(() =>
        expect(writesOf(fetchMock)).toEqual([
          {
            url: "/api/homebrew/feats/f1",
            method: "PUT",
            body: {
              ...rest,
              name: "Twice Marked",
              prerequisite: [{ level: 5, campaign: ["Eberron"] }],
              edition: "one",
            },
          },
        ]),
      );
    });
  });
});
