# AGENTS.md — token-deployer

Concise agent policy for the standalone token-deployer repo. Read [CLAUDE.md](CLAUDE.md) and
the Sui app's [CLAUDE.md](blockchain/sui/apps/token-deployer-sui/CLAUDE.md) first.

- **Scope to token deployment.** This repo is self-contained; do not reference or assume any
  consuming application.
- **No backend, no custody.** All financial truth stays on-chain / in the signed PTB. The app
  only previews and constructs transactions. Never add a server dependency.
- **Preserve layered injection safety.** `validation.ts`, `generatePackage.ts`, and
  `template.ts` each re-assert the safety rules; never drop a downstream guard.
- **Bytecode ↔ source parity.** The shipped `.mv` and `src/template-src/files.json` derive
  from the same `@meddleware/sui-token-template` commit. After any template change, run
  `regen:template && sync:template && verify:template`.
- **Published deps by name.** The Move template (and, later, `@meddleware/sui-walrus`) are
  consumed by their published npm names — never a cross-repo relative link.
- **Use Sui MCP for Sui facts.** Documentation-only; execute via `sui move build` / `npm test`
  / RPC.
- **Generate tests with code.** Keep unit (Vitest), mocked-RPC (Cypress), and real-chain
  (Playwright) tests distinct.
- **Real-chain e2e is manual only** (`workflow_dispatch`); never on push. Mainnet needs an
  explicit confirmation input.
