// Follow-up to repro/014-stop-order-needs-operator-registry.mjs: with operatorRegistry passed explicitly and some margin in the account, the same placePerpStopOrder works end to end.
// Places a stop-entry (intent "opening", bid 0.1 SOL, MARKET, trigger 30% above the mark: it cannot fire), checks it is listed, cancels it and measures the native-token balance around each step.
// Needs: PROBE_PRIVATE_KEY with STT for gas and the 0.15 STT trigger prepay (returned by the cancel) and some USDso margin in the account (>= 1 USDso).
// Usage: PROBE_PRIVATE_KEY=0x... node repro/014-explicit-registry-stop-lifecycle.mjs
import { createPublicClient, http, formatEther } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { writeMarkets, markets, PROBE_WALLET, show } from "./lib/client.mjs";
const OPERATOR_REGISTRY = "0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a"; // developer page /docs/developers/perps-testnet, contract table
const m = writeMarkets();
const pub = createPublicClient({ chain: hidekiTestnet, transport: http() });
const sol = (await markets().client.listPerpMarkets()).find((p) => p.baseSymbol === "SOL");
const tick = BigInt(sol.tickSize);
const bal = () => pub.getBalance({ address: PROBE_WALLET });
const out = { sdk: "0.32.1", stopRegistry: sol.stopRegistry, operatorRegistry: OPERATOR_REGISTRY };
const b0 = await bal();
const placed = await m.trader.placePerpStopOrder({ registry: sol.stopRegistry, pool: sol.poolAddress, operatorRegistry: OPERATOR_REGISTRY, intent: "opening", isBid: true, quantity: BigInt(sol.minQuantity),
  triggerPrice: ((BigInt(sol.markPrice) * 130n) / 100n / tick) * tick, triggerOperator: 0, stopOrderType: 1 });
const b1 = await bal();
out.place = { tx: placed.hash, status: placed.receipt.status, gasUsed: placed.receipt.gasUsed.toString(), stopOrderId: placed.stopOrderId.toString(), balanceDeltaNative: formatEther(b1 - b0), gasCostNative: formatEther(placed.receipt.gasUsed * placed.receipt.effectiveGasPrice) };
await new Promise((r) => setTimeout(r, 4000)); // the stop listing is indexed
const listed = await m.client.listPerpStopOrders({ account: PROBE_WALLET });
out.listedAfterPlace = listed.map((o) => ({ id: o.orderIdRaw, status: o.status, intent: o.intent, triggerPrice: o.triggerPrice }));
const cancelled = await m.trader.cancelPerpStopOrder({ registry: sol.stopRegistry, orderId: placed.stopOrderId });
const b2 = await bal();
out.cancel = { tx: cancelled.hash, status: cancelled.receipt.status, gasUsed: cancelled.receipt.gasUsed.toString(), balanceDeltaNative: formatEther(b2 - b1), gasCostNative: formatEther(cancelled.receipt.gasUsed * cancelled.receipt.effectiveGasPrice),
  refundedNative: formatEther(b2 - b1 + cancelled.receipt.gasUsed * cancelled.receipt.effectiveGasPrice), unclaimedSomiAfter: (await m.client.getUnclaimedPerpStopSomi({ registry: sol.stopRegistry, account: PROBE_WALLET })).toString() };
await new Promise((r) => setTimeout(r, 4000));
out.listedAfterCancel = (await m.client.listPerpStopOrders({ account: PROBE_WALLET })).map((o) => o.orderIdRaw);
console.log(show(out));
process.exit(0);
