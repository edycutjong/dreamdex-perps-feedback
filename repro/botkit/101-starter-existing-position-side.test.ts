// Repro 101: perp-starter arms its take-profit/stop-loss for PERP_SIDE, not for the position it found open.
import { describe, expect, it, vi } from "vitest";
import { makeMock, runStrategy, MARK, type Mock } from "./_botkit-harness";

const h = vi.hoisted(() => ({ ctx: undefined as any, stopped: false, onSleep: () => {} }));
vi.mock("@dreamdex-bot-kit/perp-core", async (orig) => {
  const actual = await orig<typeof import("@dreamdex-bot-kit/perp-core")>();
  return { ...actual, createExchange: () => h.ctx, onStop: () => () => h.stopped, sleep: async () => h.onSleep() };
});

const STARTER = new URL("../../../strategies/perp-starter/src/index.ts", import.meta.url).pathname;

describe("perp-starter with a position that is already open", () => {
  it("protects an existing SHORT with buy-to-close stops below and above the mark, not a long's", async () => {
    const m: Mock = makeMock();
    m.positions = [{ symbol: "BTC/USDso:USDso", side: "short", contracts: 0.01, unrealizedPnl: 0 }];
    h.ctx = { exchange: m.exchange, config: m.config, canTrade: true };
    h.stopped = false;
    h.onSleep = () => (h.stopped = true);

    // PERP_SIDE is left at its default ("long"): the account holds a short that the bot did not open.
    const code = await runStrategy(STARTER, { DRY_RUN: "false", PRIVATE_KEY: m.config.privateKey });

    expect(code).toBe(0);
    expect(m.placed).toHaveLength(0); // it manages the existing position instead of opening another
    expect(m.stopOrders).toHaveLength(1);
    const arm = m.stopOrders[0];
    const mark = BigInt(MARK) * 10n ** 18n;
    // Closing a short means BUYING. Take-profit sits BELOW the mark (fires at or below, operator 1),
    // stop-loss ABOVE it (fires at or above, operator 0).
    expect(arm.isBid).toBe(true);
    expect(arm.pair.isBid).toBe(true);
    expect(arm.triggerOperator).toBe(1);
    expect(arm.triggerPrice < mark).toBe(true);
    expect(arm.pair.triggerOperator).toBe(0);
    expect(arm.pair.triggerPrice > mark).toBe(true);
  });
});
