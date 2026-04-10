import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import ccxt from "ccxt";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Binance Symbol Data API for Calculator
  app.get("/api/binance/symbol-data", async (req, res) => {
    let { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

    // Normalize symbol (e.g., LTC/USDT.P -> LTC/USDT, BTCUSDT -> BTC/USDT)
    let normalizedSymbol = (symbol as string).toUpperCase();
    
    // Remove common suffixes
    normalizedSymbol = normalizedSymbol.replace('.P', '');
    normalizedSymbol = normalizedSymbol.replace(':USDT', '');
    
    // Ensure slash format for CCXT Binance
    if (!normalizedSymbol.includes('/')) {
      if (normalizedSymbol.endsWith('USDT')) {
        normalizedSymbol = normalizedSymbol.replace('USDT', '/USDT');
      } else if (normalizedSymbol.endsWith('BUSD')) {
        normalizedSymbol = normalizedSymbol.replace('BUSD', '/BUSD');
      }
    }

    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    try {
      const exchange = new ccxt.binance({
        apiKey: apiKey || undefined,
        secret: apiSecret || undefined,
        options: { defaultType: 'future' },
        enableRateLimit: true
      });

      // Fetch ticker for current price
      const ticker = await exchange.fetchTicker(normalizedSymbol);
      
      // Fetch funding rate
      const funding = await exchange.fetchFundingRate(normalizedSymbol);

      // Fetch market info for fees and precision
      const markets = await exchange.loadMarkets();
      const market = markets[normalizedSymbol];

      if (!market) {
        throw new Error(`Market ${normalizedSymbol} not found on Binance Futures`);
      }

      // Fetch Leverage Brackets (Requires API Key)
      let brackets = [];
      if (apiKey && apiSecret) {
        try {
          brackets = await exchange.fapiPrivateGetLeverageBracket({ symbol: normalizedSymbol.replace('/', '') });
        } catch (e) {
          console.warn("Could not fetch leverage brackets:", e);
        }
      }

      res.json({
        symbol: normalizedSymbol,
        price: ticker.last,
        markPrice: (ticker as any).markPrice || ticker.last,
        fundingRate: funding.fundingRate * 100, // Convert to %
        fundingIntervalHours: 8,
        makerFee: (market as any).maker * 100 || 0.02,
        takerFee: (market as any).taker * 100 || 0.05,
        stepSize: market.limits.amount.min || 0.001,
        tickSize: market.limits.price.min || 0.1,
        minNotional: market.limits.cost.min || 5,
        quantityPrecision: market.precision.amount,
        pricePrecision: market.precision.price,
        leverageBrackets: brackets,
        info: `Live data for ${normalizedSymbol} fetched successfully.`
      });
    } catch (error: any) {
      console.error("Binance Symbol Data Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Execute Trade API
  app.post("/api/binance/execute-trade", async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(401).json({ error: "Binance API keys not configured in Settings." });
    }

    let { 
      symbol, 
      direction, 
      type, 
      entryPrice, 
      quantity, 
      leverage, 
      marginMode,
      stopLoss,
      takeProfit
    } = req.body;

    // Normalize symbol
    let normalizedSymbol = (symbol as string).toUpperCase();
    normalizedSymbol = normalizedSymbol.replace('.P', '');
    normalizedSymbol = normalizedSymbol.replace(':USDT', '');
    if (!normalizedSymbol.includes('/')) {
      if (normalizedSymbol.endsWith('USDT')) normalizedSymbol = normalizedSymbol.replace('USDT', '/USDT');
      else if (normalizedSymbol.endsWith('BUSD')) normalizedSymbol = normalizedSymbol.replace('BUSD', '/BUSD');
    }

    try {
      const exchange = new ccxt.binance({
        apiKey,
        secret: apiSecret,
        options: { defaultType: 'future' },
        enableRateLimit: true
      });

      // 1. Set Margin Mode
      try {
        await exchange.setMarginMode(marginMode, normalizedSymbol);
      } catch (e: any) {
        // Ignore if already set to the same mode
        if (!e.message.includes("No need to change margin type")) {
          console.warn("Margin mode set error:", e.message);
        }
      }

      // 2. Set Leverage
      await exchange.setLeverage(leverage, normalizedSymbol);

      // 3. Place Entry Order
      const side = direction === 'LONG' ? 'buy' : 'sell';
      const orderType = type.toLowerCase(); // 'limit' or 'market'
      
      const entryOrder = await exchange.createOrder(
        normalizedSymbol,
        orderType,
        side,
        quantity,
        orderType === 'limit' ? entryPrice : undefined
      );

      const orders = [entryOrder];

      // 4. Place Stop Loss (Stop Market)
      if (stopLoss) {
        const slSide = side === 'buy' ? 'sell' : 'buy';
        const slOrder = await exchange.createOrder(
          normalizedSymbol,
          'STOP_MARKET',
          slSide,
          quantity,
          undefined,
          { stopPrice: stopLoss, reduceOnly: true }
        );
        orders.push(slOrder);
      }

      // 5. Place Take Profit (Limit Order)
      if (takeProfit) {
        const tpSide = side === 'buy' ? 'sell' : 'buy';
        const tpOrder = await exchange.createOrder(
          normalizedSymbol,
          'LIMIT',
          tpSide,
          quantity,
          takeProfit,
          { reduceOnly: true }
        );
        orders.push(tpOrder);
      }

      res.json({
        success: true,
        message: `Successfully executed ${direction} ${normalizedSymbol} trade on Binance.`,
        orders
      });
    } catch (error: any) {
      console.error("Binance Execution Error:", error);
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

    try {
      const exchange = new ccxt.binance({
        apiKey,
        secret: apiSecret,
        options: { defaultType: 'future' },
        enableRateLimit: true
      });

      const balance = await exchange.fetchBalance();
      const positions = await exchange.fetchPositions();
      
      const activePositions = positions.filter(p => {
        const contracts = typeof p.contracts === 'string' ? parseFloat(p.contracts) : (p.contracts || 0);
        return contracts !== 0;
      });

      const totalUsedMargin = activePositions.reduce((acc, p) => {
        const margin = typeof p.initialMargin === 'string' ? parseFloat(p.initialMargin) : (p.initialMargin || 0);
        return acc + margin;
      }, 0);

      res.json({
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
      });
    } catch (error: any) {
      console.error("Binance Balance Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Sync API
  app.post("/api/binance/sync", async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ 
        error: "Binance API keys not configured. Please add BINANCE_API_KEY and BINANCE_API_SECRET to your environment variables." 
      });
    }

    try {
      const exchange = new ccxt.binance({
        apiKey,
        secret: apiSecret,
        options: { defaultType: 'future' },
        enableRateLimit: true
      });

      // Fetch balance
      const balance = await exchange.fetchBalance();
      
      // Fetch recent trades (last 50 for now to avoid long wait)
      // Note: Binance fetchMyTrades requires a symbol. 
      // We can try to fetch positions first to see what symbols the user has traded recently.
      const positions = await exchange.fetchPositions();
      const activeSymbols = positions
        .filter(p => {
          const contracts = typeof p.contracts === 'string' ? parseFloat(p.contracts) : (p.contracts || 0);
          const notional = typeof p.notional === 'string' ? parseFloat(p.notional) : (p.notional || 0);
          return contracts !== 0 || notional !== 0;
        })
        .map(p => p.symbol);

      // Also get some common symbols if no active positions
      const symbolsToCheck = activeSymbols.length > 0 ? activeSymbols : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
      
      const allTrades = [];
      for (const symbol of symbolsToCheck) {
        try {
          const trades = await exchange.fetchMyTrades(symbol, undefined, 20);
          allTrades.push(...trades);
        } catch (e) {
          console.error(`Failed to fetch trades for ${symbol}:`, e);
        }
      }

      res.json({
        balance: balance.total,
        trades: allTrades.map(t => ({
          id: t.id,
          symbol: t.symbol,
          date: t.datetime,
          direction: t.side.toUpperCase(),
          entryPrice: t.price,
          quantity: t.amount,
          notionalValue: t.cost,
          fees: t.fee ? t.fee.cost : 0,
          pnl: (t as any).realizedPnl || 0, // Realized PnL if available
          status: 'CLOSED'
        })),
        info: "Binance sync completed successfully."
      });
    } catch (error: any) {
      console.error("Binance Sync Error:", error);
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
