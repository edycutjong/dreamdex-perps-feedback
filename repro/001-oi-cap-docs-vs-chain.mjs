// Docs "Open interest cap" column vs live open interest and the on-chain maxOpenInterest (getPerpRiskParams).
import { markets, show } from "./lib/client.mjs";
import { DOC_OI_CAP as DOC } from "./lib/docs-table.mjs";
const m = markets();
const rows = [];
for (const p of await m.client.listPerpMarkets()) {
  const scale = 10 ** Number(p.baseDecimals);
  const risk = await m.client.getPerpRiskParams(p.poolAddress);
  const chainCap = Number(risk.maxOpenInterest) / scale;
  const liveOI = Number(p.openInterest) / scale;
  rows.push({ market: p.baseSymbol, docCap: DOC[p.baseSymbol], chainMaxOpenInterest: chainCap,
    chainOverDoc: +(chainCap / DOC[p.baseSymbol]).toFixed(3), liveOI, liveOIOverDocCap: +(liveOI / DOC[p.baseSymbol]).toFixed(3) });
}
console.log(show({ sdk: "0.32.1", rows, marketsAboveDocCap: rows.filter((r) => r.liveOIOverDocCap > 1).map((r) => r.market),
  marketsWhereChainCapDiffersFromDoc: rows.filter((r) => r.chainOverDoc !== 1).length }));
process.exit(0);
