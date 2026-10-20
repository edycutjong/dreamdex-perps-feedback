// How report 009's transactions were found: take the latest 40 fills of every perp market (client.getFills), keep the
// distinct transactions, and list every one that calls placeOrderFor (selector 0x80054449) directly on the market's pool.
// The result depends on when it runs (fills move); report 009 pins five hashes found this way. Read-only.
import { createPublicClient, http, formatEther } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show } from "./lib/client.mjs";
const c = markets().client; const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const txs = new Map();
for (const p of await c.listPerpMarkets()) for (const f of await c.getFills(p.poolAddress, { market: p.id, limit: 40 })) txs.set(f.txHash, p);
const found = [];
for (const [hash, p] of txs) {
  const tx = await rpc.getTransaction({ hash });
  if (!tx.input.startsWith("0x80054449") || tx.to?.toLowerCase() !== p.poolAddress.toLowerCase()) continue;
  const rc = await rpc.getTransactionReceipt({ hash });
  found.push({ hash, market: p.baseSymbol, status: rc.status, gasLimit: tx.gas, gasUsed: rc.gasUsed, costSTT: formatEther(rc.gasUsed * rc.effectiveGasPrice) });
}
console.log(show({ ranAt: new Date().toISOString(), distinctTransactions: txs.size, directPlaceOrderFor: found.length,
  gasUsedAbove1_56M: found.filter((r) => r.gasUsed > 1560000n).length, gasUsedAbove10M: found.filter((r) => r.gasUsed > 10000000n).length,
  costAbove0_003STT: found.filter((r) => Number(r.costSTT) > 0.003).length, found }));
process.exit(0);
