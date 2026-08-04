# token-deployer — Consolidated Audit Synthesis

> **Domain synthesis** for the standalone token-deployer product. A cross-reference /
> consistency roll-up over the per-app audit(s) in this repo.

**Classification:** Internal focused-review roll-up — standalone application
**Scope:** the token-deployer app, audited on its own (client-side, non-custodial) trust
model. Currently **1 audit file**: [`token-deployer-sui-audit.md`](token-deployer-sui-audit.md).
**Produced by:** Cross-reference / consistency pass over the per-app audit(s).
**Status:** Internal. Introduces no new findings — it de-duplicates, ranks, and cross-references
the per-app report(s).
**Updated:** 2026-07-30 — first apps synthesis (created alongside the token-deployer-sui audit and
its Phase-0 real-chain e2e work).

---

## 1. Executive summary

The token-deployer is a **client-side, non-custodial** product that constructs transactions and
generates artifacts but never takes custody of keys or funds and holds no on-chain authority. Its
severity is bounded accordingly: nothing in it can move the operator's or a third party's funds —
the only value it moves is the per-deploy operator fee, split from the user's own gas coin inside
the signed PTB. The controlling risks are supply-chain (the pinned `@mysten/*` SDKs + wasm that run
in the same process as a wallet session), the integrity of *generated* artifacts (that a malicious
input cannot produce an injectable package), operator fee integrity, and user-secret hygiene
(GitHub PAT) — all **bounded, non-fund** risks.

**Overall posture: healthy.** The audited app (`token-deployer-sui`) surfaced **no
Critical/High/Medium findings**; the review found layered injection defence, PTB + build-time fee
integrity, non-custodial signing, and a test-enforced bytecode↔source parity invariant, with only
Low/Info hardening items outstanding.

## 2. Systemic / recurring themes

Stated once, with the affected app(s). Per-app finding numbers link back to the source report.

### A1 — Supply-chain: `@mysten/*` dependency-range drift — **Low (mitigated)**

**Apps:** `token-deployer-sui` (F1). Mixed caret/tilde `@mysten/*` pins, but a `package-lock.json` is
committed so `npm ci` is deterministic. The controlling authority here is the npm publish + dependency
update process (there is no on-chain upgrade key). **Recommendation:** tighten caret pins and use `npm ci`
in the build. The same SDK family / class of risk applies to the `@meddleware/sui-walrus` client.

### A2 — Generated-artifact & injection safety — **Low → HOLDS**

**Apps:** `token-deployer-sui` (F8, I2/I7/I8). Any client-side generator that substitutes user input into
source/bytecode/scripts must prove no input can produce an injectable artifact. The deployer does this with
three independent layers (form → `assertSafeConfig` → `patchVecConstant`) and a correct trust split
(free-text only into Move `b"…"`; shell scripts get only `[a-z0-9_]` identifiers). No gap found. Any
future app in this domain that generates code should be held to the same layered standard.

### A3 — User-secret & operator-fee hygiene — **Low → HOLDS (one nit)**

**Apps:** `token-deployer-sui` (F3, F9, I9). Secrets (GitHub PAT) are password-typed, HTTPS-only, never
stored/logged; the operator fee is bound into the signed PTB and guarded by a zero-address build check.
The residual nit — the PAT being cleared only on a successful push — was **fixed (F3 RESOLVED 2026-07-30):
it is now cleared in a `finally`**.

### A4 — Real-chain vs mocked test coverage — **Info → improving**

**Apps:** `token-deployer-sui` (F7, Section C). Browser apps whose core value is an on-chain transaction
cannot be fully proven by mocked UI tests. The deployer closed its confirmation/result-panel gap with a
network-parametrized real-chain e2e harness (localnet run verified; testnet/mainnet gated + manual). Future
apps should carry the same hermetic-unit + mocked-UI + gated-real-chain split.

## 3. Master findings table

No Critical/High/Medium to date. Low/Info items, de-duplicated:

| # | Finding | App(s) | Severity | Disposition | Source |
| --- | --- | --- | --- | --- | --- |
| A1 | Mixed caret/tilde `@mysten/*` pins | token-deployer-sui | Low | MITIGATED (lockfile committed) | token-deployer F1 |
| A2 | Layered injection defence / correct trust split | token-deployer-sui | Positive | HOLDS | token-deployer F8 |
| A3 | GitHub PAT cleared only on success, not failure | token-deployer-sui | Low | RESOLVED (finally-clear) | token-deployer F3 |
| — | Walrus icon-upload RPC not operator-overridable | token-deployer-sui | Info | DEFERRED | token-deployer F2 |
| — | `iconUrl` charset/length-checked, not scheme-validated | token-deployer-sui | Info | ACCEPTED-RISK | token-deployer F4 |
| — | `extractPublishResult` degrades silently on bad RPC shape | token-deployer-sui | Info | RESOLVED (non-empty assert) | token-deployer F5 |
| — | Real-chain deploy path (was untestable under mocks) | token-deployer-sui | Info | RESOLVED (Phase 0 harness) | token-deployer F7 |

## 4. Pre-launch checklist

Per-app launch gates (this product launches independently):

- **token-deployer-sui**
  - [ ] Tighten the caret `@mysten/*` pins; `npm ci` in the Cloudflare Pages build (A1 / F1).
  - [x] Clear the GitHub PAT on failure as well as success (F3 — done 2026-07-30).
  - [ ] Run `npm run e2e:testnet` once manually against a funded key (README runbook) — the only
        unexercised real-chain path. Do not run until launch-ready (premature token exposure).
  - [ ] Confirm the operator treasury (`.env.production`) and decide the Walrus relay posture (own relay
        to collect the tip, or the public relay). (F2 / open question 1.)

## 5. Open questions

1. Walrus relay at launch — operator-run (collect the tip) vs public Mysten relay (earns nothing)?
   *(token-deployer F2 / open question 1)*
2. `iconUrl` scheme allowlist, or rely on downstream wallet/explorer sanitisation? *(token-deployer F4)*
