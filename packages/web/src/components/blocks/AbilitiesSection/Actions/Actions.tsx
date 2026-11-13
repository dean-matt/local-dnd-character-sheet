import type { CharacterDefinition } from "@dnd/character";
import { Card } from "../../../Card.tsx";
import { DetailTrigger } from "../../../DetailTrigger.tsx";
import { ActionRules } from "./ActionRules.tsx";
import { ACTION_TYPES, STANDARD_ACTIONS } from "./standardActions.ts";

/**
 * The Actions card: the standard actions the character's edition prints, grouped by the kind of
 * action each takes. A name is a button that opens the catalog's rules text for it.
 */
export function Actions({ definition }: { definition: CharacterDefinition }) {
  const actions = STANDARD_ACTIONS[definition.edition];
  return (
    <Card title="Actions">
      <div className="flex flex-col gap-2">
        {ACTION_TYPES.map((type) => {
          const group = actions.filter((action) => action.type === type);
          if (group.length === 0) return null;
          return (
            <div key={type}>
              <h4 className="font-semibold text-label text-muted capitalize">{type}</h4>
              <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-body">
                {group.map(({ name, source }) => (
                  <li key={name}>
                    <DetailTrigger
                      title={name}
                      meta={type}
                      detail={<ActionRules name={name} source={source} />}
                      className="hover:underline"
                    >
                      {name}
                    </DetailTrigger>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
