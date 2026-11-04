import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomebrewKindPage } from "./HomebrewKindPage.tsx";
import { HomebrewLayout } from "./HomebrewLayout.tsx";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

const sunblade = {
  id: "i1",
  name: "Sunblade",
  edition: "one",
  type: "M",
  rarity: "rare",
  requiresAttunement: false,
  json: { name: "Sunblade", source: "HB", type: "M", rarity: "rare" },
  createdAt: CREATED_AT,
};

const hearthkeeper = {
  id: "s1",
  name: "Hearthkeeper",
  edition: "one",
  className: "Warden",
  classSource: "HB",
  classId: "c1",
  json: {
    name: "Hearthkeeper",
    source: "HB",
    shortName: "Hearthkeeper",
    className: "Warden",
    classSource: "HB",
  },
  createdAt: CREATED_AT,
};

const file = {
  format: "local-dnd-character-sheet/homebrew",
  version: 1,
  entries: [
    { collection: "items", id: "i1", input: { name: "Sunblade", edition: "one" } },
    {
      collection: "classes",
      id: "c1",
      input: { name: "Warden", edition: "one" },
      features: [],
      resources: [],
    },
    {
      collection: "subclasses",
      id: "s1",
      input: { name: "Hearthkeeper", parent: { classId: "c1" } },
    },
  ],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function stubApi(exported: Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/homebrew/export") return (await exported).clone();
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    if (url === "/api/homebrew/items") return json(200, [sunblade]);
    if (url === "/api/homebrew/subclasses") return json(200, [hearthkeeper]);
    if (url === "/api/homebrew/history") return json(200, { reversible: [], deleted: [] });
    return json(init?.method ? 404 : 200, []);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/homebrew/items"]}>
        <Routes>
          <Route path="/homebrew" element={<HomebrewLayout />}>
            <Route path=":kind" element={<HomebrewKindPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const choose = async (name: string) =>
  fireEvent.click(await screen.findByRole("checkbox", { name: `Select ${name} for export` }));

describe("the Homebrew page's export", () => {
  let click: ReturnType<typeof vi.spyOn>;
  const createObjectURL = vi.fn((_blob: Blob) => "blob:homebrew");

  beforeEach(() => {
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = createObjectURL;
        static override revokeObjectURL = vi.fn();
      },
    );
    click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    click.mockRestore();
    createObjectURL.mockClear();
    vi.unstubAllGlobals();
  });

  it("exports entries chosen on two tabs as one file, and names the parent it added", async () => {
    const fetchMock = stubApi(json(200, file));
    renderPage();

    await choose("Sunblade");
    fireEvent.click(screen.getByRole("link", { name: "Subclasses" }));
    await choose("Hearthkeeper");
    fireEvent.click(screen.getByRole("button", { name: "Export, 2 selected" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Exported 3 entries to homebrew.json. Also added Warden (class), which a chosen entry needs as a parent.",
        ),
      ).toHaveRole("status"),
    );
    expect(click).toHaveBeenCalledOnce();
    const post = fetchMock.mock.calls.find(([url]) => String(url) === "/api/homebrew/export");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      entries: [
        { collection: "items", id: "i1" },
        { collection: "subclasses", id: "s1" },
      ],
    });
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("homebrew.json");
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(file);
    expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the choice and says why when the export fails", async () => {
    stubApi(json(500, { error: "disk full" }));
    renderPage();

    await choose("Sunblade");
    fireEvent.click(screen.getByRole("button", { name: "Export, 1 selected" }));

    expect(await screen.findByText("Export failed: disk full")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export, 1 selected" })).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();

    await choose("Sunblade");
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("keeps an entry chosen while the export was pending", async () => {
    let resolve = (_res: Response) => {};
    stubApi(new Promise<Response>((settle) => (resolve = settle)));
    renderPage();

    await choose("Sunblade");
    fireEvent.click(screen.getByRole("button", { name: "Export, 1 selected" }));
    await screen.findByRole("button", { name: "Exporting…, 1 selected" });
    fireEvent.click(screen.getByRole("link", { name: "Subclasses" }));
    await choose("Hearthkeeper");
    resolve(json(200, { ...file, entries: [file.entries[0]] }));

    await waitFor(() =>
      expect(screen.getByText("Exported 1 entry to homebrew.json.")).toHaveRole("status"),
    );
    expect(screen.getByRole("button", { name: "Export, 1 selected" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Hearthkeeper for export" })).toBeChecked();
  });

  it("drops an entry from the choice once it is deleted", async () => {
    stubApi(json(200, file));
    renderPage();

    await choose("Sunblade");
    fireEvent.click(screen.getByRole("button", { name: "Delete Sunblade" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
  });

  it("puts Import and Export on the left of the row Add ends", async () => {
    stubApi(json(200, file));
    renderPage();

    const add = await screen.findByRole("button", { name: "Add item" });
    const row = [...(add.parentElement?.children ?? [])].filter(
      (el) => el.tagName === "BUTTON" && !el.hasAttribute("aria-hidden"),
    );
    expect(row.map((button) => button.textContent)).toEqual(["Import", "Export", "Add item"]);
    expect(add).toHaveClass("ml-auto");
  });

  it("holds Export until an entry is chosen, and offers Clear only while one is", async () => {
    const fetchMock = stubApi(json(200, file));
    renderPage();

    const idle = await screen.findByRole("button", { name: "Export" });
    expect(idle).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    const reserved = [...(idle.parentElement?.children ?? [])].find(
      (el) => el.textContent === "Clear",
    );
    expect(reserved).toHaveClass("invisible");
    expect(reserved).toHaveAttribute("inert");
    fireEvent.click(idle);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/homebrew/export")).toBe(
      false,
    );

    expect(idle).toHaveTextContent(/^Export$/);
    await choose("Sunblade");
    const chosen = screen.getByRole("button", { name: "Export, 1 selected" });
    expect(chosen).not.toHaveAttribute("aria-disabled");
    expect(chosen).toHaveTextContent(/^Export1$/);
    expect(within(chosen).getByText("1")).toHaveClass("absolute", "rounded-full", "bg-accent");
    expect(screen.queryByText(/selected/)).toBeNull();
    const clear = screen.getByRole("button", { name: "Clear" });
    const add = screen.getByRole("button", { name: "Add item" });
    expect([...clear.classList].sort()).toEqual(
      [...add.classList].filter((name) => name !== "ml-auto").sort(),
    );
    fireEvent.click(clear);

    expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("sets each entry's checkbox outside its card, to the left", async () => {
    stubApi(json(200, file));
    renderPage();

    const checkbox = await screen.findByRole("checkbox", { name: "Select Sunblade for export" });
    const row = checkbox.closest("li") as HTMLElement;
    const [outside, card] = [...row.children] as HTMLElement[];
    expect(outside).toContainElement(checkbox);
    expect(card).toContainElement(within(row).getByRole("button", { name: "Sunblade" }));
    expect(card).not.toContainElement(checkbox);
  });
});
