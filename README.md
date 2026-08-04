# token-deployer

A client-side, non-custodial token deployer. Each blockchain gets its own app under
`blockchain/<chain>/apps/`; the first is the **Sui** deployer — a Vue 3 + Vite browser app
that lets any user deploy their own coin fully client-side (their wallet signs and pays
gas, plus a trivial fee to the operator treasury) and download a matching, buildable source
package.

Nothing runs on a backend and the app never takes custody of keys or funds — it only
previews values and constructs transactions the user's wallet signs.

## Repository layout

```text
token-deployer/
├── blockchain/sui/apps/token-deployer-sui/   # Sui deployer app (Vue 3 + Vite)
├── docs/
│   ├── audits/                               # security review + reusable audit template
│   └── … 
├── .github/workflows/                        # manual real-chain e2e workflow
├── .claude/ · .vscode/                       # agent skills + MCP config
└── LICENSE
```

The Sui app is the current occupant. See its
[README](blockchain/sui/apps/token-deployer-sui/README.md) for the full user/operator guide
(bytecode patching, two-phase publish, fee integrity, Walrus icon relay, deployment) and its
[CLAUDE.md](blockchain/sui/apps/token-deployer-sui/CLAUDE.md) for architecture and invariants.

## Quick start (Sui app)

```bash
cd blockchain/sui/apps/token-deployer-sui
npm ci
npm run dev          # local dev server
npm test             # unit tests (Vitest)
npm run type-check   # vue-tsc
```

Copy [`.env.example`](blockchain/sui/apps/token-deployer-sui/.env.example) to `.env` and set
your operator treasury addresses before a production build.

## The Move template dependency

The Sui app ships a pre-compiled `.mv` and a canonical source bundle (`src/template-src/`),
so it builds and runs standalone. Regenerating those from source (`npm run regen:template`,
`npm run sync:template`, `npm run verify:template`) requires the Move template, which is the
published **`@meddleware/sui-token-template`** package. It is declared as an optional
dependency (so `npm ci` never breaks while it is unpublished) and resolved from
`node_modules`; point `SUI_TOKEN_TEMPLATE_DIR` at a local checkout to override. When the
template is not resolvable, the parity assertions skip — the vendored artifacts still ship.

## Security

The app is client-side and non-custodial; the maximum realistic severity is bounded
accordingly. See [SECURITY.md](SECURITY.md), the full review in
[docs/audits/token-deployer-sui-audit.md](docs/audits/token-deployer-sui-audit.md), and the
consolidated roll-up in [docs/audits/SYNTHESIS-apps.md](docs/audits/SYNTHESIS-apps.md).

## Operating the deployer

Revenue is a small per-deploy fee split from the user's gas into the operator treasury (the app
never holds user funds). See [docs/operator-treasury.md](docs/operator-treasury.md) for treasury
configuration, the zero-address build guard, and the Walrus relay tip.

## Roadmap — planned ecosystem support

Deployers for further ecosystems are planned alongside the Sui app:

- Bitcoin (L1 and L2s)
- Sui *(current)*
- Solana (SVM)
- Ethereum (EVM)
- Monero
- Near
- Litecoin
- Dogecoin
- Qortal

## License

CC0-1.0 — see [LICENSE](LICENSE).
