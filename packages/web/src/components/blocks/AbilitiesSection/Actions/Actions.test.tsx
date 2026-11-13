import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../../../test/records.ts";
import { stubFetchByUrl } from "../../../../test/stubFetch.ts";
import { Actions } from "./Actions.tsx";

function renderActions(edition: "classic" | "one") {
  const base: CharacterRecord = characterRecord("1", "Vex");
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Actions definition={{ ...base.definition, edition }} />
    </QueryClientProvider>,
  );
  return screen.getByRole("region", { name: "Actions" });
}

const names = (group: HTMLElement) =>
  within(group)
    .getAllByRole("button")
    .map((b) => b.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("Actions", () => {
  it("groups the standard actions by the kind of action they take", () => {
    stubFetchByUrl({});
    const card = renderActions("one");

    const groups = within(card)
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(groups).toEqual(["action", "bonus action", "reaction", "free"]);
    const action = within(card).getByRole("heading", { name: "action" }).nextElementSibling;
    expect(names(action as HTMLElement)).toContain("Dash");
    expect(names(action as HTMLElement)).toContain("Utilize");
    const reaction = within(card).getByRole("heading", { name: "reaction" }).nextElementSibling;
    expect(names(reaction as HTMLElement)).toEqual(["Opportunity Attack"]);
  });

  it("lists the actions of the character's edition", () => {
    stubFetchByUrl({});
    const classic = renderActions("classic");
    expect(within(classic).getByRole("button", { name: "Use an Object" })).toBeInTheDocument();
    expect(within(classic).queryByRole("button", { name: "Utilize" })).toBeNull();
  });

  it("opens an action's rules text from a button the keyboard reaches", async () => {
    const fetchMock = stubFetchByUrl({
      "/api/refs/resolve": {
        refs: [{ name: "Dash", source: "XPHB", entries: ["Gain extra Speed."] }],
      },
    });
    const card = renderActions("one");
    const dash = within(card).getByRole("button", { name: "Dash" });
    expect(dash.tagName).toBe("BUTTON");
    fireEvent.click(dash);

    expect(await screen.findByText("Gain extra Speed.")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).refs).toEqual([
      { tag: "action", name: "Dash", source: "XPHB" },
    ]);
  });
});
