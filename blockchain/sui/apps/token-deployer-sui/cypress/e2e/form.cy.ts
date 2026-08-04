describe('Token form validation and navigation', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.connectMockWallet()
  })

  it('renders form after wallet connection', () => {
    cy.get('#name').should('be.visible')
    cy.get('#symbol').should('be.visible')
    cy.get('#decimals').should('be.visible')
    cy.get('#package').should('be.visible')
    cy.get('#module').should('be.visible')
  })

  it('disables submit button when form is empty', () => {
    cy.contains('button', 'Review & deploy').should('be.disabled')
  })

  it('enables submit button when required fields are filled', () => {
    cy.fillMinimalForm()
    cy.contains('button', 'Review & deploy').should('not.be.disabled')
  })

  it('shows symbol validation error for > 32 chars', () => {
    cy.get('#symbol').type('THISISAVERYLONGSYMBOLTHATWILLEXCEED32CHARACTERS')
    cy.get('#symbol').blur()
    cy.get('#symbol-err').should('be.visible')
  })

  it('shows decimals validation error for > 18', () => {
    cy.get('#decimals').clear().type('20')
    cy.get('#decimals').blur()
    cy.get('#decimals-err').should('be.visible')
  })

  it('shows module name error for Move keyword', () => {
    cy.get('#module').type('move')
    cy.get('#module').blur()
    cy.get('#module-err').should('be.visible')
  })

  it('updates coin type preview as module name changes', () => {
    cy.get('#module').type('mytoken')
    cy.contains('.mono', '<package>::mytoken::MYTOKEN').should('be.visible')
  })

  it('expands advanced options on click', () => {
    cy.get('details summary').click()
    cy.get('#supply').should('be.visible')
    cy.get('#supply-policy').should('be.visible')
  })

  it('navigates to review panel on submit', () => {
    cy.fillMinimalForm()
    cy.contains('button', 'Review & deploy').click()
    cy.contains('button', 'Back').should('be.visible')
    cy.contains('button', 'Confirm & deploy').should('be.visible')
  })

  it('returns to form from review panel', () => {
    cy.fillMinimalForm()
    cy.contains('button', 'Review & deploy').click()
    cy.contains('button', 'Back').click()
    cy.get('#name').should('be.visible')
    cy.contains('button', 'Review & deploy').should('be.visible')
  })
})
