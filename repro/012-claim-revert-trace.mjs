// Where does VoucherDistributor.claim() revert? Read-only: trace the SDK's own claim calldata for a never-claimed account,
// find the implementation behind the proxy, and look the revert selector up in the bytecode and the public 4byte database.
import { createPublicClient, http } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show, PROBE_WALLET } from "./lib/client.mjs";
const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const m = markets(), bank = (await m.client.listPerpMarkets())[0].marginBank;
const camp = await m.client.getPerpVoucherCampaign(bank), data = "0x4e71d92d"; // claim()
const trace = await rpc.request({ method: "debug_traceCall", params: [{ from: PROBE_WALLET, to: camp.distributor, data }, "latest", { tracer: "callTracer" }] });
const slot = await rpc.getStorageAt({ address: camp.distributor, slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" }); // EIP-1967 implementation
const impl = "0x" + slot.slice(26), code = await rpc.getCode({ address: impl });
const lookup = await (await fetch("https://api.4byte.sourcify.dev/signature-database/v1/lookup?function=0x3e31dcc2&filter=false")).json();
const walk = (c) => ({ type: c.type, to: c.to, gasUsed: Number(c.gasUsed), error: c.error, output: c.output, calls: (c.calls ?? []).map(walk) });
console.log(show({ sdk: "0.32.1", distributor: camp.distributor, campaign: { startsAt: camp.startsAt, endsAt: camp.endsAt, claimsRemaining: camp.claimsRemaining },
  headBlock: await rpc.getBlockNumber(), trace: walk(trace), implementation: impl, selectorInImplementationBytecode: code.includes("3e31dcc2"),
  fourByteLookup: lookup.result.function["0x3e31dcc2"] }));
process.exit(0);
