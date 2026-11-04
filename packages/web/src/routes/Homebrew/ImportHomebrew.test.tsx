import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomebrewKindPage } from "./HomebrewKindPage.tsx";
import { HomebrewLayout } from "./HomebrewLayout.tsx";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function stubApi(imported: Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/homebrew/import") return imported;
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

function pick(contents: string, name = "homebrew.json") {
  fireEvent.change(screen.getByLabelText("Homebrew file"), {
    target: { files: [new File([contents], name, { type: "application/json" })] },
  });
}

const listCalls = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.filter(([url]) => String(url) === "/api/homebrew/items").length;

describe("ImportHomebrew", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends the picked file, says how many entries it created and refreshes the list", async () => {
    const fetchMock = stubApi(json(201, { created: 3 }));
    renderPage();
    await waitFor(() => expect(listCalls(fetchMock)).toBe(1));

    pick('{"format":"local-dnd-character-sheet/homebrew"}');

    expect(await screen.findByText("Imported 3 entries from homebrew.json.")).toHaveRole("status");
    const post = fetchMock.mock.calls.find(([url]) => String(url) === "/api/homebrew/import");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      format: "local-dnd-character-sheet/homebrew",
    });
    await waitFor(() => expect(listCalls(fetchMock)).toBe(2));
  });

  it("keeps an import's guard and result across a change of kind", async () => {
    let respond = (_: Response) => {};
    stubApi(new Promise<Response>((resolve) => (respond = resolve)));
    renderPage();

    pick("{}");
    expect(await screen.findByRole("button", { name: "Importing…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(screen.getByRole("link", { name: "Feats" }));
    await screen.findByRole("region", { name: "Feats" });

    const openPicker = vi.spyOn(HTMLInputElement.prototype, "click");
    fireEvent.click(screen.getByRole("button", { name: "Importing…" }));
    expect(openPicker).not.toHaveBeenCalled();
    openPicker.mockRestore();
    respond(json(201, { created: 2 }));

    expect(await screen.findByText("Imported 2 entries from homebrew.json.")).toHaveRole("status");
  });

  it("says why the API refused the file", async () => {
    stubApi(json(409, { error: 'The item "Sunblade" cannot be imported.' }));
    renderPage();

    pick("{}");

    expect(
      await screen.findByText('Import failed: The item "Sunblade" cannot be imported.'),
    ).toHaveRole("alert");
    expect(screen.queryByText(/^Imported/)).not.toBeInTheDocument();
  });

  it("refuses a file that is not JSON without asking the API", async () => {
    const fetchMock = stubApi(json(500, {}));
    renderPage();

    pick("not json", "notes.txt");

    expect(await screen.findByText("Import failed: notes.txt is not a JSON file.")).toHaveRole(
      "alert",
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/homebrew/import")).toBe(
      false,
    );
  });
});
