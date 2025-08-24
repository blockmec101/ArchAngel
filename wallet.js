const fs = require('fs');
const { Keypair } = require('@solana/web3.js');

function loadWalletKeypair() {
  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync('./backend-keypair.json', 'utf8'))
  );
  return Keypair.fromSecretKey(secretKey);
}

module.exports = loadWalletKeypair;
