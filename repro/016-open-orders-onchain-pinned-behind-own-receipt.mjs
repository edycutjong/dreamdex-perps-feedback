// `client.getOpenOrdersOnchain(pools, owner)` "pins the current head" (it calls eth_blockNumber) and reads the pool at that block. Right after the SDK has returned
// the receipt of the owner's own placePerpOrder / cancelOrder, that head is often a few blocks BEHIND the receipt's block, so the read does not show the order
// that was just placed (or still shows the one just cancelled). Control: `getOwnOpenOrdersOnchain` (no pin; eth_call at latest) in the same moment agrees with the receipt.
// Rests a minimum-size SOL bid 20% below the mark, then cancels it: never fills, no funds move.
// Usage: PROBE_PRIVATE_KEY=0x... [CYCLES=20] node repro/016-open-orders-onchain-pinned-behind-own-receipt.mjs
import { formatUnits } from "viem";
import { writeMarkets, markets, PROBE_WALLET, show } from "./lib/client.mjs";
const CYCLES = Number(process.env.CYCLES ?? 20);
const m = writeMarkets();
const sol = (await markets().client.listPerpMarkets()).find((p) => p.baseSymbol === "SOL");
const tick = BigInt(sol.tickSize);
const price = ((BigInt(sol.markPrice) * 80n) / 100n / tick) * tick;
const quantity = BigInt(sol.minQuantity);
const pinned = async (orderId) => { const r = await m.client.getOpenOrdersOnchain([sol.poolAddress], PROBE_WALLET); return { open: r.orders.some((o) => o.orderId === orderId), block: Number(r.blockNumber) }; };
const control = async (orderId) => (await m.client.getOwnOpenOrdersOnchain(sol.poolAddress, PROBE_WALLET)).some((id) => id === orderId);
const funds = { marginUnlockedUsdso: formatUnits((await m.client.getMarginAccount(sol.marginBank, PROBE_WALLET)).unlockedCollateralBalance, 18) };
const rows = [];
for (let i = 0; i < CYCLES; i++) {
  const p = await m.trader.placePerpOrder({ pool: sol.poolAddress, isBid: true, price, quantity });
  const a = await pinned(p.orderId); const aControl = await control(p.orderId);
  const c = await m.trader.cancelOrder({ pool: sol.poolAddress, orderId: p.orderId });
  const b = await pinned(p.orderId); const bControl = await control(p.orderId);
  rows.push({ i, orderId: p.orderId.toString(), placeTx: p.hash, placeReceiptBlock: Number(p.receipt.blockNumber), pinnedReadBlock: a.block, pinnedShowsOrderAfterPlace: a.open, controlShowsOrderAfterPlace: aControl,
    cancelTx: c.hash, cancelReceiptBlock: Number(c.receipt.blockNumber), pinnedReadBlockAfterCancel: b.block, pinnedStillShowsOrderAfterCancel: b.open, controlStillShowsOrderAfterCancel: bControl });
}
const summary = { cycles: CYCLES,
  pinnedReadBehindPlaceReceipt: rows.filter((r) => r.pinnedReadBlock < r.placeReceiptBlock).length, pinnedMissesPlacedOrder: rows.filter((r) => !r.pinnedShowsOrderAfterPlace).length, controlMissesPlacedOrder: rows.filter((r) => !r.controlShowsOrderAfterPlace).length,
  pinnedReadBehindCancelReceipt: rows.filter((r) => r.pinnedReadBlockAfterCancel < r.cancelReceiptBlock).length, pinnedStillShowsCancelledOrder: rows.filter((r) => r.pinnedStillShowsOrderAfterCancel).length, controlStillShowsCancelledOrder: rows.filter((r) => r.controlStillShowsOrderAfterCancel).length };
console.log(show({ sdk: "0.32.1", funds, pool: sol.poolAddress, price: price.toString(), quantity: quantity.toString(), rows, summary }));
process.exit(0);
