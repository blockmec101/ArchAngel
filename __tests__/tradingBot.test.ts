import { describe, expect, test, jest } from "@jest/globals"
import TradingBot from "../lib/tradingBot"
import { SwapToken } from "../lib/types"

// Mock dependencies
jest.mock("@solana/web3.js", () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getSignaturesForAddress: jest.fn().mockResolvedValue([]),
    getTransaction: jest.fn().mockResolvedValue(null),
    sendTransaction: jest.fn().mockResolvedValue("mock-tx-id"),
    confirmTransaction: jest.fn().mockResolvedValue({}),
  })),
  Keypair: {
    fromSecretKey: jest.fn().mockReturnValue({
      publicKey: {
        toString: jest.fn().mockReturnValue("mock-public-key"),
      },
    }),
  },
  PublicKey: jest.fn().mockImplementation((address) => ({
    toString: jest.fn().mockReturnValue(address),
    equals: jest.fn().mockReturnValue(false),
  })),
  VersionedTransaction: {
    deserialize: jest.fn().mockReturnValue({
      sign: jest.fn(),
    }),
  },
}))

jest.mock("@jup-ag/api", () => ({
  createJupiterApiClient: jest.fn().mockReturnValue({
    quoteGet: jest.fn().mockResolvedValue({
      inAmount: "1000000000",
      outAmount: "20000000",
      otherAmountThreshold: "19000000",
      swapMode: "ExactIn",
    }),
    swapPost: jest.fn().mockResolvedValue({
      swapTransaction: "mock-swap-transaction",
    }),
    priceGet: jest.fn().mockResolvedValue({
      data: {
        "mock-token-address": {
          price: 2.5,
        },
      },
    }),
  }),
}))

jest.mock("../lib/database", () => ({
  tradeDB: {
    setConnection: jest.fn(),
    saveTrade: jest.fn().mockResolvedValue(undefined),
    saveToken: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock("../lib/api-client", () => ({
  apiClient: {
    setBaseUrl: jest.fn(),
  },
}))

describe("TradingBot", () => {
  const mockConfig = {
    solanaEndpoint: "https://mock-solana-endpoint.com",
    jupiterEndpoint: "https://mock-jupiter-endpoint.com",
    secretKey: new Uint8Array(64).fill(1), // Mock 64-byte key
    initialInputToken: SwapToken.SOL,
    initialInputAmount: 1000000000, // 1 SOL
    detectNewMarkets: true,
    executeSwaps: false,
  }

  test("should initialize correctly", () => {
    const bot = new TradingBot(mockConfig)
    expect(bot.isReady()).toBe(true)
  })

  test("should get quote correctly", async () => {
    const bot = new TradingBot(mockConfig)
    const quote = await bot.getQuote(
      "So11111111111111111111111111111111111111112",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      1000000000,
    )

    expect(quote.inAmount).toBe("1000000000")
    expect(quote.outAmount).toBe("20000000")
  })
})

