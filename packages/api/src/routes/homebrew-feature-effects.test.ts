import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTestDatabases } from "../db/testDatabases.ts";
import { homebrewFeatureEffectsRoutes } from "./homebrew-feature-effects.ts";
import { json } from "./homebrewFixtures.ts";

const effect = (overrides: Record<string, unknown> = {}) => ({
  name: "Second Wind",
  source: "PHB",
  mechanics: [{ kind: "uses", count: 2, reset: "short" }],
  ...overrides,
});

describe("homebrewFeatureEffectsRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof homebrewFeatureEffectsRoutes>;

  beforeEach(() => {
    opened = openTestDatabases();
    routes = homebrewFeatureEffectsRoutes(opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  const create = async (body = effect()) =>
    (await routes.request("/homebrew/feature-effects", json(body))).json();
  const put = (id: string, body: unknown) =>
    routes.request(`/homebrew/feature-effects/${id}`, { ...json(body), method: "PUT" });

  it("creates, reads, lists, updates and deletes an effect keyed on name and source", async () => {
    expect(await (await routes.request("/homebrew/feature-effects")).json()).toEqual([]);

    const res = await routes.request("/homebrew/feature-effects", json(effect()));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject(effect());

    expect(await (await routes.request(`/homebrew/feature-effects/${created.id}`)).json()).toEqual(
      created,
    );
    expect(await (await routes.request("/homebrew/feature-effects")).json()).toEqual([created]);

    const mechanics = [{ kind: "uses", count: 3, reset: "long" }];
    const updated = await put(created.id, effect({ mechanics }));
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: created.id, mechanics });
  });

  it("refuses mechanics the sheet cannot apply, naming the problem", async () => {
    const res = await routes.request(
      "/homebrew/feature-effects",
      json(effect({ mechanics: [{ kind: "nonsense" }] })),
    );
    expect(res.status).toBe(400);
    const empty = await routes.request(
      "/homebrew/feature-effects",
      json(effect({ mechanics: [] })),
    );
    expect(empty.status).toBe(400);
    expect(await (await routes.request("/homebrew/feature-effects")).json()).toEqual([]);
  });

  it("refuses a second effect for the same feature, answering with the first", async () => {
    const first = await create();
    const res = await routes.request("/homebrew/feature-effects", json(effect()));
    expect(res.status).toBe(409);
    expect((await res.json()).existing.id).toBe(first.id);

    const other = await create(effect({ source: "XGE" }));
    const move = await put(other.id, effect());
    expect(move.status).toBe(409);
  });

  it("answers 404 for an id it does not hold", async () => {
    expect((await routes.request("/homebrew/feature-effects/nope")).status).toBe(404);
    expect((await put("nope", effect())).status).toBe(404);
    expect(
      (await routes.request("/homebrew/feature-effects/nope", { method: "DELETE" })).status,
    ).toBe(404);
  });

  it("deletes the row", async () => {
    const created = await create();
    const res = await routes.request(`/homebrew/feature-effects/${created.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(await (await routes.request("/homebrew/feature-effects")).json()).toEqual([]);
    expect(
      opened.homebrewDb.$client.prepare("select count(*) as n from homebrew_feature_effects").get(),
    ).toEqual({ n: 0 });
    await create();
  });
});
