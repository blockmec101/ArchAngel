import { Keypair, Connection, VersionedTransaction, PublicKey } from "@solana/web3.js"
import { createJupiterApiClient, type DefaultApi, type QuoteResponse } from "@jup-ag/api"
import { tradeDB } from "./database"
import { apiClient } from "./api-client"
import { type TokenInfo, type TradeInfo, SwapToken, type ArbBotConfig } from "./types"
import { RaydiumMarketDetector, type RaydiumMarket } from "./raydiumMarketDetector"

class TradingBot {
  private config: ArbBotConfig
  private connection: Connection
  private jupiterApi: DefaultApi
  private wallet: Keypair
  private raydiumDetector: RaydiumMarketDetector | null = null
  private isDetectingNewMarkets = false
  private newMarkets: RaydiumMarket[] = []
  private isInitialized = false

  constructor(config: ArbBotConfig) {
    this.config = config

    try {
      // Initialize Solana connection
      console.log("Initializing Solana connection to:", config.solanaEndpoint)
      this.connection = new Connection(config.solanaEndpoint, "confirmed")

      // Initialize Jupiter API client
      console.log("Initializing Jupiter API client with endpoint:", config.jupiterEndpoint)
      this.jupiterApi = createJupiterApiClient({ basePath: config.jupiterEndpoint })

      // Initialize wallet from secret key
      console.log("Initializing wallet from secret key")
      try {
        // Check if the secret key has the correct length
        if (config.secretKey.length !== 64) {
          throw new Error(`Invalid secret key length: ${config.secretKey.length}. Expected 64 bytes.`)
        }
        this.wallet = Keypair.fromSecretKey(Uint8Array.from(config.secretKey))
        console.log("Wallet public key:", this.wallet.publicKey.toString())
      } catch (error) {
        console.error("Error initializing wallet:", error)
        throw new Error("Failed to initialize wallet: " + (error instanceof Error ? error.message : String(error)))
      }

      // Initialize database with connection
      tradeDB.setConnection(this.connection)

      // Initialize API client
      apiClient.setBaseUrl(config.jupiterEndpoint)

      this.isInitialized = true
      console.log("Trading bot successfully initialized")
    } catch (error) {
      console.error("Error initializing trading bot:", error)
      throw new Error("Failed to initialize trading bot: " + (error instanceof Error ? error.message : String(error)))
    }
  }

  /**
   * Check if the bot is properly initialized
   */
  public isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Get a quote for swapping tokens
   */
  async getQuote(inputMint: string, outputMint: string, amount: number): Promise<QuoteResponse> {
    try {
      console.log(`Getting quote for ${amount} of ${inputMint} to ${outputMint}`)
      const quote = await this.jupiterApi.quoteGet({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50, // 0.5% slippage
      })

      console.log("Quote received:", {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        swapMode: quote.swapMode,
      })

      return quote
    } catch (error) {
      console.error("Error getting quote:", error)
      throw error
    }
  }

  /**
   * Execute a token swap
   */
  async executeSwap(quote: QuoteResponse): Promise<string> {
    try {
      console.log("Preparing swap transaction")
      const { swapTransaction } = await this.jupiterApi.swapPost({
        userPublicKey: this.wallet.publicKey.toBase58(),
        quoteResponse: quote,
      })

      console.log("Deserializing swap transaction")
      const swapTransactionBuf = Buffer.from(swapTransaction, "base64")
      var transaction = VersionedTransaction.deserialize(swapTransactionBuf)

      console.log("Signing transaction")
      transaction.sign([this.wallet])

      console.log("Sending transaction to network")
      const txid = await this.connection.sendTransaction(transaction)
      console.log("Transaction sent with ID:", txid)

      console.log("Waiting for transaction confirmation")
      await this.connection.confirmTransaction(txid)
      console.log("Transaction confirmed")

      // Save the trade to the database
      await tradeDB.saveTrade({
        inputToken: quote.inputMint,
        outputToken: quote.outputMint,
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        txId: txid,
      })
      console.log("Trade saved to database")

      return txid
    } catch (error) {
      console.error("Error executing swap:", error)
      throw error
    }
  }

  /**
   * Start detecting new Raydium markets
   */
  async startDetectingNewMarkets(): Promise<void> {
    if (this.isDetectingNewMarkets) {
      console.log("Already detecting new markets")
      return
    }

    try {
      console.log("Initializing Raydium market detector")
      this.raydiumDetector = new RaydiumMarketDetector(this.connection, this.wallet)

      // Start listening for new markets
      console.log("Starting to listen for new markets")
      await this.raydiumDetector.startListening((market: RaydiumMarket) => {
        this.handleNewMarket(market)
      })

      this.isDetectingNewMarkets = true
      console.log("Successfully started detecting new Raydium markets")
    } catch (error) {
      console.error("Error starting market detection:", error)
      throw error
    }
  }

  /**
   * Stop detecting new Raydium markets
   */
  async stopDetectingNewMarkets(): Promise<void> {
    if (!this.isDetectingNewMarkets || !this.raydiumDetector) {
      console.log("Not currently detecting markets")
      return
    }

    try {
      console.log("Stopping market detection")
      await this.raydiumDetector.stopListening()
      this.isDetectingNewMarkets = false
      console.log("Successfully stopped detecting new Raydium markets")
    } catch (error) {
      console.error("Error stopping market detection:", error)
      throw error
    }
  }

  /**
   * Handle a newly detected market
   */
  private async handleNewMarket(market: RaydiumMarket): Promise<void> {
    try {
      console.log("New market detected:", {
        market: market.market.toString(),
        baseMint: market.baseMint.toString(),
        quoteMint: market.quoteMint.toString(),
        isBaseSol: market.isBaseSol,
        isQuoteSol: market.isQuoteSol,
      })

      // Add to our list of new markets
      this.newMarkets.push(market)

      // Get token info if available
      let tokenMint: PublicKey
      let isBuyingBase: boolean

      if (market.isQuoteSol) {
        // If quote is SOL, we're buying the base token
        tokenMint = market.baseMint
        isBuyingBase = true
      } else if (market.isBaseSol) {
        // If base is SOL, we're buying the quote token
        tokenMint = market.quoteMint
        isBuyingBase = false
      } else {
        console.log("Neither base nor quote is SOL, skipping")
        return
      }

      // Try to get token metadata
      try {
        console.log("Fetching token metadata for", tokenMint.toString())
        const tokenInfo = await this.getTokenMetadata(tokenMint.toString())

        // Save token to database with metadata if available
        await tradeDB.saveToken({
          address: tokenMint.toString(),
          symbol: tokenInfo.symbol || `NEW_${tokenMint.toString().substring(0, 5)}`,
          name: tokenInfo.name || `New Token ${tokenMint.toString().substring(0, 5)}`,
          price: 0,
          volume24h: 0,
          change24h: 0,
          firstSeen: new Date().toISOString(),
        })
        console.log("Token saved to database with metadata")
      } catch (error) {
        console.error("Error getting token metadata:", error)

        // Save token to database without metadata
        await tradeDB.saveToken({
          address: tokenMint.toString(),
          symbol: `NEW_${tokenMint.toString().substring(0, 5)}`,
          price: 0,
          volume24h: 0,
          change24h: 0,
          firstSeen: new Date().toISOString(),
        })
        console.log("Token saved to database without metadata")
      }

      // Optionally auto-buy the token
      if (this.config.autoBuyNewTokens) {
        try {
          const amountInLamports = this.config.autoBuyAmount || 10000000 // 0.01 SOL default

          console.log(`Auto-buying new token ${tokenMint.toString()} with ${amountInLamports / 1000000000} SOL`)

          const signature = await this.raydiumDetector!.executeSwap(
            market,
            amountInLamports,
            0, // 100% slippage
          )

          console.log(`Auto-buy successful: ${signature}`)
        } catch (error) {
          console.error("Error auto-buying new token:", error)
        }
      }
    } catch (error) {
      console.error("Error handling new market:", error)
    }
  }

  /**
   * Get token metadata from the Solana blockchain
   */
  private async getTokenMetadata(tokenMint: string): Promise<{ symbol: string; name: string }> {
    try {
      console.log("Fetching token metadata from Jupiter token list")
      // First try to get from Jupiter token list
      const response = await fetch("https://token.jup.ag/all")

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`)
      }

      const tokens = await response.json()

      const tokenInfo = tokens.find((token: any) => token.address === tokenMint)

      if (tokenInfo) {
        console.log("Token found in Jupiter list:", tokenInfo.symbol)
        return {
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
        }
      }

      console.log("Token not found in Jupiter list, trying Solana token registry")
      // If not found in Jupiter, try Solana token registry
      const registryResponse = await fetch(
        `https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json`,
      )

      if (!registryResponse.ok) {
        throw new Error(`Solana registry API error: ${registryResponse.status}`)
      }

      const registryData = await registryResponse.json()

      const registryToken = registryData.tokens.find((token: any) => token.address === tokenMint)

      if (registryToken) {
        console.log("Token found in Solana registry:", registryToken.symbol)
        return {
          symbol: registryToken.symbol,
          name: registryToken.name,
        }
      }

      throw new Error("Token metadata not found in any registry")
    } catch (error) {
      console.error("Error fetching token metadata:", error)
      return { symbol: "", name: "" }
    }
  }

  /**
   * Get list of newly detected markets
   */
  getNewMarkets(): RaydiumMarket[] {
    return this.newMarkets
  }

  /**
   * Clear the list of newly detected markets
   */
  clearNewMarkets(): void {
    this.newMarkets = []
  }

  /**
   * Get top tokens by volume from Raydium
   */
  async getTopTokens(): Promise<TokenInfo[]> {
    try {
      console.log("Fetching top tokens from Raydium...")

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
        .slice(0, 20) // Get top 20 tokens
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
      console.error("Error fetching top tokens from Raydium:", error)

      // Fallback to Jupiter API if Raydium fails
      try {
        console.log("Falling back to Jupiter API...")
        return await this.getTopTokensFromJupiter()
      } catch (jupiterError) {
        console.error("Error fetching from Jupiter as well:", jupiterError)

        // Return empty array if both APIs fail
        console.log("All API attempts failed, returning empty token list")
        return []
      }
    }
  }

  /**
   * Get top tokens from Jupiter API
   */
  private async getTopTokensFromJupiter(): Promise<TokenInfo[]> {
    try {
      console.log("Fetching tokens from Jupiter API")
      // Get token list from Jupiter
      const response = await fetch("https://token.jup.ag/strict")

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`)
      }

      const tokens = await response.json()

      if (!Array.isArray(tokens)) {
        throw new Error("Invalid response format from Jupiter API")
      }

      console.log(`Received ${tokens.length} tokens from Jupiter`)

      // Get top tokens by market cap (using tags as a proxy)
      const topTokens = tokens
        .filter(
          (token: any) =>
            token.tags &&
            (token.tags.includes("popular") || token.tags.includes("raydium") || token.tags.includes("orca")),
        )
        .slice(0, 20)

      console.log(`Filtered to ${topTokens.length} popular tokens`)

      // Get prices for these tokens
      const pricePromises = topTokens.map(async (token: any) => {
        try {
          console.log(`Fetching price for ${token.symbol}`)
          const priceResponse = await this.jupiterApi.priceGet({
            ids: token.address,
          })

          return {
            symbol: token.symbol,
            address: token.address,
            price: priceResponse.data?.[token.address]?.price || 0,
            volume24h: 0, // Jupiter API doesn't provide volume directly
            change24h: 0, // Jupiter API doesn't provide price change directly
          }
        } catch (error) {
          console.error(`Error fetching price for ${token.symbol}:`, error)
          return {
            symbol: token.symbol,
            address: token.address,
            price: 0,
            volume24h: 0,
            change24h: 0,
          }
        }
      })

      const tokenInfos = await Promise.all(pricePromises)
      console.log(`Successfully fetched ${tokenInfos.length} tokens from Jupiter`)
      return tokenInfos
    } catch (error) {
      console.error("Error fetching from Jupiter:", error)
      return []
    }
  }

  /**
   * Get recent trades from Raydium
   */
  async getRecentTrades(): Promise<TradeInfo[]> {
    try {
      console.log("Fetching recent trades from Solscan...")

      // Fetch recent trades from Solscan API (which has Raydium trade data)
      const response = await fetch("https://api.solscan.io/amm/txs?offset=0&limit=10&sort_by=data_time&sort_type=desc")

      if (!response.ok) {
        throw new Error(`Solscan API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response format from Solscan API")
      }

      console.log(`Received ${data.data.length} trades from Solscan`)

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
      console.error("Error fetching recent trades from Solscan:", error)

      // Fallback to Jupiter API
      try {
        console.log("Falling back to Jupiter API for recent trades...")
        return await this.getRecentTradesFromJupiter()
      } catch (jupiterError) {
        console.error("Error fetching trades from Jupiter as well:", jupiterError)

        // Return empty array if both APIs fail
        console.log("All API attempts failed, returning empty trade list")
        return []
      }
    }
  }

  /**
   * Get recent trades from Jupiter API
   */
  private async getRecentTradesFromJupiter(): Promise<TradeInfo[]> {
    try {
      console.log("Fetching recent trades from Jupiter...")

      // Jupiter doesn't have a direct API for recent trades
      // We'll use transaction history from Solana for Jupiter transactions

      const jupiterProgramId = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")

      console.log("Fetching recent signatures for Jupiter program")
      const recentTransactions = await this.connection.getSignaturesForAddress(jupiterProgramId, { limit: 10 })

      console.log(`Received ${recentTransactions.length} recent transactions`)

      const tradePromises = recentTransactions.map(async (tx) => {
        try {
          console.log(`Fetching transaction details for ${tx.signature}`)
          const txInfo = await this.connection.getTransaction(tx.signature, {
            maxSupportedTransactionVersion: 0,
          })

          if (!txInfo || !txInfo.meta) {
            console.log(`No transaction info found for ${tx.signature}`)
            return null
          }

          // This is a simplified approach - in a real implementation, you would need to
          // parse the transaction data to extract the actual swap details
          return {
            inputToken: "So11111111111111111111111111111111111111112", // Assuming SOL as input
            outputToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Assuming USDC as output
            amount: "1000000000", // 1 SOL
            price: 0,
            timestamp: txInfo.blockTime || 0,
            txId: tx.signature,
          }
        } catch (error) {
          console.error(`Error fetching transaction ${tx.signature}:`, error)
          return null
        }
      })

      const trades = await Promise.all(tradePromises)
      const validTrades = trades.filter((trade): trade is TradeInfo => trade !== null)
      console.log(`Successfully processed ${validTrades.length} trades from Jupiter`)
      return validTrades
    } catch (error) {
      console.error("Error fetching recent trades from Jupiter:", error)
      return []
    }
  }

  /**
   * Start the trading bot
   */
  async monitorAndTrade() {
    console.log("Starting trading bot with configuration:", {
      initialInputToken: this.config.initialInputToken,
      initialInputAmount: this.config.initialInputAmount,
    })

    const inputToken =
      this.config.initialInputToken === SwapToken.SOL
        ? "So11111111111111111111111111111111111111112"
        : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    const outputToken =
      this.config.initialInputToken === SwapToken.SOL
        ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        : "So11111111111111111111111111111111111111112"

    console.log(`Trading pair: ${inputToken} -> ${outputToken}`)

    // Start market detection if configured
    if (this.config.detectNewMarkets) {
      try {
        await this.startDetectingNewMarkets()
      } catch (error) {
        console.error("Failed to start market detection:", error)
      }
    }

    // Only execute trades if trading is enabled
    if (!this.config.executeSwaps) {
      console.log("Swap execution is disabled, will only monitor markets")
      return
    }

    while (true) {
      try {
        console.log("Fetching quote...")
        const quote = await this.getQuote(inputToken, outputToken, this.config.initialInputAmount)
        console.log("Quote received:", {
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          otherAmountThreshold: quote.otherAmountThreshold,
        })

        // Execute swap without checking price threshold
        console.log("Executing swap...")
        const txid = await this.executeSwap(quote)
        console.log(`Swap executed successfully. Transaction ID: ${txid}`)

        // Use a fixed interval of 60 seconds
        console.log("Waiting 60 seconds before next trade...")
        await new Promise((resolve) => setTimeout(resolve, 60000))
      } catch (error) {
        console.error("Error in trading loop:", error)
        // Wait before retrying
        console.log("Waiting 5 seconds before retrying...")
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }
}

export default TradingBot

