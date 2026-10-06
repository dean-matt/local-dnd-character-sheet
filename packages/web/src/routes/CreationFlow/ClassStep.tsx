import { ClassField } from "./ClassField.tsx";
import { ClassGrantsSummary } from "./ClassGrantsSummary.tsx";
import { HitPointsField } from "./HitPointsField.tsx";
import { LevelField } from "./LevelField.tsx";
import { SubclassField } from "./SubclassField.tsx";
import { useClassCatalog } from "./useClassCatalog.ts";

/** What the character does: class, level and subclass on the left, hit points on the right. */
export function ClassStep() {
  const { cls } = useClassCatalog();
  return (
    <div className="grid gap-7 sm:grid-cols-2">
      <div className="flex flex-col gap-4">
        <ClassField />
        {cls && (
          <>
            <LevelField />
            <SubclassField />
            <ClassGrantsSummary />
          </>
        )}
      </div>
      <HitPointsField />
    </div>
  );
}
