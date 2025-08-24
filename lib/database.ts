import type { Connection } from "@solana/web3.js"
import type { TokenInfo, TradeInfo } from "./types"
import { db } from "./db" // Import the db object

class TradeDatabase {
  private connection: Connection | null = null
  private tokens: Map<string, TokenInfo> = new Map()
  private trades: TradeInfo[] = []

  /**
   * Set the Solana connection
   */
  setConnection(connection: Connection): void {
    this.connection = connection
    console.log("Database connection set")
  }

  /**
   * Save a token to the database
   */
  async saveToken(token: TokenInfo): Promise<void> {
    try {
      // In a production environment, you would save to a real database
      // For example:
      // await db.collection('tokens').updateOne(
      //   { address: token.address },
      //   { $set: token },
      //   { upsert: true }
      // );
      await db.collection("tokens").updateOne({ address: token.address }, { $set: token }, { upsert: true })
      console.log(`Token ${token.symbol} (${token.address}) saved to database`)
    } catch (error) {
      console.error(`Error saving token ${token.symbol} to database:`, error)
      throw error
    }
  }

  /**
   * Get a token from the database
   */
  async getToken(address: string): Promise<TokenInfo | null> {
    const token = this.tokens.get(address)
    return token || null
  }

  /**
   * Get all tokens from the database
   */
  async getAllTokens(): Promise<TokenInfo[]> {
    return Array.from(this.tokens.values())
  }

  /**
   * Save a trade to the database
   */
  async saveTrade(trade: {
    inputToken: string
    outputToken: string
    inputAmount: string
    outputAmount: string
    txId: string
  }): Promise<void> {
    const tradeInfo: TradeInfo = {
      inputToken: trade.inputToken,
      outputToken: trade.outputToken,
      amount: trade.inputAmount,
      price: Number(trade.outputAmount) / Number(trade.inputAmount),
      timestamp: Date.now() / 1000,
      txId: trade.txId,
    }

    this.trades.push(tradeInfo)
    console.log(`Trade saved to database: ${trade.txId}`)

    // In a production environment, you would save to a real database
    // For example:
    // await db.collection('trades').insertOne(tradeInfo);
  }

  /**
   * Get all trades from the database
   */
  async getAllTrades(): Promise<TradeInfo[]> {
    return this.trades
  }

  /**
   * Get trades for a specific token
   */
  async getTradesForToken(tokenAddress: string): Promise<TradeInfo[]> {
    return this.trades.filter((trade) => trade.inputToken === tokenAddress || trade.outputToken === tokenAddress)
  }
}

// Export a singleton instance
export const tradeDB = new TradeDatabase()

