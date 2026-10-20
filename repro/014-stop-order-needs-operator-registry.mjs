// SDK JSDoc (PlacePerpStopOrderParams.operatorRegistry): "Resolved from the live config (addresses.operatorPermissionsRegistry) if omitted."
// With the SDK's own testnet address set, omitting it throws before anything is sent. A throwaway key is enough: no funds, no tx.
import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { generatePrivateKey } from "viem/accounts";
import { parseUnits } from "viem";
import { INDEXER_URL, show } from "./lib/client.mjs";
const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER_URL, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, privateKey: generatePrivateKey() });
const sol = (await m.client.listPerpMarkets()).find((p) => p.baseSymbol === "SOL");
const out = { sdk: "0.32.1", hasOperatorPermissionsRegistry: "operatorPermissionsRegistry" in SOMNIA_HIDEKI_TESTNET_ADDRESSES, stopRegistryOnMarketRow: sol.stopRegistry };
try {
  await m.trader.placePerpStopOrder({ registry: sol.stopRegistry, pool: sol.poolAddress, isBid: false, quantity: 0n, triggerPrice: parseUnits("50", 18), triggerOperator: 1, stopOrderType: 1 });
  out.result = "ok";
} catch (e) { out.result = { name: e.name, message: e.message }; }
console.log(show(out));
process.exit(0);
