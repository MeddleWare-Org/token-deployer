# CLAUDE.md — token-deployer

Repository-wide guidance for the standalone **token-deployer** project: client-side,
non-custodial token deployers, one app per blockchain under `blockchain/<chain>/apps/`.
The current occupant is the Sui deployer.

This repo is self-contained. It does **not** depend on, and should not reference, any
consuming application — scope everything to token deployment itself.

## Layout

- `blockchain/sui/apps/token-deployer-sui/` — the Sui deployer (Vue 3 + Vite). Deep
  architecture and invariants live in its own
  [CLAUDE.md](blockchain/sui/apps/token-deployer-sui/CLAUDE.md); read it before touching
  the money/parity paths.
- `docs/audits/` — the security review and the reusable `AUDIT_TEMPLATE.md`.
- `.github/workflows/` — the manual (`workflow_dispatch`) real-chain e2e; never on push.

## External dependencies (published packages)

- **`@meddleware/sui-token-template`** — the canonical Move token template. The app ships a
  pre-compiled `.mv` + source bundle, so it builds standalone; template *regeneration*
  resolves this package from `node_modules` (or `SUI_TOKEN_TEMPLATE_DIR`). It is an optional
  dependency so `npm ci` tolerates it being unpublished. When wiring more consumers to it,
  always use the published name — never a cross-repo relative link.
- **`@mysten/*`** SDKs — pinned; `package-lock.json` committed. Use `npm ci`, not `install`.

The app currently vendors its own minimal Walrus client (`src/lib/walrus.ts`). Once
`@meddleware/sui-walrus` is published it should consume that instead (preserving the app's
lazy-load boundary around `@mysten/walrus`); see the note atop `src/lib/walrus.ts`.

## MCP resources

- **Sui Knowledge Docs** (`.vscode/mcp.json`) — the authoritative source for Sui Move
  syntax, framework types, the TypeScript SDK, and current standards/deprecations. Prefer it
  over memory when citing Sui facts. MCPs are documentation-only: they do not build, test, or
  reach chain state — use `sui move build`, `npm test`, and RPC for execution.

## Commands (Sui app)

```bash
cd blockchain/sui/apps/token-deployer-sui
npm ci
npm run dev | build | preview
npm test | test:e2e            # Vitest units | Cypress mocked-RPC UI e2e
npm run type-check | lint | format
npm run regen:template | sync:template | verify:template   # needs the Move template
npm run e2e:localnet | e2e:testnet | e2e:mainnet           # real-chain, manual only
```

## Working rules

- Keep all financial truth on-chain / in the signed PTB; the app previews and constructs
  only. No backend, no custody.
- Injection safety is layered — never remove a downstream guard assuming the form checked.
- The shipped bytecode and generated source must stay in lock-step with the template; after
  a template change run `regen:template && sync:template && verify:template`.
- When generating code, generate tests. Distinguish unit (Vitest) from mocked-RPC (Cypress)
  from real-chain (Playwright) — do not collapse them.
