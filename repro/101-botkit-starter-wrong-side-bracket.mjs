// Repro 101: see feedback/101-botkit-starter-wrong-side-bracket.md. Needs git, node >= 20, npm, network access to GitHub and npm.
import { run } from "./botkit/lib.mjs";
run("101", "101-starter-manage-existing-side.patch");
