// Minimal Sui wallet integration built directly on @mysten/wallet-standard
// (dapp-kit is React-only). Discovers installed wallets, connects, and adapts the
// connected wallet + account into the deploy `Executor`.
//
// NOTE: the signing path can only be exercised with a real wallet extension in a
// browser; it is intentionally thin and delegates execution to our JSON-RPC
// client so we control the returned effects/objectChanges.

import { markRaw, readonly, ref, shallowRef } from 'vue'
import { getWallets, isWalletWithRequiredFeatureSet } from '@mysten/wallet-standard'
import type { Wallet, WalletAccount } from '@mysten/wallet-standard'
import type { Transaction } from '@mysten/sui/transactions'
import type { Executor, SuiTxResult } from '../lib/deploy.js'
import { extractErrorMessage } from '../lib/errors.js'
import type { Network } from '../lib/types.js'

const REQUIRED_FEATURES = ['standard:connect', 'sui:signTransaction'] as const
const STORAGE_KEY = 'sui-deployer:wallet'

const wallets = shallowRef<Wallet[]>([])
const currentWallet = shallowRef<Wallet | null>(null)
const account = shallowRef<WalletAccount | null>(null)
const connecting = ref(false)
const error = ref<string | null>(null)

async function tryAutoReconnect(): Promise<void> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored || currentWallet.value) return
  const wallet = wallets.value.find((w) => w.name === stored)
  if (!wallet) return
  try {
    const connectFeature = wallet.features['standard:connect'] as {
      connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }>
    }
    const { accounts } = await connectFeature.connect({ silent: true })
    if (!accounts.length) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    currentWallet.value = markRaw(wallet)
    account.value = markRaw(accounts[0])
  } catch {
    // Silently ignore — user will reconnect manually
  }
}

function refreshWallets(): void {
  // markRaw each wallet: extension Wallet objects expose name/icon as getters
  // backed by ES private fields, which throw ("private field on non-instance")
  // if accessed through a Vue reactive/readonly Proxy. markRaw stops Vue from
  // ever proxying them, so template access to `w.name`/`w.icon` is safe.
  wallets.value = getWallets()
    .get()
    .filter((w) => isWalletWithRequiredFeatureSet(w, [...REQUIRED_FEATURES]))
    .map((w) => markRaw(w))
  void tryAutoReconnect()
}

let initialised = false
function init(): void {
  if (initialised) return
  initialised = true
  const api = getWallets()
  refreshWallets()
  api.on('register', refreshWallets)
  api.on('unregister', refreshWallets)
}

async function connect(wallet: Wallet): Promise<void> {
  error.value = null
  connecting.value = true
  try {
    const connectFeature = wallet.features['standard:connect'] as {
      connect: () => Promise<{ accounts: readonly WalletAccount[] }>
    }
    const { accounts } = await connectFeature.connect()
    if (!accounts.length) throw new Error('Wallet returned no accounts.')
    // markRaw for the same reason as refreshWallets: account/wallet objects carry
    // private-field getters that break when accessed through a Vue Proxy.
    currentWallet.value = markRaw(wallet)
    account.value = markRaw(accounts[0])
    localStorage.setItem(STORAGE_KEY, wallet.name)
  } catch (e) {
    error.value = extractErrorMessage(e)
    throw e
  } finally {
    connecting.value = false
  }
}

function disconnect(): void {
  const w = currentWallet.value
  const disc = w?.features['standard:disconnect'] as
    | { disconnect?: () => Promise<void> }
    | undefined
  void disc?.disconnect?.()
  currentWallet.value = null
  account.value = null
  localStorage.removeItem(STORAGE_KEY)
}

/** Build a deploy Executor bound to the connected wallet + selected network. */
async function buildExecutor(network: Network): Promise<Executor> {
  const wallet = currentWallet.value
  const acct = account.value
  if (!wallet || !acct) throw new Error('Connect a wallet first.')
  const { getSuiClient, chainForNetwork } = await import('./useSuiClient.js')
  const client = getSuiClient(network)
  const chain = chainForNetwork(network)

  const signFeature = wallet.features['sui:signTransaction'] as {
    signTransaction: (input: {
      transaction: Transaction
      account: WalletAccount
      chain: `sui:${string}`
    }) => Promise<{ bytes: string; signature: string }>
  }

  return {
    async signAndExecute(tx: Transaction): Promise<SuiTxResult> {
      const { bytes, signature } = await signFeature.signTransaction({
        transaction: tx,
        account: acct,
        chain,
      })
      const res = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEffects: true, showObjectChanges: true },
      })
      return res as unknown as SuiTxResult
    },
    async waitForTransaction(digest: string): Promise<void> {
      await client.waitForTransaction({ digest })
    },
  }
}

/**
 * Vue composable exposing shared wallet state and actions as a module singleton.
 *
 * @returns Readonly reactive refs (`wallets`, `currentWallet`, `account`,
 * `connecting`, `error`) plus `connect(wallet)`, `disconnect()` and
 * `buildExecutor(network)` — the last adapts the connected wallet into the deploy
 * {@link Executor}.
 */
export function useWallet() {
  init()
  return {
    wallets: readonly(wallets),
    currentWallet: readonly(currentWallet),
    account: readonly(account),
    connecting: readonly(connecting),
    error: readonly(error),
    connect,
    disconnect,
    buildExecutor,
  }
}
