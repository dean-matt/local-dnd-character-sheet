import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Fence for .github/workflows/. An action's ref decides the code CI runs, and for
 * crate-ci/typos it decides the binary the entrypoint downloads, so a moving ref
 * lets an upstream push turn every pull request red. The comment beside the pin
 * asks for the version; this asserts it.
 *
 * Parses each workflow rather than matching its text: a `uses:` inside a comment
 * or a run block is not a step, and a regex cannot tell the difference.
 */
const VERSION_TAG = /^v\d+(\.\d+)*$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const EXACT_VERSION = /^v\d+\.\d+\.\d+$/;

const WORKFLOWS = join(ROOT, ".github/workflows");

type Workflow = { jobs?: Record<string, { steps?: { uses?: string }[] }> };

/**
 * Every published action a job step runs, paired with the ref it names. A `./`
 * path is this repository's own code, which no upstream push can change.
 */
function actionRefs(workflow: string): { uses: string; ref: string }[] {
  const parsed = parse(read(`.github/workflows/${workflow}`)) as Workflow;
  return Object.values(parsed.jobs ?? {}).flatMap((job) =>
    (job.steps ?? [])
      .map((step) => step.uses)
      .filter((uses) => uses !== undefined)
      .filter((uses) => !uses.startsWith("./"))
      .map((uses) => ({ uses, ref: uses.slice(uses.lastIndexOf("@") + 1) })),
  );
}

const workflows = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

describe(".github/workflows/", () => {
  it("is not empty", () => {
    expect(workflows.length).toBeGreaterThan(0);
  });

  it.each(workflows)("%s names a version tag or a commit SHA on every action", (workflow) => {
    const moving = actionRefs(workflow).filter(
      ({ ref }) => !VERSION_TAG.test(ref) && !COMMIT_SHA.test(ref),
    );
    expect(
      moving.map(({ uses }) => uses),
      "a branch ref lets an upstream push decide what CI runs",
    ).toEqual([]);
  });

  it("pins crate-ci/typos to an exact version", () => {
    const typos = workflows
      .flatMap(actionRefs)
      .filter(({ uses }) => uses.startsWith("crate-ci/typos@"));

    expect(typos).toHaveLength(1);
    const ref = typos[0]?.ref ?? "";
    expect(
      EXACT_VERSION.test(ref) || COMMIT_SHA.test(ref),
      `crate-ci/typos names ${ref} — a major tag moves onto a release whose assets may not exist yet`,
    ).toBe(true);
  });
});
