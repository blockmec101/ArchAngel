const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const executeBuy = require("./buy");

const app = express();
const PORT = 3001;

app.use(bodyParser.json());

let userTradeSettings = {};   // { walletPublicKey: config }
let userActiveTrades = {};    // { walletPublicKey: [mintAddresses] }
let liveMints = [];           // Store last 50 live mints

// Config from frontend
app.post("/config", (req, res) => {
  const { walletPublicKey, config } = req.body;

  if (!walletPublicKey || !config) {
    return res.status(400).send("Missing walletPublicKey or config");
  }

  userTradeSettings[walletPublicKey] = config;
  userActiveTrades[walletPublicKey] = userActiveTrades[walletPublicKey] || [];

  console.log(`✅ Config saved for ${walletPublicKey}:`, config);
  res.status(200).send("Config stored");
});
// Incoming mint webhook from QuickNode (POST)
app.post("/mintWebhook", async (req, res) => {
  const mints = Array.isArray(req.body) ? req.body : [req.body];
  console.log(`🔔 Received ${mints.length} mint(s)`);

  // ... your existing mint processing logic ...
  
  res.status(200).send("Webhook handled");
});

// GET endpoint for debug/testing only
app.get("/mintWebhook", (req, res) => {
  console.log("⚠️ Received GET request on /mintWebhook (expected POST)");
  res.status(405).send("This endpoint only accepts POST requests.");
});

  for (const mint of mints) {
    const mintAddress = mint.mintAddress || mint?.data?.mintAddress || mint?.data?.accountKeys?.[0];
    const signature = mint.signature || mint?.data?.signature || "unknown";
    const blockTime = mint.blockTime || mint?.data?.blockTime || Date.now() / 1000;

    if (!mintAddress) continue;

    // Save to liveMints memory
    liveMints.unshift({ mintAddress, signature, blockTime });
    if (liveMints.length > 50) liveMints.pop();

    try {
      // Fetch token metadata
      const metaRes = await axios.get(`https://api.jup.ag/token-metadata?mint=${mintAddress}`);
      const token = metaRes.data;
      if (!token || !token.name) continue;

      const hasLogo = !!token.logoURI;
      const hasTwitter = !!token.twitter;
      const hasWebsite = !!token.website;
      if (!hasLogo || !hasTwitter || !hasWebsite) continue;

      // Check if liquidity pool exists
      const quoteURL = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mintAddress}&amount=1000000`;
      const quoteRes = await axios.get(quoteURL);
      const quotes = quoteRes.data?.data || [];
      if (quotes.length === 0) continue;

      console.log(`🚀 Good Token: ${token.name} (${token.symbol})`);

      // Loop users
      for (const [walletPublicKey, config] of Object.entries(userTradeSettings)) {
        if (!walletPublicKey || !config) continue;

        const currentActive = userActiveTrades[walletPublicKey] || [];
        if (currentActive.length >= config.maxTrades) continue;

        // Record
        userActiveTrades[walletPublicKey].push(mintAddress);

        console.log(`🛒 Executing buy for ${walletPublicKey} -> ${token.symbol}`);
        await executeBuy({
          mint: mintAddress,
          symbol: token.symbol,
          amountInSol: config.amountToBuy || 0.2,
          slippageBps: (config.slippage || 1) * 100
        });
      }
    } catch (err) {
      console.error("❌ Error processing mint:", err.message);
    }
  }

  res.status(200).send("Webhook handled");
});

// API to return liveMints
app.get("/liveMints", (req, res) => {
  res.status(200).json(liveMints);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}`);
});
