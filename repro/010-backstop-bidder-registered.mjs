// Margin docs: "No backstop bidders are registered on testnet, so the later stages come in sooner."
// Chain: LiquidationEngine bidder count (client.getLiquidationEngineConfig) and getBidders(); indexer: backstop takeovers
// (kind "PositionTakenOver", counterparty = bidder) up to a fixed cut-off so two runs print the same rows. Read-only.
import { createPublicClient, http, parseAbi } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show } from "./lib/client.mjs";
const CUTOFF = 1792512000; // 2026-10-20 16:00 UTC
const c = markets().client; const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const perps = await c.listPerpMarkets(); const symbol = Object.fromEntries(perps.map((p) => [p.poolAddress.toLowerCase(), p.baseSymbol]));
const sys = await c.getPerpSystemConfig(perps[0].marginBank);
const engine = await c.getLiquidationEngineConfig(sys.liquidationEngine);
const bidders = await rpc.readContract({ address: sys.liquidationEngine, abi: parseAbi(["function getBidders() view returns (address[])"]), functionName: "getBidders" });
const takeovers = (await c.getLiquidations({ kind: "PositionTakenOver", limit: 1000 }))
  .filter((r) => Number(r.timestamp) <= CUTOFF)
  .map((r) => ({ utc: new Date(Number(r.timestamp) * 1000).toISOString(), market: symbol[r.pool] ?? r.pool, size: r.size, price: r.price, bidder: r.counterparty, txHash: r.txHash }))
  .sort((a, b) => a.utc.localeCompare(b.utc));
console.log(show({ sdk: "0.32.1", liquidationEngine: sys.liquidationEngine, bidderCount: engine.bidderCount, bidders, takeoversUpToCutoff: takeovers.length,
  takeoverBiddersAreRegistered: takeovers.every((t) => bidders.map((b) => b.toLowerCase()).includes(t.bidder.toLowerCase())), takeovers }));
process.exit(0);
