// Shared mock exchange for the bot-kit perps repro tests.
// Only the exchange (network) side is mocked; the strategy and every perp-core helper are the real upstream code.
import { vi } from "vitest";

export const POOL = "0x00000000000000000000000000000000000000a1" as const;
export const BANK = "0x00000000000000000000000000000000000000b2" as const;
export const ACCOUNT = "0x00000000000000000000000000000000000000c3" as const;
export const MARK = 100_000;

const info = {
  poolAddress: POOL,
  marginBank: BANK,
  quoteToken: "0x00000000000000000000000000000000000000d4",
  baseToken: "0x00000000000000000000000000000000000000e5",
  baseSymbol: "BTC",
  quoteSymbol: "USDso",
  baseDecimals: 8,
  quoteDecimals: 6,
  tickSize: "10000000000000000", // 0.01
  lotSize: "1000",
  minQuantity: "1000",
  markPrice: (BigInt(MARK) * 10n ** 18n).toString(),
  indexPrice: (BigInt(MARK) * 10n ** 18n).toString(),
  fundingRate: "0",
  fundingWindowSec: 28800,
  fundingIntervalSec: 3600,
  initialMarginBps: 500,
  openInterest: "0",
  stopRegistry: "0x00000000000000000000000000000000000000f6",
};

export interface Position {
  symbol: string;
  side: "long" | "short";
  contracts: number;
  unrealizedPnl: number;
}

export interface Mock {
  /** Orders the mock book currently holds (placed and not yet cancelled). */
  live: Set<bigint>;
  /** Most orders the mock book ever held at once. */
  peak: number;
  placed: Array<Record<string, any>>;
  cancelled: bigint[];
  stopOrders: Array<Record<string, any>>;
  positions: Position[];
  mark: number;
  nextId: bigint;
  /** Hooks a test can set. */
  hooks: {
    loadMarkets?: () => void;
    fetchPositions?: () => void;
    cancelOrder?: (orderId: bigint) => void;
    equity?: () => bigint;
  };
  exchange: any;
  config: any;
}

export function makeMock(extraConfig: Record<string, unknown> = {}): Mock {
  const m: Mock = {
    live: new Set(),
    peak: 0,
    placed: [],
    cancelled: [],
    stopOrders: [],
    positions: [],
    mark: MARK,
    nextId: 11n,
    hooks: {},
    exchange: undefined,
    config: {
      network: "hideki",
      chainId: 50383,
      symbol: "BTC-PERP",
      dryRun: false,
      privateKey: "0x" + "11".repeat(32),
      owner: undefined,
      operatorRegistry: "0x00000000000000000000000000000000000000f7",
      ...extraConfig,
    },
  };
  const market = { symbol: "BTC/USDso:USDso", type: "swap", active: true, info };
  m.exchange = {
    walletAddress: ACCOUNT,
    close: async () => {},
    loadMarkets: async () => {
      m.hooks.loadMarkets?.();
      return { "BTC/USDso:USDso": market };
    },
    fetchPositions: async () => {
      m.hooks.fetchPositions?.();
      return m.positions;
    },
    fetchOrderBook: async () => ({
      bids: [[m.mark - 5, 1]],
      asks: [[m.mark + 5, 1]],
    }),
    client: {
      getPerpHealthSnapshot: async () => ({ priceable: true, markPrice: (BigInt(Math.round(m.mark)) * 10n ** 18n).toString() }),
      getMaxPerpOrderSize: async () => ({
        priceable: true,
        placeable: true,
        maxQuantity: 10n ** 12n,
        limitedBy: "margin",
        effectiveImfBps: 500n,
      }),
      getMarginAccount: async () => ({
        unlockedCollateralBalance: 1_000_000_000n,
        lockedCollateral: 0n,
        equity: m.hooks.equity ? m.hooks.equity() : 1_000_000_000n,
        withdrawable: 1_000_000_000n,
        imReq: 100_000_000n,
        mmReq: m.positions.length ? 500_000_000n : 0n,
        cmReq: 0n,
        marginStatus: "healthy",
        activePerpPools: [POOL],
      }),
      getPerpMaxLeverage: async () => 2,
      listPerpStopOrders: async () => [],
      getPerpStopOrderSomiPayment: async () => 150_000_000_000_000_000n,
      previewPerpClosePnl: async () => ({
        priceable: true,
        closedQuantity: m.positions[0] ? BigInt(Math.round(m.positions[0].contracts * 1e8)) : 0n,
      }),
    },
    trader: {
      placePerpOrder: async (o: Record<string, any>) => {
        const id = m.nextId++;
        m.placed.push({ ...o, orderId: id });
        if (o.orderType !== 2) m.live.add(id);
        m.peak = Math.max(m.peak, m.live.size);
        return {
          hash: "0x" + "ab".repeat(32),
          receipt: { status: "success" },
          orderId: id,
          // An IOC (type 2) fills completely at the mock book; resting orders fill nothing.
          fills: o.orderType === 2 ? [{ quantityFilled: o.quantity }] : [],
        };
      },
      cancelOrder: async ({ orderId }: { orderId: bigint }) => {
        m.hooks.cancelOrder?.(orderId);
        m.cancelled.push(orderId);
        m.live.delete(orderId);
      },
      placePerpStopOrder: async (o: Record<string, any>) => {
        m.stopOrders.push(o);
        return { stopOrderId: 1n, pairedStopOrderId: 2n };
      },
      cancelPerpStopOrders: async () => {},
      setPerpLeverage: async () => {},
    },
  };
  return m;
}

/** Run a strategy's real `main()` against the mock; resolves with the exit code once it calls process.exit. */
export async function runStrategy(path: string, env: Record<string, string>): Promise<number> {
  vi.resetModules();
  for (const k of Object.keys(process.env)) if (/^(PERP_|DRY_RUN$|NETWORK$|OWNER_ADDRESS$|PRIVATE_KEY$)/.test(k)) delete process.env[k];
  Object.assign(process.env, env);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  let resolve!: (code: number) => void;
  const done = new Promise<number>((r) => (resolve = r));
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    resolve(code ?? 0);
    return undefined as never;
  }) as never);
  await import(/* @vite-ignore */ path);
  return done;
}
