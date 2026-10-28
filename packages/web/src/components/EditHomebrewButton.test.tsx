import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogDetail } from "./CatalogDetail.tsx";
import { ResolvedRefs } from "./resolvedRefsContext.ts";

const SHEET = "/characters/1/p/sheet";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

const lantern = {
  id: "hb-item",
  name: "Lucky Lantern",
  edition: "one",
  type: "G",
  rarity: null,
  requiresAttunement: false,
  json: { name: "Lucky Lantern", source: "HB", type: "G", entries: ["It glows."] },
  createdAt: CREATED_AT,
};

const nova = {
  id: "hb-spell",
  name: "Frost Nova",
  edition: "one",
  level: 2,
  school: "V",
  concentration: false,
  ritual: false,
  json: {
    name: "Frost Nova",
    source: "HB",
    level: 2,
    school: "V",
    time: [{ number: 1, unit: "action" }],
    range: { type: "point", distance: { type: "self" } },
    components: { v: true },
    duration: [{ type: "instant" }],
    entries: ["Ice spreads, as a {@spell shield} would."],
  },
  createdAt: CREATED_AT,
};

const option = (id: string, name: string) => ({
  id,
  name,
  edition: "one",
  json: { name, source: "HB", entries: [`${name} text.`] },
  createdAt: CREATED_AT,
});

const SHIELD = {
  name: "Shield",
  source: "PHB",
  entries: ["A barrier."],
  path: "/spells/Shield/PHB",
};

type Answer = { status: number; body?: unknown };
const json = ({ status, body }: Answer) => new Response(JSON.stringify(body ?? {}), { status });

/**
 * A fake API: each `GET` in `rows` answers with its body, a `PUT` under `/api/homebrew` takes
 * the next of `puts` and, where it succeeds, becomes the row its next read returns.
 */
function stubApi(rows: Record<string, Answer | "pending">, puts: Answer[] = []) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/refs/resolve") {
      const { refs } = JSON.parse(String(init?.body)) as { refs: { name: string }[] };
      return json({
        status: 200,
        body: { refs: refs.map((ref) => (ref.name === "shield" ? SHIELD : null)) },
      });
    }
    if (init?.method === "PUT" && url.startsWith("/api/homebrew")) {
      const answer = puts.shift() ?? { status: 500, body: { error: "no answer" } };
      const current = rows[url];
      if (answer.status === 200 && current && current !== "pending") {
        const input = JSON.parse(String(init.body));
        const body = {
          ...(current.body as object),
          name: input.name,
          json: { ...input, source: "HB" },
        };
        rows[url] = { status: 200, body };
        return json({ status: 200, body });
      }
      return json(answer);
    }
    const row = rows[url];
    if (row === "pending") return new Promise<Response>(() => {});
    return json(row ?? { status: 404, body: { error: `nothing at ${url}` } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDetail(address: string, at = SHEET) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        {/* As a feature's text holds it: inside a block whose map knows none of the row's references. */}
        <ResolvedRefs value={new Map()}>
          <CatalogDetail address={address} onClose={onClose} />
        </ResolvedRefs>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

const dialogs = () => [...document.querySelectorAll<HTMLElement>("dialog[open]")];
const detail = () => dialogs()[0] as HTMLElement;
const editor = () => {
  const open = dialogs();
  if (open.length < 2) throw new Error("the editor is not open");
  return open[1] as HTMLElement;
};
const findEdit = () => within(detail()).findByRole("button", { name: "Edit" });
async function openEditor() {
  const edit = await findEdit();
  edit.focus();
  fireEvent.click(edit);
  await waitFor(() => editor());
  return edit;
}
const nameField = () => within(editor()).getByLabelText("Name", { selector: "input" });
const titleOf = (dialog: HTMLElement) =>
  document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EditHomebrewButton", () => {
  it.each([
    ["item", "/homebrew/items/hb-item", lantern],
    ["spell", "/homebrew/spells/hb-spell", nova],
  ])(
    "shows Edit on a homebrew %s's detail on a sheet, left of Add to…",
    async (_, address, row) => {
      stubApi({ [`/api${address}`]: { status: 200, body: row } });
      renderDetail(address);

      const edit = await findEdit();
      const add = within(detail()).getByRole("button", { name: /^Add to/ });
      expect(edit.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

  it.each([
    [
      "/items/Lantern/PHB",
      "/api/items/Lantern/PHB",
      { ...lantern, id: undefined, source: "PHB", kind: "item" },
    ],
    [
      "/spells/Shield/PHB",
      "/api/spells/Shield/PHB",
      { ...nova, id: undefined, name: "Shield", source: "PHB" },
    ],
  ])(
    "shows no Edit on the catalog row at %s",
    async (address, url, { id: _id, createdAt: _at, ...row }) => {
      stubApi({ [url]: { status: 200, body: row } });
      renderDetail(address);

      await within(detail()).findByRole("button", { name: /^Add to/ });
      expect(within(detail()).queryByRole("button", { name: "Edit" })).toBeNull();
    },
  );

  it.each([
    ["races", option("hb-race", "Tidekin")],
    ["backgrounds", option("hb-bg", "Wrecker")],
    [
      "classes",
      {
        ...option("hb-class", "Tidecaller"),
        hitDie: 8,
        json: { name: "Tidecaller", source: "HB", hd: { number: 1, faces: 8 } },
      },
    ],
  ])("shows no Edit, and no footer, on a homebrew row of %s", async (collection, row) => {
    stubApi({ [`/api/homebrew/${collection}/${row.id}`]: { status: 200, body: row } });
    renderDetail(`/homebrew/${collection}/${row.id}`);

    await waitFor(() => expect(titleOf(detail())).toBe(row.name));
    expect(within(detail()).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(detail().querySelector(":scope > .border-t")).toBeNull();
  });

  it("shows Add to… and no Edit on a homebrew feat", async () => {
    const row = option("hb-feat", "Sea Legs");
    stubApi({ "/api/homebrew/feats/hb-feat": { status: 200, body: row } });
    renderDetail("/homebrew/feats/hb-feat");

    await within(detail()).findByRole("button", { name: /^Add to/ });
    expect(within(detail()).queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it.each(["/search?for=1", "/characters/1/settings", "/search"])(
    "shows no Edit on a homebrew item's detail at %s",
    async (at) => {
      stubApi({ "/api/homebrew/items/hb-item": { status: 200, body: lantern } });
      renderDetail("/homebrew/items/hb-item", at);

      await waitFor(() => expect(titleOf(detail())).toBe("Lucky Lantern"));
      expect(within(detail()).queryByRole("button", { name: "Edit" })).toBeNull();
    },
  );

  it.each([
    ["pending", "pending" as const, "Loading…"],
    ["404", { status: 404, body: { error: "gone" } }, "Not found"],
    ["500", { status: 500, body: { error: "broken" } }, "Could not load"],
  ])("shows no Edit while the read is %s", async (_, answer, title) => {
    // A 5xx is retried with a backoff before it surfaces.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubApi({ "/api/homebrew/items/hb-item": answer });
    renderDetail("/homebrew/items/hb-item");

    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(titleOf(detail())).toBe(title));
    expect(within(detail()).queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens the Settings editor on the stored spell over the detail, saying the change reaches every holder", async () => {
    const fetchMock = stubApi({ "/api/homebrew/spells/hb-spell": { status: 200, body: nova } });
    renderDetail("/homebrew/spells/hb-spell");

    await openEditor();
    expect(titleOf(editor())).toBe("Edit Frost Nova");
    expect(detail()).toBeInTheDocument();
    expect(nameField()).toHaveValue("Frost Nova");
    expect(editor()).toHaveTextContent(
      "Changes to this spell apply to every character that holds it, not only this one.",
    );
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/homebrew/spells");
  });

  it("says the same of an item", async () => {
    stubApi({ "/api/homebrew/items/hb-item": { status: 200, body: lantern } });
    renderDetail("/homebrew/items/hb-item");

    await openEditor();
    expect(editor()).toHaveTextContent(
      "Changes to this item apply to every character that holds it, not only this one.",
    );
  });

  it("resolves the row's own references in the preview, not by the sheet's map", async () => {
    stubApi({ "/api/homebrew/spells/hb-spell": { status: 200, body: nova } });
    renderDetail("/homebrew/spells/hb-spell");

    await openEditor();
    fireEvent.click(within(editor()).getByRole("tab", { name: "Preview" }));
    expect(await within(editor()).findByRole("button", { name: "shield" })).toBeInTheDocument();
  });

  it("saves a rename in place, shows it in the detail, and puts focus back on Edit", async () => {
    const fetchMock = stubApi({ "/api/homebrew/items/hb-item": { status: 200, body: lantern } }, [
      { status: 200 },
    ]);
    renderDetail("/homebrew/items/hb-item");

    await openEditor();
    fireEvent.change(nameField(), { target: { value: "Cursed Lantern" } });
    fireEvent.click(within(editor()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(dialogs()).toHaveLength(1));
    const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts.map(([url]) => String(url))).toEqual(["/api/homebrew/items/hb-item"]);
    expect(JSON.parse(String(puts[0]?.[1]?.body))).toMatchObject({ name: "Cursed Lantern" });
    await waitFor(() => expect(titleOf(detail())).toBe("Cursed Lantern"));
    await waitFor(() =>
      expect(within(detail()).getByRole("button", { name: "Edit" })).toHaveFocus(),
    );
  });

  it("keeps the editor open with the edit and the failure where the save fails", async () => {
    stubApi({ "/api/homebrew/items/hb-item": { status: 200, body: lantern } }, [
      { status: 500, body: { error: "disk full" } },
    ]);
    renderDetail("/homebrew/items/hb-item");

    await openEditor();
    fireEvent.change(nameField(), { target: { value: "Cursed Lantern" } });
    fireEvent.click(within(editor()).getByRole("button", { name: "Save" }));

    expect(await within(editor()).findByText(/^Save failed: /)).toBeInTheDocument();
    expect(nameField()).toHaveValue("Cursed Lantern");
  });

  it.each([
    ["Cancel", () => fireEvent.click(within(editor()).getByRole("button", { name: "Cancel" }))],
    ["Escape", () => fireEvent(editor(), new Event("cancel", { cancelable: true }))],
    [
      "a backdrop click",
      () => {
        fireEvent.pointerDown(editor());
        fireEvent.click(editor());
      },
    ],
  ])("closes the editor alone on %s, with focus back on Edit", async (_, close) => {
    const onClose = stubAndRender();

    const edit = await openEditor();
    close();

    expect(dialogs()).toHaveLength(1);
    await waitFor(() => expect(edit).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();

    fireEvent(detail(), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("asks before discarding an edit, and stays open where the answer is no", async () => {
    stubAndRender();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const edit = await openEditor();
    fireEvent.change(nameField(), { target: { value: "Cursed Lantern" } });
    fireEvent.click(within(editor()).getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(nameField()).toHaveValue("Cursed Lantern");

    confirm.mockReturnValue(true);
    fireEvent.click(within(editor()).getByRole("button", { name: "Cancel" }));
    expect(dialogs()).toHaveLength(1);
    await waitFor(() => expect(edit).toHaveFocus());
  });
});

function stubAndRender() {
  stubApi({ "/api/homebrew/items/hb-item": { status: 200, body: lantern } });
  return renderDetail("/homebrew/items/hb-item");
}
