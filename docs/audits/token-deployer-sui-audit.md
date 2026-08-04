# Security Review — `token-deployer-sui`

**Classification:** Internal focused review (TypeScript / Vue browser app; first pass)
**Product:** `@meddleware/token-deployer` (`apps/sui/token-deployer-sui`) — a **separate product** from the
mwSUI vault (see `SYNTHESIS-apps.md`). Standalone-app corpus, not part of the vault campaign.
**Scope:** `src/lib/*` (validation 162, generatePackage 211, template 131, buildPublishTx 162, deploy 136,
github 146, licenses 122, walrus 83, walrus-constants 15, form 75, types 66), `src/composables/*`
(useWallet 133, useSuiClient 20, useWalrusRelay 133), `src/config.ts` (137), `src/main.ts`,
key components (`WalletBar.vue`, `GithubPush.vue`, `ResultPanel.vue`, `WalrusIconUpload.vue`),
`vite.config.ts`, `.env.*`, `scripts/e2e-deploy.mjs` + siblings, `package.json`, `README.md`, `CLAUDE.md`.
**Review date:** 2026-07-30
**Reviewer:** Internal review (first pass)
**Status:** Active, latest iteration (the retained `token-deployer-sui-old` / `token-deployer-envs` are
out of scope). First review of this package. Reviewed alongside the Phase-0 production-readiness work
(network-parametrized real-chain e2e harness) that this campaign added.

---

## Executive summary

`token-deployer-sui` is a **client-side, non-custodial** Vue 3 + Vite app that lets any user deploy their
own Sui coin: it patches one pre-compiled Move template in the browser, builds a two-phase publish PTB the
user's wallet signs and pays for, splits a trivial fee to the operator treasury, and hands back a
byte-identical downloadable source package (optionally pushed to the user's own GitHub). **The critical
scoping fact that bounds every finding: the app takes no custody of keys or funds, holds no on-chain
capability, and touches no vault accounting.** The only value it moves is the per-deploy operator fee,
and that is split from the user's own gas coin inside the signed PTB — it cannot be redirected at runtime.
Consequently the **maximum realistic severity is Low**: the worst outcomes are operator fee-revenue loss
(guarded), a malformed/injectable *generated* source package (guarded by three independent layers), a
supply-chain compromise of the pinned SDKs, or a user's GitHub PAT leaking (guarded) — none can move vault
or third-party funds.

The review surfaces **no Critical/High/Medium issues.** The package is notably well-built: injection
safety is layered (form → `assertSafeConfig` → `patchVecConstant`), fee integrity is enforced both in the
PTB and by a production-build guard, secrets are handled cleanly, and the bytecode↔source parity invariant
is test-enforced. The Low/Info items worth acting on before a production launch: **mixed caret/tilde
`@mysten/*` pins** (mitigated by a committed lockfile — F1); the **GitHub PAT is cleared only on a
successful push, not on failure** (F3); the **Walrus icon-upload RPC is hardcoded and not
operator-overridable** (F2, matches `walrus-audit` F6); and **`iconUrl` is length/charset-checked but not
scheme-validated** before it becomes on-chain coin metadata (F4). The real-chain deploy path was
previously unverifiable by the mocked test suite; the Phase-0 `e2e-deploy.mjs` harness now closes that gap
(F7) and its localnet run verified fee delivery + coin type on-chain.

> **Remediation (2026-07-30 — Phase 2 follow-ups):**
>
> - **F7 addressed in Phase 0** — a network-parametrized real-chain deploy e2e (`scripts/e2e-deploy.mjs`,
>   `npm run e2e:localnet|testnet|mainnet`) now covers real confirmation, the result panel, the source-zip
>   download, and on-chain fee/coin-type verification; a **pre-existing broken unit test** (walrus gRPC
>   mock used an arrow function with `new`) was fixed in the same pass (Vitest 67 green).
> - **F3 RESOLVED** — `GithubPush.vue` now clears the PAT in a `finally`, so it never outlives a single
>   push attempt whether it succeeds or fails.
> - **F5 RESOLVED** — `deploy.ts` now asserts a non-empty `packageId`/`coinType` after a successful
>   publish, failing loudly instead of rendering an empty result panel on a malformed RPC response.
> - **F1 MITIGATED / F2 DEFERRED / F4 ACCEPTED-RISK** are recorded with dispositions below.

---

## Severity Scale

| Severity | Meaning |
| --- | --- |
| **Critical** | Compromise leads to fund loss or key exposure |
| **High** | Compromise leads to significant asset loss or a credible key-handling flaw |
| **Medium** | Correctness/security gap requiring specific conditions |
| **Low** | Supply-chain / liveness / operational risk with bounded, non-fund impact |
| **Info** | Non-security observation or coverage note |
| **Positive** | Design decision notably well-executed |

Severity is bounded by the trust scope: **client-side, non-custodial coin deployment.** The app holds no
key, no fund, and no on-chain capability; nothing in it can affect the mwSUI vault or any third party.

---

## Scope

**In scope:** the `src/lib` deployment library (bytecode patch, PTB builders, orchestration, package
generation, licenses, github, walrus), the wallet/client composables, `config.ts`, the `VITE_E2E` block in
`main.ts`, the production-build treasury guard in `vite.config.ts`, the deploy-relevant components, the
real-chain e2e scripts, and the package docs.

**Out of scope / cross-package context:** the internals of `@mysten/*` SDKs and the `move-bytecode-template`
wasm (trusted upstream); the Walrus protocol, relay, and aggregator (covered for the shared client by
`walrus-audit.md`); the SPDX license archive and GitHub REST API (third-party services); the upstream
`blockchain/sui/sui-token-template` (the parity source — cross-referenced, not re-audited); the retained
`token-deployer-sui-old` / `token-deployer-envs` iterations.

**Environment:** `cd apps/sui/token-deployer-sui`; `npm run type-check` + `npm run lint` +
`npm test` (Vitest, **67 pass / 8 skip**) + `npm run test:e2e` (Cypress, mocked) are the automatic gates;
`npm run e2e:localnet` (real localnet publish) is the manual real-chain proof.

---

## Trust Model and Authority Boundaries

| Actor | Provides | Can do | Bounded by |
| --- | --- | --- | --- |
| User (browser + wallet) | token config, gas, signature, optional GitHub PAT | patch + publish their own coin; pay gas + fee | their own wallet funds; the app never persists key/PAT |
| Operator | the static build (treasury + RPC + relay envs) | receive the per-deploy fee; host the SPA | fee split is in the *signed* PTB; build fails on zero-address treasury |
| `@mysten/*` SDKs + wasm | client, PTB, bytecode primitives | all on-chain interaction, bytecode patch | trusted upstream; tilde/caret pins + committed lockfile (F1) |
| Walrus relay/aggregator | icon upload + serve (optional) | store/serve the public icon blob; charge a bounded tip | HTTPS; `WALRUS_MAX_TIP_MIST` ceiling; public assets only |
| GitHub / SPDX | optional repo push / license text | create a repo in the *user's* account; serve license text | user's own PAT (HTTPS-only); post-publish, non-gating |

**Key insight.** The app is a **transaction constructor + source generator**, not a custodian. Every
mutating action is signed by the user's wallet; the only operator-facing value (the fee) is bound into the
same PTB the user signs and cannot be re-pointed at runtime. The only trust it *extends* is to the pinned
SDKs, the wasm artifact, and the optional third-party services (Walrus/SPDX/GitHub), all of which are
either post-publish or serve public data.

---

## Findings

### Finding 1 (Low) — Mixed caret/tilde `@mysten/*` pins (mitigated by a committed lockfile)

`package.json` pins `@mysten/sui ~2.17.0` and `@mysten/walrus ~1.1.0` (tilde) but `@mysten/wallet-standard
^0.19.9`, `@mysten/bcs ^2.1.0`, and `@mysten/move-bytecode-template ^0.4.0` (caret). These SDKs run in the
same process that holds the user's wallet session and build the bytecode/PTB, so a compromised minor
release would sit on the deploy path. **Impact is bounded** — the signer is the user's own wallet, not a
vault capability, and a **`package-lock.json` is committed**, so `npm ci` resolves deterministically.
**Status: MITIGATED (Low).** **Recommendation:** narrow the three caret pins to tilde/exact and run
`npm ci` (not `npm install`) in the Cloudflare Pages build.

### Finding 2 (Info) — Walrus icon-upload RPC is hardcoded and not operator-overridable

`src/lib/walrus.ts` declares its own `RPC_URLS` (`fullnode.{testnet,mainnet}.sui.io:443`) for the
`SuiGrpcClient`, independent of `config.ts`'s `VITE_RPC_*`. The endpoint is correct (gRPC is what
`SuiGrpcClient` speaks, and the gRPC-only status of `fullnode.testnet.sui.io` is a feature here, not the
JSON-RPC landmine that affects the deploy path), but an operator who sets `VITE_RPC_TESTNET` for the
deploy path gets **no** override for the icon-upload client, and the public fullnode is rate-limited. Same
class as `walrus-audit` F6. **Status: DEFERRED (Info).** **Recommendation:** accept a
`CreateWalrusClientOptions.rpcUrl` override and thread `VITE_RPC_*` through.

### Finding 3 (Low/Info) — GitHub PAT is cleared only on a successful push, not on failure

`GithubPush.vue` sets `token.value = ''` inside the `try` after a successful push (`:40`), so a **failed**
push leaves the PAT in the reactive ref and the password input until the user edits it or navigates away.
The token is never logged, stored, or sent anywhere but `api.github.com` over HTTPS (`assertHttps`), so
this is a residence-time nit, not a leak. **Status: RESOLVED (2026-07-30)** — `GithubPush.vue` now clears
`token.value` in a `finally`, so the PAT never outlives a single attempt regardless of outcome.

### Finding 4 (Info) — `iconUrl` is charset/length-checked but not scheme-validated

`validation.ts` gates `iconUrl` with `SAFE_TEXT` (no quotes/backslashes/control chars) and a 512-char cap,
and `patchVecConstant` re-asserts the same before it is baked into the coin's on-chain `icon_url` metadata.
`SAFE_TEXT` permits any scheme, so `javascript:…` or `data:…` can be stored as the icon URL. It is the
user's **own** token and the rendering surface (wallets/explorers) is responsible for sanitising URLs, so
the practical risk is nil, but a light scheme allowlist (`https:`/`ipfs:`/the Walrus aggregator) would
harden the generated artifact. **Status: ACCEPTED-RISK (Info).** **Recommendation:** optional scheme
allowlist on `iconUrl`.

### Finding 5 (Info) — `extractPublishResult` degrades silently on an unexpected `objectChanges` shape

`extractPublishResult` (`buildPublishTx.ts`) returns `packageId: ''` / `coinType: ''` when the publish
`objectChanges` lack the expected `published` / `TreasuryCap<…>` entries, rather than asserting. On a real
chain these are always present (the localnet e2e confirms), and the finalize path *does* hard-fail if the
caps are missing (`deploy.ts:116`), but a malformed RPC response would surface as an empty result panel
rather than a clear error. **Status: RESOLVED (2026-07-30)** — `deploy.ts` now asserts non-empty
`packageId`/`coinType` after a successful publish and throws a clear error otherwise.

### Finding 6 (Info/Positive) — Clean third-party liveness separation

The **core deploy** (patch → publish → confirm → finalize) depends only on the Sui RPC and the user's
wallet. Everything third-party is optional and post-publish: SPDX license text (`raw.githubusercontent.com`)
for the LICENSE file, the Walrus relay/aggregator for the optional icon, and GitHub for the optional repo
push. A user can therefore always complete a deployment even if all three are down. **Status: Positive /
Info.** Documented in the README trust model.

### Finding 7 (Info) — Real-chain deploy path was untestable by the mocked suite (closed in Phase 0)

Before this campaign the only e2e was Cypress against a `VITE_E2E` fetch mock, which cannot reach real
confirmation, the result panel, the source download, or on-chain fee verification (the suite even
documented the confirmation step timing out under mocks). Phase 0 added `scripts/e2e-deploy.mjs` — one
network-parametrized harness (`localnet|testnet|mainnet`, mainnet gated behind `E2E_MAINNET_CONFIRM=1`) —
that drives the full UI, does a real publish, and verifies coin type + fee delta on-chain; the localnet run
passes. A **pre-existing** broken unit test (the walrus `SuiGrpcClient` mock used an arrow function with
`new`, which is not a constructor) was fixed in the same pass. **Status: RESOLVED (Info).**

### Finding 8 (Positive) — Layered injection defence with a correct trust split

User input is validated at the form (`validation.ts`: `MOVE_IDENT`, `SAFE_TEXT`, length caps, Move
reserved-word rejection) and **independently re-asserted** before substitution into Move source /
`Move.toml` (`generatePackage.ts::assertSafeConfig`) and before it is patched into the bytecode
(`template.ts::patchVecConstant`). Critically, the **free-text** fields (symbol/name/description/iconUrl)
only ever land inside Move `b"…"` byte-string literals — where `SAFE_TEXT`'s exclusion of `"`/`\`/control
chars prevents any literal breakout, and characters like `$`/backtick are inert bytes — while the generated
**`publish.sh`** receives *only* the strictly-`[a-z0-9_]` identifier fields, so there is no shell-injection
surface. Removing any one layer would not by itself create a hole, which is the correct defence-in-depth
posture.

### Finding 9 (Positive) — Fee integrity enforced in the PTB and at build time

The operator fee is `tx.splitCoins(tx.gas, [feeMist])` → `transferObjects([fee], treasury)` inside the
same publish PTB the user signs (`buildPublishTx.ts`), so it cannot be redirected at runtime, and it is
only taken when a real treasury is configured (`isFeeConfigured`). A **production build fails** if a
selectable network's treasury is the zero address (`vite.config.ts::assertTreasuryConfigured`), so revenue
can never silently burn to `0x0`. The localnet e2e independently confirmed the exact `FEE_MIST` reaching
the treasury.

### Finding 10 (Positive) — Non-custodial signing + correct wallet-proxy handling

Signing is delegated to the connected wallet via an injected `Executor` (`useWallet.ts::buildExecutor`);
the app never derives or holds a key, and the `VITE_E2E` mock wallet/fetch block is tree-shaken from
production. Wallet and account objects are `markRaw`'d before entering Vue state — the correct fix for the
extension `Wallet` objects whose private-field getters throw through a reactive Proxy — matching the known
workspace hazard.

---

## Section A — Invariant verification matrix

| # | Invariant | Enforced at | Proven by | Status |
| --- | --- | --- | --- | --- |
| I1 | Shipped `.mv` ↔ `files.json` derive from the same template | `template.ts` / `template-src` | `tests/templateArtifact.test.ts`, `tests/templateParity.test.ts`, `verify:template` | HOLDS |
| I2 | User input can never produce an injectable package | `validation.ts` + `generatePackage.ts::assertSafeConfig` + `template.ts::patchVecConstant` | `tests/validation.test.ts`, `tests/generatePackage.test.ts`, `tests/template.test.ts` | HOLDS |
| I3 | Fee split from gas to treasury; no zero-address burn | `buildPublishTx.ts` + `vite.config.ts::assertTreasuryConfigured` | `tests/buildPublishTx.test.ts`; on-chain via `e2e-deploy.mjs` (fee delta == `FEE_MIST`) | HOLDS |
| I4 | No backend / no key custody / no endorsement | app architecture; `useWallet.ts` executor | source review; README/footer disclaimers | HOLDS (code-only) |
| I5 | Heavy deps stay in lazy chunks (walrus/wasm dynamic; `useSuiClient` all-dynamic) | dynamic imports; `walrus-constants.ts` | `vite build` → standalone `useSuiClient`/`walrus` chunks, no `INEFFECTIVE_DYNAMIC_IMPORT` | HOLDS |
| I6 | Wallet/account objects never proxied by Vue | `useWallet.ts` (`markRaw`) | `tests/useWallet.test.ts`; source review | HOLDS |
| I7 | Free-text embeds safely in Move `b"…"` (no literal breakout) | `SAFE_TEXT` (excludes `"`/`\`/ctrl) | `tests/validation.test.ts`, `tests/template.test.ts` | HOLDS |
| I8 | `publish.sh` receives only `[a-z0-9_]` identifiers (no shell injection) | `renderPublishScript` (id fields only) | `tests/generatePackage.test.ts`; source review | HOLDS |
| I9 | GitHub PAT sent only to HTTPS `api.github.com`, never stored/logged, cleared after each attempt | `github.ts::assertHttps`; `GithubPush.vue` (`finally` clear) | `tests/github.test.ts`; source review | HOLDS (F3 resolved) |

---

## Section B — Third-party dependency & upgrade-authority matrix

### B.1 External dependency risk

| Dependency | Range / host | Pinned? | Liveness / trust dependency | Notes |
| --- | --- | --- | --- | --- |
| `@mysten/sui` | `~2.17.0` | tilde + lockfile | PTB build, sign/execute, wait | on the deploy path |
| `@mysten/walrus` | `~1.1.0` | tilde + lockfile | optional icon upload only | F1 |
| `@mysten/wallet-standard` | `^0.19.9` | **caret** + lockfile | wallet discovery/connect/sign | F1 |
| `@mysten/bcs` | `^2.1.0` | **caret** + lockfile | constant-pool encoding | F1 |
| `@mysten/move-bytecode-template` | `^0.4.0` | **caret** + lockfile | bytecode deserialize/serialize (wasm) | F1; wasm artifact trusted |
| Sui JSON-RPC fullnode | `VITE_RPC_*` | n/a | **core publish/confirm** | set a paid endpoint for prod |
| Walrus relay + aggregator | host consts | n/a | optional icon (public assets) | tip bounded (`WALRUS_MAX_TIP_MIST`); F2 |
| SPDX archive (`raw.githubusercontent.com`) | host const | n/a | optional LICENSE text (post-publish) | F6 |
| GitHub REST API | `api.github.com` | n/a | optional repo push (user's PAT) | HTTPS-only; F6 |

"Liveness dependency?" — only the **Sui RPC + wallet** gate a deployment; every other service is optional
and post-publish (F6).

### B.2 Upgrade-authority & capability catalog

Not an on-chain package — the app **mints and holds no capability.** The deployed token's `UpgradeCap` is
either burned (`make_immutable`) or transferred to the **user**, and the `TreasuryCap`/`MetadataCap` go to
the user; the app retains nothing after the PTB executes.

| "Authority" | Where | Custody | Gates | Notes |
| --- | --- | --- | --- | --- |
| npm publish / dependency updates | CI / maintainer | maintainer | shipped SDK versions | controlling supply-chain risk (F1) |
| Cloudflare Pages deploy + build envs | operator | operator | the static bundle (treasury/RPC/relay) | treasury baked in; zero-addr build guard |
| Operator treasury address | `.env.production` / dashboard | operator | fee destination | public receiving address; safe to commit |
| Deployed token caps (`UpgradeCap`/`TreasuryCap`/`MetadataCap`) | on-chain, after publish | **the user** | the user's own token | app never holds them |

## Section C — Test-coverage & hermetic/deferred split

### C.1 Coverage grade

| Dimension | Assessment |
| --- | --- |
| Happy-path (unit) | Covered — Vitest 67 pass across validation, template patch, PTB builders, generatePackage, deploy orchestration (mock executor), github, licenses, walrus client, useWallet, parity/artifact. |
| Injection / safety paths | Covered — validation + generatePackage + template each have dedicated suites for the SAFE_TEXT/MOVE_IDENT/keyword rules. |
| UI flow | Covered (mocked) — Cypress wallet/form/publish against the `VITE_E2E` mock (cannot reach real confirmation). |
| Real-chain deploy | Covered on localnet — `e2e-deploy.mjs` (real publish, result panel, zip, on-chain fee/coin-type). Testnet/mainnet are manual (deferred). |
| Error paths | Partial — `assertSuccess`/finalize-missing-cap covered; `extractPublishResult` degenerate shape not asserted (F5). |

### C.2 Hermetic vs. deferred paths

| Path | Hermetic unit test? | Deferred to | Tracking |
| --- | --- | --- | --- |
| bytecode patch / parity | yes | — | `verify:template` |
| PTB construction / fee split | yes | — | `tests/buildPublishTx.test.ts` |
| deploy orchestration | yes (mock executor) | — | `tests/deploy.test.ts` |
| wallet/form/publish UI | mocked (Cypress) | — | `npm run test:e2e` |
| real publish + confirmation + result panel + on-chain fee | no (needs a chain) | localnet (run), testnet/mainnet (manual) | `npm run e2e:{localnet,testnet,mainnet}`; README runbook |
| Walrus icon upload end-to-end | no | testnet | `scripts/e2e-walrus-browser.mjs` |

Paths that **cannot** be hermetically tested (a real chain or a live Walrus relay is the only option) are
the real publish/confirmation and the icon upload — both now have a documented, gated real-chain harness.

---

## Recommendations

1. **(F1)** Narrow the three caret `@mysten/*` pins to tilde/exact; run `npm ci` in the Pages build.
   *(Open — deliberate maintainer step with a controlled `npm install`; lockfile already mitigates.)*
2. ~~**(F3)** Clear the GitHub PAT in a `finally`/on-error so it never outlives one push attempt.~~
   **DONE (2026-07-30).**
3. **(F2)** Add an `rpcUrl` override to `CreateWalrusClientOptions` and thread `VITE_RPC_*` through.
4. **(F4)** Optional `iconUrl` scheme allowlist before it becomes on-chain metadata.
5. ~~**(F5)** Assert non-empty `packageId`/`coinType` after a successful publish.~~ **DONE (2026-07-30).**
6. Run `npm run e2e:testnet` once, manually, against a funded key before launch (README runbook) — the
   only remaining unexercised real-chain path.

## Open questions

1. Should the operator run their own Walrus relay at launch (to collect the tip) or ship with the public
   Mysten relay (earns nothing)? Drives F2 and the `VITE_WALRUS_RELAY_*` config.
2. Is a `iconUrl` scheme allowlist (F4) wanted, or is downstream wallet/explorer sanitisation considered
   sufficient (the user's-own-token argument)?
