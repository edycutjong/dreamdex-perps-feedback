#!/usr/bin/env bash
# Run a bot-kit repro test against upstream (pristine) or upstream + a patch.
#   repro/botkit/run-botkit.sh <test-file-prefix> [patch-file]
# Clones somnia-chain/dreamdex-bot-kit at the pinned commit into a fresh temp dir (outside this repo),
# copies the harness + test(s), optionally applies the patch, then runs the upstream perp-core tests
# (31 upstream tests + the repro tests). Needs git, node >= 20, npm.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
prefix="${1:?test file prefix, e.g. 101}"
patch="${2:-}"
commit=25798660bbe4674a6f83a960b202852896e2fed4
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git clone --quiet https://github.com/somnia-chain/dreamdex-bot-kit "$work/bot-kit"
git -C "$work/bot-kit" checkout --quiet "$commit"
if [ -n "$patch" ]; then
  git -C "$work/bot-kit" apply --check "$(cd "$(dirname "$patch")" && pwd)/$(basename "$patch")"
  git -C "$work/bot-kit" apply "$(cd "$(dirname "$patch")" && pwd)/$(basename "$patch")"
  echo "== patched with $(basename "$patch")"
else
  echo "== pristine upstream @ $commit"
fi
(cd "$work/bot-kit" && npm ci --no-audit --no-fund --silent >/dev/null 2>&1)
cp "$here/harness.ts" "$work/bot-kit/packages/perp-core/tests/_botkit-harness.ts"
cp "$here/${prefix}"-*.test.ts "$work/bot-kit/packages/perp-core/tests/"
cd "$work/bot-kit/packages/perp-core"
npx vitest run
