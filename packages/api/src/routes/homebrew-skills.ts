import { randomUUID } from "node:crypto";
import {
  type HomebrewSkillInput,
  homebrewSkillInputSchema,
  homebrewSkillRecordSchema,
} from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewSkills } from "../db/homebrew.ts";
import {
  type CharactersDb,
  charactersReferencingHomebrewSkill,
  resetHomebrewSkillValues,
} from "../db/queries/characters.ts";
import {
  deleteHomebrewSkill,
  getHomebrewSkill,
  type HomebrewDb,
  insertHomebrewSkill,
  itemsAdvantagedOnSkill,
  listHomebrewSkills,
  updateHomebrewSkill,
} from "../db/queries/homebrew.ts";
import { catalogSkillNames } from "../db/queries/skills.ts";
import { notFound } from "./errors.ts";
import {
  claimName,
  holder,
  idParam,
  nameTaken,
  nameTakenError,
  skillReferenced,
  skillReferencedError,
  toSkillRecord,
} from "./homebrew.ts";

const SKILL_NOT_FOUND = "No homebrew skill with that id";

const nameInUse = z.union([
  nameTaken("homebrew skill").content["application/json"].schema,
  z.object({ error: z.string() }),
]);

const skillNameConflict = {
  description: "A catalog skill or another homebrew skill of that edition has this name",
  content: { "application/json": { schema: nameInUse } },
};

const listSkills = createRoute({
  method: "get",
  path: "/homebrew/skills",
  tags: ["homebrew"],
  summary: "List every homebrew skill",
  responses: {
    200: {
      description: "Every homebrew skill",
      content: { "application/json": { schema: z.array(homebrewSkillRecordSchema) } },
    },
  },
});

const readSkill = createRoute({
  method: "get",
  path: "/homebrew/skills/{id}",
  tags: ["homebrew"],
  summary: "Read one homebrew skill",
  request: { params: idParam },
  responses: {
    200: {
      description: "The homebrew skill",
      content: { "application/json": { schema: homebrewSkillRecordSchema } },
    },
    404: notFound("homebrew skill"),
  },
});

const createSkill = createRoute({
  method: "post",
  path: "/homebrew/skills",
  tags: ["homebrew"],
  summary: "Create a homebrew skill",
  request: {
    body: { content: { "application/json": { schema: homebrewSkillInputSchema } } },
  },
  responses: {
    201: {
      description: "The created homebrew skill",
      content: { "application/json": { schema: homebrewSkillRecordSchema } },
    },
    409: skillNameConflict,
  },
});

const updateSkill = createRoute({
  method: "put",
  path: "/homebrew/skills/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew skill",
  description:
    "Switching a held skill between an ability and a flat bonus resets, on each character holding it, the flat number and any override of its modifier.",
  request: {
    params: idParam,
    body: { content: { "application/json": { schema: homebrewSkillInputSchema } } },
  },
  responses: {
    200: {
      description: "The updated homebrew skill",
      content: { "application/json": { schema: homebrewSkillRecordSchema } },
    },
    404: notFound("homebrew skill"),
    409: {
      description:
        "Another skill of that edition has this name, or a rename would orphan a citation",
      content: {
        "application/json": {
          schema: z.union([
            skillNameConflict.content["application/json"].schema,
            skillReferenced.content["application/json"].schema,
          ]),
        },
      },
    },
  },
});

const readHolders = createRoute({
  method: "get",
  path: "/homebrew/skills/{id}/holders",
  tags: ["homebrew"],
  summary: "List the characters that hold a homebrew skill",
  request: { params: idParam },
  responses: {
    200: {
      description: "Every character holding the skill, each with its id and name",
      content: {
        "application/json": { schema: z.array(z.object({ id: z.string(), name: z.string() })) },
      },
    },
    404: notFound("homebrew skill"),
  },
});

const removeSkill = createRoute({
  method: "delete",
  path: "/homebrew/skills/{id}",
  tags: ["homebrew"],
  summary: "Delete a homebrew skill",
  request: { params: idParam },
  responses: {
    204: { description: "The homebrew skill was deleted" },
    404: notFound("homebrew skill"),
    409: skillReferenced,
  },
});

const isFlat = (ability: string) => ability === "flat";

/** The catalog skill of `edition` named `name`, in the catalog's spelling, compared without regard to case. */
function catalogSkillNamed(dataDir: string, edition: Edition, name: string) {
  const wanted = name.toLowerCase();
  return catalogSkillNames(dataDir, edition).find((each) => each.toLowerCase() === wanted);
}

export function homebrewSkillsRoutes(db: HomebrewDb, charactersDb: CharactersDb, dataDir: string) {
  const routes = new OpenAPIHono();

  /** Why `input` may not replace `current`, if it may not: a taken name or a citation. */
  function updateRefusal(
    current: NonNullable<ReturnType<typeof getHomebrewSkill>>,
    input: HomebrewSkillInput,
  ) {
    if (current.name !== input.name || current.edition !== input.edition) {
      const catalog = catalogSkillNamed(dataDir, input.edition, input.name);
      if (catalog) return { error: `${catalog} is already a skill.` };
      const characters = charactersReferencingHomebrewSkill(charactersDb, current);
      const items = itemsAdvantagedOnSkill(db, current);
      if (characters.length + items.length > 0)
        return skillReferencedError("changed", characters, items);
    }
    return undefined;
  }

  routes.openapi(listSkills, (c) => c.json(listHomebrewSkills(db).map(toSkillRecord)));

  routes.openapi(readSkill, (c) => {
    const row = getHomebrewSkill(db, c.req.valid("param").id);
    if (!row) return c.json({ error: SKILL_NOT_FOUND }, 404);
    return c.json(toSkillRecord(row), 200);
  });

  routes.openapi(createSkill, (c) => {
    const input = c.req.valid("json");
    const catalog = catalogSkillNamed(dataDir, input.edition, input.name);
    if (catalog) return c.json({ error: `${catalog} is already a skill.` }, 409);
    const result = claimName(
      () => insertHomebrewSkill(db, randomUUID(), input),
      holder(db, homebrewSkills, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew skill", result.taken), 409);
    return c.json(toSkillRecord(result.row), 201);
  });

  routes.openapi(updateSkill, (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const current = getHomebrewSkill(db, id);
    const refusal = current && updateRefusal(current, input);
    if (refusal) return c.json(refusal, 409);
    // Before the update, since the two files cannot share a transaction: a reset that fails
    // leaves the skill as it was, and one that lands before an update that fails is harmless,
    // where the other order leaves some holders with values from the old form.
    if (current && isFlat(current.json.ability) !== isFlat(input.ability))
      resetHomebrewSkillValues(charactersDb, current, isFlat(input.ability));
    const result = claimName(
      () => updateHomebrewSkill(db, id, input),
      holder(db, homebrewSkills, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew skill", result.taken), 409);
    if (!result.row) return c.json({ error: SKILL_NOT_FOUND }, 404);
    return c.json(toSkillRecord(result.row), 200);
  });

  routes.openapi(readHolders, (c) => {
    const current = getHomebrewSkill(db, c.req.valid("param").id);
    if (!current) return c.json({ error: SKILL_NOT_FOUND }, 404);
    return c.json(charactersReferencingHomebrewSkill(charactersDb, current), 200);
  });

  routes.openapi(removeSkill, (c) => {
    const { id } = c.req.valid("param");
    const current = getHomebrewSkill(db, id);
    if (!current) return c.json({ error: SKILL_NOT_FOUND }, 404);
    const characters = charactersReferencingHomebrewSkill(charactersDb, current);
    const items = itemsAdvantagedOnSkill(db, current);
    if (characters.length + items.length > 0)
      return c.json(skillReferencedError("deleted", characters, items), 409);
    deleteHomebrewSkill(db, id);
    return c.body(null, 204);
  });

  return routes;
}
