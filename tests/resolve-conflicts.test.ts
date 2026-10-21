import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { capture } from "../scripts/capture.mjs";
import { resolveConflicts, resolveRows } from "../scripts/resolve-conflicts.mjs";

const TABLE = `# Project

## Further reading

| Document | What it covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | How the packages fit |
`;

const ROW_MAIN = "| [docs/items.md](docs/items.md) | Items and their variants |\n";
const ROW_BRANCH = "| [docs/reviving.md](docs/reviving.md) | Returning after a gap |\n";

/**
 * Two branches cut from one commit, each changing `file` its own way, with the branch
 * checked out and `main` merged into it. The merge is left conflicted.
 */
function conflicted(file: string, start: string, onMain: string, onBranch: string) {
  const dir = mkdtempSync(join(tmpdir(), "resolve-conflicts-"));
  const git = (...args: string[]) =>
    capture("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir });
  const write = (text: string) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
    git("add", file);
    git("commit", "-qm", text.length.toString());
  };
  git("init", "-q", "-b", "main");
  write(start);
  git("checkout", "-qb", "docs/1-reviving");
  write(onBranch);
  git("checkout", "-q", "main");
  write(onMain);
  git("checkout", "-q", "docs/1-reviving");
  expect(() => git("merge", "-q", "--no-edit", "main")).toThrow();
  return { dir, git };
}

describe("resolveConflicts", () => {
  it("takes both rows where two branches each add one to a README table", () => {
    const { dir, git } = conflicted("README.md", TABLE, TABLE + ROW_MAIN, TABLE + ROW_BRANCH);
    try {
      expect(resolveConflicts("12", dir)).toBeNull();
      expect(readFileSync(join(dir, "README.md"), "utf8")).toBe(TABLE + ROW_MAIN + ROW_BRANCH);
      expect(git("diff", "--name-only", "--diff-filter=U")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hands an edited row to the author with the hunk quoted and the base named", () => {
    const edited = (what: string) => TABLE.replace("How the packages fit", what);
    const { dir, git } = conflicted(
      "README.md",
      TABLE,
      edited("Package graph"),
      edited("Where code goes"),
    );
    try {
      const report = resolveConflicts("12", dir) ?? "";
      expect(report).toContain(`#12 conflicts with main at ${git("rev-parse", "main").trim()}`);
      expect(report).toContain("README.md — the author of #12");
      expect(report).toContain("| Package graph |");
      expect(report).toContain("| Where code goes |");
      expect(git("diff", "--name-only", "--diff-filter=U")).toBe("README.md\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hands a fenced file to the repo owner though its conflict is only added rows", () => {
    const file = ".claude/skills/table.md";
    const { dir } = conflicted(file, TABLE, TABLE + ROW_MAIN, TABLE + ROW_BRANCH);
    try {
      expect(resolveConflicts("12", dir)).toContain(`${file} — the repo owner (fenced path)`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("resolveRows", () => {
  const hunk = (ours: string, base: string, theirs: string) =>
    `<<<<<<< HEAD\n${ours}||||||| base\n${base}=======\n${theirs}>>>>>>> main\n`;

  it("keeps a row both sides added once", () => {
    expect(resolveRows(hunk(ROW_MAIN + ROW_BRANCH, "", ROW_MAIN)).text).toBe(ROW_MAIN + ROW_BRANCH);
  });

  it("leaves prose, and a side that removed its rows, as conflicts", () => {
    expect(resolveRows(hunk("A sentence.\n", "", ROW_MAIN)).unresolved).toHaveLength(1);
    expect(resolveRows(hunk("", "", ROW_MAIN)).unresolved).toHaveLength(1);
  });
});
