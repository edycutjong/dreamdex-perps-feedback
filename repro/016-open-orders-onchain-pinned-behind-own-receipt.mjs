// `client.getOpenOrdersOnchain(pools, owner)` "pins the current head" (it calls eth_blockNumber) and reads the pool at that block. Right after the SDK has returned
// the receipt of the owner's own placePerpOrder / cancelOrder, that head is often a few blocks BEHIND the receipt's block, so the read does not show the order
// that was just placed (or still shows the one just cancelled). Control: `getOwnOpenOrdersOnchain` (no pin; eth_call at latest) in the same moment agrees with the receipt.
// Second control (added in run 3): the same read with `{ blockNumber: receipt.blockNumber }`, i.e. the caller passes its own receipt's block (errors recorded).
// Third read (added in run 4, concurrent from run 5): a raw, uncached `eth_blockNumber` POSTed to the chain's RPC at the same moment as the pinned read
// (RAW_FIRST=1 sends it before the pinned read instead, as in run 4; that delays the pinned read). If the node's head is already at or past the
// receipt while the pin (viem `getBlockNumber()`, cached for `cacheTime`, 500 ms by default here) is below it, the stale block came from the client-side cache.
// Rests a minimum-size SOL bid 20% below the mark, then cancels it: never fills, no funds move.
// Usage: PROBE_PRIVATE_KEY=0x... [CYCLES=20] node repro/016-open-orders-onchain-pinned-behind-own-receipt.mjs
import { formatUnits } from "viem";
import { writeMarkets, markets, PROBE_WALLET, show } from "./lib/client.mjs";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
const CYCLES = Number(process.env.CYCLES ?? 20);
const RAW_FIRST = process.env.RAW_FIRST === "1";
const m = writeMarkets();
const sol = (await markets().client.listPerpMarkets()).find((p) => p.baseSymbol === "SOL");
const tick = BigInt(sol.tickSize);
const price = ((BigInt(sol.markPrice) * 80n) / 100n / tick) * tick;
const quantity = BigInt(sol.minQuantity);
const pinned = async (orderId) => { const r = await m.client.getOpenOrdersOnchain([sol.poolAddress], PROBE_WALLET); return { open: r.orders.some((o) => o.orderId === orderId), block: Number(r.blockNumber) }; };
const atReceipt = async (orderId, blockNumber) => { try { const r = await m.client.getOpenOrdersOnchain([sol.poolAddress], PROBE_WALLET, { blockNumber }); return { open: r.orders.some((o) => o.orderId === orderId), error: null }; } catch (e) { return { open: null, error: `${e.name}: ${String(e.message).slice(0, 200)}` }; } };
const RPC = hidekiTestnet.rpcUrls.default.http[0];
const rawHead = async () => Number(BigInt((await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) })).json()).result));
const control = async (orderId) => (await m.client.getOwnOpenOrdersOnchain(sol.poolAddress, PROBE_WALLET)).some((id) => id === orderId);
const funds = { marginUnlockedUsdso: formatUnits((await m.client.getMarginAccount(sol.marginBank, PROBE_WALLET)).unlockedCollateralBalance, 18) };
const rows = [];
for (let i = 0; i < CYCLES; i++) {
  const p = await m.trader.placePerpOrder({ pool: sol.poolAddress, isBid: true, price, quantity });
  const [aRaw, a] = RAW_FIRST ? [await rawHead(), await pinned(p.orderId)] : await Promise.all([rawHead(), pinned(p.orderId)]); const aReceipt = await atReceipt(p.orderId, p.receipt.blockNumber); const aControl = await control(p.orderId);
  const c = await m.trader.cancelOrder({ pool: sol.poolAddress, orderId: p.orderId });
  const [bRaw, b] = RAW_FIRST ? [await rawHead(), await pinned(p.orderId)] : await Promise.all([rawHead(), pinned(p.orderId)]); const bReceipt = await atReceipt(p.orderId, c.receipt.blockNumber); const bControl = await control(p.orderId);
  rows.push({ i, orderId: p.orderId.toString(), placeTx: p.hash, placeReceiptBlock: Number(p.receipt.blockNumber), rawHeadAtPinnedRead: aRaw, pinnedReadBlock: a.block, pinnedShowsOrderAfterPlace: a.open, atReceiptShowsOrderAfterPlace: aReceipt.open, atReceiptErrorAfterPlace: aReceipt.error, controlShowsOrderAfterPlace: aControl,
    cancelTx: c.hash, cancelReceiptBlock: Number(c.receipt.blockNumber), rawHeadAtPinnedReadAfterCancel: bRaw, pinnedReadBlockAfterCancel: b.block, pinnedStillShowsOrderAfterCancel: b.open, atReceiptStillShowsOrderAfterCancel: bReceipt.open, atReceiptErrorAfterCancel: bReceipt.error, controlStillShowsOrderAfterCancel: bControl });
}
const summary = { cycles: CYCLES,
  pinnedReadBehindPlaceReceipt: rows.filter((r) => r.pinnedReadBlock < r.placeReceiptBlock).length, rawHeadBehindPlaceReceipt: rows.filter((r) => r.rawHeadAtPinnedRead < r.placeReceiptBlock).length, pinnedBehindReceiptWhileRawHeadAtOrPast: rows.filter((r) => r.pinnedReadBlock < r.placeReceiptBlock && r.rawHeadAtPinnedRead >= r.placeReceiptBlock).length, pinnedMissesPlacedOrder: rows.filter((r) => !r.pinnedShowsOrderAfterPlace).length, controlMissesPlacedOrder: rows.filter((r) => !r.controlShowsOrderAfterPlace).length,
  atReceiptShowsPlacedOrder: rows.filter((r) => r.atReceiptShowsOrderAfterPlace === true).length, atReceiptErrorsAfterPlace: rows.filter((r) => r.atReceiptErrorAfterPlace !== null).length,
  pinnedReadBehindCancelReceipt: rows.filter((r) => r.pinnedReadBlockAfterCancel < r.cancelReceiptBlock).length, rawHeadBehindCancelReceipt: rows.filter((r) => r.rawHeadAtPinnedReadAfterCancel < r.cancelReceiptBlock).length, pinnedBehindCancelReceiptWhileRawHeadAtOrPast: rows.filter((r) => r.pinnedReadBlockAfterCancel < r.cancelReceiptBlock && r.rawHeadAtPinnedReadAfterCancel >= r.cancelReceiptBlock).length, pinnedAfterCancelEqualsPinnedAfterPlace: rows.filter((r) => r.pinnedReadBlockAfterCancel === r.pinnedReadBlock).length, pinnedStillShowsCancelledOrder: rows.filter((r) => r.pinnedStillShowsOrderAfterCancel).length, controlStillShowsCancelledOrder: rows.filter((r) => r.controlStillShowsOrderAfterCancel).length,
  atReceiptShowsCancelledOrderGone: rows.filter((r) => r.atReceiptStillShowsOrderAfterCancel === false).length, atReceiptErrorsAfterCancel: rows.filter((r) => r.atReceiptErrorAfterCancel !== null).length };
console.log(show({ sdk: "0.32.1", funds, pool: sol.poolAddress, price: price.toString(), quantity: quantity.toString(), rows, summary }));
process.exit(0);
