const { Connection, Keypair, PublicKey, VersionedTransaction } = require('@solana/web3.js');
const fetch = require('node-fetch');
const loadWalletKeypair = require('./wallet');

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const wallet = loadWalletKeypair();

async function executeBuy(mintAddress, amountInSol = 0.2, slippageBps = 100) {
  const inputMint = 'So11111111111111111111111111111111111111112';
  const outputMint = mintAddress;
  const amount = Math.round(amountInSol * 1e9);

  const quoteUrl = `https://quote-api.jup.ag/v6/swap?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&userPublicKey=${wallet.publicKey}`;
  const quoteRes = await fetch(quoteUrl);
  const quote = await quoteRes.json();

  if (!quote.swapTransaction) {
    console.log(`⚠️ No swap route for ${mintAddress}`);
    return;
  }

  const swapTxBuf = Buffer.from(quote.swapTransaction, 'base64');
  const swapTx = VersionedTransaction.deserialize(swapTxBuf);
  swapTx.sign([wallet]);

  const txid = await connection.sendTransaction(swapTx);
  console.log(`✅ Bought ${mintAddress} | Tx: https://solscan.io/tx/${txid}`);
}

module.exports = executeBuy;
