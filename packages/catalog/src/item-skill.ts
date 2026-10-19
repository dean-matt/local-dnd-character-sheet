import { z } from "zod";
import { grantedSchema } from "./proficiency-grants.ts";

/**
 * The skills an item grants its wearer, lowercased: `skillProficiencies` as a race or a
 * background states it, and `expertise` as a feat does. Expertise lands only on a skill the
 * wearer is proficient in, so an item that names a skill under both grants proficiency, and
 * expertise where something else already did. A potion's grant lasts as long as the drink,
 * so a potion grants nothing. `undefined` for a row that grants no skill.
 */
export const itemSkillGrantsSchema = z
  .looseObject({
    type: z.string().optional().catch(undefined),
    skillProficiencies: grantedSchema,
    expertise: grantedSchema,
  })
  .transform(({ type, skillProficiencies, expertise }) =>
    type?.split("|")[0] === "P" || skillProficiencies.length + expertise.length === 0
      ? undefined
      : { skills: skillProficiencies, expertise },
  );
