import { weaponTraitSchema } from "@dnd/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseWeaponField } from "./BaseWeaponField.tsx";

const row = (name: string, source: string, edition = "one") => ({
  name,
  source,
  edition,
  kind: "baseitem",
  type: "M|XPHB",
  rarity: "none",
  requiresAttunement: false,
  json: { name, source, weaponCategory: "martial", dmg1: "1d8" },
});

const CATALOG = {
  one: [row("Longsword", "XPHB"), row("Musket", "XDMG")],
  classic: [row("Longsword", "PHB", "classic"), row("Musket", "DMG", "classic")],
};

function stubApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const edition = /^\/api\/items\?edition=(one|classic)&baseWeapons=true&limit=200$/.exec(
      String(input),
    )?.[1] as keyof typeof CATALOG | undefined;
    return edition
      ? new Response(JSON.stringify({ items: CATALOG[edition], total: 2 }))
      : new Response(JSON.stringify({ error: "nothing here" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

function renderField(initial: string) {
  const writes: (string | undefined)[] = [];
  function Holder({ edition }: { edition: "one" | "classic" }) {
    const [current, setCurrent] = useState(initial);
    return (
      <BaseWeaponField
        current={current}
        edition={edition}
        error={undefined}
        onChange={(next) => {
          writes.push(next);
          setCurrent(next ?? "");
        }}
      />
    );
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (edition: "one" | "classic") => (
    <QueryClientProvider client={client}>
      <Holder edition={edition} />
    </QueryClientProvider>
  );
  const { rerender } = render(tree("one"));
  return { writes, switchTo: (edition: "one" | "classic") => rerender(tree(edition)) };
}

const field = () => screen.getByRole("combobox", { name: "Base weapon" });

const pickOption = (name: string) => {
  fireEvent.click(field());
  fireEvent.click(screen.getByRole("option", { name }));
};

/** Waits for the catalog list to load, so the dropdown offers the weapons. */
const loaded = () => waitFor(() => expect(screen.queryByText(/^Loading the/)).toBeNull());

describe("BaseWeaponField", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes a picked weapon as the catalog spells it, a uid that proficiency and mastery resolve", async () => {
    stubApi();
    const { writes } = renderField("");
    await loaded();
    expect(field()).toHaveTextContent("Not stated");

    pickOption("Longsword");

    expect(writes).toEqual(["Longsword|XPHB"]);
    expect(field()).toHaveTextContent("Longsword");
    const trait = weaponTraitSchema.parse({ weaponCategory: "martial", baseItem: writes[0] });
    expect(trait?.baseName?.toLowerCase()).toBe("longsword");
  });

  it("jumps to a weapon by typing its name", async () => {
    stubApi();
    renderField("");
    await loaded();

    fireEvent.keyDown(field(), { key: "m" });
    expect(screen.getByRole("option", { name: "Musket" }).id).toBe(
      field().getAttribute("aria-activedescendant"),
    );
  });

  it("names a failed load and still lets the field be cleared", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "boom" }), { status: 404 })),
    );
    const { writes } = renderField("Longsword|XPHB");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The 2024 base weapons failed to load"),
    );
    pickOption("Not stated");
    expect(writes).toEqual([undefined]);
  });

  it("says so until the list loads", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderField("");

    expect(screen.getByText("Loading the 2024 base weapons…")).toBeInTheDocument();
  });

  it("flags a base weapon from the other edition once the item's edition changes", async () => {
    stubApi();
    const { writes, switchTo } = renderField("Longsword|XPHB");
    await loaded();
    expect(screen.queryByRole("alert")).toBeNull();

    switchTo("classic");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Not found among the 2014 base weapons"),
    );
    expect(field()).toHaveTextContent("Longsword|XPHB");
    expect(writes).toEqual([]);
  });

  it("offers a baseItem no base weapon of the edition matches as written, marked, without writing it", async () => {
    stubApi();
    const { writes } = renderField("longsword|phb");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Not found among the 2024 base weapons"),
    );

    expect(field()).toHaveTextContent("longsword|phb");
    fireEvent.click(field());
    expect(screen.getByRole("option", { name: "longsword|phb — not found" })).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("removes the baseItem when Not stated is picked", async () => {
    stubApi();
    const { writes } = renderField("Musket|XDMG");
    await loaded();

    pickOption("Not stated");

    expect(writes).toEqual([undefined]);
  });
});
