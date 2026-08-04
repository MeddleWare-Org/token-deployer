import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import templateFiles from '../src/template-src/files.json'

// Single-source-of-truth guard. `src/template-src/files.json` is generated from
// the canonical sui-token-template by scripts/sync-template-src.sh. This test
// fails if the two drift — i.e. the template changed but the sync script was not
// re-run — so the downloadable package can never silently diverge from the CLI
// generator (and, via the shared source, the on-chain bytecode).

const files = templateFiles as Record<string, string>
// vitest runs with cwd = the app dir; the canonical template is two levels up.
const T = resolve(process.cwd(), '../../blockchain/sui/sui-token-template')

// Mirrors the key -> source mapping in scripts/sync-template-src.sh.
const SOURCE_OF: Record<string, string> = {
  'Move.toml': 'Move.toml',
  'source.move': 'sources/sui_token_template.move',
  'scripts/publish.sh': 'templates/publish.sh',
  '.gitignore': 'templates/.gitignore',
  'README.md': 'templates/README.md',
  'deployments.md': 'templates/deployments.md',
  'CLAUDE.md': 'templates/CLAUDE.md',
  'AGENTS.md': 'templates/AGENTS.md',
}

describe('template-src parity with the canonical sui-token-template', () => {
  const templatePresent = existsSync(`${T}/Move.toml`)

  it('bundles exactly the expected file keys', () => {
    expect(Object.keys(files).sort()).toEqual(Object.keys(SOURCE_OF).sort())
  })

  for (const [key, rel] of Object.entries(SOURCE_OF)) {
    it.skipIf(!templatePresent)(`files.json["${key}"] matches ${rel} verbatim`, () => {
      const canonical = readFileSync(`${T}/${rel}`, 'utf8')
      expect(files[key]).toBe(canonical)
    })
  }
})
