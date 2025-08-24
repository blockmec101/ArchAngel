import { Keypair } from "@solana/web3.js"

/**
 * Generate a new Solana keypair for testing
 * DO NOT USE IN PRODUCTION
 */
export function generateTestKeypair(): { publicKey: string; secretKey: number[] } {
  // Generate a new keypair
  const keypair = Keypair.generate()

  // Convert the secret key to an array for JSON serialization
  const secretKeyArray = Array.from(keypair.secretKey)

  return {
    publicKey: keypair.publicKey.toString(),
    secretKey: secretKeyArray,
  }
}

// If this file is run directly, generate and print a keypair
if (typeof window === "undefined" && require.main === module) {
  const keypair = generateTestKeypair()
  console.log("Generated test keypair:")
  console.log("Public Key:", keypair.publicKey)
  console.log("Secret Key (for .env.local):")
  console.log(`NEXT_PUBLIC_SECRET_KEY=${JSON.stringify(keypair.secretKey)}`)
}

