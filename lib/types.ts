// Add a types file to ensure proper type definitions

export interface TokenInfo {
  symbol: string
  address: string
  price: number
  volume24h: number
  change24h: number
  firstSeen?: string
  name?: string
}

export interface TradeInfo {
  inputToken: string
  outputToken: string
  amount: string
  price: number
  timestamp: number
  txId: string
}

export enum SwapToken {
  SOL = 0,
  USDC = 1,
}

export interface ArbBotConfig {
  solanaEndpoint: string
  jupiterEndpoint: string
  secretKey: Uint8Array
  initialInputToken: SwapToken
  initialInputAmount: number
  amountToBuy?: number
  maxTrade?: number
  buyMarketCap?: number
  sellMarketCap?: number
  stopLoss?: number
  slippage?: number
  autoBuyNewTokens?: boolean
  autoBuyAmount?: number
  detectNewMarkets?: boolean
  executeSwaps?: boolean
}

