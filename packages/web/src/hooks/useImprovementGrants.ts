import type { CharacterDefinition } from "@dnd/character";
import { type ImprovementGrant, improvementGrants } from "../lib/improvementGrants.ts";
import { useClassFeatures } from "./useClassFeatures.ts";

type Level = CharacterDefinition["levels"][number];

/**
 * Every improvement `levels` reaches, read off each catalog class's features and its
 * subclass's at its level. `read` holds once every class's features have loaded, a failed
 * read excepted, since reading it as no improvement would take back the choices made
 * there. A homebrew class carries no features, so it grants none.
 */
export function useImprovementGrants(levels: readonly Level[]): {
  grants: ImprovementGrant[];
  read: boolean;
} {
  const { featuresOf, read } = useClassFeatures(levels);
  return {
    grants: improvementGrants(levels, (cls) => {
      const features = featuresOf(cls);
      return [...features.class, ...features.subclass];
    }),
    read,
  };
}
