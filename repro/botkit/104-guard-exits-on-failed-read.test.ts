// Repro 104: perp-guard ends the process on the first failed read, so a position that needs flattening is never reached.
import { describe, expect, it, vi } from "vitest";
import { makeMock, runStrategy, type Mock } from "./_botkit-harness";

const h = vi.hoisted(() => ({ ctx: undefined as any, stopped: false, onSleep: () => {} }));
vi.mock("@dreamdex-bot-kit/perp-core", async (orig) => {
  const actual = await orig<typeof import("@dreamdex-bot-kit/perp-core")>();
  return { ...actual, createExchange: () => h.ctx, onStop: () => () => h.stopped, sleep: async () => h.onSleep() };
});

const GUARD = new URL("../../../strategies/perp-guard/src/index.ts", import.meta.url).pathname;

describe("perp-guard when one position read fails", () => {
  it("keeps polling and flattens the position on the next cycle", async () => {
    const m: Mock = makeMock({ symbol: "" }); // blank PERP_SYMBOL: watch whatever the account holds
    m.positions = [{ symbol: "BTC/USDso:USDso", side: "long", contracts: 0.01, unrealizedPnl: -900 }];
    // equity == maintenance requirement: health 1.0x, below the 1.15x flatten line
    m.hooks.equity = () => 500_000_000n;
    h.ctx = { exchange: m.exchange, config: m.config, canTrade: true };
    h.stopped = false;

    // The first position read fails (an indexer hiccup); every later read works.
    let reads = 0;
    m.hooks.fetchPositions = () => {
      reads += 1;
      if (reads === 1) throw new Error("indexer request failed: 503 Service Unavailable");
    };
    let sleeps = 0;
    h.onSleep = () => {
      sleeps += 1;
      if (sleeps >= 2) h.stopped = true;
    };

    const code = await runStrategy(GUARD, { DRY_RUN: "false", PRIVATE_KEY: m.config.privateKey });

    expect(code).toBe(0); // upstream: the process exits with code 1 on that first failed read
    // The guard got to the position and sold it: a market IOC (type 2), isBid false, the whole 0.01 BTC.
    const closes = m.placed.filter((o) => o.orderType === 2);
    expect(closes).toHaveLength(1);
    expect(closes[0].isBid).toBe(false);
    expect(closes[0].quantity).toBe(1_000_000n);
  });
});
