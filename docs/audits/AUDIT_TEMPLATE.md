# Audit Template — Standard Sections (second-pass, 2026-07-25)

This template defines the **three standard sections** every per-package audit file must carry
after the second-pass review (2026-07-25). It is a companion to `SWITCHBOARD_REVIEW_TEMPLATE.md`
(which governs the oracle-specific Switchboard review only).

The first-pass audits (baseline 2026-06-16) used a consistent per-package skeleton — Executive
summary → Threat model / trust boundaries → Severity scale → Scope → Findings (F#/P#/OQ#) →
Verification. The second pass **keeps that skeleton** and adds the three matrices below, which the
first pass tracked only implicitly (in prose or finding bodies). New audit files authored in the
second pass use the full skeleton **plus** these three sections.

The severity taxonomy is unchanged (see any existing audit's "Severity Scale" block):
Critical / High / Medium / Low / Info / Positive. Every finding must carry a disposition
(RESOLVED / MITIGATED / ADJUDICATED / ACCEPTED-RISK / DEFERRED) with cited evidence — no bare-OPEN.

---

## Section A — Invariant verification matrix

One row per documented invariant the package is responsible for. The goal is to make explicit
*where* each invariant is enforced and *what proves it*, rather than leaving it in prose.

| # | Invariant (plain statement) | Enforced / asserted at (`file:fn`) | Proven by (test / code-assert / cross-pkg) | Status |
| --- | --- | --- | --- | --- |
| I1 | [e.g. `total_in == total_out` conserved across a mutating call] | `sources/x.move::fn` (or `src/x.ts`) | `tests/x_tests::test_conserve` | HOLDS / GAP |

Status values: **HOLDS** (enforced + proven), **HOLDS (code-only)** (enforced, no direct test),
**GAP** (documented but not enforced/proven — must produce a finding), **N/A**.

---

## Section B — Third-party dependency & upgrade-authority matrix

### B.1 External dependency risk

One row per external dependency reachable from this package (git-pinned Move deps and protocol shared
objects, or pinned npm dependencies for a TypeScript package). Purely internal deps are omitted.

| Dependency | Pinned rev / object ID | Env | Liveness dependency? | External audit status | Notes |
| --- | --- | --- | --- | --- | --- |
| [e.g. `stork`] | `ebc28e2…` | mainnet+testnet | rebalance price feed | [known audit / none at review date] | [read-only / fee-coin / etc.] |

"Liveness dependency?" — state precisely which code path halts if the dependency is unavailable
(e.g. "publish only", "icon upload only", "none — read is optional confirmation").

### B.2 Upgrade-authority & capability catalog

One row per privileged capability or upgrade authority the package mints, holds, or is gated by.

| Capability / UpgradeCap | Minted / held where | Custody after deploy | Gates | Immutability plan |
| --- | --- | --- | --- | --- |
| [e.g. `UpgradeCap` (this pkg)] | publish | `GOVERNANCE_ADDRESS` | package upgrade | mainnet-gate decision |
| [e.g. `StrategyAdapterCap`] | `admin::add_strategy` | sealed in shared config | adapter→core calls | n/a |

---

## Section C — Test-coverage & hermetic/localnet split

### C.1 Coverage grade

Beyond the raw test count, grade what is actually exercised.

| Dimension | Assessment |
| --- | --- |
| Happy-path coverage | [covered / partial / none] |
| Error-path / abort-code coverage | [list abort codes with a test vs. those without] |
| Boundary / edge-case coverage | [e.g. zero-amount, at-threshold, overflow] |
| NAV / accounting-math coverage | [covered / partial / none] |

### C.2 Hermetic vs. deferred paths

| Path | Hermetic unit test? | Deferred to (localnet / mock-harness / testnet)? | Tracking |
| --- | --- | --- | --- |
| [e.g. allocate with live rate] | no | mock-harness | `run_adapter_harness.sh` |

State plainly which paths **cannot** be hermetically tested (real shared objects required) so the
coverage grade is not misread as a gap where a live-object test is the only option.
