#!/usr/bin/env bash
set -euo pipefail
# Recompiles the canonical sui-token-template Move module and refreshes the
# bytecode artifact the deployer ships (src/move-template/*). Run this whenever
# blockchain/sui/sui-token-template/sources/sui_token_template.move changes, so
# the shipped bytecode stays in lock-step with the downloadable source generator.
#
# IMPORTANT: use `sui move build` (NOT `sui move test`) — the test profile emits
# instrumented bytecode (magic 0xDEADC0DE) that is not publishable.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$HERE/.."
TEMPLATE_DIR="$APP_DIR/../../../blockchain/sui/sui-token-template"

echo "Building $TEMPLATE_DIR (testnet build-env)…"
( cd "$TEMPLATE_DIR" && rm -rf build && sui move build --build-env testnet >/dev/null )

MV="$TEMPLATE_DIR/build/sui_token_template/bytecode_modules/sui_token_template.mv"
MAGIC="$(head -c 4 "$MV" | xxd -p)"
if [[ "$MAGIC" != "a11ceb0b" ]]; then
  echo "ERROR: unexpected bytecode magic $MAGIC (expected a11ceb0b)" >&2
  exit 1
fi

cp "$MV" "$APP_DIR/src/move-template/sui_token_template.mv"
B64="$(base64 -w0 "$MV")"

# Refresh only the base64 literal in template.ts, preserving the rest.
node - "$APP_DIR/src/move-template/template.ts" "$B64" <<'NODE'
const fs = require('node:fs');
const [file, b64] = process.argv.slice(2);
let s = fs.readFileSync(file, 'utf8');
s = s.replace(/export const TEMPLATE_MODULE_B64 =\n\s*'[^']*';/, `export const TEMPLATE_MODULE_B64 =\n  '${b64}';`);
fs.writeFileSync(file, s);
console.log('updated TEMPLATE_MODULE_B64 (%d base64 chars)', b64.length);
NODE

echo "Done. Verify the DEFAULT_* constants in template.ts still match the source."
