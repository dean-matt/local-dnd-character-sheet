import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { CreationGrants } from "./CreationGrants.tsx";
import { creationForm } from "./creationForm.ts";
import { IdentityStep } from "./IdentityStep.tsx";

const PHB = (name: string) => ({ name, source: "PHB" });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const hit = (type: string, name: string, source = "PHB", qualifier?: string) => ({
  type,
  name,
  source,
  edition: "classic",
  ...(qualifier && { qualifier }),
});

const ELF = {
  ...PHB("Elf"),
  size: ["M"],
  speed: 30,
  skillProficiencies: [{ perception: true }],
  languageProficiencies: [{ common: true, elvish: true }],
  entries: [{ type: "entries", name: "Darkvision", entries: [] }],
};
const HIGH_ELF = { ...ELF, name: "High", weaponProficiencies: [{ "longsword|phb": true }] };
const VERDAN = {
  name: "Verdan",
  source: "AI",
  size: ["V"],
  speed: 30,
  resist: [{ choose: { from: ["acid", "fire"] } }],
  languageProficiencies: [{ common: true, goblin: true }],
};
const background = (name: string, skills: Record<string, true>) => ({
  ...PHB(name),
  edition: "classic",
  json: { ...PHB(name), skillProficiencies: [skills] },
});

const ROWS: Record<string, unknown> = {
  "/api/races/Elf/PHB": { ...PHB("Elf"), edition: "classic", json: ELF },
  "/api/races/Elf/PHB/subraces?edition=classic&limit=200": page([
    { ...PHB("High"), raceName: "Elf", raceSource: "PHB", edition: "classic", json: HIGH_ELF },
    { ...PHB("Wood"), raceName: "Elf", raceSource: "PHB", edition: "classic", json: ELF },
  ]),
  "/api/races/Verdan/AI": { name: "Verdan", source: "AI", edition: "classic", json: VERDAN },
  "/api/races/Verdan/AI/subraces?edition=classic&limit=200": page([]),
  "/api/backgrounds?edition=classic&limit=200": page([
    background("Sage", { arcana: true, history: true }),
    background("Acolyte", { insight: true, religion: true }),
  ]),
  "/api/races/Elf/PHB/subraces?edition=one&limit=200": page([]),
  "/api/feats?edition=one&limit=200": page([
    {
      name: "Grappler",
      source: "XPHB",
      edition: "one",
      json: { name: "Grappler", source: "XPHB" },
    },
  ]),
  "/api/backgrounds?edition=one&limit=200": page([]),
  "/api/classes/Cleric/PHB": {
    ...PHB("Cleric"),
    edition: "classic",
    hitDie: 8,
    json: { ...PHB("Cleric"), classFeatures: [] },
  },
  "/api/classes/Cleric/PHB/subclasses?edition=one&limit=200": page([]),
  "/api/homebrew/races/hr-1": { id: "hr-1", name: "Kenku", edition: "classic" },
  "/api/homebrew/backgrounds/hbg-1": { id: "hbg-1", name: "Smuggler", edition: "classic" },
  "/api/homebrew/classes/hc-1": {
    id: "hc-1",
    name: "Blood Hunter",
    edition: "classic",
    hitDie: 10,
    json: { name: "Blood Hunter", source: "Homebrew", hd: { number: 1, faces: 10 } },
    createdAt: "2026-10-06T00:00:00.000Z",
  },
  "/api/catalog/deity/Oghma/PHB?qualifier=Celtic": {
    type: "deity",
    ...PHB("Oghma"),
    qualifier: "Celtic",
    edition: "classic",
    json: PHB("Oghma"),
  },
  "/api/catalog/deity/Oghma/PHB?qualifier=Forgotten%20Realms": {
    type: "deity",
    ...PHB("Oghma"),
    qualifier: "Forgotten Realms",
    edition: null,
    json: PHB("Oghma"),
  },
};

const SEARCHES: Record<string, unknown[]> = {
  race: [hit("race", "Elf"), hit("race", "Verdan", "AI")],
  background: [hit("background", "Sage"), hit("background", "Acolyte")],
  deity: [hit("deity", "Oghma", "PHB", "Celtic"), hit("deity", "Oghma", "PHB", "Forgotten Realms")],
  "skill,language": [
    ...["Perception", "Arcana", "History", "Insight", "Religion"].map((name) => hit("skill", name)),
    hit("language", "Common", "ERLW"),
    hit("language", "Common"),
    hit("language", "Elvish"),
  ],
};

function stubCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const type = new URL(url, "http://local").searchParams.get("type");
      const body = url.startsWith("/api/search?") ? page(SEARCHES[type ?? ""] ?? []) : ROWS[url];
      return body === undefined
        ? new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

let values: Partial<CharacterDefinition> = {};

function Values() {
  // The draft holds a partial definition, which the probe reads only field by field.
  values = useWatch<CharacterDefinition>() as Partial<CharacterDefinition>;
  return null;
}

function renderStep() {
  renderWithClient(
    <creationForm.FormShell onSubmit={() => {}}>
      {() => (
        <>
          <CreationGrants />
          <IdentityStep />
          <Values />
        </>
      )}
    </creationForm.FormShell>,
  );
}

const combobox = (name: string) => screen.getByRole("combobox", { name });

async function pick(field: string, query: string, option: RegExp) {
  fireEvent.change(combobox(field), { target: { value: query } });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("IdentityStep", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("draft:creation", JSON.stringify({ edition: "classic" }));
    stubCatalog();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks for a subrace, and lands what the race grants from the core book's rows", async () => {
    renderStep();

    await pick("Race", "elf", /^Elf/);

    expect(screen.getByRole("button", { name: "Clear race, Elf" })).toHaveFocus();
    expect(await screen.findByText("Elf has subraces — choose one")).toBeVisible();
    expect(screen.getByText("Traits: Darkvision")).toBeVisible();
    await waitFor(() =>
      expect(values.proficiencies).toMatchObject({
        skills: [{ ref: PHB("Perception"), level: "proficient" }],
        languages: [PHB("Common"), PHB("Elvish")],
        weapons: [],
      }),
    );

    click("High");

    expect(values.subrace).toEqual(PHB("High"));
    expect(screen.getByRole("button", { name: "High" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(values.proficiencies?.weapons).toEqual(["Longsword"]));
  });

  it("says what a background grants before it is chosen, and swaps the grant on a change", async () => {
    renderStep();

    fireEvent.change(combobox("Background"), { target: { value: "sa" } });
    expect(
      await screen.findByRole("option", { name: /Sage.*Grants Arcana, History/ }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: /Sage/ }));

    expect(screen.getByText("Grants: Arcana, History")).toBeVisible();
    await waitFor(() =>
      expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toEqual([
        "Arcana",
        "History",
      ]),
    );

    click("Clear background, Sage");
    expect(combobox("Background")).toHaveFocus();
    await pick("Background", "aco", /Acolyte/);

    await waitFor(() =>
      expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toEqual([
        "Insight",
        "Religion",
      ]),
    );
  });

  it("takes a race the catalog lacks, noting the departure, and drops the note with it", async () => {
    renderStep();

    click("Not listed? Type a race");
    expect(screen.getByRole("textbox", { name: "Race name" })).toHaveFocus();
    fireEvent.change(screen.getByRole("textbox", { name: "Race name" }), {
      target: { value: "Warforged" },
    });
    click("Use");

    expect(values.race).toEqual({ name: "Warforged", source: "Custom" });
    expect(values.departures).toEqual([
      { field: "race", note: expect.stringContaining("Warforged is not a race the catalog holds") },
    ]);

    click("Clear race, Warforged");

    expect(values.race).toBeUndefined();
    expect(values.departures).toEqual([]);
  });

  it("names a granted language no row answers, and lands the rest", async () => {
    renderStep();

    await pick("Race", "verdan", /^Verdan/);

    expect(
      await screen.findByText(
        "The character does not gain Goblin: no language in this edition matches.",
      ),
    ).toBeVisible();
    await waitFor(() => expect(values.proficiencies?.languages).toEqual([PHB("Common")]));
  });

  it("asks the size and the resistance a race leaves open", async () => {
    renderStep();

    await pick("Race", "verdan", /^Verdan/);
    expect(await screen.findByRole("group", { name: "Size — choose one" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Medium" }));
    expect(screen.getByRole("group", { name: "Size" })).toBeVisible();
    click("Fire");

    expect(values.size).toBe("medium");
    expect(values.raceResistance).toBe("fire");
    expect(screen.getByRole("button", { name: "Small" })).toHaveAttribute("aria-pressed", "false");
  });

  it("stores a deity with its pantheon, and clears it back to none", async () => {
    renderStep();

    fireEvent.change(combobox("Deity (optional)"), { target: { value: "oghma" } });
    expect(await screen.findByRole("option", { name: /Oghma · Forgotten Realms/ })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: /Oghma · Celtic/ }));

    expect(values.deity).toEqual({ name: "Oghma", source: "PHB", pantheon: "Celtic" });

    click("Clear deity, Oghma · Celtic");

    expect(values.deity).toBeUndefined();
    expect(combobox("Deity (optional)")).toHaveFocus();
  });

  it("asks the rules first, and names each choice a change leaves behind without clearing it", async () => {
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({
        edition: "classic",
        levels: [{ class: PHB("Cleric"), subclass: PHB("Life Domain") }],
      }),
    );
    renderStep();

    const rules = screen.getByRole("group", { name: "Rules" });
    expect(rules.compareDocumentPosition(combobox("Race"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("button", { name: "2014" })).toHaveAttribute("aria-pressed", "true");
    await pick("Race", "elf", /^Elf/);
    fireEvent.click(await screen.findByRole("button", { name: "High" }));
    await pick("Background", "sa", /Sage/);
    const status = screen.getByRole("status", { name: "Choices outside the rules" });
    expect(status).toBeEmptyDOMElement();

    click("2024");

    expect(values.edition).toBe("one");
    await waitFor(() =>
      expect(Array.from(status.querySelectorAll("li"), (li) => li.textContent)).toEqual([
        "Race: Elf (PHB)",
        "Subrace: High (PHB)",
        "Background: Sage (PHB)",
        "Class: Cleric (PHB)",
        "Subclass: Life Domain (PHB)",
      ]),
    );
    expect(status).toHaveTextContent(
      "Not in the 2024 rules. Each stays until you clear it, or the race or class it belongs to",
    );
    expect(values.race).toEqual(PHB("Elf"));
    expect(values.subrace).toEqual(PHB("High"));
    expect(values.background).toEqual(PHB("Sage"));
    expect(values.levels).toEqual([{ class: PHB("Cleric"), subclass: PHB("Life Domain") }]);

    click("2014");

    await waitFor(() => expect(status).toBeEmptyDOMElement());
  });

  it("allows feats under the 2014 rules until unticked, and asks nothing under the 2024 rules", () => {
    renderStep();

    const allow = screen.getByRole("checkbox", { name: "Allow feats" });
    expect(allow).toBeChecked();
    expect(allow).toHaveAccessibleDescription("A feat may replace an Ability Score Improvement.");
    expect(values.houseRules).toEqual({ feats: true });

    fireEvent.click(allow);

    expect(values.houseRules).toEqual({ feats: false });

    click("2024");

    expect(screen.queryByRole("checkbox", { name: "Allow feats" })).toBeNull();
  });

  it("names a homebrew choice and a deity of the other edition", async () => {
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({
        edition: "classic",
        race: { homebrewId: "hr-1" },
        background: { homebrewId: "hbg-1" },
        deity: { ...PHB("Oghma"), pantheon: "Celtic" },
        levels: [{ class: { homebrewId: "hc-1" } }],
      }),
    );
    renderStep();
    const status = screen.getByRole("status", { name: "Choices outside the rules" });

    click("2024");

    await waitFor(() =>
      expect(Array.from(status.querySelectorAll("li"), (li) => li.textContent)).toEqual([
        "Race: Kenku (homebrew)",
        "Background: Smuggler (homebrew)",
        "Class: Blood Hunter (homebrew)",
        "Deity: Oghma · Celtic",
      ]),
    );
  });

  it("names a feat taken at an improvement that the new edition lacks", async () => {
    const fighter = PHB("Fighter");
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({
        edition: "classic",
        levels: Array.from({ length: 4 }, () => ({ class: fighter })),
        feats: [{ ref: PHB("Grappler"), grantedBy: { kind: "class", ref: fighter }, level: 4 }],
      }),
    );
    renderStep();
    const status = screen.getByRole("status", { name: "Choices outside the rules" });

    click("2024");

    await waitFor(() =>
      expect(Array.from(status.querySelectorAll("li"), (li) => li.textContent)).toContain(
        "Feat: Grappler (PHB)",
      ),
    );
  });

  it("never names a deity both editions share", async () => {
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({
        edition: "classic",
        deity: { ...PHB("Oghma"), pantheon: "Forgotten Realms" },
      }),
    );
    renderStep();
    const url = "/api/catalog/deity/Oghma/PHB?qualifier=Forgotten%20Realms";
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toContain(url),
    );

    click("2024");

    // The row has no visible effect to wait on, so give its query time to settle.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("status", { name: "Choices outside the rules" })).toBeEmptyDOMElement();
  });

  it("sets the name and the alignment", async () => {
    renderStep();

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Vex" } });
    fireEvent.click(combobox("Alignment"));
    fireEvent.click(screen.getByRole("option", { name: "Chaotic Good" }));

    expect(values.name).toBe("Vex");
    expect(values.alignment).toBe("Chaotic Good");
  });
});
