"use client";

import React, { useState, useEffect, useRef } from "react";
import { Connection } from "@solana/web3.js";
import toast from "react-hot-toast";

export default function ArchAngelBot() {
  const [amountToBuy, setAmountToBuy] = useState(1);
  const [maxTrades, setMaxTrades] = useState(2);
  const [buyMarketCap, setBuyMarketCap] = useState(50);
  const [sellMarketCap, setSellMarketCap] = useState(10);
  const [stopLoss, setStopLoss] = useState(2);
  const [slippage, setSlippage] = useState(0);
  const [selectedSources, setSelectedSources] = useState({ twitter: false, telegram: false, website: false });
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [tokens, setTokens] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [activeTrades, setActiveTrades] = useState([]);
  const [isTrading, setIsTrading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [liveMints, setLiveMints] = useState([]);
  const tradesPerPage = 10;
  const tradingInterval = useRef<NodeJS.Timeout | null>(null);
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

  const toggleSource = (key: string) => {
    setSelectedSources({ ...selectedSources, [key]: !selectedSources[key] });
  };

  const handleWalletConnect = async () => {
    try {
      if (typeof window === "undefined") return;

      const provider = (window as any)?.solana;
      if (!provider || !provider.isPhantom) return toast.error("Phantom wallet not found");

      if (!walletConnected) {
        const resp = await provider.connect();
        if (!resp.publicKey) return toast.error("Connection failed");
        setWalletAddress(resp.publicKey.toString());
        setWalletConnected(true);
        toast.success("✅ Wallet Connected");
      } else {
        await provider.disconnect();
        setWalletConnected(false);
        setWalletAddress("");
        toast.success("👋 Wallet Disconnected");
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
      toast.error("Failed to connect/disconnect");
    }
  };

  const handleStartStopTrading = async () => {
    if (!walletConnected || !walletAddress) return toast.error("Connect your wallet first!");

    if (!isTrading) {
      try {
        await fetch("https://archangel.fun/liveMints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletPublicKey: walletAddress,
            config: { amountToBuy, maxTrades, buyMarketCap, sellMarketCap, stopLoss, slippage }
          })
        });
        toast.success("🚀 Trading Config Sent!");
        setIsTrading(true);
      } catch (err) {
        console.error("POST /config failed:", err);
        toast.error("❌ Backend not responding");
      }
    } else {
      setIsTrading(false);
      toast("🛑 Trading Stopped");
    }
  };

  const handleManualSell = (index: number) => {
    const sold = { ...activeTrades[index], manuallySold: true };
    setTradeHistory((prev) => [...prev, sold]);
    setActiveTrades((prev) => prev.filter((_, i) => i !== index));
  };

  const simulateTrade = () => {
    const available = tokens.filter(t => t?.name && typeof t.name === "string" && !t.name.toLowerCase().includes("pump") && !activeTrades.find(at => at.name === t.name));
    const newTrades = [];

    for (let i = 0; i < maxTrades - activeTrades.length && i < available.length; i++) {
      const token = available[i];
      const buyMC = token.marketCap || Math.random() * 50;
      const sellMC = buyMC + sellMarketCap;
      const profit = (sellMC - buyMC) * (amountToBuy / buyMC);
      newTrades.push({ name: token.name, buyMC, sellMC, amount: amountToBuy, profit });
    }

    setActiveTrades((prev) => [...prev, ...newTrades]);
  };

  useEffect(() => {
  const autoConnect = async () => {
    if (typeof window !== "undefined" && window.solana?.isPhantom) {
      try {
        const resp = await window.solana.connect({ onlyIfTrusted: true });
        setWalletAddress(resp.publicKey.toString());
        setWalletConnected(true);
      } catch {
        // Not yet trusted - skip auto-connection
      }
    }
  };
  autoConnect();
}, []);

  useEffect(() => {
    if (!isTrading) return;
    tradingInterval.current = setInterval(() => {
      setActiveTrades((prev) => {
        const completed = prev.map(t => {
          const currentPrice = t.sellMC;
          const profit = (currentPrice - t.buyMC) * (t.amount / t.buyMC);
          return { ...t, profit };
        });
        setTradeHistory(h => [...h, ...completed]);
        return [];
      });
      simulateTrade();
    }, 5000);

    return () => clearInterval(tradingInterval.current!);
  }, [isTrading, maxTrades, tokens]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch("https://cache.jup.ag/tokens");
        const data = await res.json();
        const filtered = data.filter(t => t?.name && !t.name.toLowerCase().includes("pump"));
        setTokens(filtered);
      } catch {
        toast.error("❌ Failed to fetch tokens");
      }
    };
    fetchTokens();
    return () => clearInterval(tradingInterval.current!);
  }, []);

  useEffect(() => {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/liveMints`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setLiveMints(data);
    } catch (err) {
      console.error("❌ Failed fetching live mints:", err.message || err);
    }
  }, 5000);

  return () => clearInterval(interval);
}, []);


  const paginatedTrades = tradeHistory.slice((currentPage - 1) * tradesPerPage, currentPage * tradesPerPage);
  const totalPages = Math.ceil(tradeHistory.length / tradesPerPage);
  const totalProfit = tradeHistory.reduce((acc, t) => acc + t.profit, 0);
  const wins = tradeHistory.filter(t => t.profit > 0).length;
  const losses = tradeHistory.filter(t => t.profit <= 0).length;

  return (
    <div className="bg-[#0f172a] text-white min-h-screen p-4 space-y-4">
      <div className="flex justify-between items-center">
        <img src="/logo.jpg" alt="Arch Angel Logo" className="w-24 h-24 rounded-full" />
        <div className="flex items-center space-x-4">
          {walletConnected && (
            <div className="bg-white text-black px-3 py-1 rounded text-sm">
              {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
            </div>
          )}
          <button onClick={handleWalletConnect} className="bg-black text-white px-4 py-2 rounded">
            {walletConnected ? "Disconnect Wallet" : "Connect Wallet"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col"><label>Amount to Buy (SOL)</label><input type="number" value={amountToBuy} onChange={e => setAmountToBuy(Number(e.target.value))} className="p-2 rounded text-black" /></div>
        <div className="flex flex-col"><label>Max Trades</label><input type="number" value={maxTrades} onChange={e => setMaxTrades(Number(e.target.value))} className="p-2 rounded text-black" /></div>
        <div className="flex flex-col"><label>Buy Market Cap (SOL)</label><input type="number" value={buyMarketCap} onChange={e => setBuyMarketCap(Number(e.target.value))} className="p-2 rounded text-black" /></div>
        <div className="flex flex-col"><label>Sell Market Cap Increase (SOL)</label><input type="number" value={sellMarketCap} onChange={e => setSellMarketCap(Number(e.target.value))} className="p-2 rounded text-black" /></div>
        <div className="flex flex-col"><label>Stop Loss (SOL)</label><input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} className="p-2 rounded text-black" /></div>
        <div className="flex flex-col"><label>Slippage (%)</label><input type="number" value={slippage} onChange={e => setSlippage(Number(e.target.value))} className="p-2 rounded text-black" /></div>
      </div>

      <div className="flex space-x-4">
        {Object.keys(selectedSources).map(key => (
          <label key={key} className="flex items-center space-x-2">
            <input type="checkbox" checked={selectedSources[key]} onChange={() => toggleSource(key)} />
            <span className="capitalize">{key}</span>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white text-black p-4 rounded"><p>Winning Trades</p><p className="text-green-500 text-xl font-bold">{wins}</p></div>
        <div className="bg-white text-black p-4 rounded"><p>Stop Loss Hit</p><p className="text-red-500 text-xl font-bold">{losses}</p></div>
        <div className="bg-white text-black p-4 rounded"><p>Total Profit (SOL)</p><p className="text-xl font-bold">{totalProfit.toFixed(2)}</p></div>
      </div>

      <div className="bg-white text-black p-4 rounded">
        <h2 className="font-bold">Selected Tokens ({activeTrades.length}/{maxTrades})</h2>
        <table className="w-full text-left mt-2">
          <thead><tr><th>Token Name</th><th>Buy MC</th><th>Sell MC</th><th>Amount</th><th>Profit</th><th>Action</th></tr></thead>
          <tbody>
            {activeTrades.map((t, i) => (
              <tr key={i}>
                <td>{t.name}</td>
                <td>{t.buyMC.toFixed(2)}</td>
                <td>{t.sellMC.toFixed(2)}</td>
                <td>{t.amount}</td>
                <td>{t.profit.toFixed(2)}</td>
                <td><button onClick={() => handleManualSell(i)} className="bg-red-500 text-white px-2 py-1 rounded">Sell</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white text-black p-4 rounded">
        <h2 className="font-bold">Live Minted Tokens</h2>
        <table className="w-full text-left mt-2">
          <thead><tr><th>Mint</th><th>Signature</th><th>Time</th></tr></thead>
          <tbody>
            {liveMints.map((m, i) => (
              <tr key={i}>
                <td className="break-all">{m.mintAddress}</td>
                <td>{m.signature?.slice(0, 8)}...</td>
                <td>{new Date(m.blockTime * 1000).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center">
        <button onClick={handleStartStopTrading} className={`px-6 py-3 rounded text-lg ${isTrading ? "bg-red-500" : "bg-green-500"} text-white`}>
          {isTrading ? "Stop Trading" : "Start Trading"}
        </button>
      </div>
    </div>
  );
}
