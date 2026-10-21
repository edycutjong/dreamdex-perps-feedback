// Live companion to repro/011-funding-sign-vs-docs.mjs. For every perp market: read timeWeightedPremium (SDK: "the premium the
// NEXT settlement will charge ... PRE-clamp ... Positive means the perp is rich and longs pay") ~20 s before that market's
// nextFundingAt, then the fundingRate once lastFundingUpdateAt advances. Read-only; takes up to ~1.5 h (one settlement per market).
import { markets, show } from "./lib/client.mjs";
const c = markets().client; const ps = await c.listPerpMarkets();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const one = async (p) => {
  let st = await c.getPerpState(p.poolAddress);
  if (Number(st.nextFundingAt) - Date.now() / 1000 < 40) { await sleep(Math.max(0, Number(st.nextFundingAt) * 1000 - Date.now()) + 60000); st = await c.getPerpState(p.poolAddress); }
  await sleep(Math.max(0, (Number(st.nextFundingAt) - 20) * 1000 - Date.now()));
  const prem = await c.getPerpFundingPremium(p.poolAddress); const pre = await c.getPerpState(p.poolAddress);
  let post = pre;
  for (let i = 0; i < 30 && post.lastFundingUpdateAt <= pre.lastFundingUpdateAt; i++) { await sleep(30000); post = await c.getPerpState(p.poolAddress); }
  return { market: p.baseSymbol, settledAt: String(pre.nextFundingAt), armed: prem.armed, preTimeWeightedPremium: prem.timeWeightedPremium,
    preMark: pre.markPrice, preIndex: pre.indexPrice, preRate: pre.fundingRate, postRate: post.fundingRate,
    preLastUpdate: pre.lastFundingUpdateAt, postLastUpdate: post.lastFundingUpdateAt, settled: post.lastFundingUpdateAt > pre.lastFundingUpdateAt };
};
const rows = await Promise.all(ps.map(one));
console.log(show({ capturedAt: new Date().toISOString(), rows })); process.exit(0);
