// Shared read-only client for the repro scripts. No key material is read here.
import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

export const INDEXER_URL = "https://hideki-dev.smk.somnia.host/v1/graphql";
export const ADDRESSES = SOMNIA_HIDEKI_TESTNET_ADDRESSES;
export const PROBE_WALLET = "0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b";

export const markets = () =>
  new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER_URL, addresses: ADDRESSES });

// JSON-safe printer for bigint-heavy SDK rows.
export const show = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);

// Write-path clients read PROBE_PRIVATE_KEY from the environment only.
export const requireKey = () => {
  const k = process.env.PROBE_PRIVATE_KEY;
  if (!k) throw new Error("set PROBE_PRIVATE_KEY in the environment");
  return k;
};

// Same client with a signer, for the write-path repros.
export const writeMarkets = () =>
  new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER_URL, addresses: ADDRESSES, privateKey: requireKey() });
