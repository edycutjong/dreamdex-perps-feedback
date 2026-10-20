// Docs: "Any address can claim the 1,000 USDso perps credit once, as long as it holds no perp positions or orders" and
// getPerpVoucherEligibility(...).eligible === true. Here: eligible is true, yet VoucherDistributor.claim() reverts.
// Needs a funded key in PROBE_PRIVATE_KEY (STT for gas only; a reverted claim still mines and costs ~0.0002 STT).
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { writeMarkets, requireKey, show } from "./lib/client.mjs";
const m = writeMarkets(), rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const account = privateKeyToAccount(requireKey());
const wallet = createWalletClient({ chain: hidekiTestnet, transport: http(), account });
const bank = (await m.client.listPerpMarkets())[0].marginBank;
const eligibility = await m.client.getPerpVoucherEligibility(bank, account.address);
const claim = await m.trader.buildClaimPerpVoucher({ marginBank: bank }); // the SDK's own unsigned claim tx
let simulated;
try { await rpc.call({ account: account.address, to: claim.to, data: claim.data }); simulated = "ok"; }
catch (e) { simulated = { shortMessage: e.shortMessage, data: e.walk?.((x) => x.data)?.data ?? null }; }
const hash = await wallet.sendTransaction({ to: claim.to, data: claim.data, gas: 300000n }); // fixed gas: skip estimateGas
const rc = await rpc.waitForTransactionReceipt({ hash });
const voucher = await m.client.getPerpVoucher(bank, account.address);
console.log(show({ sdk: "0.32.1", wallet: account.address, distributor: claim.to, eligibility, simulatedClaim: simulated,
  claimTx: { hash, status: rc.status, block: rc.blockNumber, gasUsed: rc.gasUsed, costSTT: formatEther(rc.gasUsed * rc.effectiveGasPrice), logs: rc.logs.length },
  voucherAfter: voucher }));
process.exit(0);
