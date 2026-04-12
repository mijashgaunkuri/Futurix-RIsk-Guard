import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import ccxt from "ccxt";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PRODUCTION-GRADE BINANCE FUTURES CLIENT
 * Encapsulates CCXT logic with retries and robust error handling.
 */
class BinanceClient {
  private static instances: Map<string, any> = new Map();
  private exchange: any;
  private apiKey: string | undefined;
  private apiSecret: string | undefined;

  constructor(apiKey?: string, apiSecret?: string) {
    this.apiKey = apiKey || process.env.BINANCE_API_KEY;
    this.apiSecret = apiSecret || process.env.BINANCE_API_SECRET;
    
    const instanceKey = `${this.apiKey || 'public'}_${this.apiSecret || 'public'}`;
    
    if (BinanceClient.instances.has(instanceKey)) {
      this.exchange = BinanceClient.instances.get(instanceKey)!;
    } else {
      this.exchange = new ccxt.binance({
        apiKey: this.apiKey,
        secret: this.apiSecret,
        options: { defaultType: 'future' },
        enableRateLimit: true,
        timeout: 30000,
      });
      BinanceClient.instances.set(instanceKey, this.exchange);
    }
  }

  async executeWithRetry<T>(fn: (exchange: any) => Promise<T>, retries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries + 1; i++) {
      try {
        return await fn(this.exchange);
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error instanceof ccxt.RateLimitExceeded || 
                           (error.message && error.message.toLowerCase().includes('rate limit')) ||
                           (error.message && error.message.toLowerCase().includes('rate exceeded'));
        
        if (error instanceof ccxt.NetworkError || isRateLimit) {
          const delay = isRateLimit ? 2000 * Math.pow(2, i) : 1000 * (i + 1);
          console.warn(`Binance API attempt ${i + 1} failed (${isRateLimit ? 'Rate Limit' : 'Network'}), retrying in ${delay}ms...`, error.message);
          if (i < retries) await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async getSymbolData(symbol: string) {
    return this.executeWithRetry(async (ex) => {
      const ticker = await ex.fetchTicker(symbol);
      const funding = await ex.fetchFundingRate(symbol);
      const markets = await ex.loadMarkets();
      const market = markets[symbol];

      if (!market) throw new Error(`Market ${symbol} not found`);

      let brackets = [];
      if (this.apiKey && this.apiSecret) {
        try {
          brackets = await ex.fapiPrivateGetLeverageBracket({ symbol: symbol.replace('/', '').replace(':USDT', '') });
        } catch (e) {
          console.warn("Could not fetch leverage brackets:", e);
        }
      }

      return {
        symbol,
        price: ticker.last,
        markPrice: (ticker as any).markPrice || ticker.last,
        fundingRate: funding.fundingRate * 100,
        fundingIntervalHours: 8,
        makerFee: (market as any).maker * 100 || 0.02,
        takerFee: (market as any).taker * 100 || 0.05,
        stepSize: market.limits.amount.min || 0.001,
        tickSize: market.limits.price.min || 0.1,
        minNotional: market.limits.cost.min || 5,
        quantityPrecision: market.precision.amount,
        pricePrecision: market.precision.price,
        leverageBrackets: brackets,
      };
    });
  }

  async getBalance() {
    return this.executeWithRetry(async (ex) => {
      const balance = await ex.fetchBalance();
      const positions = await ex.fetchPositions();
      
      const activePositions = positions.filter(p => {
        const contracts = typeof p.contracts === 'string' ? parseFloat(p.contracts) : (p.contracts || 0);
        return contracts !== 0;
      });

      const totalUsedMargin = activePositions.reduce((acc, p) => {
        const margin = typeof p.initialMargin === 'string' ? parseFloat(p.initialMargin) : (p.initialMargin || 0);
        return acc + margin;
      }, 0);

      return {
        total: balance.total,
        free: balance.free,
        used: balance.used,
        usdt: balance.total['USDT'] || 0,
        usedMargin: totalUsedMargin,
        positions: activePositions.map(p => ({
          symbol: p.symbol,
          side: p.side,
          contracts: p.contracts,
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          notional: p.notional,
          leverage: p.leverage,
          unrealizedPnl: p.unrealizedPnl,
          liquidationPrice: p.liquidationPrice,
          marginType: (p as any).marginType || (p.info ? (p.info as any).marginType : 'unknown')
        }))
      };
    });
  }
}

// Simple in-memory cache
const cache: Map<string, { data: any, timestamp: number }> = new Map();
const CACHE_TTL = 30000; // 30 seconds

function normalizeSymbol(symbol: string): string {
  let normalized = symbol.toUpperCase().replace('.P', '').replace(':USDT', '');
  if (!normalized.includes('/')) {
    if (normalized.endsWith('USDT')) normalized = normalized.replace('USDT', '/USDT');
    else if (normalized.endsWith('BUSD')) normalized = normalized.replace('BUSD', '/BUSD');
  }
  return normalized;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Binance Symbol Data API
  app.get("/api/binance/symbol-data", async (req, res) => {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

    const cacheKey = `symbol_${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10000) { // 10s cache for symbol data
      return res.json(cached.data);
    }

    try {
      const client = new BinanceClient();
      const data = await client.getSymbolData(normalizeSymbol(symbol as string));
      cache.set(cacheKey, { data, timestamp: Date.now() });
      res.json(data);
    } catch (error: any) {
      console.error("Binance Symbol Data Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Execute Trade API
  app.post("/api/binance/execute-trade", async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(401).json({ error: "Binance API keys not configured." });
    }

    const { 
      symbol, direction, type, entryPrice, quantity, leverage, marginMode, stopLoss, takeProfit 
    } = req.body;

    const normalized = normalizeSymbol(symbol);

    try {
      const client = new BinanceClient(apiKey, apiSecret);
      const result = await client.executeWithRetry(async (ex) => {
        // 1. Set Margin Mode
        try {
          await ex.setMarginMode(marginMode, normalized);
        } catch (e: any) {
          if (!e.message.includes("No need to change margin type")) console.warn("Margin mode error:", e.message);
        }

        // 2. Set Leverage
        await ex.setLeverage(leverage, normalized);

        // 3. Place Entry Order
        const side = direction === 'LONG' ? 'buy' : 'sell';
        const orderType = type.toLowerCase();
        
        const entryOrder = await ex.createOrder(normalized, orderType, side, quantity, orderType === 'limit' ? entryPrice : undefined);
        const orders = [entryOrder];

        // 4. Place SL
        if (stopLoss) {
          const slOrder = await ex.createOrder(normalized, 'STOP_MARKET', side === 'buy' ? 'sell' : 'buy', quantity, undefined, { stopPrice: stopLoss, reduceOnly: true });
          orders.push(slOrder);
        }

        // 5. Place TP
        if (takeProfit) {
          const tpOrder = await ex.createOrder(normalized, 'LIMIT', side === 'buy' ? 'sell' : 'buy', quantity, takeProfit, { reduceOnly: true });
          orders.push(tpOrder);
        }

        return { success: true, orders };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Binance Execution Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Balance API
  app.get("/api/binance/balance", async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(401).json({ error: "Binance API keys not configured." });
    }

    const cacheKey = `balance_${apiKey}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 15000) { // 15s cache for balance
      return res.json(cached.data);
    }

    try {
      const client = new BinanceClient(apiKey, apiSecret);
      const data = await client.getBalance();
      cache.set(cacheKey, { data, timestamp: Date.now() });
      res.json(data);
    } catch (error: any) {
      console.error("Binance Balance Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Sync API
  app.post("/api/binance/sync", async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(401).json({ error: "Binance API keys not configured." });
    }

    try {
      const client = new BinanceClient(apiKey, apiSecret);
      const result = await client.executeWithRetry(async (ex) => {
        const balance = await ex.fetchBalance();
        
        let income = [];
        try {
          income = await ex.fapiPrivateGetIncome({ 
            startTime: Date.now() - (7 * 24 * 60 * 60 * 1000),
            limit: 1000 
          });
        } catch (e) { console.warn("Income fetch error:", e); }
        
        const activeSymbols = new Set<string>();
        income.forEach((item: any) => {
          if (item.symbol) activeSymbols.add(normalizeSymbol(item.symbol));
        });

        const positions = await ex.fetchPositions();
        positions.forEach(p => {
          if (parseFloat(p.contracts as any) !== 0) activeSymbols.add(p.symbol);
        });

        const symbolsToCheck = Array.from(activeSymbols).slice(0, 15);
        if (symbolsToCheck.length === 0) symbolsToCheck.push('BTC/USDT', 'ETH/USDT');
        
        const allTrades = [];
        for (const symbol of symbolsToCheck) {
          try {
            const trades = await ex.fetchMyTrades(symbol, undefined, 50);
            allTrades.push(...trades);
          } catch (e) { console.error(`Trade fetch error for ${symbol}:`, e); }
        }

        allTrades.sort((a, b) => b.timestamp - a.timestamp);

        return {
          balance: balance.total,
          trades: allTrades.map(t => ({
            id: t.id,
            symbol: t.symbol,
            date: t.datetime,
            direction: t.side.toUpperCase() === 'BUY' ? 'LONG' : 'SHORT',
            entryPrice: t.price,
            quantity: t.amount,
            notionalValue: t.cost,
            fees: t.fee ? t.fee.cost : 0,
            pnl: (t as any).realizedPnl || (t.info ? parseFloat((t.info as any).realizedPnl) : 0) || 0,
            status: 'CLOSED'
          }))
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Binance Sync Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Transactions API
  app.get("/api/binance/transactions", async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(401).json({ error: "Binance API keys not configured." });
    }

    const cacheKey = `transactions_${apiKey}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    try {
      const client = new BinanceClient(apiKey, apiSecret);
      const result = await client.executeWithRetry(async (ex) => {
        const income = await ex.fapiPrivateGetIncome({
          startTime: Date.now() - (7 * 24 * 60 * 60 * 1000),
          limit: 1000
        });

        const transactions = income.map((item: any) => {
          let type = item.incomeType;
          let description = "";
          switch(type) {
            case 'TRANSFER': description = "Transfer In/Out"; break;
            case 'REALIZED_PNL': description = `Trade PNL (${item.symbol})`; break;
            case 'FUNDING_FEE': description = `Funding Fee (${item.symbol})`; break;
            case 'COMMISSION': description = `Trading Fee (${item.symbol})`; break;
            case 'INSURANCE_CLEAR': description = "Insurance Clearance"; break;
            default: description = type;
          }
          return {
            id: item.tranId,
            symbol: item.symbol || 'USDT',
            income: parseFloat(item.income),
            asset: item.asset,
            time: parseInt(item.time),
            type: type,
            description: description
          };
        });

        transactions.sort((a: any, b: any) => b.time - a.time);
        return { transactions };
      });

      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      res.json(result);
    } catch (error: any) {
      console.error("Binance Transactions Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
