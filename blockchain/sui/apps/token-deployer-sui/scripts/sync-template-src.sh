#!/usr/bin/env bash
set -euo pipefail
# Copies the canonical sui-token-template text files into the app as a single
# JSON module (src/template-src/files.json), so the downloadable-package
# generator stays the single source of truth with the CLI generator. Re-run
# whenever the template's source/docs/scripts change.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$HERE/.."
T="$APP_DIR/../../blockchain/sui/sui-token-template"
OUT="$APP_DIR/src/template-src/files.json"
mkdir -p "$APP_DIR/src/template-src"

node - "$T" "$OUT" <<'NODE'
const fs = require('node:fs');
const [T, OUT] = process.argv.slice(2);
const read = (p) => fs.readFileSync(`${T}/${p}`, 'utf8');
const files = {
  'Move.toml': read('Move.toml'),
  'source.move': read('sources/sui_token_template.move'),
  'scripts/publish.sh': read('templates/publish.sh'),
  '.gitignore': read('templates/.gitignore'),
  'README.md': read('templates/README.md'),
  'deployments.md': read('templates/deployments.md'),
  'CLAUDE.md': read('templates/CLAUDE.md'),
  'AGENTS.md': read('templates/AGENTS.md'),
};
fs.writeFileSync(OUT, JSON.stringify(files, null, 2) + '\n');
console.log('wrote %s (%d files)', OUT, Object.keys(files).length);
NODE
