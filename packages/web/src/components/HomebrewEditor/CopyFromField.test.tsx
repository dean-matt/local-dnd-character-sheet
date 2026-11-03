import type { SearchHit } from "@dnd/catalog";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "codemirror";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { EntryEditor } from "./EntryEditor.tsx";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

/**
 * A fake API: `/search` answers `hits` whatever it asks, and every other `GET` the body
 * `rows` holds for its path. Anything else is a 404, so a write fails loudly.
 */
function stubApi(hits: SearchHit[], rows: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = url.startsWith("/api/search?")
      ? { items: hits, total: hits.length, limit: 20, offset: 0 }
      : init?.method === undefined
        ? rows[url]
        : undefined;
    return body === undefined
      ? new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 })
      : new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderEditor(collection: HomebrewCollection) {
  const onSave = vi.fn();
  renderWithClient(
    <EntryEditor
      collection={collection}
      record={undefined}
      saving={false}
      failure={null}
      onSave={onSave}
      onClose={() => undefined}
    />,
  );
  return onSave;
}

async function pickHit(name: RegExp) {
  const input = screen.getByRole("combobox", { name: "Copy from" });
  fireEvent.change(input, { target: { value: "sun" } });
  fireEvent.click(await screen.findByRole("option", { name }));
}

const nameField = () => screen.getByLabelText("Name", { selector: "input" });

/** The entry as the JSON mode shows it, read from its CodeMirror view, then back to the form. */
const jsonEntry = () => {
  fireEvent.click(screen.getByRole("tab", { name: "JSON" }));
  const view = EditorView.findFromDOM(
    screen.getByLabelText(/ JSON$/, { selector: '[role="textbox"]' }),
  );
  const text = view?.state.doc.toString() ?? "";
  fireEvent.click(screen.getByRole("tab", { name: "Step by step" }));
  return JSON.parse(text) as Record<string, unknown>;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copying an entry into a new one", () => {
  it.each([
    ["items", true],
    ["races", true],
    ["spells", true],
    ["backgrounds", true],
    ["classes", true],
    ["skills", true],
    ["feats", true],
    ["subclasses", false],
    ["subraces", false],
    ["deities", false],
    ["optional-features", false],
    ["monsters", false],
  ] as const)("offers a copy for a new %s entry: %s", (collection, offered) => {
    stubApi([], {});
    renderEditor(collection);

    expect(screen.queryAllByRole("combobox", { name: "Copy from" })).toHaveLength(offered ? 1 : 0);
  });

  it("prefills a catalog item's fields under a free name, without its source, writing nothing", async () => {
    const fetchMock = stubApi(
      [
        { type: "item", name: "Sunblade", source: "DMG", edition: "one" },
        { type: "item", id: "i1", name: "Sunblade (Copy)", edition: "one" },
      ],
      {
        "/api/items/Sunblade/DMG": {
          json: {
            name: "Sunblade",
            source: "DMG",
            page: 205,
            type: "M",
            rarity: "rare",
            reqAttune: true,
            entries: ["A blade of radiance."],
          },
        },
        "/api/homebrew/items": [],
      },
    );
    const onSave = renderEditor("items");

    await pickHit(/DMG/);

    await waitFor(() => expect(nameField()).toHaveValue("Sunblade (copy 2)"));
    expect(jsonEntry()).toEqual({
      name: "Sunblade (copy 2)",
      type: "M",
      rarity: "rare",
      reqAttune: true,
      entries: ["A blade of radiance."],
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === undefined)).toBe(true);
  });

  it("carries a homebrew class's features and resources, and edits the copy in either mode", async () => {
    const features = [{ name: "Second Wind", level: 1, entries: ["Breathe."] }];
    const resources = [{ name: "Grit", maximums: Array(20).fill(2) }];
    stubApi([{ type: "class", id: "c1", name: "Sunwarden", edition: "one" }], {
      "/api/homebrew/classes/c1": {
        json: { name: "Sunwarden", source: "HB", hd: { number: 1, faces: 10 } },
      },
      "/api/homebrew/classes/c1/features": features,
      "/api/homebrew/classes/c1/resources": resources,
      "/api/homebrew/classes": [{ id: "c1", name: "Sunwarden" }],
    });
    renderEditor("classes");

    await pickHit(/Sunwarden/);

    await waitFor(() => expect(nameField()).toHaveValue("Sunwarden (copy)"));
    fireEvent.change(nameField(), { target: { value: "Moonwarden" } });
    expect(jsonEntry()).toEqual({
      name: "Moonwarden",
      hd: { number: 1, faces: 10 },
      features,
      resources,
    });
  });

  it("lists catalog and homebrew skills of the edition, and copies the one picked", async () => {
    stubApi([{ type: "skill", name: "Athletics", source: "XPHB", edition: "one" }], {
      "/api/homebrew/skills": [
        {
          id: "k1",
          name: "Sailing",
          edition: "one",
          json: { name: "Sailing", source: "HB", ability: "wis" },
          createdAt: CREATED_AT,
        },
        {
          id: "k2",
          name: "Rowing",
          edition: "classic",
          json: { name: "Rowing", source: "HB", ability: "str" },
          createdAt: CREATED_AT,
        },
      ],
      "/api/homebrew/skills/k1": { json: { name: "Sailing", source: "HB", ability: "wis" } },
    });
    renderEditor("skills");

    fireEvent.click(screen.getByRole("combobox", { name: "Copy from" }));
    const list = await screen.findByRole("listbox", { name: "Copy from" });
    await within(list).findByRole("option", { name: "Athletics (XPHB)" });
    const sailing = await within(list).findByRole("option", { name: "Sailing (Homebrew)" });
    expect(within(list).queryByRole("option", { name: /Rowing/ })).toBeNull();
    fireEvent.click(sailing);

    await waitFor(() => expect(nameField()).toHaveValue("Sailing (copy)"));
    expect(jsonEntry()).toEqual({ name: "Sailing (copy)", ability: "wis" });
  });

  it("copies a catalog skill from the rules lookup", async () => {
    stubApi([{ type: "skill", name: "Athletics", source: "XPHB", edition: "one" }], {
      "/api/homebrew/skills": [],
      "/api/catalog/skill/Athletics/XPHB": {
        json: { name: "Athletics", source: "XPHB", page: 14, ability: "str" },
      },
    });
    renderEditor("skills");

    fireEvent.click(screen.getByRole("combobox", { name: "Copy from" }));
    const list = await screen.findByRole("listbox", { name: "Copy from" });
    fireEvent.click(await within(list).findByRole("option", { name: "Athletics (XPHB)" }));

    await waitFor(() => expect(nameField()).toHaveValue("Athletics (copy)"));
    expect(jsonEntry()).toEqual({ name: "Athletics (copy)", ability: "str" });
  });

  it("copies a catalog class without its references to features it does not bring", async () => {
    stubApi([{ type: "class", name: "Fighter", source: "XPHB", edition: "one" }], {
      "/api/classes/Fighter/XPHB": {
        json: {
          name: "Fighter",
          source: "XPHB",
          hd: { number: 1, faces: 10 },
          classFeatures: ["Second Wind|Fighter|XPHB|1"],
          subclassTitle: "Fighter Subclass",
        },
      },
      "/api/homebrew/classes": [],
    });
    renderEditor("classes");

    await pickHit(/Fighter/);

    await waitFor(() => expect(nameField()).toHaveValue("Fighter (copy)"));
    expect(jsonEntry()).toEqual({ name: "Fighter (copy)", hd: { number: 1, faces: 10 } });
  });

  it("offers no copy for a row being edited", () => {
    stubApi([], {});
    renderWithClient(
      <EntryEditor
        collection="skills"
        record={{
          id: "k1",
          name: "Sailing",
          edition: "one",
          json: { name: "Sailing", ability: "wis" },
        }}
        saving={false}
        failure={null}
        onSave={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Copy from" })).toBeNull();
  });
});
