declare global {
  namespace Cypress {
    interface Chainable {
      connectMockWallet(): Chainable<void>
      fillMinimalForm(): Chainable<void>
      interceptSuiRpc(): Chainable<void>
    }
  }
}

Cypress.Commands.add('connectMockWallet', () => {
  cy.contains('button', 'Connect Wallet').click()
  cy.contains('button', 'Test Wallet').click()
})

Cypress.Commands.add('fillMinimalForm', () => {
  cy.get('#name').type('My Token')
  cy.get('#symbol').type('MTK')
  cy.get('#decimals').clear().type('9')
  cy.get('#package').type('my_token')
  cy.get('#module').type('mytoken')
})

Cypress.Commands.add('interceptSuiRpc', () => {
  // Fixed test digests in valid hex format (32 bytes = 64 hex chars)
  const publishDigest = '0x' + 'aa'.repeat(32)
  const packageId = '0x' + 'bb'.repeat(32)
  const treasureCapId = '0x' + 'cc'.repeat(32)
  const metadataCapId = '0x' + 'dd'.repeat(32)

  // Minimal valid SuiTransactionBlockResponse for successful deploy
  const successTxResponse = {
    digest: publishDigest,
    effects: {
      status: { status: 'success' },
      gasUsed: { computationCost: '1000', storageCost: '2000', storageRebate: '0' },
    },
    objectChanges: [
      { type: 'published', packageId },
      {
        type: 'created',
        objectType: `0x2::coin::TreasuryCap<${packageId}::mytoken::MYTOKEN>`,
        objectId: treasureCapId,
      },
      {
        type: 'created',
        objectType: `0x2::coin_registry::MetadataCap<${packageId}::mytoken::MYTOKEN>`,
        objectId: metadataCapId,
      },
    ],
    events: [],
    transaction: null,
    balanceChanges: null,
  }

  cy.intercept('POST', /fullnode|rpc/, (req) => {
    const method = req.body?.method
    cy.window().then((win) => {
      if ((win as Record<string, unknown>).__e2eDebug) {
        console.log('[E2E RPC Mock]', method, 'request:', req.body)
      }
    })

    const response = {
      jsonrpc: '2.0',
      id: req.body?.id || 1,
    } as Record<string, unknown>

    if (method === 'sui_executeTransactionBlock') {
      response.result = successTxResponse
    } else if (method === 'sui_getTransactionBlock') {
      // Called by waitForTransaction() to poll for transaction status
      response.result = successTxResponse
    } else if (method === 'suix_getCoins' || method === 'suix_getBalance') {
      response.result = { data: [], nextCursor: null, hasNextPage: false }
    } else {
      response.result = null
    }

    cy.window().then((win) => {
      if ((win as Record<string, unknown>).__e2eDebug) {
        console.log('[E2E RPC Mock]', method, 'response:', response)
      }
    })

    req.reply(200, response)
  }).as('suiRpc')
})
