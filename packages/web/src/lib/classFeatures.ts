import type { ClassFeatureRecord } from "@dnd/catalog";

/** A class's features and its subclass's, each at the class level it arrives. */
export type ClassFeatures = {
  class: readonly ClassFeatureRecord[];
  subclass: readonly ClassFeatureRecord[];
};
