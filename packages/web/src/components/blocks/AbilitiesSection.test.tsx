import {
  type CharacterDerived,
  type CharacterRecord,
  deriveCharacter,
  entryKey,
} from "@dnd/character";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, stateRecord } from "../../test/records.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { AbilitiesSection } from "./AbilitiesSection.tsx";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const STEALTH = { name: "Stealth", source: "XPHB" };
const DECEPTION = { name: "Deception", source: "XPHB" };
const PERCEPTION = { name: "Perception", source: "XPHB" };
const ARCANA = { name: "Arcana", source: "XPHB" };
const FIEND = { name: "Fiend Patron", source: "XPHB" };

/** `characterRecord`'s Warlock at level 3 with a patron, two skills and two saves. */
function warlock(): CharacterRecord {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    level: 3,
    definition: {
      ...record.definition,
      levels: [{ class: WARLOCK }, { class: WARLOCK }, { class: WARLOCK, subclass: FIEND }],
      proficiencies: {
        ...record.definition.proficiencies,
        savingThrows: ["wis", "cha"],
        skills: [
          { ref: DECEPTION, level: "proficient" },
          { ref: STEALTH, level: "expertise" },
        ],
      },
    },
  };
}

function derivedFor(record: CharacterRecord): CharacterDerived {
  return deriveCharacter(record.definition, {
    hitDice: new Map([[entryKey(WARLOCK), 8]]),
    spellcastingAbilities: new Map([[entryKey(WARLOCK), "cha"]]),
    casterTables: new Map(),
    skills: [
      { ref: STEALTH, ability: "dex" },
      { ref: DECEPTION, ability: "cha" },
      { ref: PERCEPTION, ability: "wis" },
      { ref: ARCANA, ability: "int" },
    ],
    size: "medium",
    speed: { walk: 30, fly: 40 },
    armor: new Map(),
    weights: new Map(),
    weapons: new Map(),
  });
}

function renderSection(record = warlock(), derived = derivedFor(record)) {
  stubRules([]);
  renderWithClient(<AbilitiesSection character={record} derived={derived} />);
}

/** A row's text with the aria-hidden decoration dropped, as a screen reader reaches it. */
function spoken(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  for (const hidden of clone.querySelectorAll("[aria-hidden='true']")) hidden.remove();
  return clone.textContent ?? "";
}

const card = (name: string) => within(screen.getByRole("region", { name }));

/** One tile's term and value together, found by the full name a screen reader speaks. */
const tile = (region: string, name: string) =>
  card(region).getAllByText(name)[0]?.closest("div") as HTMLElement;

/** The button that opens a row's terms, which follows the one that opens its detail. */
const rowButton = (region: string, name: string) =>
  within(card(region).getByText(name).closest("li") as HTMLElement)
    .getAllByRole("button")
    .at(-1) as HTMLElement;

const nameButton = (region: string, name: string) =>
  within(card(region).getByText(name).closest("li") as HTMLElement).getAllByRole(
    "button",
  )[0] as HTMLElement;

/**
 * Answers the rules lookups a modal makes, and apart from them the state read `Vitals`
 * makes and the inventory read `Attacks` makes.
 */
function stubRules(entries: unknown[]) {
  const fetchMock = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ refs: [{ name: "x", source: "XPHB", entries }] })),
  );
  const reads: Record<string, unknown> = {
    "/api/characters/1/state": stateRecord(),
    "/api/characters/1/inventory": { items: [] },
  };
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) =>
    String(url) in reads ? new Response(JSON.stringify(reads[String(url)])) : fetchMock(url, init),
  );
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("AbilitiesSection", () => {
  it("degrades until both the character and its derived block have loaded", () => {
    render(<AbilitiesSection character={warlock()} derived={undefined} />);
    expect(screen.getByText("Abilities isn't available yet.")).toBeInTheDocument();
  });

  it("reads each ability as its name, score and signed modifier", () => {
    renderSection();

    expect(spoken(tile("Ability Scores", "Strength"))).toBe("Strength8, modifier-1");
    expect(spoken(tile("Ability Scores", "Charisma"))).toBe("Charisma17, modifier+3");
  });

  it("takes each modifier from the derived block, not from the score", () => {
    const record = warlock();
    const derived = derivedFor(record);
    renderSection(record, {
      ...derived,
      abilityModifiers: {
        ...derived.abilityModifiers,
        dex: { computed: 3, manual: null, terms: [] },
      },
    });

    expect(within(tile("Ability Scores", "Dexterity")).getByText("+3")).toBeVisible();
  });

  it("names a save by its abbreviation, and a screen reader by its full name and proficiency", () => {
    renderSection();

    const saves = card("Saving Throws");
    expect(saves.getByText("CHA")).toBeVisible();
    expect(spoken(saves.getByText("Charisma").closest("li") as HTMLElement)).toBe(
      "Charisma, proficient+5",
    );
    expect(spoken(saves.getByText("Strength").closest("li") as HTMLElement)).toBe("Strength-1");
  });

  it("draws proficiency, half proficiency and expertise as distinct rings", () => {
    const record = warlock();
    const definition = {
      ...record.definition,
      proficiencies: {
        ...record.definition.proficiencies,
        skills: [
          { ref: DECEPTION, level: "proficient" as const },
          { ref: STEALTH, level: "expertise" as const },
          { ref: ARCANA, level: "half" as const },
        ],
      },
    };
    renderSection({ ...record, definition });

    const ring = (name: string) =>
      card("Skills").getByText(name).closest("li")?.querySelector("[title]")?.className;
    const classes = [ring("Perception"), ring("Deception"), ring("Stealth"), ring("Arcana")];
    expect(new Set(classes).size).toBe(4);
    expect(card("Skills").getByText("Stealth").closest("li")).toHaveTextContent(
      "Stealth, expertise",
    );
  });

  it("lists every skill the derived block scores, alphabetically, with its governing ability", () => {
    renderSection();

    const rows = card("Skills").getAllByRole("listitem");
    expect(rows.map((row) => spoken(row))).toEqual([
      "ArcanaIntelligence+0",
      "Deception, proficientCharisma+5",
      "PerceptionWisdom+1",
      "Stealth, expertiseDexterity+7",
    ]);
  });

  it("puts the passive scores in the Skills card, an absent one as absent", () => {
    renderSection();

    expect(screen.queryByRole("region", { name: "Passive Scores" })).not.toBeInTheDocument();
    const skills = card("Skills");
    expect(skills.getByText("Passive Perception").nextElementSibling).toHaveTextContent("11");
    expect(spoken(skills.getByText("Passive Insight").nextElementSibling as HTMLElement)).toBe(
      "None",
    );
  });

  it("shows four combat tiles, and every speed the character has", () => {
    renderSection();

    const combat = card("Combat");
    const value = (name: string) => tile("Combat", name);
    expect(spoken(value("Proficiency Bonus"))).toBe("Proficiency Bonus+2");
    expect(spoken(value("Armor Class"))).toBe("Armor Class13");
    expect(spoken(value("Initiative"))).toBe("Initiative+3");
    expect(value("Speed")).toHaveTextContent("30");
    expect(value("Speed")).toHaveTextContent("fly 40 ft.");
    expect(combat.queryByText(/Hit Point/)).not.toBeInTheDocument();
    expect(combat.queryByText(/Hit Dice/)).not.toBeInTheDocument();
  });

  it("tells an overridden value apart from a computed one", () => {
    const record = warlock();
    const derived = derivedFor(record);
    renderSection(record, { ...derived, armorClass: { ...derived.armorClass, manual: 18 } });

    expect(spoken(tile("Combat", "Armor Class"))).toBe("Armor Class18, overridden from 13");
  });

  it("opens a save's, a skill's and armor class's terms on focus, and leaves a termless value plain", async () => {
    const record = warlock();
    const derived = derivedFor(record);
    renderSection(record, {
      ...derived,
      initiative: { ...derived.initiative, terms: [] },
      armorClass: {
        computed: 13,
        manual: null,
        terms: [
          { label: "Base", value: 10 },
          { label: "Dexterity", value: 3 },
        ],
      },
    });

    rowButton("Saving Throws", "Charisma").focus();
    expect(await screen.findByRole("group", { name: "Charisma save breakdown" })).toHaveTextContent(
      "Charisma3Proficiency2",
    );

    rowButton("Skills", "Stealth").focus();
    expect(await screen.findByRole("group", { name: "Stealth check breakdown" })).toBeVisible();

    screen.getByRole("button", { name: "Armor Class 13" }).focus();
    expect(await screen.findByRole("group", { name: "Armor Class breakdown" })).toHaveTextContent(
      "Base10Dexterity3",
    );

    expect(screen.queryByRole("button", { name: /Initiative/ })).not.toBeInTheDocument();
  });

  it("opens initiative's and the proficiency bonus's terms on focus", async () => {
    renderSection();

    screen.getByRole("button", { name: /^Initiative/ }).focus();
    expect(await screen.findByRole("group", { name: "Initiative breakdown" })).toBeVisible();

    screen.getByRole("button", { name: /^Proficiency Bonus/ }).focus();
    expect(await screen.findByRole("group", { name: "Proficiency Bonus breakdown" })).toBeVisible();
  });

  it("speaks an override on a value that also has terms", () => {
    const record = warlock();
    renderSection(record, {
      ...derivedFor(record),
      armorClass: { computed: 13, manual: 18, terms: [{ label: "Base", value: 10 }] },
    });
    expect(
      screen.getByRole("button", { name: "Armor Class 18, overridden from 13" }),
    ).toBeVisible();
  });

  it("spells out every mark on the page, since a tooltip never reaches a touch reader", () => {
    renderSection();
    const legend = screen.getByText("Expertise").closest("p") as HTMLElement;
    expect(legend).toHaveTextContent(
      "Not proficientHalf proficiencyProficientExpertise* Overridden",
    );
  });

  it("renders every overridable value read-only", () => {
    renderSection();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  describe("detail modal", () => {
    it("opens a skill's terms and its catalog text, asking for the skill by its own source", async () => {
      const fetchMock = stubRules(["Stealth covers hiding."]);
      const record = warlock();
      renderWithClient(<AbilitiesSection character={record} derived={derivedFor(record)} />);

      fireEvent.click(nameButton("Skills", "Stealth"));

      const modal = within(screen.getByRole("dialog", { name: "Stealth" }));
      expect(modal.getByText("Expertise")).toBeVisible();
      expect(modal.getByText("+7")).toBeVisible();
      expect(await modal.findByText("Stealth covers hiding.")).toBeVisible();
      const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(body.refs).toEqual([{ tag: "skill", name: "Stealth", source: "XPHB" }]);
    });

    it("opens a save from its name and an ability from its label", async () => {
      const fetchMock = stubRules(["Roll to resist."]);
      const record = warlock();
      renderWithClient(<AbilitiesSection character={record} derived={derivedFor(record)} />);

      fireEvent.click(nameButton("Saving Throws", "Charisma"));
      expect(await screen.findByText("Roll to resist.")).toBeVisible();
      expect(screen.getByRole("dialog", { name: "Charisma saving throw" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      fireEvent.click(within(tile("Ability Scores", "Strength")).getByRole("button"));
      expect(screen.getByRole("dialog", { name: "Strength" })).toHaveTextContent("Score 8");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const asked = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).refs[0]);
      expect(asked).toContainEqual({ tag: "variantrule", name: "Saving Throw", source: "XPHB" });
      expect(asked).toContainEqual({
        tag: "variantrule",
        name: "Ability Score and Modifier",
        source: "XPHB",
      });
    });

    it("leaves a classic character's ability and save without rules text, and keeps its skill's", () => {
      const fetchMock = stubRules(["Roll to resist."]);
      const record = warlock();
      const classic = {
        ...record,
        definition: { ...record.definition, edition: "classic" as const },
      };
      renderWithClient(<AbilitiesSection character={classic} derived={derivedFor(classic)} />);

      fireEvent.click(nameButton("Saving Throws", "Charisma"));
      expect(screen.getByRole("dialog", { name: "Charisma saving throw" })).toBeVisible();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      fireEvent.click(nameButton("Skills", "Stealth"));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps the formula popover and the modal on separate controls, each keyboard reachable", async () => {
      stubRules([]);
      const record = warlock();
      renderWithClient(<AbilitiesSection character={record} derived={derivedFor(record)} />);

      expect(nameButton("Skills", "Stealth")).not.toBe(rowButton("Skills", "Stealth"));

      rowButton("Skills", "Stealth").focus();
      expect(await screen.findByRole("group", { name: "Stealth check breakdown" })).toBeVisible();

      fireEvent.click(nameButton("Skills", "Stealth"));
      expect(screen.getByRole("dialog", { name: "Stealth" })).toBeVisible();
    });

    it("returns focus to the name when the modal closes", async () => {
      stubRules([]);
      const record = warlock();
      renderWithClient(<AbilitiesSection character={record} derived={derivedFor(record)} />);

      const name = nameButton("Skills", "Arcana");
      fireEvent.click(name);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      await waitFor(() => expect(nameButton("Skills", "Arcana")).toHaveFocus());
    });
  });
});
