// Docs "Open interest cap" column vs the on-chain maxOpenInterest the pool enforces (getPerpRiskParams).
import { markets, show } from "./lib/client.mjs";
// Copied from https://app.testnet.dreamdex.io/docs/trading/perps-testnet ("Markets" table, Open interest cap column)
const DOC = { BTC: 246.81545, ETH: 3995.6125, HYPE: 23812.72, SOL: 47654.44, XRP: 344632, ADA: 2254678, AVAX: 66672.2,
  BNB: 693.975, DOGE: 5613590, LINK: 42643.6, NEAR: 250410, SUI: 635009, XLM: 2677780, "1000PEPE": 130285600, LIT: 138896.6,
  PUMP: 87993700, TAO: 2185.491, VVV: 21786.14, WLD: 1264000, ZEC: 420, ZRO: 250599.5 };
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
