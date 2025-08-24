export enum CircuitBreakerState {
  CLOSED = 0, // Normal operation
  OPEN = 1, // Trading halted
  HALF_OPEN = 2, // Testing if trading can resume
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount = 0
  private lastFailureTime = 0
  private resetTimeout = 60000 // 1 minute
  private failureThreshold = 5
  private halfOpenSuccessRequired = 3
  private halfOpenSuccessCount = 0

  constructor(failureThreshold = 5, resetTimeout = 60000, halfOpenSuccessRequired = 3) {
    this.failureThreshold = failureThreshold
    this.resetTimeout = resetTimeout
    this.halfOpenSuccessRequired = halfOpenSuccessRequired
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if it's time to try half-open state
      const now = Date.now()
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN
        this.halfOpenSuccessCount = 0
      } else {
        throw new Error("Circuit breaker is open")
      }
    }

    try {
      const result = await fn()

      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.halfOpenSuccessCount++
        if (this.halfOpenSuccessCount >= this.halfOpenSuccessRequired) {
          this.reset()
        }
      }

      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  /**
   * Record a failure
   */
  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.halfOpenSuccessCount = 0
  }

  /**
   * Get the current state of the circuit breaker
   */
  getState(): CircuitBreakerState {
    return this.state
  }
}

// Export a singleton instance
export const circuitBreaker = new CircuitBreaker()

