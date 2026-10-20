// Who actually receives the voucher? Every indexed "Credited" margin event, and the sender of the tx that produced it.
// Read-only. PAGES x 1000 newest rows (default 2); evidence/012-credit-senders-full.json was run with PAGES=40.
import { createPublicClient, http } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { INDEXER_URL, show } from "./lib/client.mjs";
const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const gq = async (query) => (await (await fetch(INDEXER_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) })).json()).data.MarginEvent;
const rows = new Map(); let upTo = null;
for (let page = 0; page < Number(process.env.PAGES ?? 2); page++) {
  const where = `{kind:{_eq:"Credited"}${upTo ? `, timestamp:{_lte:"${upTo}"}` : ""}}`;
  const got = await gq(`query { MarginEvent(where:${where}, order_by:[{timestamp:desc},{id:desc}], limit:1000) { id txHash timestamp account granter } }`);
  got.forEach((r) => rows.set(r.id, r)); if (got.length < 1000) break; upTo = got.at(-1).timestamp;
}
const byTx = {}; for (const r of rows.values()) (byTx[r.txHash] ??= []).push(r);
const rowsBySender = {}; let selfClaimTxs = 0;
for (const [hash, list] of Object.entries(byTx)) {
  const { from } = await rpc.getTransaction({ hash }); rowsBySender[from] = (rowsBySender[from] ?? 0) + list.length;
  if (list.length === 1 && list[0].account.toLowerCase() === from.toLowerCase()) selfClaimTxs++;
}
const ts = [...rows.values()].map((r) => Number(r.timestamp));
console.log(show({ creditedRows: rows.size, distinctTxs: Object.keys(byTx).length, oldestUtc: new Date(Math.min(...ts) * 1000).toISOString(),
  newestUtc: new Date(Math.max(...ts) * 1000).toISOString(), granters: [...new Set([...rows.values()].map((r) => r.granter))], rowsBySender, selfClaimTxs }));
process.exit(0);
