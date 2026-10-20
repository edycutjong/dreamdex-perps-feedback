// Funding docs: "Perp above the index (positive funding): longs pay shorts. Perp below the index (negative funding): shorts pay
// longs." No interest rate, dampener or cap is mentioned. This reads getFundingParameters() on every pool, then every indexed
// hourly settlement up to a fixed cut-off, comparing the settled rate's sign with markPrice vs indexPrice at that settlement.
import { createPublicClient, http, parseAbi } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show } from "./lib/client.mjs";
const CUTOFF = 1792512000; // 2026-10-20 16:00 UTC
const c = markets().client; const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const abi = parseAbi(["function getFundingParameters() view returns ((uint256 fundingCalculationWindowSec, uint256 fundingSettlementIntervalSec, int256 interestRatePerWindow, uint256 maxFundingRatePerWindow, uint256 dampener, uint256 emaSmoothingAlpha, uint256 maxOracleStalenessSec))"]);
const perps = await c.listPerpMarkets(); const params = new Set(); const examples = [];
const t = { settlements: 0, rateEqualsInterestRate: 0, rateNegative: 0, markBelowIndex: 0, markBelowIndexRatePositive: 0, markAboveIndex: 0, markAboveIndexRateNegative: 0 };
for (const p of perps) {
  const f = await rpc.readContract({ address: p.poolAddress, abi, functionName: "getFundingParameters" }); params.add(show(f));
  for (let offset = 0; ; offset += 1000) {
    const page = await c.listFundingRateHistory(p.poolAddress, { from: 0, to: CUTOFF, order: "asc", limit: 1000, offset });
    for (const r of page) {
      if (r.markPrice === null) continue;
      const rate = BigInt(r.fundingRate), mark = BigInt(r.markPrice), index = BigInt(r.indexPrice); t.settlements++;
      if (rate === f.interestRatePerWindow) t.rateEqualsInterestRate++; if (rate < 0n) t.rateNegative++;
      if (mark < index) { t.markBelowIndex++; if (rate > 0n) { t.markBelowIndexRatePositive++;
        if (p.baseSymbol === "BTC" && examples.length < 3) examples.push({ market: p.baseSymbol, utc: new Date(Number(r.timestamp) * 1000).toISOString(), markPrice: r.markPrice, indexPrice: r.indexPrice, fundingRate: r.fundingRate, txHash: r.txHash }); } }
      if (mark > index) { t.markAboveIndex++; if (rate < 0n) t.markAboveIndexRateNegative++; }
    }
    if (page.length < 1000) break;
  }
}
console.log(show({ sdk: "0.32.1", cutoff: CUTOFF, pools: perps.length, fundingParametersDistinct: [...params].map((x) => JSON.parse(x)), ...t, examples }));
process.exit(0);
