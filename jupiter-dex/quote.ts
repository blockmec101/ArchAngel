import axios from 'axios';

const JUPITER_QUOTE_URL = `${process.env.NEXT_PUBLIC_JUPITER_ENDPOINT}/quote`;

export const getQuote = async ({
  inputMint,
  outputMint,
  amount,
  slippage = 1,
}: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippage?: number;
}) => {
  const { data } = await axios.get(JUPITER_QUOTE_URL, {
    params: {
      inputMint,
      outputMint,
      amount,
      slippageBps: slippage * 100, // 1% default
    },
    headers: {
      'x-api-key': process.env.JUPITER_API_KEY || '',
    },
  });

  return data;
};
