// App docs: funding settles "Every hour" and lazy application gives "The same as paying every hour".
// This lists every indexed settlement that came late (intervalsSettled > 1) and how much of the gap it charged (intervalsAccrued),
// then decodes each one's FundingUpdated log from the transaction receipt on chain.
import { createPublicClient, http, parseAbi, decodeEventLog } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show } from "./lib/client.mjs";
import { lateSettlements } from "./lib/funding-history.mjs";
const r = await lateSettlements(markets().client);
const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const abi = parseAbi(["event FundingUpdated(int256 fundingRate, int256 cumulativeFundingPerUnit, uint256 indexPrice, uint64 intervalsSettled, uint256 markPrice)"]);
for (const x of r.late) {
  const receipt = await rpc.getTransactionReceipt({ hash: x.txHash });
  const log = receipt.logs.find((l) => l.address.toLowerCase() === x.pool.toLowerCase() && (() => { try { decodeEventLog({ abi, data: l.data, topics: l.topics }); return true; } catch { return false; } })());
  x.receiptStatus = receipt.status;
  x.receiptIntervalsSettled = log ? Number(decodeEventLog({ abi, data: log.data, topics: log.topics }).args.intervalsSettled) : null;
}
// Headline = settlements that follow an earlier settlement of the same market; a market's first indexed settlement is counted apart.
const after = r.late.filter((x) => !x.firstSettlement), byMarket = {};
for (const x of after) byMarket[x.market] = (byMarket[x.market] ?? 0) + x.secondsNotAccrued / 3600;
console.log(show({ sdk: "0.32.1", ...r, receiptsMatchingIndexer: r.late.filter((x) => x.receiptIntervalsSettled === x.intervalsSettled).length,
  stepOfOneInterval: r.late.filter((x) => x.intervalsInCumulativeStep === 1).length,
  lateAfterPreviousSettlement: after.length, hoursNotAccruedAfterPreviousSettlement: after.reduce((t, x) => t + x.secondsNotAccrued / 3600, 0),
  hoursNotAccruedByMarketAfterPreviousSettlement: byMarket,
  firstSettlementsCoveringSeveralIntervals: r.late.filter((x) => x.firstSettlement).map((x) => [x.market, x.utc, x.intervalsSettled]) }));
process.exit(0);
