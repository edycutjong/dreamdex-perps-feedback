# dreamBot Builder: server-rendered HTML and meta description say "Spot and Event Contracts" while the page (and the flag in the same HTML) include Perps
Severity: normal
Area: app

## Steps to reproduce
1. `npm install`, then `node repro/005-builder-ssr-omits-perps.mjs` (plain HTTP GET of https://app.testnet.dreamdex.io/dreambot-builder, no JS, no key).
2. Open the same URL in a normal browser and read the line under "Set up your dreamBot" (captured in `evidence/005-hydrated-text.txt` and `evidence/005-hydrated-page.png`).

## Expected
Developer docs `/docs/developers/perps-testnet`: "the [dreamBot Builder](https://app.testnet.dreamdex.io/dreambot-builder) sets up a perps bot for you."
The page itself, once hydrated, says: "Build, test, and deploy dreamBots for Spot, Event Contracts and Perps, in five steps." The server-rendered text and `<meta name="description">` of the same page should say the same, since they are what crawlers, link previews and no-JS clients read.

## Actual
The HTML returned by the server says "Build, test, and deploy dreamBots for Spot and Event Contracts , in five steps." and the meta description says "Configure, test, and deploy a dreamBot trading bot for Spot and Event Contracts on dreamDEX." Perps is not mentioned in either, although the feature flags embedded in that same response contain `"dreambot-perps":true`.
After hydration in a browser the sentence reads "Build, test, and deploy dreamBots for Spot, Event Contracts and Perps, in five steps."
So the server-rendered sentence and the meta description contradict both the hydrated page and the developer docs sentence above.

## Evidence
- `evidence/005-run1.json`, `evidence/005-run2.json`: two fresh-process runs of the repro, byte-identical (`serverRenderedSentence`, `metaDescription`, `ogDescription`, `featureFlagDreambotPerps: "true"`).
- `evidence/005-hydrated-text.txt` and `evidence/005-hydrated-page.png`: the same page after hydration in headless Chromium, 2026-10-20.
- `evidence/docs-excerpts-2026-10-20.txt`: the developer-docs sentence quoted above, as served on 2026-10-20 (UTC).

## Environment
- Not SDK related; page fetched with Node v22.22.0 `fetch`, hydrated view with headless Chromium (desktop UA)
- App: app.testnet.dreamdex.io (Somnia Hideki testnet, Tokyo), no wallet connected
- Date: 2026-10-20 (UTC)
