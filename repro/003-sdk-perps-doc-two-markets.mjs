// docs/PERPS.md shipped inside the SDK says only BTC and ETH perps are live. Compare with the live market list.
import { readFileSync } from "node:fs";
import { markets, show } from "./lib/client.mjs";
const docUrl = new URL("../node_modules/@somnia-chain/markets-sdk/docs/PERPS.md", import.meta.url);
const doc = readFileSync(docUrl, "utf8").split("\n");
const claim = doc.findIndex((l) => l.includes("Perps are live on testnet"));
const live = await markets().client.listPerpMarkets();
console.log(show({
  sdk: "0.32.1",
  docFile: "docs/PERPS.md",
  docLines: { line: claim + 1, text: [doc[claim], doc[claim + 1]] },
  liveMarketCount: live.length,
  liveSymbols: live.map((p) => p.baseSymbol),
  liveButNotInDoc: live.map((p) => p.baseSymbol).filter((s) => s !== "BTC" && s !== "ETH").length,
}));
process.exit(0);
