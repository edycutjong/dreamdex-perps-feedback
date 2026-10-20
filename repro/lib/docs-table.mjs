// "Open interest cap" column, copied from https://app.testnet.dreamdex.io/docs/trading/perps-testnet ("Markets" table, base units).
// Re-checked against the live page on 2026-10-20 (UTC): all 21 rows unchanged (snapshot: evidence/docs-excerpts-2026-10-20.txt).
export const DOC_OI_CAP = { BTC: 246.81545, ETH: 3995.6125, HYPE: 23812.72, SOL: 47654.44, XRP: 344632, ADA: 2254678, AVAX: 66672.2,
  BNB: 693.975, DOGE: 5613590, LINK: 42643.6, NEAR: 250410, SUI: 635009, XLM: 2677780, "1000PEPE": 130285600, LIT: 138896.6,
  PUMP: 87993700, TAO: 2185.491, VVV: 21786.14, WLD: 1264000, ZEC: 420, ZRO: 250599.5 };

// "Paper USDso" column of the same table: the markets marked "No" (all others are "Yes").
export const DOC_PAPER_USDSO_NO = ["1000PEPE", "LIT", "PUMP", "VVV", "ZEC", "ZRO"];
