export class RateLimiter {
  private windowMs: number
  private maxRequests: number
  private requests: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  /**
   * Check if a request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now()
    const requestData = this.requests.get(key)

    if (!requestData || now > requestData.resetTime) {
      // First request or window expired
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      })
      return true
    }

    if (requestData.count < this.maxRequests) {
      // Increment request count
      requestData.count++
      return true
    }

    return false
  }

  /**
   * Get remaining requests for a key
   */
  getRemainingRequests(key: string): number {
    const now = Date.now()
    const requestData = this.requests.get(key)

    if (!requestData || now > requestData.resetTime) {
      return this.maxRequests
    }

    return Math.max(0, this.maxRequests - requestData.count)
  }

  /**
   * Get reset time for a key
   */
  getResetTime(key: string): number {
    const requestData = this.requests.get(key)
    return requestData ? requestData.resetTime : Date.now() + this.windowMs
  }
}

// Export a singleton instance
export const rateLimiter = new RateLimiter()

