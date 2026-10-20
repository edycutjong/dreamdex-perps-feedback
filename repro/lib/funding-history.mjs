// Every indexed funding settlement of every perp market up to a fixed cut-off, so two runs print the same rows.
// A settlement that came late carries intervalsSettled > 1; intervalsAccrued is what it actually charged (indexer field).
// intervalsInCumulativeStep re-derives that from event fields only: the cumulativeFundingPerUnit step / (fundingRate x indexPrice / 8).
// A market's first settlement is measured from 0, where its cumulative index starts.
export const CUTOFF = 1792512000; // 2026-10-20 16:00 UTC
export async function lateSettlements(client) {
  const late = []; let rows = 0, accruedOverOne = 0;
  for (const p of await client.listPerpMarkets()) {
    let prev;
    for (let offset = 0; ; offset += 1000) {
      const page = await client.listFundingRateHistory(p.poolAddress, { from: 0, to: CUTOFF, order: "asc", limit: 1000, offset });
      for (const r of page) {
        rows++; const settled = Number(r.intervalsSettled), accrued = Number(r.intervalsAccrued);
        if (accrued > 1) accruedOverOne++;
        const step = BigInt(r.fundingRate) !== 0n
          ? Number(((BigInt(r.cumulativeFundingPerUnit) - BigInt(prev?.cumulativeFundingPerUnit ?? 0)) * 8000n) / (BigInt(r.fundingRate) * BigInt(r.indexPrice))) / 1000 : null;
        if (settled > 1) late.push({ market: p.baseSymbol, pool: p.poolAddress, timestamp: Number(r.timestamp), utc: new Date(Number(r.timestamp) * 1000).toISOString(),
          intervalsSettled: settled, intervalsAccrued: accrued, fundingIntervalSec: r.fundingIntervalSec,
          intervalsInCumulativeStep: step, secondsNotAccrued: (settled - accrued) * Number(r.fundingIntervalSec), txHash: r.txHash });
        prev = r;
      }
      if (page.length < 1000) break;
    }
  }
  return { cutoff: CUTOFF, settlementsScanned: rows, rowsAccruingMoreThanOneInterval: accruedOverOne, lateSettlements: late.length,
    hoursNotAccrued: +(late.reduce((s, r) => s + r.secondsNotAccrued, 0) / 3600).toFixed(2), late };
}
