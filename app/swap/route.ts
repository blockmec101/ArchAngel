// app/api/swap/route.ts
import { NextResponse } from 'next/server';
import { getQuote } from '@/jupiter-dex/quote';
import { executeSwap } from '@/jupiter-dex/swap';

export async function GET() {
  const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
  const outputMint = 'Es9vMFrzaCERd6jGqC1z5VYc1R6YpV7nTGEfLZk3PPtt'; // USDC
  const amount = 0.01 * 1e9; // 0.01 SOL in lamports
  const secret = JSON.parse(process.env.NEXT_PUBLIC_SECRET_KEY || '[]');

  try {
    const quote = await getQuote({ inputMint, outputMint, amount });
    const route = quote.data?.[0];

    if (!route) {
      return NextResponse.json({ error: 'No swap route found.' }, { status: 400 });
    }

    const txSignature = await executeSwap({ route, secretKey: secret });

    return NextResponse.json({ signature: txSignature });
  } catch (err: any) {
    console.error('Swap error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
