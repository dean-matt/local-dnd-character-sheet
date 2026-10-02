import { existsSync, globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import {
  isArrowFunction,
  isCallExpression,
  isExportAssignment,
  isExportDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isJsxOpeningLikeElement,
  isNamedExports,
  isVariableDeclaration,
  isVariableStatement,
  ModifierFlags,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { API } from "typescript/unstable/sync";
import { afterAll, describe, expect, it } from "vitest";
import { ROOT } from "./lib/doc-helpers.ts";

/**
 * Fences `docs/code-organization.md`'s one-thing-per-file rules over `packages/web/src`. A
 * `.tsx` file holds at most one component, is named after it, and exports nothing but it
 * and its props type, because Vite's Fast Refresh hot-swaps only a file whose exports are
 * all components. A file under `hooks/` exports at most one hook. A component folder —
 * `X/` holding `X.tsx` — is entered from outside only through `X.tsx`, and no `index`
 * barrel stands in for it. No `.tsx` file draws its own `<svg>`: icons come from
 * `lucide-react`, so none drifts from the set the mockup draws. One concept per `lib/` file
 * is a judgment no parser makes, so review holds that one.
 *
 * A component is a PascalCase function, or a PascalCase const bound to a function, at any
 * depth and through any wrapping call, so one declared inside another or wrapped in `memo`
 * or `forwardRef` still counts. The files are read with the TypeScript compiler, never a
 * regex, which a component spread over lines or nested in a body slips past.
 */
const WEB = join(ROOT, "packages/web");
const PASCAL = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/;
const HOOK = /^use[A-Z]/;

const api = new API({ cwd: ROOT });
afterAll(() => api.close());

function sourceFiles(tsconfig: string, files: string[]): Map<string, SourceFile> {
  const project = api.updateSnapshot({ openProjects: [tsconfig] }).getProject(tsconfig);
  if (!project) throw new Error(`No project opened at ${tsconfig}`);
  return new Map(
    files.map((file) => {
      const source = project.program.getSourceFile(file);
      if (!source) throw new Error(`${file} is outside ${tsconfig}`);
      return [file, source];
    }),
  );
}

function unwrapCalls(node: Node | undefined): Node | undefined {
  let inner = node;
  while (inner && isCallExpression(inner)) inner = inner.arguments[0];
  return inner;
}

const isFunction = (node: Node | undefined) =>
  node !== undefined && (isArrowFunction(node) || isFunctionExpression(node));

function components(source: SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: Node): void => {
    if (isFunctionDeclaration(node) && node.name && PASCAL.test(node.name.text)) {
      found.push(node.name.text);
    }
    if (
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      PASCAL.test(node.name.text) &&
      isFunction(unwrapCalls(node.initializer))
    ) {
      found.push(node.name.text);
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
}

const nameOf = (node: Node): string => {
  const { name } = node as { name?: Node };
  return name && isIdentifier(name) ? name.text : "default";
};

function exportedNames(source: SourceFile): string[] {
  return source.statements.flatMap((statement): string[] => {
    if (isExportAssignment(statement)) return ["default"];
    if (isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      return clause && isNamedExports(clause) ? clause.elements.map(nameOf) : ["*"];
    }
    const { modifierFlags = ModifierFlags.None } = statement as { modifierFlags?: ModifierFlags };
    if (!(modifierFlags & ModifierFlags.Export)) return [];
    if (isVariableStatement(statement)) return statement.declarationList.declarations.map(nameOf);
    return [nameOf(statement)];
  });
}

/** Each component folder holding `target`, outermost first, up to `root`. */
function foldersAround(target: string, root: string): string[] {
  const folders: string[] = [];
  for (let dir = dirname(target); dir.startsWith(root + sep); dir = dirname(dir)) {
    if (existsSync(join(dir, `${basename(dir)}.tsx`))) folders.unshift(dir);
  }
  return folders;
}

/** The private files of a component folder `file` reaches into from outside it. */
function privateImports(file: string, source: SourceFile, root: string): string[] {
  return source.imports.flatMap((node) => {
    const { text } = node as { text?: string };
    if (!text?.startsWith(".")) return [];
    const target = resolve(dirname(file), text);
    return foldersAround(target, root)
      .filter((dir) => !file.startsWith(dir + sep) && target !== join(dir, `${basename(dir)}.tsx`))
      .map((dir) => `imports ${text}, private to ${relative(root, dir).replaceAll("\\", "/")}/`);
  });
}

function componentFaults(file: string, source: SourceFile, exported: string[]): string[] {
  const found: string[] = [];
  const defined = components(source);
  if (defined.length > 1) found.push(`defines ${defined.length} components: ${defined.join(", ")}`);
  const [component] = defined;
  if (component === undefined) return found;
  if (basename(file, ".tsx") !== component) found.push(`is not named after ${component}`);
  const extra = exported.filter((name) => name !== component && name !== `${component}Props`);
  if (extra.length > 0) found.push(`exports more than ${component}: ${extra.join(", ")}`);
  return found;
}

function drawsSvg(source: SourceFile): boolean {
  const visit = (node: Node): boolean =>
    (isJsxOpeningLikeElement(node) && isIdentifier(node.tagName) && node.tagName.text === "svg") ||
    node.forEachChild(visit) === true;
  return visit(source);
}

/** Every way `file` breaks the rules above, worded for a failing test. */
function faults(file: string, source: SourceFile, root: string): string[] {
  const found = privateImports(file, source, root);
  if (/^index\.tsx?$/.test(basename(file))) found.push("is an index barrel");
  if (/\.test\.tsx?$/.test(file)) return found;
  const exported = exportedNames(source);
  if (file.endsWith(".tsx")) {
    found.push(...componentFaults(file, source, exported));
    if (drawsSvg(source)) found.push("draws an <svg> rather than a lucide-react icon");
  }
  if (/[\\/]hooks[\\/]/.test(file)) {
    const hooks = exported.filter((name) => HOOK.test(name));
    if (hooks.length > 1) found.push(`exports ${hooks.length} hooks: ${hooks.join(", ")}`);
  }
  return found;
}

describe("packages/web/src", () => {
  const files = globSync("src/**/*.{ts,tsx}", { cwd: WEB }).map((file) => join(WEB, file));
  const sources = sourceFiles(join(WEB, "tsconfig.json"), files);

  it.each(files.map((file) => [file.slice(WEB.length + 1).replaceAll("\\", "/"), file]))(
    "%s holds one thing",
    (_, file) => {
      expect(faults(file, sources.get(file) as SourceFile, join(WEB, "src"))).toEqual([]);
    },
  );
});

describe("the shape check", () => {
  const dir = mkdtempSync(join(tmpdir(), "web-file-shape-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const cases: Record<string, string> = {
    "Nested.tsx":
      "export function Nested() { function Inner() { return <i />; } return <Inner />; }",
    "Wrapped.tsx": [
      'import { forwardRef, memo } from "react";',
      "export const Wrapped = memo(() => <b />);",
      "const Ref = memo(forwardRef<HTMLElement>((_, ref) => <i ref={ref} />));",
      "void Ref;",
    ].join("\n"),
    "Renamed.tsx": "export function Other() { return <b />; }",
    "Extra.tsx":
      "export const LABEL = 'x'; export type ExtraProps = {}; export function Extra() { return <b />; }",
    "hooks/useTwo.ts": "export function useOne() {} export function useTwo() {}",
    "Folder/Folder.tsx":
      'import { Part } from "./Part.tsx"; export function Folder() { return <Part />; }',
    "Folder/Part.tsx": "export function Part() { return <b />; }",
    "Outside.tsx": [
      'import { Folder } from "./Folder/Folder.tsx";',
      'import { Part } from "./Folder/Part.tsx";',
      "export function Outside() { return <Folder><Part /></Folder>; }",
    ].join("\n"),
    "index.ts": 'export { Folder } from "./Folder/Folder.tsx";',
    "Drawn.tsx": [
      "export function Drawn() {",
      '  return <span title="<svg>"><svg viewBox="0 0 24 24"><path d="M0 0" /></svg></span>;',
      "}",
    ].join("\n"),
    "Named.tsx": 'export function Named() { return <span title="<svg>" />; }',
  };
  mkdirSync(join(dir, "hooks"));
  mkdirSync(join(dir, "Folder"));
  for (const [file, text] of Object.entries(cases)) writeFileSync(join(dir, file), text);
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { jsx: "preserve", noEmit: true }, include: ["**/*"] }),
  );
  const paths = Object.keys(cases).map((file) => join(dir, file));
  const sources = sourceFiles(join(dir, "tsconfig.json"), paths);
  const faultsOf = (file: string) =>
    faults(join(dir, file), sources.get(join(dir, file)) as SourceFile, dir);

  it("counts a component declared inside another", () => {
    expect(faultsOf("Nested.tsx")).toEqual(["defines 2 components: Nested, Inner"]);
  });

  it("counts a component wrapped in memo or forwardRef", () => {
    expect(faultsOf("Wrapped.tsx")).toEqual(["defines 2 components: Wrapped, Ref"]);
  });

  it("names a file that does not match its component", () => {
    expect(faultsOf("Renamed.tsx")).toEqual(["is not named after Other"]);
  });

  it("allows the props type and rejects any other export", () => {
    expect(faultsOf("Extra.tsx")).toEqual(["exports more than Extra: LABEL"]);
  });

  it("counts the hooks a file under hooks/ exports", () => {
    expect(faultsOf("hooks/useTwo.ts")).toEqual(["exports 2 hooks: useOne, useTwo"]);
  });

  it("rejects a private file of a component folder imported from outside it", () => {
    expect(faultsOf("Outside.tsx")).toEqual(["imports ./Folder/Part.tsx, private to Folder/"]);
    expect(faultsOf("Folder/Folder.tsx")).toEqual([]);
  });

  it("rejects a hand-drawn <svg> and passes the text <svg>", () => {
    expect(faultsOf("Drawn.tsx")).toEqual(["draws an <svg> rather than a lucide-react icon"]);
    expect(faultsOf("Named.tsx")).toEqual([]);
  });

  it("rejects an index barrel", () => {
    expect(faultsOf("index.ts")).toEqual(["is an index barrel"]);
  });
});
