// Docs: "A single account is capped at a tenth of it on most markets" ("it" = the documented open interest cap).
import { markets, show } from "./lib/client.mjs";
import { DOC_OI_CAP as DOC } from "./lib/docs-table.mjs";
const m = markets();
const rows = [];
for (const p of await m.client.listPerpMarkets()) {
  const risk = await m.client.getPerpRiskParams(p.poolAddress);
  const maxPosition = Number(risk.maxPositionSize) / 10 ** Number(p.baseDecimals);
  rows.push({ market: p.baseSymbol, docCap: DOC[p.baseSymbol], maxPositionSize: maxPosition,
    shareOfDocCap: +(maxPosition / DOC[p.baseSymbol]).toFixed(3) });
}
const byShare = {};
for (const r of rows) (byShare[r.shareOfDocCap] ??= []).push(r.market);
console.log(show({ sdk: "0.32.1", totalMarkets: rows.length, marketsAtOneTenth: rows.filter((r) => r.shareOfDocCap === 0.1).length,
  byShare, rows }));
process.exit(0);
