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

/** Waits for the catalog list to reach the datalist, so a typed name has rows to match. */
const loaded = () =>
  waitFor(() => expect(document.querySelectorAll("datalist option")).toHaveLength(2));

describe("BaseWeaponField", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes a picked weapon as the catalog spells it, a uid that proficiency and mastery resolve", async () => {
    stubApi();
    const { writes } = renderField("");
    await loaded();

    fireEvent.change(field(), { target: { value: "longsword" } });

    expect(writes).toEqual(["Longsword|XPHB"]);
    const trait = weaponTraitSchema.parse({ weaponCategory: "martial", baseItem: writes[0] });
    expect(trait?.baseName?.toLowerCase()).toBe("longsword");
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
    expect(field()).not.toHaveAttribute("readonly");
    fireEvent.change(field(), { target: { value: "" } });
    expect(writes).toEqual([undefined]);
  });

  it("is read-only and says so until the list loads", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderField("");

    expect(field()).toHaveAttribute("readonly");
    expect(screen.getByText("Loading the 2024 base weapons…")).toBeInTheDocument();
  });

  it("marks typed text only once no base weapon's name starts with it", async () => {
    stubApi();
    renderField("");
    await loaded();

    fireEvent.change(field(), { target: { value: "Long" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(field(), { target: { value: "Longx" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Pick one of the 2024 base weapons");
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
    expect(field()).toHaveValue("Longsword|XPHB");
    expect(writes).toEqual([]);
  });

  it("writes nothing for text that names no base weapon, marks it, and shows the saved value on leaving", async () => {
    stubApi();
    const { writes } = renderField("longsword|xphb");
    await loaded();
    expect(field()).toHaveValue("Longsword");

    fireEvent.change(field(), { target: { value: "Longswrod" } });

    expect(writes).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent("Pick one of the 2024 base weapons");
    fireEvent.blur(field());
    expect(field()).toHaveValue("Longsword");
  });

  it("shows a baseItem no base weapon of the edition matches as written, marked, without writing it", async () => {
    stubApi();
    const { writes } = renderField("longsword|phb");
    await loaded();

    expect(field()).toHaveValue("longsword|phb");
    expect(screen.getByRole("alert")).toHaveTextContent("Not found among the 2024 base weapons");
    expect(writes).toEqual([]);
  });

  it("removes the baseItem when the field is cleared", async () => {
    stubApi();
    const { writes } = renderField("Musket|XDMG");
    await loaded();

    fireEvent.change(field(), { target: { value: "" } });

    expect(writes).toEqual([undefined]);
  });
});
