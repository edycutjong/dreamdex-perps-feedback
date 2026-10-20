// Repro 105: perp-starter with PERP_SIDE=short applies the stop-loss % to the take-profit and the take-profit % to the stop-loss.
import { describe, expect, it, vi } from "vitest";
import { makeMock, runStrategy, MARK, type Mock } from "./_botkit-harness";

const h = vi.hoisted(() => ({ ctx: undefined as any, stopped: false, onSleep: () => {} }));
vi.mock("@dreamdex-bot-kit/perp-core", async (orig) => {
  const actual = await orig<typeof import("@dreamdex-bot-kit/perp-core")>();
  return { ...actual, createExchange: () => h.ctx, onStop: () => () => h.stopped, sleep: async () => h.onSleep() };
});

const STARTER = new URL("../../../strategies/perp-starter/src/index.ts", import.meta.url).pathname;
const price = (raw: bigint) => Number(raw) / 1e18;

describe("perp-starter opening a short with PERP_TAKE_PROFIT_PCT=2 and PERP_STOP_LOSS_PCT=1", () => {
  it("arms the take-profit 2% below the mark and the stop-loss 1% above it", async () => {
    const m: Mock = makeMock();
    h.ctx = { exchange: m.exchange, config: m.config, canTrade: true };
    h.stopped = false;
    h.onSleep = () => (h.stopped = true);

    const code = await runStrategy(STARTER, {
      DRY_RUN: "false",
      PRIVATE_KEY: m.config.privateKey,
      PERP_SIDE: "short",
      PERP_TAKE_PROFIT_PCT: "2",
      PERP_STOP_LOSS_PCT: "1",
    });

    expect(code).toBe(0);
    expect(m.placed.filter((o) => o.orderType === 2)).toHaveLength(1); // the opening IOC sell
    expect(m.stopOrders).toHaveLength(1);
    const arm = m.stopOrders[0];
    // take-profit leg (triggers at or below the mark for a short) and the paired stop-loss leg (at or above it)
    expect(arm.triggerOperator).toBe(1);
    expect(price(arm.triggerPrice)).toBeCloseTo(MARK * 0.98, 1); // 98,000
    expect(price(arm.pair.triggerPrice)).toBeCloseTo(MARK * 1.01, 1); // 101,000
  });
});
