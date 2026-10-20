// dreamBot Builder: server-rendered HTML (what crawlers, link previews and no-JS clients get) vs the feature flag it ships.
const res = await fetch("https://app.testnet.dreamdex.io/dreambot-builder");
const html = await res.text();
const pick = (re) => (html.match(re) ?? [])[1] ?? null;
const at = html.indexOf("Build, test, and deploy dreamBots for");
const text = html.slice(at, at + 300).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const sentence = text.slice(0, text.indexOf("steps.") + 6);
console.log(JSON.stringify({
  status: res.status,
  serverRenderedSentence: sentence,
  metaDescription: pick(/<meta name="description" content="([^"]*)"/),
  ogDescription: pick(/<meta property="og:description" content="([^"]*)"/),
  featureFlagDreambotPerps: pick(/dreambot-perps\\*":(true|false)/),
  mentionsPerpsInSentenceOrMeta: /perps/i.test(`${sentence} ${pick(/<meta name="description" content="([^"]*)"/)}`),
}, null, 2));
