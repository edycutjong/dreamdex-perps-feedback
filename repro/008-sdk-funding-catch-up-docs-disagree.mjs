// The SDK package states three different rules for how much a late funding settlement charges. Print each passage
// (file, line, text) from the installed package. No network. Which rule the chain follows: report 007.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const root = createRequire(import.meta.url).resolve("@somnia-chain/markets-sdk").replace(/dist\/index\.js$/, "");
const version = JSON.parse(readFileSync(root + "package.json", "utf8")).version;
const quote = (rule, file, needle) => {
  const lines = readFileSync(root + file, "utf8").split("\n"); const i = lines.findIndex((l) => l.includes(needle));
  return { rule, file, line: i + 1, text: lines.slice(i, i + 3).map((l) => l.trim()).join(" ") };
};
console.log(JSON.stringify({ sdk: version, statements: [
  quote(1, "dist/funding.d.ts", "catch-up horizon is ONE interval"),
  quote(1, "dist/funding.d.ts", "deriving it as `min(intervalsSettled, n)`"),
  quote(2, "dist/store.d.ts", "Accrual is capped at n"),
  quote(2, "dist/eventsAbi.js", "accrual is capped at n"),
  quote(3, "docs/PERPS.md", "over several intervals, multiply that by"),
] }, null, 2));
