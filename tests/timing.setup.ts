import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { afterAll, beforeAll, expect } from "vitest";

type Timing = { open: number; fixture: number; rm: number; mkdtemp: number };
const g = globalThis as unknown as { __dbTiming: Timing; __fsTimed?: boolean };
g.__dbTiming = { open: 0, fixture: 0, rm: 0, mkdtemp: 0 };

if (!g.__fsTimed) {
  g.__fsTimed = true;
  const rm = fs.rmSync;
  const mk = fs.mkdtempSync;
  fs.rmSync = ((...a: Parameters<typeof rm>) => {
    const s = performance.now();
    try {
      return rm(...a);
    } finally {
      g.__dbTiming.rm += performance.now() - s;
    }
  }) as typeof rm;
  fs.mkdtempSync = ((...a: Parameters<typeof mk>) => {
    const s = performance.now();
    try {
      return mk(...(a as [string]));
    } finally {
      g.__dbTiming.mkdtemp += performance.now() - s;
    }
  }) as typeof mk;
  syncBuiltinESMExports();
}

let start = 0;
let file = "";
beforeAll(() => {
  g.__dbTiming = { open: 0, fixture: 0, rm: 0, mkdtemp: 0 };
  file = expect.getState().testPath ?? "";
  start = performance.now();
});
afterAll(() => {
  const out = process.env.TIMING_OUT;
  if (!out) return;
  fs.appendFileSync(
    out,
    `${JSON.stringify({ file, total: performance.now() - start, ...g.__dbTiming })}\n`,
  );
});
