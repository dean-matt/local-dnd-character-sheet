import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { AbilityScoresStep } from "./AbilityScoresStep.tsx";
import type { AbilitiesMemory } from "./abilityMethods.ts";
import { CreationIncreases } from "./CreationIncreases.tsx";
import { creationForm } from "./creationForm.ts";
import { useAbilitiesDone } from "./useAbilitiesDone.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const XPHB = (name: string) => ({ name, source: "XPHB" });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });

const ELF = { ...PHB("Elf"), ability: [{ dex: 2 }] };
const HIGH_ELF = { ...ELF, name: "High", ability: [{ dex: 2, int: 1 }] };
const HALF_ELF = {
  ...PHB("Half-Elf"),
  ability: [{ cha: 2, choose: { from: ["str", "dex", "con", "int", "wis"], count: 2 } }],
};
const from = ["str", "con", "cha"];
const SOLDIER = {
  ...XPHB("Soldier"),
  edition: "one",
  json: {
    ...XPHB("Soldier"),
    ability: [
      { choose: { weighted: { from, weights: [2, 1] } } },
      { choose: { weighted: { from, weights: [1, 1, 1] } } },
    ],
  },
};

const FIGHTER = PHB("Fighter");
const feat = (name: string, json: object = {}) => ({
  ...PHB(name),
  edition: "classic",
  json: { ...PHB(name), ...json },
});

const ROWS: Record<string, unknown> = {
  "/api/classes/Fighter/PHB/at/4": {
    level: 4,
    resources: [],
    spellSlots: [],
    optionalFeatures: [],
    features: [
      { ...PHB("Ability Score Improvement"), level: 4, json: PHB("Ability Score Improvement") },
    ],
  },
  "/api/feats?edition=classic&limit=200": page([
    feat("Actor", { ability: [{ cha: 1 }] }),
    feat("Grappler", { prerequisite: [{ ability: [{ str: 13 }] }] }),
  ]),
  "/api/races/Elf/PHB": { ...PHB("Elf"), edition: "classic", json: ELF },
  "/api/races/Elf/PHB/subraces?edition=classic&limit=200": page([
    { ...PHB("High"), raceName: "Elf", raceSource: "PHB", edition: "classic", json: HIGH_ELF },
  ]),
  "/api/races/Half-Elf/PHB": { ...PHB("Half-Elf"), edition: "classic", json: HALF_ELF },
  "/api/races/Half-Elf/PHB/subraces?edition=classic&limit=200": page([]),
  "/api/backgrounds?edition=classic&limit=200": page([]),
  "/api/backgrounds?edition=one&limit=200": page([SOLDIER]),
  "/api/catalog/skill/Athletics/PHB": {
    type: "skill",
    ...PHB("Athletics"),
    edition: "classic",
    json: { ...PHB("Athletics"), ability: "str" },
  },
};

function stubCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const skills = url.includes("type=skill&source=PHB")
        ? [{ type: "skill", ...PHB("Athletics"), edition: "classic" }]
        : [];
      const body = url.startsWith("/api/search?") ? page(skills) : ROWS[url];
      return body === undefined
        ? new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

let values: Partial<CharacterDefinition> = {};
let done = false;

function Probe() {
  values = useWatch<CharacterDefinition>() as Partial<CharacterDefinition>;
  done = useAbilitiesDone();
  return null;
}

/** The flow's hold on the step's memory, with a toggle that leaves the step and comes back. */
function Flow() {
  const [memory, setMemory] = useState<AbilitiesMemory>();
  const [open, setOpen] = useState(true);
  return (
    <>
      <CreationIncreases />
      <button type="button" onClick={() => setOpen(!open)}>
        Away
      </button>
      {open && <AbilityScoresStep memory={memory} onMemory={setMemory} />}
      <Probe />
    </>
  );
}

function renderStep(draft: object = {}) {
  localStorage.setItem("draft:creation", JSON.stringify({ edition: "classic", ...draft }));
  renderWithClient(
    <creationForm.FormShell onSubmit={() => {}}>{() => <Flow />}</creationForm.FormShell>,
  );
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const row = (label: string) => within(screen.getByRole("group", { name: label }));
const type = (label: string, score: string) =>
  fireEvent.change(screen.getByRole("spinbutton", { name: `${label} base score` }), {
    target: { value: score },
  });
const scoresDeparture = () =>
  values.departures?.find((departure) => departure.field === "abilityScores")?.note;

function assign(label: string, score: number) {
  fireEvent.click(screen.getByRole("combobox", { name: `${label} base score` }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`^${score}( |$)`) }));
}

const ARRAY = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

describe("AbilityScoresStep", () => {
  beforeEach(() => {
    localStorage.clear();
    stubCatalog();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("assigns the standard array, and notes a value assigned twice without refusing it", async () => {
    renderStep();
    expect(screen.getByRole("button", { name: "Standard Array" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    assign("Strength", 15);
    fireEvent.click(screen.getByRole("combobox", { name: "Dexterity base score" }));
    expect(screen.getByRole("option", { name: "15 — used by STR" })).toBeVisible();
    expect(screen.getByRole("option", { name: "14" })).toBeVisible();
    fireEvent.click(screen.getByRole("combobox", { name: "Dexterity base score" }));
    assign("Dexterity", 15);

    expect(values.abilityScores).toEqual({ str: 15, dex: 15 });
    expect(scoresDeparture()).toBe("Standard array: 15 assigned more than once.");

    assign("Dexterity", 14);
    expect(scoresDeparture()).toBeUndefined();
    for (const [label, score] of [
      ["Constitution", 13],
      ["Intelligence", 12],
      ["Wisdom", 10],
      ["Charisma", 8],
    ] as const)
      assign(label, score);

    expect(values.abilityScores).toEqual(ARRAY);
    expect(row("Strength").getByText("+2")).toBeVisible();
    await waitFor(() => expect(done).toBe(true));
  });

  it("counts point buy's spend, and keeps an overspend while noting it", () => {
    renderStep();
    click("Point Buy");

    expect(values.abilityScores).toMatchObject({ str: 8, cha: 8 });
    expect(screen.getByText("0 of 27 points spent, 27 remaining")).toBeVisible();

    type("Strength", "15");
    type("Dexterity", "15");
    type("Constitution", "15");
    type("Intelligence", "16");

    expect(screen.getByText("36 of 27 points spent, over budget by 9")).toBeVisible();
    expect(values.abilityScores?.int).toBe(16);
    expect(scoresDeparture()).toBe(
      "Point buy: 36 of 27 points spent; Intelligence is 16, outside its 8 to 15.",
    );

    type("Intelligence", "8");
    type("Constitution", "8");
    expect(scoresDeparture()).toBeUndefined();
  });

  it("rolls 4d6 dropping the lowest for each ability, and shows every die", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderStep();
    click("Roll");

    expect(values.abilityScores).toEqual({ str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 });
    expect(row("Strength").getByText("dropped")).toBeInTheDocument();
    expect(row("Strength").getAllByText(/^4/)).toHaveLength(4);
    expect(scoresDeparture()).toBeUndefined();

    click("Reroll all (4d6kh3)");
    expect(Math.random).toHaveBeenCalledTimes(48);

    click("Away");
    click("Away");
    expect(screen.getByRole("button", { name: "Roll" })).toHaveAttribute("aria-pressed", "true");
    expect(row("Strength").getByText("dropped")).toBeInTheDocument();
  });

  it("scores each skill off its ability, with the proficiency the character holds", async () => {
    renderStep({
      abilityScores: ARRAY,
      levels: [{ class: PHB("Fighter") }],
      proficiencies: {
        savingThrows: ["str"],
        skills: [{ ref: PHB("Athletics"), level: "proficient" }],
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
      },
    });

    expect(await row("Strength").findByText("Athletics +4")).toBeVisible();
    expect(row("Strength").getByText("Save +4")).toBeVisible();
    expect(row("Dexterity").getByText("Save +2")).toBeVisible();
  });

  it("frees a race's increases to any ability under the custom-origin house rule", async () => {
    renderStep({
      race: PHB("Elf"),
      subrace: PHB("High"),
      abilityScores: ARRAY,
      houseRules: { customOrigin: true },
    });

    const first = await screen.findByRole("group", { name: "Race +2, 1 of 2 — choose one" });
    fireEvent.click(within(first).getByRole("button", { name: "Wisdom" }));

    expect(values.abilityIncreases).toEqual([{ ability: "wis", amount: 2, grantedBy: "race" }]);
  });

  it("notes typed-in scores as a departure, and drops the note on returning to a method", () => {
    renderStep({ abilityScores: ARRAY });
    expect(screen.getByRole("button", { name: "Standard Array" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    click("Custom");
    type("Strength", "18");

    expect(values.abilityScores?.str).toBe(18);
    expect(scoresDeparture()).toMatch(/^Ability scores typed in/);

    click("Point Buy");
    expect(scoresDeparture()).toBeUndefined();
  });

  it("lands a race's fixed increases as terms beside the base, not inside it", async () => {
    renderStep({ race: PHB("Elf"), subrace: PHB("High"), abilityScores: ARRAY });

    await waitFor(() =>
      expect(values.abilityIncreases).toEqual([
        { ability: "dex", amount: 2, grantedBy: "race" },
        { ability: "int", amount: 1, grantedBy: "race" },
      ]),
    );
    expect(values.abilityScores?.dex).toBe(14);
    expect(row("Dexterity").getByText("+2 race")).toBeVisible();
    expect(row("Dexterity").getByText("16")).toBeVisible();
    expect(row("Dexterity").getByText("+3")).toBeVisible();
    expect(screen.getByText("+2 Dexterity, +1 Intelligence")).toBeVisible();
    await waitFor(() => expect(done).toBe(true));
  });

  it("asks where a race's free increases go, never twice to one ability", async () => {
    renderStep({ race: PHB("Half-Elf"), abilityScores: ARRAY });

    const first = await screen.findByRole("group", { name: "Race +1, 1 of 2 — choose one" });
    await waitFor(() => expect(done).toBe(false));
    fireEvent.click(within(first).getByRole("button", { name: "Strength" }));

    const second = screen.getByRole("group", { name: "Race +1, 2 of 2 — choose one" });
    expect(within(second).queryByRole("button", { name: "Strength" })).toBeNull();
    fireEvent.click(within(second).getByRole("button", { name: "Constitution" }));

    expect(values.abilityIncreases).toEqual([
      { ability: "cha", amount: 2, grantedBy: "race" },
      { ability: "str", amount: 1, grantedBy: "race" },
      { ability: "con", amount: 1, grantedBy: "race" },
    ]);
    await waitFor(() => expect(done).toBe(true));
  });

  it("keeps a pick in the slot it was placed in, though stored increases name no slot", async () => {
    renderStep({ race: PHB("Half-Elf"), abilityScores: ARRAY });

    const second = await screen.findByRole("group", { name: "Race +1, 2 of 2 — choose one" });
    fireEvent.click(within(second).getByRole("button", { name: "Wisdom" }));

    expect(
      within(screen.getByRole("group", { name: "Race +1, 2 of 2" })).getByRole("button", {
        name: "Wisdom",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Race +1, 1 of 2 — choose one" })).toBeVisible();
  });

  it("takes a 2024 background's increases either way it offers them", async () => {
    renderStep({ edition: "one", background: XPHB("Soldier"), abilityScores: ARRAY });

    fireEvent.click(
      within(
        await screen.findByRole("group", { name: "Background +2, 1 of 2 — choose one" }),
      ).getByRole("button", { name: "Strength" }),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: "Background +1, 2 of 2 — choose one" })).getByRole(
        "button",
        { name: "Constitution" },
      ),
    );
    expect(values.abilityIncreases).toEqual([
      { ability: "str", amount: 2, grantedBy: "background" },
      { ability: "con", amount: 1, grantedBy: "background" },
    ]);
    expect(row("Strength").getByText("+2 background")).toBeVisible();

    click("+1 and +1 and +1");
    expect(values.abilityIncreases).toEqual([]);
    for (const [index, name] of ["Strength", "Constitution", "Charisma"].entries())
      fireEvent.click(
        within(
          screen.getByRole("group", { name: `Background +1, ${index + 1} of 3 — choose one` }),
        ).getByRole("button", { name }),
      );

    expect(values.abilityIncreases).toHaveLength(3);
    expect(screen.getByRole("button", { name: "+1 and +1 and +1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() => expect(done).toBe(true));
  });

  it("takes back an increase the race no longer grants", async () => {
    renderStep({
      race: PHB("Half-Elf"),
      abilityScores: ARRAY,
      abilityIncreases: [{ ability: "dex", amount: 2, grantedBy: "race" }],
    });

    await waitFor(() =>
      expect(values.abilityIncreases).toEqual([{ ability: "cha", amount: 2, grantedBy: "race" }]),
    );
  });

  it("asks a level 4 character for its improvement, scores or a feat, and is done once it is made", async () => {
    renderStep({
      levels: Array.from({ length: 4 }, () => ({ class: FIGHTER })),
      abilityScores: { ...ARRAY, str: 19, dex: 12 },
    });
    const choose = (label: string, option: string) => {
      fireEvent.click(screen.getByRole("combobox", { name: label }));
      fireEvent.click(screen.getByRole("option", { name: option }));
    };

    expect(await screen.findByText("Level 4 · Fighter 4 — choose")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Level 4 choice" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Level 4 choice" }));
    expect(screen.getByRole("option", { name: "Grappler" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "Raise ability scores" }));
    expect(done).toBe(false);

    fireEvent.click(screen.getByRole("combobox", { name: "Level 4 +2" }));
    expect(screen.queryByRole("option", { name: "+2 Strength" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "+2 Dexterity" }));

    expect(values.abilityIncreases).toEqual([
      { ability: "dex", amount: 2, grantedBy: "class", level: 4 },
    ]);
    expect(values.feats ?? []).toEqual([]);
    expect(row("Dexterity").getByText(/\+2 ability score improvement \(level 4\)/)).toBeVisible();
    await waitFor(() => expect(done).toBe(true));

    choose("Level 4 choice", "Actor");
    expect(values.feats).toEqual([
      { ref: PHB("Actor"), grantedBy: { kind: "class", ref: FIGHTER }, level: 4 },
    ]);
    expect(values.abilityIncreases).toEqual([
      { ability: "cha", amount: 1, grantedBy: "feat", level: 4 },
    ]);
    await waitFor(() => expect(done).toBe(true));
  });
});
