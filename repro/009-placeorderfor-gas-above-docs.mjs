// Developer docs: placeOrderFor "used up to about 1.56M gas", an IOC estimate was 7.7M, the bot kit sends 10,000,000,
// and pool transactions "cost between 0.0003 and 0.003 STT each". Read five recent successful placeOrderFor txs (public).
import { createPublicClient, http, parseAbi, decodeFunctionData, formatEther } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { markets, show } from "./lib/client.mjs";
const TXS = ["0x94f9c6e14d1c6c94822f94082f4feac8a0993246db929f0ca5b7053559d5ffac", "0x9abaa49de446e8ca4203337cb8e9f5fd28c087a05d47f3b8fbc7298778ebf1c6",
  "0x978cc8ff166263878f4c1e6f514112233114a5f987593de62823b5686a0ae7cf", "0x5cdb4cf75c28f977b891b02f6d0805146323f1667dbcf12ca8dafced7ea2256e",
  "0x20d76faf412d3a4b3d632b6fb95c4981cc8899568b03fad56bfb28613dbd8327"];
const abi = parseAbi(["function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)"]);
const rpc = createPublicClient({ chain: hidekiTestnet, transport: http() });
const pools = Object.fromEntries((await markets().client.listPerpMarkets()).map((p) => [p.poolAddress.toLowerCase(), p.baseSymbol]));
const rows = [];
for (const hash of TXS) {
  const [tx, rc] = await Promise.all([rpc.getTransaction({ hash }), rpc.getTransactionReceipt({ hash })]);
  const block = await rpc.getBlock({ blockNumber: rc.blockNumber });
  const { functionName, args } = decodeFunctionData({ abi, data: tx.input });
  rows.push({ hash, function: functionName, market: pools[tx.to.toLowerCase()] ?? null, utc: new Date(Number(block.timestamp) * 1000).toISOString(),
    orderType: args[6], status: rc.status, gasLimit: tx.gas, gasUsed: rc.gasUsed, effectiveGasPrice: rc.effectiveGasPrice, costSTT: formatEther(rc.gasUsed * rc.effectiveGasPrice) });
}
const n = (f) => rows.filter(f).length;
console.log(show({ sdk: "0.32.1", txs: rows.length, successful: n((r) => r.status === "success"), toPerpPool: n((r) => r.market !== null),
  gasUsedAbove1_56M: n((r) => r.gasUsed > 1560000n), iocGasUsedAbove7_7M: n((r) => r.orderType === 2 && r.gasUsed > 7700000n),
  gasUsedAbove10M: n((r) => r.gasUsed > 10000000n), costAbove0_003STT: n((r) => Number(r.costSTT) > 0.003), rows }));
process.exit(0);
