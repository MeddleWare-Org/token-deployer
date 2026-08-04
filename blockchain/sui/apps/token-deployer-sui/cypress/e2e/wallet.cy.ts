describe('Wallet connection dialog', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('renders header always', () => {
    cy.get('header h1').should('contain', 'Create your own Sui coin')
  })

  it('shows connect wallet button with mock wallet available', () => {
    cy.contains('button', 'Connect Wallet').should('be.visible')
    cy.get('#name').should('not.exist')
  })

  it('opens dialog on connect wallet button click', () => {
    cy.contains('button', 'Connect Wallet').click()
    cy.get('dialog').should('exist')
    cy.get('dialog h2').should('contain', 'Connect Wallet')
    cy.get('dialog select#dialog-network-select').should('exist')
    cy.get('dialog button').contains('Test Wallet').should('exist')
  })

  it('dialog contains wallet selection', () => {
    cy.contains('button', 'Connect Wallet').click()
    cy.get('dialog').should('exist')
    cy.get('dialog button').contains('Test Wallet').should('be.visible')
    cy.get('dialog select#dialog-network-select').should('exist')
  })

  it('closes dialog and shows connected state on wallet connect', () => {
    cy.contains('button', 'Connect Wallet').click()
    cy.get('dialog button').contains('Test Wallet').click()
    cy.get('dialog').should('not.be.visible')
    cy.contains('span', 'Test Wallet').should('be.visible')
    cy.contains('button', 'Disconnect').should('be.visible')
    cy.get('#name').should('be.visible')
  })

  it('disconnects wallet and shows connect button again', () => {
    cy.connectMockWallet()
    cy.contains('button', 'Disconnect').click()
    cy.contains('button', 'Connect Wallet').should('be.visible')
    cy.get('#name').should('not.exist')
  })

  it('changes network in dialog', () => {
    cy.contains('button', 'Connect Wallet').click()
    cy.get('dialog select#dialog-network-select').select('mainnet')
    cy.get('dialog select#dialog-network-select').should('have.value', 'mainnet')
  })
})
