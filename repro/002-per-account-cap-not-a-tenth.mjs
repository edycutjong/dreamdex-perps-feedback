// Docs: "A single account is capped at a tenth of it on most markets." Check maxPositionSize / maxOpenInterest on-chain.
import { markets, show } from "./lib/client.mjs";
const m = markets();
const rows = [];
for (const p of await m.client.listPerpMarkets()) {
  const risk = await m.client.getPerpRiskParams(p.poolAddress);
  rows.push({ market: p.baseSymbol, maxPositionSize: risk.maxPositionSize, maxOpenInterest: risk.maxOpenInterest,
    perAccountShare: +(Number(risk.maxPositionSize) / Number(risk.maxOpenInterest)).toFixed(4) });
}
const byShare = {};
for (const r of rows) (byShare[r.perAccountShare] ??= []).push(r.market);
console.log(show({ sdk: "0.32.1", marketsWithShareExactlyOneTenth: rows.filter((r) => r.perAccountShare === 0.1).length,
  totalMarkets: rows.length, byShare, rows }));
process.exit(0);
