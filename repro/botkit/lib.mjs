// Runs one bot-kit repro twice from fresh clones: on pristine upstream (expected to FAIL) and with its patch (expected to PASS).
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

export function run(nnn, patchFile) {
  const script = join(here, "run-botkit.sh");
  const modes = [["upstream (expect FAIL)", []], ["patched (expect PASS)", [join(root, "patches", patchFile)]]];
  const results = modes.map(([label, args]) => {
    const r = spawnSync(script, [nnn, ...args], { encoding: "utf8" });
    const out = `${r.stdout}${r.stderr}`;
    const tests = out.match(/Tests\s+.*\)/)?.[0] ?? "no test summary";
    console.log(`${label}: exit ${r.status} | ${tests}`);
    return r.status;
  });
  const ok = results[0] !== 0 && results[1] === 0;
  console.log(ok ? "REPRODUCED: fails on upstream, passes with the patch" : "NOT AS EXPECTED");
  process.exit(ok ? 0 : 1);
}
