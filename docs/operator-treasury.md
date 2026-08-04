# Operator treasury & fees

How the token-deployer collects revenue, and how an operator should hold it. The app is
**non-custodial**: it never holds user funds. The only value it moves is a small per-deploy fee,
and it is split from the user's own gas coin inside the PTB the user signs — it cannot be
redirected at runtime.

## The deploy fee

- **`VITE_FEE_MIST`** — the flat fee (in MIST) split into the operator treasury on each deploy.
  Default 1 SUI (`1000000000`). It is bound into the signed publish PTB, not charged separately.
- **`VITE_FEE_TREASURY_TESTNET` / `VITE_FEE_TREASURY_MAINNET`** — the recipient address per
  network. **Required** for the fee to be collected.
- **Zero-address build guard** — a production build **fails** if a selectable network's treasury
  is still the zero address (`assertTreasuryConfigured` in `vite.config.ts`), so revenue can never
  silently burn. `VITE_ALLOW_UNSET_TREASURY=1` bypasses it (dev/e2e only).

The committed operator defaults live in `.env.production` (auto-loaded by `vite build`); see
[`.env.example`](../blockchain/sui/apps/token-deployer-sui/.env.example) for the full list.

## Holding the treasury

- **Prefer a multisig** for the treasury address, especially on mainnet. A single-signer key is
  acceptable only for early/testnet operation; move to a hardware-wallet or higher-quorum multisig
  before mainnet revenue accrues.
- The testnet and mainnet treasuries can be the same address or different — they are independent
  env vars.
- **Rotating the treasury requires a frontend redeploy** — the address is a build-time constant
  (`import.meta.env`), not a runtime setting. Update `.env.production` (or the Cloudflare Pages
  environment) and rebuild.

## Walrus icon-upload revenue (separate)

The icon upload can additionally earn a native per-upload **tip** if the operator runs their own
Walrus upload relay (`VITE_WALRUS_RELAY_*`); unset falls back to the public Mysten relay (which
earns the operator nothing). The client-side `VITE_WALRUS_MAX_TIP_MIST` guard must exceed the
relay's configured tip. See the app README's relay runbook and
[SECURITY.md](../SECURITY.md).
