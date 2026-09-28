import { readFileSync } from "node:fs";
import { relative } from "node:path";

const rows = readFileSync(process.argv[2], "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
const s = (ms) => `${(ms / 1000).toFixed(1)}s`;
const maxTest = rows.reduce((m, r) => (r.maxTest > m.maxTest ? r : m));
console.log(
  `slowest single test (with its beforeEach/afterEach) ${s(maxTest.maxTest)} in ${relative(process.cwd(), maxTest.file)}`,
);
const setup = (r) => r.open + r.fixture + r.rm + r.mkdtemp;
console.log(`files ${rows.length}`);
console.log(
  `summed file time ${s(sum("total"))}: openDatabases ${s(sum("open"))}, content fixtures ${s(sum("fixture"))}, rmSync ${s(sum("rm"))}, mkdtemp ${s(sum("mkdtemp"))}, rest ${s(sum("total") - rows.reduce((n, r) => n + setup(r), 0))}`,
);
for (const r of rows.sort((a, b) => b.total - a.total).slice(0, 25)) {
  console.log(
    `${s(r.total).padStart(7)} open ${s(r.open).padStart(6)} fixture ${s(r.fixture).padStart(6)} rm ${s(r.rm).padStart(6)} mkdtemp ${s(r.mkdtemp).padStart(6)} maxTest ${s(r.maxTest).padStart(6)}  ${relative(process.cwd(), r.file)}`,
  );
}
