# Security

## Trust model

The token-deployer is **client-side and non-custodial**. The app patches a pre-compiled Move
template in the browser, builds the publish PTB the user's own wallet signs and pays for, and
hands back a byte-identical downloadable source package. It holds **no keys, no funds, and no
on-chain capability**. The only value it moves is the per-deploy operator fee, split from the
user's own gas coin inside the signed PTB — it cannot be redirected at runtime.

Consequently the **maximum realistic severity is Low**: the worst outcomes are operator
fee-revenue loss (guarded), a malformed/injectable *generated* source package (guarded by
three independent layers), a supply-chain compromise of the pinned SDKs, or a user's GitHub
PAT leaking (guarded) — none can move the operator's or a third party's funds.

## Key invariants

- **Bytecode ↔ source parity** — the shipped `.mv` and the generated source both derive from
  the same `@meddleware/sui-token-template` commit; enforced by the template tests.
- **Layered injection safety** — form validation, `assertSafeConfig`, and the bytecode patcher
  each independently re-assert the safety rules.
- **Fee integrity** — the fee is split from `tx.gas` in the publish PTB; the production build
  fails on a zero-address treasury.
- **No backend / no custody** — all financial truth is on-chain; the app only constructs
  transactions.
- **Deterministic dependencies** — `package-lock.json` committed; use `npm ci`.

## Reporting

Report suspected vulnerabilities privately to `meddleware@proton.me`. Please do not open a
public issue for security-sensitive reports.

## Full review

See [docs/audits/token-deployer-sui-audit.md](docs/audits/token-deployer-sui-audit.md) for the
complete findings, invariant matrix, dependency risk table, and remediation status, and
[docs/audits/SYNTHESIS-apps.md](docs/audits/SYNTHESIS-apps.md) for the consolidated themes and
pre-launch checklist. The reusable review structure is in
[docs/audits/AUDIT_TEMPLATE.md](docs/audits/AUDIT_TEMPLATE.md). Operator revenue/treasury guidance
is in [docs/operator-treasury.md](docs/operator-treasury.md).
