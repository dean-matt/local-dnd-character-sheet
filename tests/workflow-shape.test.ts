import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
 * A major tag moves across releases as well, and is taken anyway: repointing `v5`
 * is what the ecosystem publishes against, and Dependabot reads a tag as readily
 * as a SHA. The exact pin is reserved for the ref that picks a binary.
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
      "a branch ref runs whatever upstream last pushed there",
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

type CiJob = {
  name?: string;
  needs?: string[];
  if?: string;
  strategy?: { matrix?: { shard?: number[] | string } };
  steps?: { id?: string; run?: string }[];
};

/**
 * The ruleset requires `check (<os>)` by name, so each must wait on every job that runs
 * for that OS, and report when one fails rather than skip, which reads as green.
 */
describe("ci.yml", () => {
  const jobs = (parse(read(".github/workflows/ci.yml")) as { jobs: Record<string, CiJob> }).jobs;

  it.each(["ubuntu-latest", "windows-latest"])("check (%s) stands for its shards", (os) => {
    const check = Object.values(jobs).find((j) => j.name === `check (${os})`);
    const shards = Object.entries(jobs)
      .filter(([, j]) => j.name?.startsWith(`test (${os},`))
      .map(([id]) => id);
    expect(shards).toHaveLength(1);
    expect(check?.needs).toEqual(expect.arrayContaining(shards));
    expect(check?.if).toBe("always()");
  });

  it("gates the OS-independent steps under check (ubuntu-latest)", () => {
    expect(jobs["check-ubuntu"]?.needs).toContain("static");
  });

  it("numbers each OS's shards 1 to n", () => {
    for (const [id, job] of Object.entries(jobs).filter(([id]) => id.startsWith("test-"))) {
      const shards = job.strategy?.matrix?.shard;
      if (typeof shards === "string") continue;
      expect(shards, id).toEqual((shards ?? []).map((_, i) => i + 1));
      expect(shards?.length, id).toBeGreaterThan(0);
    }
  });

  it("plans the Windows shards 1 to n, within the cap, from the plan job", () => {
    expect(jobs["test-windows"]?.needs).toContain("plan-windows");
    expect(jobs["test-windows"]?.strategy?.matrix?.shard).toBe(
      `\${{ fromJSON(needs.plan-windows.outputs.shards) }}`,
    );
    const run = jobs["plan-windows"]?.steps?.find((s) => s.id === "plan")?.run ?? "";
    const out = join(mkdtempSync(join(tmpdir(), "plan-")), "output");
    execFileSync("bash", ["-c", run], { cwd: ROOT, env: { ...process.env, GITHUB_OUTPUT: out } });
    const shards = JSON.parse(readFileSync(out, "utf8").replace("shards=", "")) as number[];
    expect(shards).toEqual(shards.map((_, i) => i + 1));
    expect(shards.length).toBeGreaterThanOrEqual(2);
    expect(shards.length).toBeLessThanOrEqual(16);
  });
});
