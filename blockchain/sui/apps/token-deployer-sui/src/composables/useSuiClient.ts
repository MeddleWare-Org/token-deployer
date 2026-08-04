import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'
import { RPC_URLS } from '../config.js'
import type { Network } from '../lib/types.js'

const clients = new Map<Network, SuiJsonRpcClient>()

/** Cached JSON-RPC client per network. */
export function getSuiClient(network: Network): SuiJsonRpcClient {
  let client = clients.get(network)
  if (!client) {
    client = new SuiJsonRpcClient({ url: RPC_URLS[network], network })
    clients.set(network, client)
  }
  return client
}

/** The wallet-standard chain identifier for a network. */
export function chainForNetwork(network: Network): `sui:${string}` {
  return `sui:${network}`
}
