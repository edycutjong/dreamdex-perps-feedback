// Repro 102: perp-maker exits on any thrown error with its last quote pair still resting on the book.
import { describe, expect, it, vi } from "vitest";
import { makeMock, runStrategy, type Mock } from "./_botkit-harness";

const h = vi.hoisted(() => ({ ctx: undefined as any, stopped: false, onSleep: () => {} }));
vi.mock("@dreamdex-bot-kit/perp-core", async (orig) => {
  const actual = await orig<typeof import("@dreamdex-bot-kit/perp-core")>();
  return { ...actual, createExchange: () => h.ctx, onStop: () => () => h.stopped, sleep: async () => h.onSleep() };
});

const MAKER = new URL("../../../strategies/perp-maker/src/index.ts", import.meta.url).pathname;

describe("perp-maker when a read fails between quote cycles", () => {
  it("pulls the bid and ask it has resting before it exits", async () => {
    const m: Mock = makeMock();
    h.ctx = { exchange: m.exchange, config: m.config, canTrade: true };
    h.stopped = false;
    // Cycle 1 quotes normally. During the wait, the indexer starts failing, so cycle 2's market reload throws.
    h.onSleep = () => {
      m.hooks.loadMarkets = () => {
        throw new Error("indexer request failed: 502 Bad Gateway");
      };
    };

    const code = await runStrategy(MAKER, { DRY_RUN: "false", PRIVATE_KEY: m.config.privateKey });

    // The bot did quote both sides (post-only orders, type 3) before the failure.
    expect(m.placed.filter((o) => o.orderType === 3)).toHaveLength(2);
    expect(code).toBe(1);
    // After the process has exited nothing of the bot's may still be resting on the book.
    expect([...m.live]).toEqual([]);
  });
});
