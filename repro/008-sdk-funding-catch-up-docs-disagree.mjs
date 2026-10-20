// The SDK states three different rules for how much a late funding settlement charges. Print each, then the indexed history.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { markets, show } from "./lib/client.mjs";
import { lateSettlements } from "./lib/funding-history.mjs";
const root = createRequire(import.meta.url).resolve("@somnia-chain/markets-sdk").replace(/dist\/index\.js$/, "");
const quote = (file, needle) => {
  const lines = readFileSync(root + file, "utf8").split("\n"); const i = lines.findIndex((l) => l.includes(needle));
  return { file, line: i + 1, text: lines.slice(i, i + 3).map((l) => l.trim()).join(" ") };
};
const statements = [
  quote("dist/funding.d.ts", "catch-up horizon is ONE interval"),
  quote("dist/store.d.ts", "Accrual is capped at n"),
  quote("dist/eventsAbi.js", "accrual is capped at n"),
  quote("docs/PERPS.md", "over several intervals, multiply that by"),
];
const r = await lateSettlements(markets().client);
const maxSettled = Math.max(...r.late.map((x) => x.intervalsSettled));
console.log(show({ sdk: "0.32.1", statements, settlementsScanned: r.settlementsScanned, lateSettlements: r.lateSettlements,
  maxIntervalsSettledInOneRow: maxSettled, rowsAccruingMoreThanOneInterval: r.rowsAccruingMoreThanOneInterval }));
process.exit(0);
