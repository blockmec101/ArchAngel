import axios from "axios"

export interface TokenAnalytics {
  price: number
  volume24h: number
  marketCap: number
  fdv: number
  priceChange24h: number
  holders: number
}

export class BirdeyeClient {
  private apiKey: string | null = null
  private baseUrl = "https://public-api.birdeye.so"

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null
  }

  /**
   * Set the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  /**
   * Get token analytics
   */
  async getTokenAnalytics(tokenAddress: string): Promise<TokenAnalytics> {
    try {
      if (!this.apiKey) {
        throw new Error("Birdeye API key not set")
      }

      const response = await axios.get(`${this.baseUrl}/public/token_analytics`, {
        params: {
          address: tokenAddress,
        },
        headers: {
          "X-API-KEY": this.apiKey,
        },
      })

      const data = response.data

      return {
        price: data.value?.price || 0,
        volume24h: data.value?.volume24h || 0,
        marketCap: data.value?.marketCap || 0,
        fdv: data.value?.fdv || 0,
        priceChange24h: data.value?.priceChange24h || 0,
        holders: data.value?.holders || 0,
      }
    } catch (error) {
      console.error(`Error fetching token analytics for ${tokenAddress}:`, error)
      return {
        price: 0,
        volume24h: 0,
        marketCap: 0,
        fdv: 0,
        priceChange24h: 0,
        holders: 0,
      }
    }
  }

  /**
   * Get token price
   */
  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      if (!this.apiKey) {
        throw new Error("Birdeye API key not set")
      }

      const response = await axios.get(`${this.baseUrl}/public/price`, {
        params: {
          address: tokenAddress,
        },
        headers: {
          "X-API-KEY": this.apiKey,
        },
      })

      return response.data.data?.value || 0
    } catch (error) {
      console.error(`Error fetching token price for ${tokenAddress}:`, error)
      return 0
    }
  }
}

// Export a singleton instance
export const birdeyeClient = new BirdeyeClient(process.env.BIRDEYE_API_KEY)

