// Same cause as repro/016-open-orders-onchain-pinned-behind-own-receipt.mjs, on the account-risk reads: `getMarginAccount` and `getAccountEquity` read at the head
// they get from eth_blockNumber. Right after the SDK returns the receipt of the owner's own fill (IOC market buy of the SOL minimum, 0.1) the margin account is read
// as it was BEFORE the fill (no active pool, imReq 0), and right after the closing sell it is still read as open. Control: `getPerpPosition` (eth_call at latest) agrees with the receipt.
// Each cycle opens and closes 0.1 SOL at the touch: it costs about the spread (a few thousandths of a USDso).
// Usage: PROBE_PRIVATE_KEY=0x... [CYCLES=10] node repro/016-margin-reads-pinned-behind-own-fill.mjs
import { formatUnits } from "viem";
import { writeMarkets, markets, PROBE_WALLET, show } from "./lib/client.mjs";
const CYCLES = Number(process.env.CYCLES ?? 10);
const m = writeMarkets();
const sol = (await markets().client.listPerpMarkets()).find((p) => p.baseSymbol === "SOL");
const tick = BigInt(sol.tickSize), quantity = BigInt(sol.minQuantity);
const ref = { marginBank: sol.marginBank, account: PROBE_WALLET, pool: sol.poolAddress };
const read = async () => {
  const [ma, eq, pos] = await Promise.all([m.client.getMarginAccount(sol.marginBank, PROBE_WALLET), m.client.getAccountEquity(PROBE_WALLET, { scope: "perps", marginBank: sol.marginBank }), m.client.getPerpPosition(ref)]);
  return { marginAccountBlock: Number(ma.asOfBlock), accountEquityBlock: Number(eq.asOfBlock), marginAccountActivePools: ma.activePerpPools.length, marginAccountImReq: ma.imReq.toString(), controlPositionSize: pos.size.toString() };
};
const touch = async () => { const t = (await m.client.getBookTopsOnchain([{ id: sol.id, poolAddress: sol.poolAddress }])).tops[sol.poolAddress]; return { bid: BigInt(t.bestBid), ask: BigInt(t.bestAsk) }; };
const funds = { marginUnlockedUsdso: formatUnits((await m.client.getMarginAccount(sol.marginBank, PROBE_WALLET)).unlockedCollateralBalance, 18) };
const rows = [];
for (let i = 0; i < CYCLES; i++) {
  let t = await touch();
  const open = await m.trader.placePerpOrder({ pool: sol.poolAddress, isBid: true, price: ((t.ask * 101n) / 100n / tick) * tick, quantity, orderType: 2 });
  const afterOpen = await read();
  t = await touch();
  const close = await m.trader.placePerpOrder({ pool: sol.poolAddress, isBid: false, price: ((t.bid * 99n) / 100n / tick) * tick, quantity, orderType: 2 });
  const afterClose = await read();
  rows.push({ i, openTx: open.hash, openReceiptBlock: Number(open.receipt.blockNumber), filledOpen: open.fills.reduce((s, f) => s + BigInt(f.quantityFilled), 0n).toString(), afterOpen,
    closeTx: close.hash, closeReceiptBlock: Number(close.receipt.blockNumber), filledClose: close.fills.reduce((s, f) => s + BigInt(f.quantityFilled), 0n).toString(), afterClose });
}
const summary = { cycles: CYCLES,
  marginAccountReadBeforeOwnFill: rows.filter((r) => r.afterOpen.marginAccountBlock < r.openReceiptBlock).length,
  marginAccountShowsNoPositionAfterFill: rows.filter((r) => r.afterOpen.marginAccountActivePools === 0).length, controlShowsPositionAfterFill: rows.filter((r) => r.afterOpen.controlPositionSize === quantity.toString()).length,
  accountEquityReadBeforeOwnFill: rows.filter((r) => r.afterOpen.accountEquityBlock < r.openReceiptBlock).length, accountEquityReadBeforeOwnClose: rows.filter((r) => r.afterClose.accountEquityBlock < r.closeReceiptBlock).length,
  marginAccountReadBeforeOwnClose: rows.filter((r) => r.afterClose.marginAccountBlock < r.closeReceiptBlock).length,
  marginAccountStillShowsPositionAfterClose: rows.filter((r) => r.afterClose.marginAccountActivePools > 0).length, controlShowsFlatAfterClose: rows.filter((r) => r.afterClose.controlPositionSize === "0").length };
console.log(show({ sdk: "0.32.1", funds, pool: sol.poolAddress, quantity: quantity.toString(), rows, summary }));
process.exit(0);
