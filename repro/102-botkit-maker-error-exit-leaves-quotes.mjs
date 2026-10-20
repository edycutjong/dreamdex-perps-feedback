// Repro 102: see feedback/102-botkit-maker-error-exit-leaves-quotes.md. Needs git, node >= 20, npm, network access to GitHub and npm.
import { run } from "./botkit/lib.mjs";
run("102", "102-maker-pull-quotes-on-error.patch");
