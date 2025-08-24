export interface RiskParameters {
  maxTradeAmount: number // in SOL
  maxDailyTradeVolume: number // in SOL
  maxExposurePerToken: number // in SOL
  stopLossPercentage: number // as a decimal (e.g., 0.05 for 5%)
  takeProfitPercentage: number // as a decimal (e.g., 0.1 for 10%)
  maxSlippage: number // as a decimal (e.g., 0.01 for 1%)
  minLiquidity: number // in SOL
  cooldownPeriod: number // in milliseconds
}

export class RiskManager {
  private parameters: RiskParameters
  private dailyTradeVolume = 0
  private tokenExposure: Map<string, number> = new Map()
  private lastTradeTime: Map<string, number> = new Map()

  constructor(parameters: Partial<RiskParameters> = {}) {
    // Default risk parameters
    this.parameters = {
      maxTradeAmount: 0.1, // 0.1 SOL
      maxDailyTradeVolume: 1, // 1 SOL
      maxExposurePerToken: 0.2, // 0.2 SOL
      stopLossPercentage: 0.05, // 5%
      takeProfitPercentage: 0.1, // 10%
      maxSlippage: 0.01, // 1%
      minLiquidity: 1, // 1 SOL
      cooldownPeriod: 60000, // 1 minute
      ...parameters,
    }

    // Reset daily trade volume at midnight
    setInterval(() => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.resetDailyTradeVolume()
      }
    }, 60000) // Check every minute
  }

  /**
   * Update risk parameters
   */
  updateParameters(parameters: Partial<RiskParameters>): void {
    this.parameters = {
      ...this.parameters,
      ...parameters,
    }
  }

  /**
   * Check if a trade is allowed based on risk parameters
   */
  canTrade(tokenAddress: string, tradeAmount: number, tokenLiquidity: number): { allowed: boolean; reason?: string } {
    // Check if trade amount exceeds max trade amount
    if (tradeAmount > this.parameters.maxTradeAmount) {
      return {
        allowed: false,
        reason: `Trade amount ${tradeAmount} exceeds max trade amount ${this.parameters.maxTradeAmount}`,
      }
    }

    // Check if daily trade volume would exceed max daily trade volume
    if (this.dailyTradeVolume + tradeAmount > this.parameters.maxDailyTradeVolume) {
      return {
        allowed: false,
        reason: `Daily trade volume would exceed max daily trade volume`,
      }
    }

    // Check if token exposure would exceed max exposure per token
    const currentExposure = this.tokenExposure.get(tokenAddress) || 0
    if (currentExposure + tradeAmount > this.parameters.maxExposurePerToken) {
      return {
        allowed: false,
        reason: `Token exposure would exceed max exposure per token`,
      }
    }

    // Check if token liquidity is sufficient
    if (tokenLiquidity < this.parameters.minLiquidity) {
      return {
        allowed: false,
        reason: `Token liquidity ${tokenLiquidity} is below minimum ${this.parameters.minLiquidity}`,
      }
    }

    // Check if we're in the cooldown period
    const lastTradeTime = this.lastTradeTime.get(tokenAddress) || 0
    const now = Date.now()
    if (now - lastTradeTime < this.parameters.cooldownPeriod) {
      return {
        allowed: false,
        reason: `In cooldown period for this token`,
      }
    }

    return { allowed: true }
  }

  /**
   * Record a trade for risk tracking
   */
  recordTrade(tokenAddress: string, tradeAmount: number): void {
    // Update daily trade volume
    this.dailyTradeVolume += tradeAmount

    // Update token exposure
    const currentExposure = this.tokenExposure.get(tokenAddress) || 0
    this.tokenExposure.set(tokenAddress, currentExposure + tradeAmount)

    // Update last trade time
    this.lastTradeTime.set(tokenAddress, Date.now())
  }

  /**
   * Calculate stop loss price for a token
   */
  calculateStopLoss(entryPrice: number): number {
    return entryPrice * (1 - this.parameters.stopLossPercentage)
  }

  /**
   * Calculate take profit price for a token
   */
  calculateTakeProfit(entryPrice: number): number {
    return entryPrice * (1 + this.parameters.takeProfitPercentage)
  }

  /**
   * Reset daily trade volume
   */
  private resetDailyTradeVolume(): void {
    this.dailyTradeVolume = 0
  }
}

// Export a singleton instance
export const riskManager = new RiskManager()

