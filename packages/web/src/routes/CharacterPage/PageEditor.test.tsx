import type { CharacterPageRecord, PageBlock } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../test/records.ts";
import { CharacterPage } from "./CharacterPage.tsx";

const grapple = (blocks: PageBlock[]): CharacterPageRecord => ({
  slug: "grapple",
  title: "Grapple",
  hidden: false,
  preset: false,
  blocks,
});

/**
 * A fake of the pages routes: a `PUT` stores the list it is sent and answers it back.
 * `hold` keeps every `PUT` waiting until the function it returns is called.
 */
function stubServer(initial: CharacterPageRecord[]) {
  let stored = initial;
  const puts: CharacterPageRecord[][] = [];
  let gate: Promise<void> | undefined;
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/characters/1/pages" && init?.method === "PUT") {
        await gate;
        const body = JSON.parse(String(init.body)) as Omit<CharacterPageRecord, "preset">[];
        stored = body.map((page) => ({ ...page, preset: false }));
        puts.push(stored);
        return json(stored);
      }
      if (url === "/api/characters/1/pages") return json(stored);
      if (url === "/api/characters/1") return json(characterRecord("1", "Vex"));
      if (url === "/api/characters/1/derived") return json(derivedRecord());
      if (url === "/api/characters/1/state") return json(stateRecord());
      return new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 });
    }),
  );
  const page = () => stored.find((each) => each.slug === "grapple");
  const hold = () => {
    let release = () => {};
    gate = new Promise((resolve) => {
      release = resolve;
    });
    return release;
  };
  return { puts, page, hold };
}

async function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/characters/1/p/grapple?edit"]}>
        <Routes>
          <Route path="/characters/:id/p/:slug" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("textbox", { name: "Page title" });
}

const blockNames = () =>
  within(screen.getByRole("list", { name: "Blocks" }))
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("aria-label"));

const announced = () => document.querySelector("[aria-live='polite'].sr-only");

function pick(combobox: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: combobox }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PageEditor", () => {
  it("opens from the page's Edit button and closes back to its blocks", async () => {
    stubServer([grapple([{ kind: "text", text: "Grab them." }])]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/characters/1/p/grapple"]}>
          <Routes>
            <Route path="/characters/:id/p/:slug" element={<CharacterPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit page" }));
    expect(screen.getByRole("textbox", { name: "Page title" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done editing" }));
    expect(screen.queryByRole("textbox", { name: "Page title" })).not.toBeInTheDocument();
    expect(screen.getByText("Grab them.")).toBeInTheDocument();
  });

  it("retitles the page and keeps its slug", async () => {
    const server = stubServer([grapple([])]);
    await renderEditor();

    const title = screen.getByRole("textbox", { name: "Page title" });
    fireEvent.change(title, { target: { value: "Grappling" } });
    fireEvent.blur(title);

    await waitFor(() => expect(server.page()?.title).toBe("Grappling"));
    expect(server.page()?.slug).toBe("grapple");
  });

  it("adds a block of every kind from the picker, focusing each where it lands", async () => {
    const server = stubServer([grapple([])]);
    await renderEditor();

    for (const name of ["Spells section", "Armor Class", "Inventory list", "Text"]) {
      fireEvent.click(screen.getByRole("button", { name: "Add block" }));
      fireEvent.click(await screen.findByRole("button", { name: `Add ${name}` }));
      await waitFor(() => expect(announced()).toHaveTextContent(`${name} added.`));
      await waitFor(() => expect(document.activeElement).toHaveAccessibleName(`Move ${name} up`));
    }

    await waitFor(() =>
      expect(server.page()?.blocks).toEqual([
        { kind: "section", section: "spells" },
        { kind: "value", field: "armorClass" },
        { kind: "list", source: "inventory", filter: {} },
        { kind: "text", text: "" },
      ]),
    );
  });

  it("moves a block from the keyboard, announcing it and keeping focus on it", async () => {
    const server = stubServer([
      grapple([
        { kind: "value", field: "armorClass" },
        { kind: "value", field: "initiative" },
      ]),
    ]);
    await renderEditor();

    const down = screen.getByRole("button", { name: "Move Armor Class down" });
    down.focus();
    fireEvent.click(down);

    await waitFor(() =>
      expect(blockNames()).toEqual(["Initiative, block 1 of 2", "Armor Class, block 2 of 2"]),
    );
    expect(announced()).toHaveTextContent("Armor Class moved to position 2 of 2.");
    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName("Move Armor Class down"),
    );
    await waitFor(() =>
      expect(server.page()?.blocks.map((block) => block.kind === "value" && block.field)).toEqual([
        "initiative",
        "armorClass",
      ]),
    );
  });

  it("lands a save queued behind another on the block typed into, after a move", async () => {
    const server = stubServer([
      grapple([
        { kind: "text", text: "A" },
        { kind: "text", text: "B" },
      ]),
    ]);
    await renderEditor();
    const release = server.hold();
    const [first] = screen.getAllByRole("textbox", { name: "Text" }) as [HTMLElement];

    fireEvent.change(first, { target: { value: "A1" } });
    fireEvent.blur(first);
    fireEvent.change(first, { target: { value: "A2" } });
    fireEvent.blur(first);
    fireEvent.click(screen.getAllByRole("button", { name: "Move Text down" })[0] as HTMLElement);
    release();

    await waitFor(() =>
      expect(server.page()?.blocks).toEqual([
        { kind: "text", text: "B" },
        { kind: "text", text: "A2" },
      ]),
    );
  });

  it("removes a block", async () => {
    const server = stubServer([grapple([{ kind: "section", section: "notes" }])]);
    await renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Remove Notes section" }));

    await waitFor(() => expect(server.page()?.blocks).toEqual([]));
    expect(screen.getByText("No blocks on this page yet.")).toBeInTheDocument();
  });

  it("points a value block at a derived value by picking it", async () => {
    const server = stubServer([grapple([{ kind: "value", field: "armorClass" }])]);
    await renderEditor();

    pick("Value", "Proficiency Bonus");

    await waitFor(() =>
      expect(server.page()?.blocks).toEqual([{ kind: "value", field: "proficiencyBonus" }]),
    );
  });

  it("builds a list block's filter and stores the filter, not the rows", async () => {
    const server = stubServer([grapple([{ kind: "list", source: "spells", filter: {} }])]);
    await renderEditor();

    fireEvent.click(screen.getByRole("checkbox", { name: "Prepared only" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "3rd Level" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cantrips" }));
    const search = screen.getByRole("textbox", { name: "Name contains" });
    fireEvent.change(search, { target: { value: " fire " } });
    fireEvent.blur(search);

    await waitFor(() =>
      expect(server.page()?.blocks).toEqual([
        {
          kind: "list",
          source: "spells",
          filter: { prepared: true, levels: [0, 3], search: "fire" },
        },
      ]),
    );

    pick("List", "Inventory");
    await waitFor(() =>
      expect(server.page()?.blocks).toEqual([
        { kind: "list", source: "inventory", filter: { search: "fire" } },
      ]),
    );
    expect(screen.getByRole("checkbox", { name: "Equipped only" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Prepared only" })).not.toBeInTheDocument();
  });

  it("undoes a retitle made after an undo apart from the retitle before it", async () => {
    const server = stubServer([grapple([])]);
    await renderEditor();
    const title = screen.getByRole("textbox", { name: "Page title" });
    const retitle = async (value: string) => {
      fireEvent.change(title, { target: { value } });
      fireEvent.blur(title);
      await waitFor(() => expect(server.page()?.title).toBe(value));
    };

    await retitle("Grappling");
    fireEvent.click(screen.getByRole("button", { name: "Add block" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add Text" }));
    await waitFor(() => expect(server.page()?.blocks).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Undo page change" }));
    await waitFor(() => expect(server.page()?.blocks).toEqual([]));
    await retitle("Holds");

    fireEvent.click(screen.getByRole("button", { name: "Undo page change" }));
    await waitFor(() => expect(server.page()?.title).toBe("Grappling"));
  });

  it("undoes each change in turn, a burst of typing as one", async () => {
    const server = stubServer([grapple([{ kind: "text", text: "Grab." }])]);
    await renderEditor();
    const undo = screen.getByRole("button", { name: "Undo page change" });
    expect(undo).toHaveAttribute("aria-disabled", "true");

    const text = screen.getByRole("textbox", { name: "Text" });
    fireEvent.change(text, { target: { value: "Grab them" } });
    fireEvent.blur(text);
    await waitFor(() => expect(server.puts).toHaveLength(1));
    fireEvent.change(text, { target: { value: "Grab them hard." } });
    fireEvent.blur(text);
    await waitFor(() => expect(server.puts).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Remove Text" }));
    await waitFor(() => expect(server.page()?.blocks).toEqual([]));

    fireEvent.click(undo);
    await waitFor(() =>
      expect(server.page()?.blocks).toEqual([{ kind: "text", text: "Grab them hard." }]),
    );
    expect(announced()).toHaveTextContent("Undid the last page change.");

    fireEvent.click(screen.getByRole("button", { name: "Undo page change" }));
    await waitFor(() => expect(server.page()?.blocks).toEqual([{ kind: "text", text: "Grab." }]));
    expect(screen.getByRole("button", { name: "Undo page change" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
