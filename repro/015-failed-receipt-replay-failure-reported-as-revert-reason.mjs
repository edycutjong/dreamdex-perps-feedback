// An order that MINES and reverts is replayed by the SDK as an eth_call at the receipt's block to recover the reason. When the node cannot
// serve that replay ("unable to load historical state"), the SDK still throws ContractRevertError and puts the TRANSPORT failure text into
// `reason` ("placeOrder reverted: rpc eth_call failed: RPC Request failed.") instead of the contract's reason.
// Needs: PROBE_PRIVATE_KEY (funded: STT for gas, >= 1 USDso in the wallet or margin account). Each attempt is one real, reverted tx; no funds move.
// Usage: PROBE_PRIVATE_KEY=0x... [ATTEMPTS=20] node repro/015-failed-receipt-replay-failure-reported-as-revert-reason.mjs
import { createPublicClient, http, getAddress, decodeErrorResult } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { writeMarkets, markets, PROBE_WALLET, show } from "./lib/client.mjs";
const ATTEMPTS = Number(process.env.ATTEMPTS ?? 20);
const m = writeMarkets();
const pub = createPublicClient({ chain: hidekiTestnet, transport: http() });
const sol = (await markets().client.listPerpMarkets()).find((p) => p.baseSymbol === "SOL");
const tick = BigInt(sol.tickSize), lot = BigInt(sol.lotSize);
const price = ((BigInt(sol.markPrice) * 80n) / 100n / tick) * tick; // resting bid 20% below the mark: never fills
const max = await m.client.getMaxPerpOrderSize({ pool: sol.poolAddress, marginBank: sol.marginBank, account: PROBE_WALLET, isBid: true, price, autoPull: true });
const quantity = BigInt(max.maxQuantity) + lot; // one lot more than the SDK's own maximum: the pool's pull exceeds the wallet and the tx reverts
const startBlock = await pub.getBlockNumber();
const nonce0 = await pub.getTransactionCount({ address: PROBE_WALLET });
const attempts = [];
for (let i = 0; i < ATTEMPTS; i++) {
  try { await m.trader.placePerpOrder({ pool: sol.poolAddress, isBid: true, price, quantity }); attempts.push({ i, outcome: "PLACED?!" }); }
  catch (e) { attempts.push({ i, errorClass: e.name, isContractRevertError: e.name === "ContractRevertError", errorName: e.errorName ?? null, reason: e.reason ?? null, message: e.message }); }
}
// Map attempt i -> its tx by nonce (scan the blocks since the run began).
const txs = [];
const endBlock = await pub.getBlockNumber();
for (let b = startBlock; b <= endBlock; b += 25n) {
  const blocks = await Promise.all(Array.from({ length: Number(endBlock - b < 24n ? endBlock - b + 1n : 25n) }, (_, k) => pub.getBlock({ blockNumber: b + BigInt(k), includeTransactions: true })));
  for (const blk of blocks) for (const t of blk.transactions) if (getAddress(t.from) === getAddress(PROBE_WALLET) && Number(t.nonce) >= nonce0) txs.push(t);
}
txs.sort((a, b) => Number(a.nonce) - Number(b.nonce));
for (const a of attempts) {
  const t = txs[a.i]; if (!t) continue;
  const r = await pub.getTransactionReceipt({ hash: t.hash });
  a.txHash = t.hash; a.block = Number(r.blockNumber); a.txStatus = r.status; a.gasUsed = r.gasUsed.toString();
  // What the SDK's replay should have recovered: the same call replayed one block before the tx (revert data decoded as Error(string)).
  try { await pub.call({ account: PROBE_WALLET, to: t.to, data: t.input, blockNumber: r.blockNumber - 1n }); a.replayAtPreviousBlock = "no revert"; }
  catch (e) { let d; e.walk?.((x) => { if (typeof x.data === "string" && d === undefined) d = x.data; }); try { a.replayAtPreviousBlock = decodeErrorResult({ abi: [{ type: "error", name: "Error", inputs: [{ type: "string" }] }], data: d }).args[0]; } catch { a.replayAtPreviousBlock = e.shortMessage ?? e.message; } }
}
const wrapped = attempts.filter((a) => /rpc eth_call failed/.test(a.message ?? ""));
console.log(show({ sdk: "0.32.1", pool: sol.poolAddress, quantity: quantity.toString(), sdkMaxQuantity: max.maxQuantity, attempts, summary: { attempts: ATTEMPTS, decodedReason: attempts.length - wrapped.length, transportTextAsReason: wrapped.length } }));
process.exit(0);
