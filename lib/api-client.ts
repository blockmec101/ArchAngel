// API client utility to fetch data from various sources

import type { TokenInfo, TradeInfo } from "./types"

class ApiClient {
  private apiKey: string | null = null
  private baseUrl: string | null = null
  private dataSource = "raydium" // Default data source

  constructor() {
    console.log("API client initialized")
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey
    console.log("API key set")
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl
    console.log(`Base URL set to: ${baseUrl}`)
  }

  setDataSource(source: string) {
    this.dataSource = source
    console.log(`Data source set to: ${source}`)
  }

  async fetchTopTokens(limit = 10): Promise<TokenInfo[]> {
    console.log(`Fetching top ${limit} tokens from ${this.dataSource}...`)

    try {
      if (this.dataSource === "raydium") {
        return await this.fetchTopTokensFromRaydium(limit)
      } else {
        return await this.fetchTopTokensFromJupiter(limit)
      }
    } catch (error) {
      console.error(`Error fetching top tokens from ${this.dataSource}:`, error)
      return []
    }
  }

  private async fetchTopTokensFromRaydium(limit: number): Promise<TokenInfo[]> {
    try {
      // Fetch token data from Raydium API
      const response = await fetch("https://api.raydium.io/v2/main/pairs")

      if (!response.ok) {
        throw new Error(`Raydium API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response format from Raydium API")
      }

      // Process and map the data to our TokenInfo interface
      const tokens = data.data
        .filter(
          (pair: any) =>
            // Filter for SOL pairs
            pair.name && (pair.name.includes("SOL") || pair.name.includes("WSOL")),
        )
        .slice(0, limit) // Get top tokens
        .map((pair: any) => {
          // Extract token info
          const isBaseSol = pair.name.endsWith("SOL") || pair.name.endsWith("WSOL")
          const symbol = isBaseSol ? pair.name.split("/")[0] : pair.name.split("/")[1]
          const address = isBaseSol ? pair.baseMint : pair.quoteMint

          return {
            symbol,
            address,
            price: Number.parseFloat(pair.price) || 0,
            volume24h: Number.parseFloat(pair.volume24h) || 0,
            change24h: Number.parseFloat(pair.priceChange24h) || 0,
          }
        })

      console.log(`Successfully fetched ${tokens.length} tokens from Raydium`)
      return tokens
    } catch (error) {
      console.error("Error fetching from Raydium:", error)
      throw error
    }
  }

  private async fetchTopTokensFromJupiter(limit: number): Promise<TokenInfo[]> {
    try {
      // Get token list from Jupiter
      const response = await fetch("https://token.jup.ag/strict")

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`)
      }

      const tokens = await response.json()

      if (!Array.isArray(tokens)) {
        throw new Error("Invalid response format from Jupiter API")
      }

      // Get top tokens by market cap (using tags as a proxy)
      const topTokens = tokens
        .filter(
          (token: any) =>
            token.tags &&
            (token.tags.includes("popular") || token.tags.includes("raydium") || token.tags.includes("orca")),
        )
        .slice(0, limit)
        .map((token: any) => ({
          symbol: token.symbol,
          address: token.address,
          price: 0, // We don't have price data here
          volume24h: 0,
          change24h: 0,
        }))

      // Try to get prices for these tokens
      try {
        const priceResponse = await fetch(
          `https://price.jup.ag/v4/price?ids=${topTokens.map((t) => t.address).join(",")}`,
        )
        if (priceResponse.ok) {
          const priceData = await priceResponse.json()

          // Update prices if available
          if (priceData.data) {
            topTokens.forEach((token) => {
              if (priceData.data[token.address]) {
                token.price = priceData.data[token.address].price || 0
              }
            })
          }
        }
      } catch (priceError) {
        console.error("Error fetching prices from Jupiter:", priceError)
      }

      console.log(`Successfully fetched ${topTokens.length} tokens from Jupiter`)
      return topTokens
    } catch (error) {
      console.error("Error fetching from Jupiter:", error)
      throw error
    }
  }

  async fetchRecentTrades(limit = 10): Promise<TradeInfo[]> {
    console.log(`Fetching ${limit} recent trades from ${this.dataSource}...`)

    try {
      if (this.dataSource === "raydium") {
        return await this.fetchRecentTradesFromRaydium(limit)
      } else {
        return await this.fetchRecentTradesFromJupiter(limit)
      }
    } catch (error) {
      console.error(`Error fetching recent trades from ${this.dataSource}:`, error)
      return []
    }
  }

  private async fetchRecentTradesFromRaydium(limit: number): Promise<TradeInfo[]> {
    try {
      // Fetch recent trades from Solscan API (which has Raydium trade data)
      const response = await fetch(
        `https://api.solscan.io/amm/txs?offset=0&limit=${limit}&sort_by=data_time&sort_type=desc`,
      )

      if (!response.ok) {
        throw new Error(`Solscan API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response format from Solscan API")
      }

      // Process and map the data to our TradeInfo interface
      const trades = data.data
        .filter((tx: any) => tx.ammId && tx.swapInfo)
        .map((tx: any) => {
          const { swapInfo } = tx

          return {
            inputToken: swapInfo.inSymbol === "SOL" ? "So11111111111111111111111111111111111111112" : swapInfo.inMint,
            outputToken:
              swapInfo.outSymbol === "SOL" ? "So11111111111111111111111111111111111111112" : swapInfo.outMint,
            amount: swapInfo.inAmount.toString(),
            price: Number.parseFloat(swapInfo.outAmount) / Number.parseFloat(swapInfo.inAmount),
            timestamp: tx.blockTime,
            txId: tx.txId,
          }
        })

      console.log(`Successfully processed ${trades.length} trades from Solscan/Raydium`)
      return trades
    } catch (error) {
      console.error("Error fetching from Solscan:", error)
      throw error
    }
  }

  private async fetchRecentTradesFromJupiter(limit: number): Promise<TradeInfo[]> {
    // Jupiter doesn't have a direct API for recent trades
    // Return mock data for now
    return Array(limit)
      .fill(0)
      .map((_, i) => ({
        inputToken: "So11111111111111111111111111111111111111112",
        outputToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000000",
        price: 150.25 + (Math.random() * 10 - 5),
        timestamp: Date.now() / 1000 - i * 60,
        txId: `jupiter-tx-${Math.random().toString(36).substring(2, 15)}`,
      }))
  }

  async fetchTokenPrice(tokenAddress: string): Promise<number> {
    console.log(`Fetching price for token ${tokenAddress} from ${this.dataSource}...`)

    try {
      // Try Jupiter price API first
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenAddress}`)

      if (!response.ok) {
        throw new Error(`Jupiter price API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.data && data.data[tokenAddress]) {
        return data.data[tokenAddress].price
      }

      throw new Error("Price not found in Jupiter API")
    } catch (error) {
      console.error(`Error fetching price for token ${tokenAddress} from Jupiter:`, error)

      // Fallback to Raydium API
      try {
        console.log("Falling back to Raydium API for price...")
        const response = await fetch("https://api.raydium.io/v2/main/pairs")

        if (!response.ok) {
          throw new Error(`Raydium API error: ${response.status}`)
        }

        const data = await response.json()

        // Find the pair that contains our token
        const pair = data.data.find((pair: any) => pair.baseMint === tokenAddress || pair.quoteMint === tokenAddress)

        if (pair) {
          return Number.parseFloat(pair.price)
        }

        return 0
      } catch (raydiumError) {
        console.error(`Error fetching price from Raydium as well:`, raydiumError)
        return 0
      }
    }
  }
}

// Export a singleton instance
export const apiClient = new ApiClient()

