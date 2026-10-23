import { randomUUID } from "node:crypto";
import { homebrewSkillInputSchema, homebrewSkillRecordSchema } from "@dnd/catalog";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { homebrewSkills } from "../db/homebrew.ts";
import { type CharactersDb, charactersReferencingHomebrewSkill } from "../db/queries/characters.ts";
import {
  deleteHomebrewSkill,
  getHomebrewSkill,
  type HomebrewDb,
  insertHomebrewSkill,
  itemsAdvantagedOnSkill,
  listHomebrewSkills,
  updateHomebrewSkill,
} from "../db/queries/homebrew.ts";
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
    409: nameTaken("homebrew skill"),
  },
});

const updateSkill = createRoute({
  method: "put",
  path: "/homebrew/skills/{id}",
  tags: ["homebrew"],
  summary: "Replace a homebrew skill",
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
            nameTaken("homebrew skill").content["application/json"].schema,
            skillReferenced.content["application/json"].schema,
          ]),
        },
      },
    },
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

export function homebrewSkillsRoutes(db: HomebrewDb, charactersDb: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(listSkills, (c) => c.json(listHomebrewSkills(db).map(toSkillRecord)));

  routes.openapi(readSkill, (c) => {
    const row = getHomebrewSkill(db, c.req.valid("param").id);
    if (!row) return c.json({ error: SKILL_NOT_FOUND }, 404);
    return c.json(toSkillRecord(row), 200);
  });

  routes.openapi(createSkill, (c) => {
    const input = c.req.valid("json");
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
    if (current && (current.name !== input.name || current.edition !== input.edition)) {
      const characters = charactersReferencingHomebrewSkill(charactersDb, current);
      const items = itemsAdvantagedOnSkill(db, current);
      if (characters.length + items.length > 0)
        return c.json(skillReferencedError("changed", characters, items), 409);
    }
    const result = claimName(
      () => updateHomebrewSkill(db, id, input),
      holder(db, homebrewSkills, input),
    );
    if ("taken" in result) return c.json(nameTakenError("homebrew skill", result.taken), 409);
    if (!result.row) return c.json({ error: SKILL_NOT_FOUND }, 404);
    return c.json(toSkillRecord(result.row), 200);
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
