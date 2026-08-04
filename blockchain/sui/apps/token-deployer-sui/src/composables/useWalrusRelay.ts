import { ref, computed } from 'vue'
import { WALRUS_RELAY_HOSTS, PUBLIC_WALRUS_RELAY_HOSTS } from '../config.js'
import type { WalrusNetwork } from '../lib/walrus.js'

/**
 * A Walrus relay option: either the operator's relay or the public Mysten relay.
 * Tracks whether it's accessible and what tip it charges.
 */
export interface RelayOption {
  label: string
  host: string
  tip: bigint | null // null if not accessible
  isPublic: boolean
}

/**
 * Manage Walrus relay selection and cost estimation.
 *
 * Detects whether the operator relay is accessible (health check on `/v1/tip-config`).
 * If accessible, shows both operator (default) and public relay options. If not,
 * shows only the public relay. Calculates estimated cost based on file size.
 */
export function useWalrusRelay(network: WalrusNetwork) {
  const operatorRelayHost = WALRUS_RELAY_HOSTS[network]
  const publicRelayHost = PUBLIC_WALRUS_RELAY_HOSTS[network]
  const isOperatorRelayConfigured = operatorRelayHost !== publicRelayHost

  const selectedRelayHost = ref(operatorRelayHost)
  const operatorRelayAccessible = ref<boolean | null>(null) // null = checking, true/false = result
  const operatorRelayTip = ref<bigint | null>(null)
  const fileSizeBytes = ref(0)

  // Health check: can we reach the operator relay's /v1/tip-config?
  const checkOperatorRelayHealth = async (): Promise<void> => {
    if (!isOperatorRelayConfigured) {
      operatorRelayAccessible.value = false
      return
    }
    try {
      const res = await fetch(`${operatorRelayHost}/v1/tip-config`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        operatorRelayAccessible.value = true
        // Extract the tip from the response (const or linear)
        try {
          const data = await res.json()
          // The relay returns send_tip with kind (const: N or linear: {base, encoded_size_mul_per_kib})
          // For estimation, use the base (or const) value
          if (data.send_tip?.kind?.const !== undefined) {
            operatorRelayTip.value = BigInt(data.send_tip.kind.const)
          } else if (data.send_tip?.kind?.linear?.base !== undefined) {
            operatorRelayTip.value = BigInt(data.send_tip.kind.linear.base)
          }
        } catch {
          // If we can't parse the tip, that's okay — we'll show "No tip" in the UI
        }
      } else {
        operatorRelayAccessible.value = false
      }
    } catch {
      operatorRelayAccessible.value = false
    }
  }

  // If operator relay is not healthy, switch to public relay and disable switching back
  const availableRelays = computed((): RelayOption[] => {
    const relays: RelayOption[] = []

    if (isOperatorRelayConfigured && operatorRelayAccessible.value) {
      relays.push({
        label: 'Operator relay (supports your vault)',
        host: operatorRelayHost,
        tip: operatorRelayTip.value,
        isPublic: false,
      })
    }

    relays.push({
      label: 'Public relay (free, no tip)',
      host: publicRelayHost,
      tip: null,
      isPublic: true,
    })

    return relays
  })

  // If operator relay is not accessible, force the selection to the public relay
  const ensureValidSelection = () => {
    const available = availableRelays.value.map((r) => r.host)
    if (!available.includes(selectedRelayHost.value)) {
      selectedRelayHost.value = publicRelayHost
    }
  }

  // Estimate the cost for the selected relay, based on file size
  const estimatedCost = computed((): { mist: bigint; sui: string; label: string } | null => {
    if (fileSizeBytes.value === 0) return null

    const relayHost = selectedRelayHost.value
    if (relayHost === publicRelayHost) {
      return { mist: 0n, sui: '0', label: 'Free (public relay)' }
    }

    // Operator relay — use the tip config
    if (operatorRelayTip.value === null) {
      return null // not yet loaded
    }

    // For simplicity, estimate using the base (const) or linear base
    // Exact cost depends on encoding, which we don't know until encode() is called
    // but this gives a good ballpark
    let tipMist = operatorRelayTip.value

    const tipSui = Number(tipMist) / 1e9
    return {
      mist: tipMist,
      sui: tipSui.toFixed(6),
      label: `Estimated relay fee: ${tipSui.toFixed(4)} SUI`,
    }
  })

  return {
    selectedRelayHost,
    operatorRelayAccessible,
    availableRelays,
    fileSizeBytes,
    estimatedCost,
    checkOperatorRelayHealth,
    ensureValidSelection,
  }
}
