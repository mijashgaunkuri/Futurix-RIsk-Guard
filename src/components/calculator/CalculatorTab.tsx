import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Clock,
  Zap,
  Target,
  Shield,
  ShieldCheck,
  Brain,
  PlusCircle,
  Copy,
  Percent,
  CircleDollarSign,
  ArrowLeftRight,
  Search,
  History,
  Trash2,
  FileText,
  Settings,
  BookOpen
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { LogTradeModal } from './LogTradeModal';
import { ConfirmExecutionModal } from './ConfirmExecutionModal';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Trade, TradeDirection } from '../../types';
import { SYMBOL_MMR_TIERS } from '../../constants';
import { cn } from '../../lib/utils';
import { 
  getVolatilityAdjustedRisk, 
  calculateRealWorldFriction, 
  getSymbolNotionalLimit, 
  getMaxLeverageForNotional, 
  findBracket 
} from '../../services/tradeService';

interface CalculatorTabProps {
  currentBalance: number;
  onLogTrade: (t: Trade) => void;
  onUpdateBalance: (a: number, t: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'RESET', n: string) => void;
  nprRate: number;
  trades: Trade[];
  calculationHistory: any[];
  setCalculationHistory: React.Dispatch<React.SetStateAction<any[]>>;
  showNotification: (m: string, t?: 'success' | 'error' | 'info') => void;
  safeFetchJson: (url: string, options?: RequestInit) => Promise<any>;
  binancePositions: any[];
}

export const CalculatorTab = ({ 
  currentBalance, 
  onLogTrade, 
  onUpdateBalance, 
  nprRate, 
  trades, 
  calculationHistory, 
  setCalculationHistory, 
  showNotification, 
  safeFetchJson, 
  binancePositions 
}: CalculatorTabProps) => {
  const [direction, setDirection] = useState<TradeDirection>(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).direction || 'LONG' : 'LONG';
    } catch (e) { return 'LONG'; }
  });
  const [symbol, setSymbol] = useState(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).symbol || 'BTCUSDT' : 'BTCUSDT';
    } catch (e) { return 'BTCUSDT'; }
  });
  const [useJournalBalance, setUseJournalBalance] = useState(true);
  const [manualBalance, setManualBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).riskPercent ?? 1 : 1;
    } catch (e) { return 1; }
  });
  const [entryPrice, setEntryPrice] = useState(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).entryPrice ?? 0 : 0;
    } catch (e) { return 0; }
  });
  const [stopLoss, setStopLoss] = useState(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).stopLoss ?? 0 : 0;
    } catch (e) { return 0; }
  });
  const [takeProfit, setTakeProfit] = useState(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).takeProfit ?? 0 : 0;
    } catch (e) { return 0; }
  });
  const [leverage, setLeverage] = useState(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).leverage ?? 10 : 10;
    } catch (e) { return 10; }
  });
  const [expectedHoldHours, setExpectedHoldHours] = useState(24);
  const [fundingRate, setFundingRate] = useState(0.01);
  const [avgFundingRate, setAvgFundingRate] = useState(0.01);
  const [fundingIntervalHours, setFundingIntervalHours] = useState(8);
  const [atr, setAtr] = useState(0);
  const [avgOrderBookDepth, setAvgOrderBookDepth] = useState(1000000);
  const [makerFee, setMakerFee] = useState(0.02);
  const [takerFee, setTakerFee] = useState(0.05);
  const [stepSize, setStepSize] = useState(0.001);
  const [tickSize, setTickSize] = useState(0.1);
  const [minNotional, setMinNotional] = useState(5);
  const [quantityPrecision, setQuantityPrecision] = useState(3);
  const [pricePrecision, setPricePrecision] = useState(2);
  const [leverageBrackets, setLeverageBrackets] = useState<any[]>([]);
  const [useDiscount, setUseDiscount] = useState(false);
  const [entryOrderType, setEntryOrderType] = useState<'MAKER' | 'TAKER'>('TAKER');
  const [exitTpOrderType, setExitTpOrderType] = useState<'MAKER' | 'TAKER'>('TAKER');
  const [exitSlOrderType, setExitSlOrderType] = useState<'MAKER' | 'TAKER'>('TAKER');
  const [marginMode, setMarginMode] = useState<'ISOLATED' | 'CROSS'>('ISOLATED');
  const [slippageBuffer, setSlippageBuffer] = useState(0.2);
  const [useConservativeSizing, setUseConservativeSizing] = useState(() => {
    try {
      const saved = localStorage.getItem('calculator_trade_params');
      return saved ? JSON.parse(saved).useConservativeSizing ?? true : true;
    } catch (e) { return true; }
  });
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [ictAnalysis, setIctAnalysis] = useState<{
    validity: string;
    mssConfirmed: string;
    fvgQuality: string;
    riskReward: string;
    verdict: string;
  } | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [manualQuantity, setManualQuantity] = useState<number | null>(null);
  const [addedMargin, setAddedMargin] = useState(0);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (symbol && symbol.length >= 3) {
      const timer = setTimeout(() => {
        fetchLiveData();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [symbol]);

  const fetchLiveData = async () => {
    setIsFetching(true);
    try {
      const formattedSymbol = symbol.includes('/') ? symbol : symbol.replace('USDT', '/USDT');
      const data = await safeFetchJson(`/api/binance/symbol-data?symbol=${encodeURIComponent(formattedSymbol)}`);
      
      if (data.error) throw new Error(data.error);

      setEntryPrice(data.price);
      setFundingRate(data.fundingRate);
      setFundingIntervalHours(data.fundingIntervalHours);
      setMakerFee(data.makerFee);
      setTakerFee(data.takerFee);
      setStepSize(data.stepSize);
      setTickSize(data.tickSize);
      setMinNotional(data.minNotional);
      setQuantityPrecision(data.quantityPrecision);
      setPricePrecision(data.pricePrecision);
      setLeverageBrackets(data.leverageBrackets);
      setLastSyncedAt(new Date());
      
      if (stopLoss === 0) {
        const slDist = data.price * 0.01;
        setStopLoss(direction === 'LONG' ? data.price - slDist : data.price + slDist);
      }
      
      showNotification(`Live data for ${symbol} synced!`, 'success');
    } catch (error: any) {
      showNotification(`Failed to fetch live data: ${error.message}`, 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const handleExecuteTrade = async () => {
    if (!results) return;
    
    setIsExecuting(true);
    try {
      const formattedSymbol = symbol.includes('/') ? symbol : symbol.replace('USDT', '/USDT');
      const data = await safeFetchJson('/api/binance/execute-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: formattedSymbol,
          direction,
          type: entryOrderType === 'TAKER' ? 'MARKET' : 'LIMIT',
          entryPrice,
          quantity: results.quantity,
          leverage,
          marginMode,
          stopLoss,
          takeProfit
        })
      });

      if (data.error) throw new Error(data.error);

      showNotification(data.message, 'success');
      
      onLogTrade({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        symbol,
        direction,
        entryPrice,
        stopLoss,
        takeProfit,
        quantity: results.quantity,
        notionalValue: results.notionalValue,
        initialMargin: results.initialMargin,
        maintenanceMargin: results.maintenanceMargin,
        liquidationPrice: results.liquidationPrice,
        leverage,
        status: 'OPEN',
        pnl: 0,
        fees: results.entryFee,
        netPnl: -results.entryFee,
        strategy: 'Binance Execution',
        tags: ['API'],
        notes: `Executed via Calculator API. SL: ${stopLoss}, TP: ${takeProfit}`,
        plannedRR: results.plannedRR,
        riskAmount: results.riskAmount,
        marginMode,
        addedMargin,
        balanceBefore: currentBalance,
        timeframe: '1m',
        emotion: 'Neutral',
        entryOrderType,
        exitTpOrderType,
        exitSlOrderType,
        estimatedHoldHours: expectedHoldHours,
        fundingRatePerInterval: fundingRate,
        fundingIntervalHours,
        makerFee,
        takerFee,
        atr,
        avgOrderBookDepth,
        avgFundingRate,
        adjustedRiskPercent: results.adjustedRiskPercent,
        useDiscount,
        finalLeverageUsed: results.finalLeverage
      });

      setIsConfirmOpen(false);
    } catch (error: any) {
      showNotification(`Execution Failed: ${error.message}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const loadHistoryItem = (item: any) => {
    setSymbol(item.symbol);
    setDirection(item.direction);
    setEntryPrice(item.entryPrice);
    setStopLoss(item.stopLoss);
    setTakeProfit(item.takeProfit || 0);
    if (item.leverage) setLeverage(item.leverage);
    if (item.riskPercent) setRiskPercent(item.riskPercent);
    if (item.marginMode) setMarginMode(item.marginMode);
    if (item.useConservativeSizing !== undefined) setUseConservativeSizing(item.useConservativeSizing);
  };

  const handleScanScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = event.target?.result?.toString().split(',')[1];
          if (!base64Data) throw new Error("Failed to read file");

          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type,
                },
              },
              {
                text: `Act as a Senior ICT Price Action Analyst. Your task is to extract trade details and validate 1-minute (1m) chart entries based on Market Structure Shift (MSS) and Fair Value Gap (FVG) logic.
### Validation Criteria:
1. MSS Identification: Confirm price has broken a clear swing high/low with aggressive displacement (large candles).
2. FVG Quality: Identify if a clear 3-candle imbalance (FVG) exists within the displacement move.
3. Liquidity Context: Check if the move started after sweeping a previous High or Low (Liquidity Purge).
4. Entry Zone: Validate if price has retraced into the FVG (Oversold/Overbought zone).
Return a JSON object with trade details and the ICT analysis. Strictly avoid "guessing" if the image is blurry. If no clear MSS is visible, mark validity as INVALID.`,
              },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  direction: { type: Type.STRING, enum: ["LONG", "SHORT"] },
                  entryPrice: { type: Type.NUMBER },
                  stopLoss: { type: Type.NUMBER },
                  takeProfit: { type: Type.NUMBER },
                  ictAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      validity: { type: Type.STRING, enum: ["VALID", "INVALID", "MARGINAL"] },
                      mssConfirmed: { type: Type.STRING },
                      fvgQuality: { type: Type.STRING },
                      riskReward: { type: Type.STRING },
                      verdict: { type: Type.STRING },
                    },
                    required: ["validity", "mssConfirmed", "fvgQuality", "riskReward", "verdict"],
                  },
                },
              },
            },
          });

          const text = response.text;
          if (!text) throw new Error("No response from AI");
          
          const result = JSON.parse(text);
          if (result.symbol) setSymbol(result.symbol.toUpperCase());
          if (result.direction) setDirection(result.direction);
          if (result.entryPrice) setEntryPrice(result.entryPrice);
          if (result.stopLoss) setStopLoss(result.stopLoss);
          if (result.takeProfit) setTakeProfit(result.takeProfit);
          if (result.ictAnalysis) setIctAnalysis(result.ictAnalysis);
        } catch (innerError: any) {
          console.error("AI Scanning failed", innerError);
          setScanError("AI failed to parse screenshot. Try a clearer image.");
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File reading failed", error);
      setScanError("Failed to read image file.");
      setIsScanning(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const dataToSave = {
      direction,
      symbol,
      riskPercent,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage,
      atr,
      avgOrderBookDepth,
      avgFundingRate,
      addedMargin,
      useConservativeSizing
    };
    localStorage.setItem('calculator_trade_params', JSON.stringify(dataToSave));
  }, [direction, symbol, riskPercent, entryPrice, stopLoss, takeProfit, leverage, atr, avgOrderBookDepth, avgFundingRate, addedMargin, useConservativeSizing]);

  const results = useMemo(() => {
    if (!entryPrice || !stopLoss || entryPrice === stopLoss) return null;

    const balance = useJournalBalance ? currentBalance : manualBalance;
    
    const adjustedRiskPercent = getVolatilityAdjustedRisk({
      baseRiskPercent: riskPercent,
      atr,
      entryPrice
    });
    const riskAmount = balance * (adjustedRiskPercent / 100);
    
    const priceDiff = direction === 'LONG' ? (entryPrice - stopLoss) : (stopLoss - entryPrice);
    
    if (priceDiff <= 0) return null;

    const friction = calculateRealWorldFriction({
      entryPrice,
      stopLoss,
      quantity: 1,
      direction,
      entryOrderType,
      exitTpOrderType,
      exitSlOrderType,
      estimatedHoldHours: expectedHoldHours,
      fundingRatePerInterval: fundingRate,
      avgFundingRate,
      fundingIntervalHours,
      atr,
      avgOrderBookDepth,
      useDiscount,
      makerFee,
      takerFee,
    });

    const feeRate = (takerFee / 100);
    const slippageRate = (slippageBuffer / 100);
    const fundingRateTotal = friction.fundingRateTotal;
    
    const priceRisk = Math.abs(entryPrice - stopLoss);
    
    const entryFeePerUnit = entryPrice * feeRate;
    const slFeePerUnit = stopLoss * feeRate;
    
    const entrySlippagePerUnit = entryPrice * slippageRate;
    const slSlippagePerUnit = stopLoss * slippageRate;
    const fundingPerUnit = entryPrice * Math.abs(fundingRateTotal);
    
    const effectiveRiskPerUnit = priceRisk + entryFeePerUnit + slFeePerUnit + entrySlippagePerUnit + slSlippagePerUnit + fundingPerUnit;
    
    let rawConservativeQuantity = riskAmount / effectiveRiskPerUnit;
    let rawStandardQuantity = riskAmount / priceRisk;

    const maxNotionalLimit = getSymbolNotionalLimit(symbol);
    const maxQuantityByNotional = maxNotionalLimit / entryPrice;

    const maxLeverageCons = getMaxLeverageForNotional(symbol, rawConservativeQuantity * entryPrice);
    const finalLeverageCons = Math.min(leverage, maxLeverageCons);
    const maxQtyBalanceCons = (balance * finalLeverageCons) / entryPrice;
    const finalConsQuantity = Math.min(rawConservativeQuantity, maxQtyBalanceCons, maxQuantityByNotional);

    const maxLeverageStd = getMaxLeverageForNotional(symbol, rawStandardQuantity * entryPrice);
    const finalLeverageStd = Math.min(leverage, maxLeverageStd);
    const maxQtyBalanceStd = (balance * finalLeverageStd) / entryPrice;
    const finalStdQuantity = Math.min(rawStandardQuantity, maxQtyBalanceStd, maxQuantityByNotional);

    const conservativeQuantity = stepSize > 0 ? Math.floor(finalConsQuantity / stepSize) * stepSize : 0;
    const standardQuantity = stepSize > 0 ? Math.floor(finalStdQuantity / stepSize) * stepSize : 0;

    const quantity = manualQuantity !== null ? manualQuantity : (useConservativeSizing ? conservativeQuantity : standardQuantity);
    const finalLeverage = useConservativeSizing ? finalLeverageCons : finalLeverageStd;
    const notionalValue = quantity * entryPrice;
    
    let mmr = 0;
    let maintenanceAmount = 0;
    
    const bracket = findBracket(leverageBrackets, notionalValue);
    if (bracket) {
      mmr = Number(bracket.maintMarginRatio || 0);
      maintenanceAmount = Number(bracket.cum || 0);
    } else {
      const tiers = SYMBOL_MMR_TIERS[symbol] || SYMBOL_MMR_TIERS['DEFAULT'];
      const tier = tiers.find(t => notionalValue <= t.bracket) || tiers[tiers.length - 1];
      mmr = tier.mmr;
      maintenanceAmount = tier.maintenanceAmount;
    }

    const initialMargin = finalLeverage > 0 ? notionalValue / finalLeverage : 0;
    const maintenanceMargin = (notionalValue * mmr) - maintenanceAmount;

    const priceLoss = Math.abs(entryPrice - stopLoss) * quantity;
    const slFees = (entryPrice + stopLoss) * feeRate * quantity;
    const slSlippage = (entryPrice + stopLoss) * slippageRate * quantity;
    const slFunding = notionalValue * Math.abs(fundingRateTotal);
    
    const netPnlAtSL = -(priceLoss + slFees + slSlippage );
    const actualRisk = Math.abs(netPnlAtSL);

    const priceGain = takeProfit ? Math.abs(takeProfit - entryPrice) * quantity : 0;
    const tpFees = takeProfit ? (entryPrice + takeProfit) * feeRate * quantity : 0;
    const tpSlippage = takeProfit ? (entryPrice + takeProfit) * (slippageRate * 0.5) * quantity : 0;
    const tpFunding = notionalValue * fundingRateTotal;
    
    const netPnlAtTP = takeProfit ? (priceGain - tpFees - tpSlippage ) : 0;

    const plannedRR = priceRisk > 0 && takeProfit ? Math.abs(takeProfit - entryPrice) / priceRisk : 0;
    const netRR = actualRisk > 0 ? netPnlAtTP / actualRisk : 0;
    const verdict = netRR < 1 ? "REJECT" : "ACCEPT";

    const riskBuffer = manualQuantity !== null ? actualRisk * 0.25 : riskAmount * 0.25;
    const totalRequired = initialMargin + (notionalValue * feeRate) + riskBuffer;
    const canTakeTrade = totalRequired < balance;

    const entryFee = notionalValue * feeRate;
    const pnlAtSL = (direction === 'LONG' ? (stopLoss - entryPrice) : (entryPrice - stopLoss)) * quantity;

    let liquidationPrice = 0;
    if (notionalValue > 0) {
      // Refined Liquidation Price Calculation (Isolated Margin)
      // Accounts for Entry Fees, Estimated Funding Fees, and Added Margin
      const estFundingFees = notionalValue * Math.abs(fundingRateTotal);
      const walletBalance = initialMargin + addedMargin - entryFee - estFundingFees;
      
      if (direction === 'LONG') {
        liquidationPrice = (entryPrice * quantity - walletBalance + maintenanceAmount) / (quantity * (1 - mmr));
      } else {
        liquidationPrice = (entryPrice * quantity + walletBalance - maintenanceAmount) / (quantity * (1 + mmr));
      }
      
      liquidationPrice = Math.max(0, isNaN(liquidationPrice) ? 0 : liquidationPrice);
    }

    const distToSL = entryPrice > 0 ? (Math.abs(entryPrice - stopLoss) / entryPrice) * 100 : 0;
    const distToLiq = entryPrice > 0 ? (Math.abs(entryPrice - liquidationPrice) / entryPrice) * 100 : 0;
    const safetyBuffer = distToSL > 0 ? distToLiq / distToSL : 0;

    const maxSafeLeverage = Math.max(1, Math.floor(1 / ((distToSL / 100) * 2.5 + mmr)));
    const optimalLeverage = Math.max(1, Math.floor(1 / ((distToSL / 100) * 3 + mmr)));

    const rules = [
      { id: 1, name: "Risk Control", passed: riskPercent <= 2, value: `${riskPercent}%`, advice: riskPercent > 2 ? "Risk exceeds 2%. High risk of ruin." : "Risk is within safe limits (≤ 2%)." },
      { id: 2, name: "Leverage Safety", passed: finalLeverage <= maxSafeLeverage, value: `${finalLeverage}x`, advice: finalLeverage > maxSafeLeverage ? `Leverage too high for this SL. Max safe: ${maxSafeLeverage}x.` : "Leverage is safe for this stop loss distance." },
      { id: 3, name: "Liquidation Safety", passed: safetyBuffer >= 3, value: `${safetyBuffer.toFixed(2)}x`, advice: safetyBuffer < 3 ? (safetyBuffer < 2.5 ? "CRITICAL: Buffer < 2.5x. Reduce leverage or reduce size." : "Caution: Liquidation is relatively close to SL.") : "Liquidation price is safely far from stop loss." },
      { id: 4, name: "Reward-to-Risk", passed: plannedRR >= 2, value: `${plannedRR.toFixed(2)}:1`, advice: plannedRR < 2 ? "RR ratio is below 2:1. Strategy may lack edge." : "Good reward-to-risk ratio." },
      { id: 5, name: "Capital Efficiency", passed: initialMargin < balance * 0.5, value: `${((initialMargin / balance) * 100).toFixed(1)}%`, advice: initialMargin > balance * 0.5 ? "Using > 50% of account as margin. High risk." : "Margin usage is within safe limits." },
      { id: 6, name: "Funding Impact", passed: Math.abs(notionalValue * fundingRateTotal) < riskAmount * 0.1, value: `$${(notionalValue * fundingRateTotal).toFixed(2)}`, advice: Math.abs(notionalValue * fundingRateTotal) > riskAmount * 0.1 ? "Funding costs are significant. Consider shorter hold." : "Funding impact is negligible." },
      { id: 7, name: "Slippage Impact", passed: (slippageRate * notionalValue) < riskAmount * 0.2, value: `${(slippageRate * 100).toFixed(2)}%`, advice: (slippageRate * notionalValue) > riskAmount * 0.2 ? "High slippage risk. Use limit orders if possible." : "Slippage impact is manageable." },
      { id: 8, name: "Margin Mode", passed: marginMode === 'ISOLATED', value: marginMode, advice: marginMode === 'CROSS' ? "Cross margin can risk entire balance. Use Isolated for safety." : "Isolated margin limits risk to position only." },
      { id: 9, name: "Symbol Volatility", passed: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(symbol), value: symbol, advice: !['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(symbol) ? "Altcoins have higher volatility and slippage." : "Trading a major, high-liquidity symbol." },
      { id: 10, name: "Capital Buffer", passed: canTakeTrade, value: canTakeTrade ? "ADEQUATE" : "INSUFFICIENT", advice: !canTakeTrade ? "Total required exceeds balance. Reduce size or leverage." : "Adequate capital to cover margin and friction." },
      { id: 11, name: "SL Validation (ATR)", passed: atr > 0 ? (distToSL / 100 * entryPrice) >= 1.5 * atr : true, value: atr > 0 ? `${(distToSL / 100 * entryPrice / atr).toFixed(1)} ATR` : "N/A", advice: atr > 0 && (distToSL / 100 * entryPrice) < 1.5 * atr ? "Stop loss is too tight relative to volatility. Increase SL distance." : "Stop loss distance is adequate for current volatility." }
    ];

    const suggestedTP2 = direction === 'LONG' ? entryPrice + (priceRisk * 2) : entryPrice - (priceRisk * 2);
    const suggestedTP3 = direction === 'LONG' ? entryPrice + (priceRisk * 3) : entryPrice - (priceRisk * 3);

    return {
      quantity,
      notionalValue,
      initialMargin,
      maintenanceMargin,
      liquidationPrice,
      riskAmount,
      pnlAtSL,
      netPnlAtSL,
      netPnlAtTP,
      plannedRR,
      netRR,
      verdict,
      canTakeTrade,
      totalRequired,
      finalLeverage,
      maxSafeLeverage,
      optimalLeverage,
      safetyBuffer,
      distToSL,
      distToLiq,
      rules,
      entryFee,
      adjustedRiskPercent,
      suggestedTP2,
      suggestedTP3,
      conservativeQuantity,
      standardQuantity
    };
  }, [entryPrice, stopLoss, takeProfit, riskPercent, leverage, useJournalBalance, currentBalance, manualBalance, direction, symbol, entryOrderType, exitTpOrderType, exitSlOrderType, expectedHoldHours, fundingRate, avgFundingRate, fundingIntervalHours, atr, avgOrderBookDepth, useDiscount, makerFee, takerFee, stepSize, tickSize, minNotional, leverageBrackets, slippageBuffer, useConservativeSizing, manualQuantity, addedMargin, marginMode]);

  const saveToHistory = () => {
    if (!results) return;
    const newEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      symbol,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage,
      riskPercent,
      marginMode,
      addedMargin,
      useConservativeSizing,
      results: { ...results }
    };
    setCalculationHistory(prev => [newEntry, ...prev].slice(0, 50));
  };

  const deleteHistoryItem = (id: string) => {
    setCalculationHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Input Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                  <Calculator className="w-4 h-4 text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold">Trade Parameters</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-xs font-bold transition-all"
                >
                  {isScanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                  Scan Chart
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleScanScreenshot} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button 
                  onClick={fetchLiveData}
                  disabled={isFetching}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl transition-all"
                  title="Refresh Live Data"
                >
                  <RefreshCw className={cn("w-5 h-5", isFetching && "animate-spin")} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {/* Direction & Symbol */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <ArrowLeftRight className="w-2.5 h-2.5" />
                    Trade Direction
                  </label>
                  <div className="flex p-0.5 bg-zinc-950 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setDirection('LONG')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                        direction === 'LONG' ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      LONG
                    </button>
                    <button
                      onClick={() => setDirection('SHORT')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                        direction === 'SHORT' ? "bg-rose-500 text-zinc-100 shadow-lg shadow-rose-500/20" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      SHORT
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <Search className="w-2.5 h-2.5" />
                    Symbol
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                      placeholder="BTCUSDT"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {isFetching && <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />}
                      <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono uppercase">FUTURES</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance & Risk */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                      <CircleDollarSign className="w-2.5 h-2.5" />
                      Trading Balance
                    </label>
                    <button 
                      onClick={() => setUseJournalBalance(!useJournalBalance)}
                      className="text-[9px] font-bold text-emerald-500 hover:underline"
                    >
                      {useJournalBalance ? "Switch to Manual" : "Use Journal Balance"}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={useJournalBalance ? currentBalance.toFixed(2) : manualBalance}
                      onChange={(e) => setManualBalance(Number(e.target.value))}
                      disabled={useJournalBalance}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-70 transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">USDT</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                      <Percent className="w-2.5 h-2.5" />
                      Risk Per Trade
                    </label>
                    <span className="text-[10px] font-bold text-emerald-500">
                      ${results?.riskAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">%</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[0.5, 1, 2, 3].map(val => (
                      <button 
                        key={val}
                        onClick={() => setRiskPercent(val)}
                        className={cn(
                          "flex-1 py-1 rounded-lg text-[9px] font-bold border transition-all",
                          riskPercent === val ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        )}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Entry & SL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Entry Price</label>
                  <input
                    type="number"
                    step={tickSize}
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Stop Loss</label>
                  <input
                    type="number"
                    step={tickSize}
                    value={stopLoss}
                    onChange={(e) => setStopLoss(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Take Profit</label>
                  <input
                    type="number"
                    step={tickSize}
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="pt-4">
                <button 
                  onClick={() => setIsModalOpen(!isModalOpen)}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-emerald-500 transition-colors"
                >
                  <Settings className={cn("w-4 h-4 transition-transform", isModalOpen && "rotate-90")} />
                  {isModalOpen ? "Hide Advanced Settings" : "Show Advanced Settings (Fees, Leverage, Slippage)"}
                </button>
                
                <AnimatePresence>
                  {isModalOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-800 mt-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Max Leverage</label>
                          <input
                            type="number"
                            value={leverage}
                            onChange={(e) => setLeverage(Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Margin Mode</label>
                          <select
                            value={marginMode}
                            onChange={(e) => setMarginMode(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none"
                          >
                            <option value="ISOLATED">Isolated</option>
                            <option value="CROSS">Cross</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Added Margin (USDT)</label>
                          <input
                            type="number"
                            value={addedMargin}
                            onChange={(e) => setAddedMargin(Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Slippage Buffer (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={slippageBuffer}
                            onChange={(e) => setSlippageBuffer(Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Entry Order Type</label>
                          <select
                            value={entryOrderType}
                            onChange={(e) => setEntryOrderType(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none"
                          >
                            <option value="TAKER">Taker (Market)</option>
                            <option value="MAKER">Maker (Limit)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">TP Order Type</label>
                          <select
                            value={exitTpOrderType}
                            onChange={(e) => setExitTpOrderType(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none"
                          >
                            <option value="TAKER">Taker (Market)</option>
                            <option value="MAKER">Maker (Limit)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">SL Order Type</label>
                          <select
                            value={exitSlOrderType}
                            onChange={(e) => setExitSlOrderType(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none"
                          >
                            <option value="TAKER">Taker (Market)</option>
                            <option value="MAKER">Maker (Limit)</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Results Card */}
          {results ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                    <Zap className="w-4 h-4 text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-bold">Execution Plan</h2>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black tracking-widest",
                  results.verdict === 'ACCEPT' ? "bg-emerald-500 text-zinc-950" : "bg-rose-500 text-zinc-100"
                )}>
                  {results.verdict}
                </div>
              </div>

              <div className="p-6">
                {/* Sizing Method Toggle */}
                <div className="flex items-center justify-between mb-6 p-1 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <button 
                    onClick={() => setUseConservativeSizing(true)}
                    className={cn(
                      "flex-1 flex flex-col items-center py-2 rounded-xl transition-all",
                      useConservativeSizing ? "bg-emerald-500 text-zinc-950 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">Conservative</span>
                    <span className="text-[9px] font-bold opacity-70">Risk + Fees + Slippage</span>
                    <span className="text-[10px] font-mono mt-1">{results.conservativeQuantity.toFixed(quantityPrecision)}</span>
                  </button>
                  <button 
                    onClick={() => setUseConservativeSizing(false)}
                    className={cn(
                      "flex-1 flex flex-col items-center py-2 rounded-xl transition-all",
                      !useConservativeSizing ? "bg-emerald-500 text-zinc-950 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">Standard</span>
                    <span className="text-[9px] font-bold opacity-70">Price Risk Only</span>
                    <span className="text-[10px] font-mono mt-1">{results.standardQuantity.toFixed(quantityPrecision)}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Position Size</p>
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-3xl font-black text-white">{results.quantity.toFixed(quantityPrecision)}</h3>
                      <span className="text-xs font-bold text-zinc-500">{symbol.replace('USDT', '')}</span>
                    </div>
                    <p className="text-[10px] font-medium text-zinc-400">≈ ${results.notionalValue.toFixed(2)} Notional</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Required Margin</p>
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-3xl font-black text-emerald-500">${results.initialMargin.toFixed(2)}</h3>
                      <span className="text-xs font-bold text-zinc-500">USDT</span>
                    </div>
                    <p className="text-[10px] font-medium text-zinc-400">at {results.finalLeverage}x Leverage</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Liquidation Price</p>
                    <div className="flex items-baseline gap-1.5">
                      <h3 className={cn(
                        "text-3xl font-black",
                        results.safetyBuffer < 1.5 ? "text-rose-500 animate-pulse" : "text-rose-500"
                      )}>${results.liquidationPrice.toFixed(pricePrecision)}</h3>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-zinc-500">Risk Buffer</span>
                        <span className={cn(
                          results.safetyBuffer < 1.2 ? "text-rose-500" : results.safetyBuffer < 2 ? "text-amber-500" : "text-emerald-500"
                        )}>
                          {results.safetyBuffer.toFixed(2)}x SL Distance
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (results.safetyBuffer / 5) * 100)}%` }}
                          className={cn(
                            "h-full transition-all duration-500",
                            results.safetyBuffer < 1.2 ? "bg-rose-500" : results.safetyBuffer < 2 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                        />
                      </div>
                      {results.safetyBuffer < 1.1 && (
                        <div className="flex items-center gap-1 text-rose-500 animate-bounce">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="text-[10px] font-black uppercase tracking-tighter">Extreme Liquidation Risk</span>
                        </div>
                      )}
                      <p className="text-[9px] text-zinc-500 leading-tight">
                        Refined calculation accounts for {Math.abs(results.fundingPnL).toFixed(4)} USDT estimated funding & fees.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-400">Net PnL at SL</span>
                      <span className="text-base font-black text-rose-500">-${Math.abs(results.netPnlAtSL).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-400">Net PnL at TP</span>
                      <span className="text-base font-black text-emerald-500">+${results.netPnlAtTP.toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-zinc-800 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-400">Net RR Ratio</span>
                      <span className={cn(
                        "text-base font-black",
                        results.netRR >= 2 ? "text-emerald-500" : "text-amber-500"
                      )}>{results.netRR.toFixed(2)}:1</span>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-400">Entry Fee</span>
                      <span className="text-xs font-bold text-zinc-200">${results.entryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-400">SL Distance</span>
                      <span className="text-xs font-bold text-zinc-200">{results.distToSL.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-400">Adjusted Risk</span>
                      <span className="text-xs font-bold text-emerald-500">{results.adjustedRiskPercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={!results.canTakeTrade || isExecuting}
                    className={cn(
                      "flex-[2] py-3 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2",
                      results.canTakeTrade 
                        ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20" 
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    )}
                  >
                    {isExecuting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    EXECUTE ON BINANCE
                  </button>
                  <button 
                    onClick={() => setIsLogModalOpen(true)}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2"
                    title="Log to Journal"
                  >
                    <BookOpen className="w-4 h-4" />
                    LOG
                  </button>
                  <button 
                    onClick={saveToHistory}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
                    title="Save to History"
                  >
                    <PlusCircle className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">Waiting for Parameters</h3>
              <p className="text-zinc-500 mt-2 max-w-xs mx-auto">Enter entry price and stop loss to see the execution plan.</p>
            </div>
          )}
        </div>

        {/* Right Column: Analysis & History */}
        <div className="space-y-6">
          {/* Risk Score Card */}
          {results && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h2 className="text-base font-bold">Risk Audit</h2>
              </div>
              <div className="p-4 space-y-3">
                {results.rules.map(rule => (
                  <div key={rule.id} className="group">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{rule.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-zinc-400">{rule.value}</span>
                        {rule.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        )}
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                      {rule.advice}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ICT Analysis Card */}
          {ictAnalysis && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <h2 className="text-base font-bold">ICT AI Analysis</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Validity</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-black",
                    ictAnalysis.validity === 'VALID' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}>{ictAnalysis.validity}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">MSS Confirmation</span>
                  <p className="text-[10px] text-zinc-300 leading-relaxed">{ictAnalysis.mssConfirmed}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">FVG Quality</span>
                  <p className="text-[10px] text-zinc-300 leading-relaxed">{ictAnalysis.fvgQuality}</p>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs font-bold text-purple-400 italic">"{ictAnalysis.verdict}"</p>
                </div>
              </div>
            </div>
          )}

          {/* History Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-zinc-400" />
                <h2 className="text-lg font-bold">Recent Calcs</h2>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{calculationHistory.length}</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {calculationHistory.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {calculationHistory.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-zinc-800/50 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-black px-1.5 py-0.5 rounded",
                              item.direction === 'LONG' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                            )}>{item.direction}</span>
                            <span className="text-sm font-bold">{item.symbol}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">{format(new Date(item.date), 'MMM d, HH:mm')}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => loadHistoryItem(item)}
                            className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-emerald-500 transition-all"
                            title="Load"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => deleteHistoryItem(item.id)}
                            className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-rose-500 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-zinc-950/50 p-2 rounded-lg">
                          <p className="text-[8px] font-bold text-zinc-500 uppercase">Quantity</p>
                          <p className="text-xs font-bold text-zinc-200">{item.results.quantity.toFixed(3)}</p>
                        </div>
                        <div className="bg-zinc-950/50 p-2 rounded-lg">
                          <p className="text-[8px] font-bold text-zinc-500 uppercase">Margin</p>
                          <p className="text-xs font-bold text-emerald-500">${item.results.initialMargin.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-xs font-bold text-zinc-600">No history yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Execution Confirmation Modal */}
      {isConfirmOpen && results && (
        <ConfirmExecutionModal 
          results={results}
          symbol={symbol}
          direction={direction}
          leverage={leverage}
          entryPrice={entryPrice}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          isExecuting={isExecuting}
          marginMode={marginMode}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleExecuteTrade}
          pricePrecision={pricePrecision}
          quantityPrecision={quantityPrecision}
        />
      )}

      {/* Log Trade Modal */}
      {isLogModalOpen && results && (
        <LogTradeModal 
          results={results}
          symbol={symbol}
          direction={direction}
          leverage={leverage}
          entryPrice={entryPrice}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          currentBalance={currentBalance}
          addedMargin={addedMargin}
          onClose={() => setIsLogModalOpen(false)}
          onSave={(trade) => {
            onLogTrade(trade);
            setIsLogModalOpen(false);
            showNotification('Trade logged to journal successfully', 'success');
          }}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};
