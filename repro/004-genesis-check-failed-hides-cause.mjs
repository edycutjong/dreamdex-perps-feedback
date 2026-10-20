// Any failed chain read on the first call surfaces as "genesis check failed"; the real cause is only on error.cause.
import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { show } from "./lib/client.mjs";
const withWs = (url) => ({ ...hidekiTestnet, rpcUrls: { default: { http: hidekiTestnet.rpcUrls.default.http, webSocket: [url] } } });
const cases = { wsRefused: "ws://127.0.0.1:9/ws", wsWrongPath: "wss://api.hideki2.infra.testnet.somnia.network/not-a-ws-path" };
const out = {};
for (const [name, url] of Object.entries(cases)) {
  const m = new SomniaMarkets({ chain: withWs(url), indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES });
  try {
    const [pool] = await m.client.listPerpMarkets();
    await m.client.getPerpState(pool.poolAddress);
    out[name] = { ok: true };
  } catch (e) {
    out[name] = { name: e.name, message: e.message, cause: String(e.cause?.message ?? "").split("\n").find((l) => l.startsWith("Details:")) };
  }
}
console.log(show({ sdk: "0.32.1", out }));
process.exit(0);
