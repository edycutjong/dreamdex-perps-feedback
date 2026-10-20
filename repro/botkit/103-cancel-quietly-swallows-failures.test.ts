// Repro 103: cancelQuietly swallows every error, so perp-maker forgets a quote whose cancel failed and quotes again on top of it.
import { describe, expect, it, vi } from "vitest";
import { makeMock, runStrategy, MARK, type Mock } from "./_botkit-harness";

const h = vi.hoisted(() => ({ ctx: undefined as any, stopped: false, onSleep: () => {} }));
vi.mock("@dreamdex-bot-kit/perp-core", async (orig) => {
  const actual = await orig<typeof import("@dreamdex-bot-kit/perp-core")>();
  return { ...actual, createExchange: () => h.ctx, onStop: () => () => h.stopped, sleep: async () => h.onSleep() };
});

const MAKER = new URL("../../../strategies/perp-maker/src/index.ts", import.meta.url).pathname;

describe("perp-maker when a cancel fails for a reason other than 'order already gone'", () => {
  it("does not quote a second pair over the first, and does not lose track of it", async () => {
    const m: Mock = makeMock();
    h.ctx = { exchange: m.exchange, config: m.config, canTrade: true };
    h.stopped = false;

    // The first cancel of each order fails with a transient transport error (the order stays live);
    // the same cancel works when it is tried again.
    const failedOnce = new Set<bigint>();
    m.hooks.cancelOrder = (id) => {
      if (!failedOnce.has(id)) {
        failedOnce.add(id);
        throw new Error("HTTP request failed: socket hang up (ECONNRESET)");
      }
    };

    let sleeps = 0;
    h.onSleep = () => {
      sleeps += 1;
      if (sleeps === 1) m.mark = MARK * 1.005; // 50 bps: past the 8 bps re-quote trigger
      if (sleeps >= 2) h.stopped = true;
    };

    const code = await runStrategy(MAKER, { DRY_RUN: "false", PRIVATE_KEY: m.config.privateKey });

    expect(code).toBe(0);
    expect(failedOnce.size).toBeGreaterThan(0); // the failure path was exercised
    // One pair at a time: a re-quote may not stack on an order that could not be cancelled.
    expect(m.peak).toBeLessThanOrEqual(2);
    // And after a clean stop nothing of the bot's is left on the book.
    expect([...m.live]).toEqual([]);
  });

  it("gives up on an order whose cancel keeps failing, so the bot is never stuck not quoting", async () => {
    const m: Mock = makeMock();
    h.ctx = { exchange: m.exchange, config: m.config, canTrade: true };
    h.stopped = false;
    // Every cancel fails with a message nothing recognises (a revert with no reason).
    m.hooks.cancelOrder = () => {
      throw new Error("execution reverted");
    };
    let sleeps = 0;
    h.onSleep = () => {
      sleeps += 1;
      if (sleeps === 1) m.mark = MARK * 1.005;
      if (sleeps >= 5) h.stopped = true;
    };

    const code = await runStrategy(MAKER, { DRY_RUN: "false", PRIVATE_KEY: m.config.privateKey });

    expect(code).toBe(0);
    // Upstream quotes a new pair at once (4 post-only orders by cycle 2); the patch retries the cancel for 3 cycles,
    // then gives up on those two orders and quotes again, so both versions end with at least 4.
    expect(m.placed.filter((o) => o.orderType === 3).length).toBeGreaterThanOrEqual(4);
  });
});
