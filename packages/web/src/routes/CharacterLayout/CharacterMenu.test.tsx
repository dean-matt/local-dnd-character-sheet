import { defaultCharacterState, PRESET_PAGES } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, presetPageRecords } from "../../test/records.ts";
import { CharacterMenu } from "./CharacterMenu.tsx";

function exportResponse(status: number) {
  return status === 500
    ? new Response(JSON.stringify({ error: "characters.db is locked" }), { status })
    : new Response(JSON.stringify(characterFile()), { status: 200 });
}

function stubFetch(status: number) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      return status === 201
        ? new Response(JSON.stringify(characterRecord("2", "Vex (copy)")), { status })
        : new Response(JSON.stringify({ error: "disk full" }), { status });
    }
    if (init?.method === "DELETE") {
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify({ error: "Could not back up characters.db" }), { status });
    }
    if (String(input) === "/api/characters/1/export") return exportResponse(status);
    return String(input) === "/api/characters/1/pages"
      ? new Response(JSON.stringify(presetPageRecords()), { status: 200 })
      : new Response(JSON.stringify({ error: "nothing here" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const characterFile = () => ({
  format: "local-dnd-character-sheet/character",
  version: 1,
  definition: characterRecord("1", "Vex").definition,
  state: defaultCharacterState(),
  pages: PRESET_PAGES,
});

const deletes = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Character menu" }));

function openDelete() {
  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete character" }));
}

function renderMenu(name = "Vex") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["characters"], [characterRecord("1", name)]);
  const router = createMemoryRouter(
    [
      {
        path: "/characters/:id",
        element: <CharacterMenu character={characterRecord("1", name)} />,
      },
      { path: "/characters/2", element: <p>copy</p> },
      { path: "/characters", element: <p>list</p> },
    ],
    { initialEntries: ["/characters/1"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterMenu", () => {
  it("holds Duplicate, Export and Delete, moves between them by arrow key, and closes on Escape", () => {
    stubFetch(204);
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Character menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    openMenu();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const [duplicate, exportItem, remove] = screen.getAllByRole("menuitem");
    expect(duplicate).toHaveTextContent("Duplicate character");
    expect(exportItem).toHaveTextContent("Export character");
    expect(remove).toHaveTextContent("Delete character");
    expect(duplicate).toHaveFocus();
    fireEvent.keyDown(duplicate as HTMLElement, { key: "ArrowDown" });
    expect(exportItem).toHaveFocus();
    fireEvent.keyDown(exportItem as HTMLElement, { key: "ArrowDown" });
    expect(remove).toHaveFocus();
    fireEvent.keyDown(remove as HTMLElement, { key: "ArrowDown" });
    expect(duplicate).toHaveFocus();
    fireEvent.keyDown(duplicate as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("reaches the last item by ArrowUp and End, the first by Home, and closes when focus leaves", () => {
    stubFetch(204);
    renderMenu();
    openMenu();
    const items = screen.getAllByRole("menuitem");
    const [duplicate, remove] = [items[0], items.at(-1)];

    fireEvent.keyDown(duplicate as HTMLElement, { key: "ArrowUp" });
    expect(remove).toHaveFocus();
    fireEvent.keyDown(remove as HTMLElement, { key: "Home" });
    expect(duplicate).toHaveFocus();
    fireEvent.keyDown(duplicate as HTMLElement, { key: "End" });
    expect(remove).toHaveFocus();
    fireEvent.blur(remove as HTMLElement, { relatedTarget: document.body });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("duplicates the character, then opens the copy", async () => {
    const fetchMock = stubFetch(201);
    const { router, queryClient } = renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate character" }));

    await screen.findByText("copy");
    expect(router.state.location.pathname).toBe("/characters/2");
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts.map(([input]) => String(input))).toEqual(["/api/characters/1/duplicate"]);
    expect(queryClient.getQueryData(["characters", "2"])).toMatchObject({ name: "Vex (copy)" });
  });

  it("stays on the character and says why when the duplicate fails", async () => {
    stubFetch(500);
    const { router } = renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate character" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate failed: disk full");
    expect(router.state.location.pathname).toBe("/characters/1");

    openMenu();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("downloads the character's file, named for the character", async () => {
    const fetchMock = stubFetch(204);
    const createObjectURL = vi.fn((_blob: Blob) => "blob:vex");
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = createObjectURL;
        static override revokeObjectURL = vi.fn();
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export character" }));

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("Vex.json");
    expect(link.href).toBe("blob:vex");
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(characterFile());
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      "/api/characters/1/export",
    );
    click.mockRestore();
  });

  it("stays on the character and says why when the export fails", async () => {
    stubFetch(500);
    const { router } = renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export character" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Export failed: characters.db is locked",
    );
    expect(router.state.location.pathname).toBe("/characters/1");
  });

  it("names what goes with the character and that undo cannot bring it back", async () => {
    stubFetch(204);
    renderMenu();

    openDelete();

    const dialog = screen.getByRole("dialog", { name: "Delete Vex?" });
    expect(dialog).toHaveTextContent(/its play state, .*its roll log and its undo history/);
    expect(dialog).toHaveTextContent("Undo cannot bring it back");
    expect(dialog).toHaveTextContent("data/backups/");
    await waitFor(() =>
      expect(dialog).toHaveTextContent(`all ${presetPageRecords().length} of its pages`),
    );
  });

  it("deletes nothing until the name is typed back", () => {
    const fetchMock = stubFetch(204);
    renderMenu();
    openDelete();

    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirm);
    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Ve" } });
    fireEvent.click(confirm);

    expect(deletes(fetchMock)).toHaveLength(0);
  });

  it("asks for a whitespace name to be typed too, rather than taking an empty field", () => {
    stubFetch(204);
    renderMenu("  ");
    openDelete();

    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("aria-disabled", "true");
  });

  it("deletes once the name matches, then leaves for the list without the character", async () => {
    const fetchMock = stubFetch(204);
    const { router, queryClient } = renderMenu();
    openDelete();

    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Vex" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await screen.findByText("list");
    expect(router.state.location.pathname).toBe("/characters");
    expect(deletes(fetchMock)).toHaveLength(1);
    expect(String(deletes(fetchMock)[0]?.[0])).toBe("/api/characters/1");
    expect(queryClient.getQueryData(["characters"])).toEqual([]);
  });

  it("stays open and says why when the delete fails", async () => {
    stubFetch(500);
    const { router } = renderMenu();
    openDelete();

    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Vex" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Delete failed: Could not back up characters.db",
    );
    expect(screen.getByLabelText("Type Vex to confirm")).toHaveAttribute("aria-invalid", "false");
    expect(router.state.location.pathname).toBe("/characters/1");
  });
});
