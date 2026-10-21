# dreamdex-perps-feedback

Reproducible feedback on the dreamDEX perps docs, SDK and app, for the dreamDEX Perps Bounty (Feedback track). 21 reports: 16 on the docs, SDK and app (001-016, checked against the live Hideki testnet wherever chain data is involved), and 5 on the official `somnia-chain/dreamdex-bot-kit` perps examples (101-105), each with a tested patch. One Markdown file per issue in `feedback/`, a script in `repro/`, captured output in `evidence/`.

## Reports

| # | Title | Severity | Area |
|---|---|---|---|
| 001 | [Perps docs "Open interest cap" disagrees with live open interest (above it on BTC and XRP) and with the pool's `maxOpenInterest` on 20 of 21 markets](feedback/001-oi-cap-docs-vs-chain.md) | normal | docs |
| 002 | [Per-account position cap is not "a tenth" of the market's open interest cap on most markets: 1 of 21 against the pool's `maxOpenInterest`, 10 of 21 against the docs table](feedback/002-per-account-cap-not-a-tenth.md) | normal | docs |
| 003 | [`@somnia-chain/markets-sdk` `docs/PERPS.md` names only BTC and ETH as the live perps (lines 3-4); `listPerpMarkets()` returns 21](feedback/003-sdk-perps-doc-lists-two-markets.md) | normal | docs |
| 004 | [An unreachable WebSocket is thrown as "genesis check failed" although no genesis was compared; the network cause (refused, HTTP 502) is only on `error.cause`](feedback/004-genesis-check-failed-hides-cause.md) | normal | SDK |
| 005 | [dreamBot Builder: server-rendered HTML and meta description say "Spot and Event Contracts" while the page (and the flag in the same HTML) include Perps](feedback/005-builder-server-html-omits-perps.md) | normal | app |
| 006 | [Paper USDso: the docs say 6 markets are closed to the voucher, but the on-chain voucher allowlist has all 21 markets on it](feedback/006-paper-usdso-allowlist-docs-vs-chain.md) | normal | docs |
| 007 | [Funding docs say it is paid every hour, but 25 late settlements each charged one hour and skipped the rest: 290 hourly intervals never charged](feedback/007-funding-gaps-not-paid.md) | normal | docs |
| 008 | [SDK docs disagree on what a late funding settlement charges: `funding.d.ts` says at most one interval, `docs/PERPS.md` says one settlement can charge more than one](feedback/008-sdk-funding-catch-up-docs-disagree.md) | normal | SDK |
| 009 | [Developer docs understate `placeOrderFor` gas: successful IOC orders used up to 13.4M gas, above the documented ~1.56M and the 10M bot-kit limit](feedback/009-placeorderfor-gas-above-docs.md) | normal | docs |
| 010 | [Margin docs say no backstop bidders are registered on testnet, but one is, and it took over 3 positions](feedback/010-backstop-bidder-registered.md) | normal | docs |
| 011 | [Funding docs say a perp below the index has negative funding, but 8,831 of 9,041 settlements with the mark below the index settled positive (longs paid)](feedback/011-funding-sign-vs-docs.md) | normal | docs |
| 012 | [Voucher self-claim reverts for a flat, never-claimed address although the developer docs and `getPerpVoucherEligibility` say it should work](feedback/012-voucher-self-claim-reverts-while-eligible.md) | normal | SDK |
| 013 | [`claimPerpVoucher` throws "claim reverted: for an unknown reason." because the distributor's custom error is not in the SDK error ABI](feedback/013-claim-revert-error-not-decoded.md) | normal | SDK |
| 014 | [`placePerpStopOrder` throws `NotConfiguredError` unless `operatorRegistry` is passed, although its JSDoc says it is resolved from the config when omitted](feedback/014-stop-order-operator-registry-not-resolved.md) | normal | SDK |
| 015 | [`placePerpOrder` reports its own failed `eth_call` replay as the revert reason: "placeOrder reverted: rpc eth_call failed: RPC Request failed."](feedback/015-reverted-order-reports-rpc-failure-as-revert-reason.md) | normal | SDK |
| 016 | [`getMarginAccount`, `getAccountEquity` and `getOpenOrdersOnchain` read at a block behind the receipt the SDK has just returned for the caller's own order](feedback/016-pinned-head-reads-behind-own-receipt.md) | normal | SDK |
| 101 | [bot-kit perp-starter arms its take-profit/stop-loss for PERP_SIDE, not for the position it found open: an existing short gets a long's sell-to-close stops](feedback/101-botkit-starter-wrong-side-bracket.md) | normal | app |
| 102 | [bot-kit perp-maker pulls its quotes only on Ctrl-C: any error thrown between cycles exits the process with the last bid and ask still resting on the book](feedback/102-botkit-maker-error-exit-leaves-quotes.md) | major | app |
| 103 | [bot-kit cancelQuietly swallows every cancel error, so perp-maker forgets a quote whose cancel failed and quotes a second pair on top of it](feedback/103-botkit-cancel-quietly-hides-failed-cancels.md) | normal | app |
| 104 | [bot-kit perp-guard ends the whole process on the first failed read: only the close call is wrapped in try/catch, so a transient indexer or RPC error stops the guard watching](feedback/104-botkit-guard-exits-on-failed-read.md) | normal | app |
| 105 | [bot-kit perp-starter with PERP_SIDE=short arms its take-profit at the stop-loss percentage and its stop-loss at the take-profit percentage](feedback/105-botkit-starter-short-swaps-tp-sl-percentages.md) | major | app |

## Run a repro

```
npm install
node repro/NNN-<slug>.mjs
```

- 001-011, 014: read-only, no key (014 with `OPERATOR_REGISTRY` set sends a transaction).
- 012 and 013 send the SDK's own `claimPerpVoucher` from a flat testnet wallet (about 0.00014 STT): `PROBE_PRIVATE_KEY=0x… node repro/012-voucher-claim-reverts.mjs`. The other 012 scripts are read-only.
- 015 and 016 (and the follow-up `repro/014-explicit-registry-stop-lifecycle.mjs`) send real transactions from a funded testnet wallet (STT for gas, about 50 USDso of margin): `PROBE_PRIVATE_KEY=0x… ATTEMPTS=30 node repro/015-failed-receipt-replay-failure-reported-as-revert-reason.mjs` (30 small reverted orders), `PROBE_PRIVATE_KEY=0x… CYCLES=20 node repro/016-open-orders-onchain-pinned-behind-own-receipt.mjs` and `PROBE_PRIVATE_KEY=0x… CYCLES=10 node repro/016-margin-reads-pinned-behind-own-fill.mjs` (they place, cancel or fill and close 0.1 SOL orders). 015 and 016 print a `summary` of the counts the report quotes; the counts vary from run to run (015: 1 to 14 of 30), the effect does not.
- 101-105 clone `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`, run its vitest suite on the pristine tree (one test fails) and with `patches/NNN-*.patch` applied (all pass). They print `REPRODUCED` on success. Needs `git` and network access.

## Environment

- `@somnia-chain/markets-sdk` 0.32.1 for 001-016 (pinned in `package.json`); the bot-kit repros 101-105 run against the version the bot-kit resolves (0.31.0). Node 22.
- Network: Somnia Hideki testnet (chain id 50383), indexer `https://hideki-dev.smk.somnia.host/v1/graphql`.
- Probe wallet (testnet only): `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`.
- Every figure in a report is printed by its repro or stored in `evidence/`, except the account balances named in the Steps sections of 015 and 016; report 009 says which discovery run was not saved.

## License

MIT, see `LICENSE`.
