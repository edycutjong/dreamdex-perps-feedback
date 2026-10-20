// Docs: markets marked "No" under Paper USDso are closed to the voucher ("The six newest markets are not on that list").
// Chain: MarginBank voucher allowlist, read through client.getPerpLeverage(...).voucherMarketAllowed AND directly
// with MarginBank.isVoucherMarketAllowed(pool) / getVoucherLeverageCap(), so an SDK mapping error is ruled out.
import { createPublicClient, http, parseAbi } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show, PROBE_WALLET } from "./lib/client.mjs";
import { DOC_PAPER_USDSO_NO } from "./lib/docs-table.mjs";
const m = markets();
const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const bankAbi = parseAbi(["function isVoucherMarketAllowed(address perpPool) view returns (bool)", "function getVoucherLeverageCap() view returns (uint16)"]);
const perps = await m.client.listPerpMarkets();
const rows = [];
for (const p of perps) {
  const lev = await m.client.getPerpLeverage({ marginBank: p.marginBank, account: PROBE_WALLET, pool: p.poolAddress });
  const direct = await rpc.readContract({ address: p.marginBank, abi: bankAbi, functionName: "isVoucherMarketAllowed", args: [p.poolAddress] });
  rows.push({ market: p.baseSymbol, pool: p.poolAddress, docsPaperUsdso: DOC_PAPER_USDSO_NO.includes(p.baseSymbol) ? "No" : "Yes",
    chainVoucherMarketAllowed: lev.voucherMarketAllowed, marginBankIsVoucherMarketAllowed: direct, voucherLeverageCapX: lev.voucherLeverageCapX });
}
const directCap = await rpc.readContract({ address: perps[0].marginBank, abi: bankAbi, functionName: "getVoucherLeverageCap" });
const camp = await m.client.getPerpVoucherCampaign(perps[0].marginBank);
const docsNoButAllowed = rows.filter((r) => r.docsPaperUsdso === "No" && r.chainVoucherMarketAllowed).map((r) => r.market);
console.log(show({ sdk: "0.32.1", marginBank: perps[0].marginBank, totalMarkets: rows.length,
  allowedOnChain: rows.filter((r) => r.chainVoucherMarketAllowed).length,
  allowedOnChainDirectRead: rows.filter((r) => r.marginBankIsVoucherMarketAllowed).length, marginBankGetVoucherLeverageCap: directCap,
  docsSayNo: DOC_PAPER_USDSO_NO, docsNoButAllowed,
  campaign: { distributor: camp.distributor, grantAmount: camp.grantAmount, startsAt: camp.startsAt, endsAt: camp.endsAt, leverageCapX: camp.leverageCapX },
  rows }));
process.exit(0);
