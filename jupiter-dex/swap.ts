import {
    Connection,
    Keypair,
    sendAndConfirmRawTransaction,
  } from '@solana/web3.js';
  import axios from 'axios';
  
  export const executeSwap = async ({
    route,
    secretKey,
  }: {
    route: any;
    secretKey: number[];
  }) => {
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_ENDPOINT!, 'confirmed');
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
    const { data } = await axios.post(
      'https://quote-api.jup.ag/v6/swap',
      {
        route,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapUnwrapSOL: true,
        dynamicComputeUnitLimit: true,
      },
      {
        headers: {
          'x-api-key': process.env.JUPITER_API_KEY || '',
        },
      }
    );
  
    const tx = Buffer.from(data.swapTransaction, 'base64');
    const sig = await connection.sendRawTransaction(tx);
    await connection.confirmTransaction(sig, 'confirmed');
  
    return sig;
  };
  