// SDK JSDoc (PlacePerpStopOrderParams.operatorRegistry): "Resolved from the live config (addresses.operatorPermissionsRegistry) if omitted."
// With the SDK's own testnet address set, omitting it throws before anything is sent: a throwaway key is enough (no funds, no tx).
// Variant: OPERATOR_REGISTRY=0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a PROBE_PRIVATE_KEY=<funded key> passes it (the SDK then sends its operator-grant tx).
import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { generatePrivateKey } from "viem/accounts";
import { parseUnits } from "viem";
import { INDEXER_URL, show } from "./lib/client.mjs";
const operatorRegistry = process.env.OPERATOR_REGISTRY;
const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER_URL, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, privateKey: operatorRegistry ? process.env.PROBE_PRIVATE_KEY : generatePrivateKey() });
const sol = (await m.client.listPerpMarkets()).find((p) => p.baseSymbol === "SOL");
const out = { sdk: "0.32.1", hasOperatorPermissionsRegistry: "operatorPermissionsRegistry" in SOMNIA_HIDEKI_TESTNET_ADDRESSES, stopRegistryOnMarketRow: sol.stopRegistry, operatorRegistryPassed: operatorRegistry ?? null };
try {
  await m.trader.placePerpStopOrder({ registry: sol.stopRegistry, pool: sol.poolAddress, operatorRegistry, intent: "opening", isBid: true, quantity: parseUnits("0.1", 9), triggerPrice: parseUnits("200", 18), triggerOperator: 0, stopOrderType: 1 });
  out.result = "ok";
} catch (e) { out.result = { name: e.name, message: e.message }; }
console.log(show(out));
process.exit(0);
