// Repro 103: see feedback/103-botkit-cancel-quietly-hides-failed-cancels.md. Needs git, node >= 20, npm, network access to GitHub and npm.
import { run } from "./botkit/lib.mjs";
run("103", "103-cancel-quietly-report-failures.patch");
