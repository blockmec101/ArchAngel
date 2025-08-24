import axios from "axios"

export class TelegramBot {
  private token: string | null = null
  private chatId: string | null = null

  constructor(token?: string, chatId?: string) {
    this.token = token || null
    this.chatId = chatId || null
  }

  /**
   * Set the bot token and chat ID
   */
  setCredentials(token: string, chatId: string): void {
    this.token = token
    this.chatId = chatId
  }

  /**
   * Send a message to the Telegram chat
   */
  async sendMessage(message: string): Promise<boolean> {
    try {
      if (!this.token || !this.chatId) {
        console.warn("Telegram bot token or chat ID not set")
        return false
      }

      const response = await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: "HTML",
      })

      return response.data.ok === true
    } catch (error) {
      console.error("Error sending Telegram message:", error)
      return false
    }
  }

  /**
   * Send a trade notification
   */
  async sendTradeNotification(
    action: "BUY" | "SELL",
    tokenSymbol: string,
    tokenAddress: string,
    amount: number,
    price: number,
    txId: string,
  ): Promise<boolean> {
    const message = `
<b>${action} ${tokenSymbol}</b>

Amount: ${amount} SOL
Price: ${price} SOL
Token: <a href="https://solscan.io/token/${tokenAddress}">${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}</a>
Transaction: <a href="https://solscan.io/tx/${txId}">${txId.slice(0, 8)}...${txId.slice(-8)}</a>
`

    return this.sendMessage(message)
  }

  /**
   * Send a new token notification
   */
  async sendNewTokenNotification(
    tokenSymbol: string,
    tokenAddress: string,
    marketCap: number,
    hasTwitter: boolean,
    hasTelegram: boolean,
    hasWebsite: boolean,
  ): Promise<boolean> {
    const message = `
<b>🚨 NEW TOKEN DETECTED 🚨</b>

Symbol: ${tokenSymbol}
Market Cap: ${marketCap} SOL
Token: <a href="https://solscan.io/token/${tokenAddress}">${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}</a>

Social Media:
- Twitter: ${hasTwitter ? "✅" : "❌"}
- Telegram: ${hasTelegram ? "✅" : "❌"}
- Website: ${hasWebsite ? "✅" : "❌"}
`

    return this.sendMessage(message)
  }
}

// Export a singleton instance
export const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID)

