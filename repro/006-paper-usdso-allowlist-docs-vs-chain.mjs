// Docs: markets marked "No" under Paper USDso are closed to the voucher ("The six newest markets are not on that list").
// Chain: MarginBank voucher allowlist, read through client.getPerpLeverage(...).voucherMarketAllowed.
import { markets, show, PROBE_WALLET } from "./lib/client.mjs";
import { DOC_PAPER_USDSO_NO } from "./lib/docs-table.mjs";
const m = markets();
const perps = await m.client.listPerpMarkets();
const rows = [];
for (const p of perps) {
  const lev = await m.client.getPerpLeverage({ marginBank: p.marginBank, account: PROBE_WALLET, pool: p.poolAddress });
  rows.push({ market: p.baseSymbol, pool: p.poolAddress, docsPaperUsdso: DOC_PAPER_USDSO_NO.includes(p.baseSymbol) ? "No" : "Yes",
    chainVoucherMarketAllowed: lev.voucherMarketAllowed, voucherLeverageCapX: lev.voucherLeverageCapX });
}
const camp = await m.client.getPerpVoucherCampaign(perps[0].marginBank);
const docsNoButAllowed = rows.filter((r) => r.docsPaperUsdso === "No" && r.chainVoucherMarketAllowed).map((r) => r.market);
console.log(show({ sdk: "0.32.1", totalMarkets: rows.length,
  allowedOnChain: rows.filter((r) => r.chainVoucherMarketAllowed).length, docsSayNo: DOC_PAPER_USDSO_NO, docsNoButAllowed,
  campaign: { distributor: camp.distributor, grantAmount: camp.grantAmount, startsAt: camp.startsAt, endsAt: camp.endsAt, leverageCapX: camp.leverageCapX },
  rows }));
process.exit(0);
