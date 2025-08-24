describe("Trading Bot UI", () => {
  beforeEach(() => {
    cy.visit("/")
  })

  it("should display the trading bot UI", () => {
    cy.contains("ARCH ANGEL")
    cy.contains("Trading Bot")
  })

  it("should connect wallet", () => {
    // Mock Phantom wallet
    cy.window().then((win) => {
      win.solana = {
        isPhantom: true,
        connect: cy.stub().resolves({
          publicKey: {
            toString: () => "mock-public-key",
          },
        }),
      }
    })

    cy.contains("Connect Wallet").click()
    cy.contains("Connected: mock-p...c-key")
  })

  it("should start trading", () => {
    // Mock API responses
    cy.intercept("GET", "**/api/tokens", { fixture: "tokens.json" })
    cy.intercept("GET", "**/api/trades", { fixture: "trades.json" })

    cy.contains("Start Trading").click()
    cy.contains("Stop Trading")
  })
})

