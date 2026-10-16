import { weaponTraitSchema } from "@dnd/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseWeaponField } from "./BaseWeaponField.tsx";

const row = (name: string, source: string) => ({
  name,
  source,
  edition: "one",
  kind: "baseitem",
  type: "M|XPHB",
  rarity: "none",
  requiresAttunement: false,
  json: { name, source, weaponCategory: "martial", dmg1: "1d8" },
});

const CATALOG = [row("Longsword", "XPHB"), row("Musket", "XDMG")];

function stubApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    String(input) === "/api/items?edition=one&baseWeapons=true&limit=200"
      ? new Response(JSON.stringify({ items: CATALOG, total: CATALOG.length }))
      : new Response(JSON.stringify({ error: "nothing here" }), { status: 404 }),
  );
  vi.stubGlobal("fetch", fetchMock);
}

function renderField(initial: string) {
  const writes: (string | undefined)[] = [];
  function Holder() {
    const [current, setCurrent] = useState(initial);
    return (
      <BaseWeaponField
        current={current}
        edition="one"
        error={undefined}
        onChange={(next) => {
          writes.push(next);
          setCurrent(next ?? "");
        }}
      />
    );
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>,
  );
  return writes;
}

const field = () => screen.getByRole("combobox", { name: "Base weapon" });

/** Waits for the catalog list to reach the datalist, so a typed name has rows to match. */
const loaded = () =>
  waitFor(() => expect(document.querySelectorAll("datalist option")).toHaveLength(2));

describe("BaseWeaponField", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes a picked weapon as the catalog spells it, a uid proficiency and mastery resolve", async () => {
    stubApi();
    const writes = renderField("");
    await loaded();

    fireEvent.change(field(), { target: { value: "longsword" } });

    expect(writes).toEqual(["Longsword|XPHB"]);
    const written = writes[0] ?? "";
    const trait = weaponTraitSchema.parse({ weaponCategory: "martial", baseItem: written });
    const target = CATALOG.find((weapon) => weapon.name === trait?.baseName);
    expect(`${target?.name}|${target?.source}`.toLowerCase()).toBe(written.toLowerCase());
  });

  it("writes nothing for text that names no base weapon, marks it, and shows the saved value on leaving", async () => {
    stubApi();
    const writes = renderField("longsword|xphb");
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
    const writes = renderField("longsword|phb");
    await loaded();

    expect(field()).toHaveValue("longsword|phb");
    expect(screen.getByRole("alert")).toHaveTextContent("Not found among the 2024 base weapons");
    expect(writes).toEqual([]);
  });

  it("removes the baseItem when the field is cleared", async () => {
    stubApi();
    const writes = renderField("Musket|XDMG");
    await loaded();

    fireEvent.change(field(), { target: { value: "" } });

    expect(writes).toEqual([undefined]);
  });
});
