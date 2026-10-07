import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useFormContext, useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { CreationGrants } from "./CreationGrants.tsx";
import { creationForm } from "./creationForm.ts";

const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const SAGE = {
  name: "Sage",
  source: "PHB",
  edition: "classic",
  json: { name: "Sage", source: "PHB", skillProficiencies: [{ arcana: true, history: true }] },
};
const skills = (source: string) =>
  ["Arcana", "History"].map((name) => ({ type: "skill", name, source, edition: null }));

function stubCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const edition = new URL(url, "http://local").searchParams.get("edition");
      const body = url.startsWith("/api/backgrounds?")
        ? page([SAGE])
        : url.startsWith("/api/search?")
          ? page(skills(edition === "one" ? "XPHB" : "PHB"))
          : undefined;
      return body === undefined
        ? new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

let values: Partial<CharacterDefinition> = {};

function Probe() {
  const { setValue } = useFormContext<CharacterDefinition>();
  values = useWatch<CharacterDefinition>() as Partial<CharacterDefinition>;
  return (
    <button type="button" onClick={() => setValue("edition", "one")}>
      2024
    </button>
  );
}

const sources = () => values.proficiencies?.skills.map((skill) => skill.ref.source);

describe("CreationGrants", () => {
  beforeEach(() => {
    localStorage.clear();
    stubCatalog();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lands a grant swap that changes only the rows its skills name", async () => {
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({ edition: "classic", background: { name: "Sage", source: "PHB" } }),
    );
    renderWithClient(
      <creationForm.FormShell onSubmit={() => {}}>
        {() => (
          <>
            <CreationGrants />
            <Probe />
          </>
        )}
      </creationForm.FormShell>,
    );
    await waitFor(() => expect(sources()).toEqual(["PHB", "PHB"]));

    fireEvent.click(screen.getByRole("button", { name: "2024" }));

    await waitFor(() => expect(sources()).toEqual(["XPHB", "XPHB"]));
  });
});
