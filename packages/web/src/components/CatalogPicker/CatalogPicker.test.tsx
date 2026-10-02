import type { SearchHit } from "@dnd/catalog";
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetch } from "../../test/stubFetch.ts";
import { CatalogPicker } from "./CatalogPicker.tsx";

const FIREBALL: SearchHit = { type: "spell", name: "Fireball", source: "PHB", edition: "classic" };
const FIRE_BOLT: SearchHit = {
  type: "spell",
  name: "Fire Bolt",
  source: "PHB",
  edition: "classic",
};
const EMBERLASH: SearchHit = { type: "spell", id: "7", name: "Emberlash", edition: "classic" };

function page(items: SearchHit[], total = items.length) {
  return new Response(JSON.stringify({ items, total, limit: 20, offset: 0 }), { status: 200 });
}

function renderPicker(props: Partial<Parameters<typeof CatalogPicker>[0]> = {}) {
  const onPick = vi.fn();
  renderWithClient(
    <CatalogPicker label="Spell" edition="classic" type="spell" onPick={onPick} {...props} />,
  );
  return { onPick, input: screen.getByRole("combobox", { name: "Spell" }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CatalogPicker", () => {
  it("searches only the kind the caller names, bounded", async () => {
    const fetchMock = stubFetch(page([FIREBALL]));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "fire" } });

    expect(await screen.findByRole("option", { name: /Fireball/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search?edition=classic&q=fire&limit=20&type=spell",
      undefined,
    );
  });

  it("fetches nothing for a blank query", () => {
    const fetchMock = stubFetch(page([]));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "   " } });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("marks a homebrew row as homebrew and a catalog row with its source", async () => {
    stubFetch(page([EMBERLASH, FIREBALL]));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "e" } });

    const homebrew = await screen.findByRole("option", { name: /Emberlash/ });
    expect(within(homebrew).getByText("Homebrew")).toBeInTheDocument();
    const catalog = screen.getByRole("option", { name: /Fireball/ });
    expect(within(catalog).getByText("PHB")).toBeInTheDocument();
    expect(within(catalog).queryByText("Homebrew")).not.toBeInTheDocument();
  });

  it("shows the bound when the search matched more than it lists", async () => {
    stubFetch(page([FIREBALL, FIRE_BOLT], 312));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "fire" } });

    expect(
      await screen.findByText("Showing 2 of 312 matches — keep typing to narrow"),
    ).toBeInTheDocument();
  });

  it("says when nothing matched", async () => {
    stubFetch(page([]));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "zzz" } });

    expect(await screen.findByText("No matches")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("arrows through the options, announcing the active one, and picks a reference", async () => {
    stubFetch(page([FIREBALL, EMBERLASH]));
    const { input, onPick } = renderPicker();

    fireEvent.change(input, { target: { value: "e" } });
    await screen.findByRole("option", { name: /Fireball/ });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const first = screen.getByRole("option", { name: /Fireball/ });
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
    expect(first).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith({ name: "Fireball", source: "PHB" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("wraps the arrows and picks a homebrew row by its id", async () => {
    stubFetch(page([FIREBALL, EMBERLASH]));
    const { input, onPick } = renderPicker();

    fireEvent.change(input, { target: { value: "e" } });
    await screen.findByRole("option", { name: /Emberlash/ });

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onPick).toHaveBeenCalledWith({ homebrewId: "7" });
  });

  it("picks on click", async () => {
    stubFetch(page([FIREBALL]));
    const { input, onPick } = renderPicker();

    fireEvent.change(input, { target: { value: "fire" } });
    fireEvent.click(await screen.findByRole("option", { name: /Fireball/ }));

    expect(onPick).toHaveBeenCalledWith({ name: "Fireball", source: "PHB" });
  });

  it("offers an unavailable row with its reason and refuses to pick it", async () => {
    stubFetch(page([FIREBALL, FIRE_BOLT]));
    const { input, onPick } = renderPicker({
      unavailableReason: (hit) =>
        hit.name === "Fireball" ? "3rd level — a level 3 bard casts up to 2nd" : undefined,
    });

    fireEvent.change(input, { target: { value: "fire" } });
    const fireball = await screen.findByRole("option", { name: /Fireball/ });
    expect(fireball).toHaveAttribute("aria-disabled", "true");
    expect(within(fireball).getByText("3rd level — a level 3 bard casts up to 2nd")).toBeVisible();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(fireball);
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith({ name: "Fire Bolt", source: "PHB" });
  });

  it("closes on Escape, then clears the query on a second", async () => {
    stubFetch(page([FIREBALL]));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "fire" } });
    await screen.findByRole("option", { name: /Fireball/ });

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("fire");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("closes when focus leaves the input", async () => {
    stubFetch(page([FIREBALL]));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "fire" } });
    await screen.findByRole("option", { name: /Fireball/ });
    fireEvent.blur(input);

    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("reports a failed search", async () => {
    stubFetch(new Response(JSON.stringify({ error: "q is too long" }), { status: 400 }));
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: "fire" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Search failed: q is too long");
  });
});
