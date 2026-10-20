// Does the claim() revert depend on the caller? Read-only, no key: eth_call of VoucherDistributor.claim() from 8 callers,
// next to what getPerpVoucher / getPerpVoucherEligibility say for each. The 4 "credited" accounts were the 4 newest
// indexed Credited recipients on 2026-10-21 (block 28876842); they are pinned so the run is repeatable.
import { createPublicClient, http } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show, PROBE_WALLET } from "./lib/client.mjs";
const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const m = markets(), bank = (await m.client.listPerpMarkets())[0].marginBank;
const camp = await m.client.getPerpVoucherCampaign(bank), data = "0x4e71d92d"; // claim()
const callers = {
  probeWallet: PROBE_WALLET, freshWallet: "0x0d6D4dd4125477f5f0E380eDE951B37a395Fa036",
  creditSender: "0x792182e6b2bd50deb22dc5436f7c518b34f9bd12", zeroAddress: "0x0000000000000000000000000000000000000000",
  credited1: "0x18d414dbcf0c399633afedf3106013a10e64e072", credited2: "0xc7ad9b4e382faf2ffe697f3cfdbebbb9eb50fb83",
  credited3: "0x38b96d17b6b4b8518976879b84bf74a5aa788c77", credited4: "0x762a46d39353d6dd6a0fc20da3ed394c144198a7",
};
const results = {};
for (const [name, account] of Object.entries(callers)) {
  const { claimed } = await m.client.getPerpVoucher(bank, account);
  const { eligible, reason } = await m.client.getPerpVoucherEligibility(bank, account);
  let revertData = null;
  try { await rpc.call({ account, to: camp.distributor, data }); } catch (e) { let c = e; while (c && !c.data && c.cause) c = c.cause; revertData = c?.data ?? "no data"; }
  results[name] = { account, claimed, eligible, reason: reason ?? null, claimCall: revertData ? "reverted" : "succeeded", revertData };
}
const vals = Object.values(results);
console.log(show({ distributor: camp.distributor, results,
  summary: { callers: vals.length, reverted: vals.filter((r) => r.claimCall === "reverted").length,
    distinctRevertData: [...new Set(vals.map((r) => r.revertData))],
    sdkSaysAlreadyClaimed: vals.filter((r) => r.reason === "alreadyClaimed").length } }));
process.exit(0);
