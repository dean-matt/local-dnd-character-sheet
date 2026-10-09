import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
p.on("request", (r) => { const u = decodeURIComponent(r.url()); if (/search\?|\/items\//.test(u)) console.log("REQ", u.replace(/^https?:\/\/[^/]+/, "")); });
await p.goto("http://127.0.0.1:5173/characters/16bfad5a-dbd1-4f3e-a54e-c6c84b36138a");
await p.waitForTimeout(2000);
console.log("LINKS", (await p.getByRole("link").allTextContents()).slice(0,40).join(" | "));
const inv = p.getByRole("link", { name: /inventory/i }).first(); if (await inv.count()) { await inv.click(); await p.waitForTimeout(1500); }
const add = p.getByRole("combobox", { name: /add an item/i }).first();
console.log("add combobox", await add.count());
await add.fill("flame tongue"); await p.waitForTimeout(1500);
const opts = p.getByRole("option"); console.log("OPTS", (await opts.allTextContents()).join(" || "));
await opts.first().click(); await p.waitForTimeout(1000);
const base = p.getByRole("combobox", { name: /base item/i }).first();
await base.fill("maul"); await p.waitForTimeout(1500);
console.log("BASE OPTS", (await p.getByRole("option").allTextContents()).join(" || "));
await p.getByRole("option").first().click(); await p.waitForTimeout(2000);
console.log("BODY", (await p.locator("body").innerText()).match(/.{0,80}cannot take.{0,120}/s)?.[0]);
await b.close();
