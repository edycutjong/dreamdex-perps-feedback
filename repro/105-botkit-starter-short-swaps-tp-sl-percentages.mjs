// Repro 105: see feedback/105-botkit-starter-short-swaps-tp-sl-percentages.md. Needs git, node >= 20, npm, network access to GitHub and npm.
import { run } from "./botkit/lib.mjs";
run("105", "105-starter-short-tp-sl-percentages.patch");
