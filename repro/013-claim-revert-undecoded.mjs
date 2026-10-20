// trader.claimPerpVoucher() on a flat, eligible account: the SDK waits for the receipt, re-simulates, and throws
// "claim reverted: for an unknown reason." with data 0x3e31dcc2. Is that selector in the SDK's error ABI (546 errors)?
// Needs a funded key in PROBE_PRIVATE_KEY; the reverted claim mines and costs ~0.00014 STT.
import { keccak256, toHex } from "viem";
import { contractErrorsAbi } from "@somnia-chain/markets-sdk";
import { writeMarkets, show } from "./lib/client.mjs";
const m = writeMarkets();
const known = new Map();
for (const i of contractErrorsAbi.filter((x) => x.type === "error"))
    known.set(keccak256(toHex(`${i.name}(${(i.inputs ?? []).map((x) => x.type).join(",")})`)).slice(0, 10), i.name);
const bank = (await m.client.listPerpMarkets())[0].marginBank;
const out = { sdk: "0.32.1", eligibility: await m.client.getPerpVoucherEligibility(bank, m.walletAddress), errorsInSdkAbi: known.size };
try { await m.trader.claimPerpVoucher({ marginBank: bank }); out.claim = "ok"; }
catch (e) {
  out.claim = { name: e.name, message: e.message, errorName: e.errorName ?? null, reason: e.reason, data: e.data, address: e.address, functionName: e.functionName,
    selectorKnownToSdk: known.get(e.data?.slice(0, 10)) ?? false };
}
console.log(show(out));
process.exit(0);
