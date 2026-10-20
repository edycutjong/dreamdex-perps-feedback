// Repro 104: see feedback/104-botkit-guard-exits-on-failed-read.md. Needs git, node >= 20, npm, network access to GitHub and npm.
import { run } from "./botkit/lib.mjs";
run("104", "104-guard-survive-failed-read.patch");
