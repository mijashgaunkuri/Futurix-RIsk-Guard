/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trade, TradeDirection } from '../types';
import { SYMBOL_MMR_TIERS } from '../constants';

export const simulateFundingFee = (params: {
  currentFundingRate: number;
  avgFundingRate: number;
  holdHours: number;
  intervalHours: number;
}) => {
  const { currentFundingRate, avgFundingRate, holdHours, intervalHours } = params;
  const intervals = Math.floor(holdHours / intervalHours);
  if (intervals <= 0) return 0;

  let totalRate = 0;
  let currentRate = currentFundingRate / 100;
  const avgRate = avgFundingRate / 100;

  for (let i = 0; i < intervals; i++) {
    const fluctuation = (Math.random() * 0.4 - 0.2) * currentRate;
    const drift = (avgRate - currentRate) * 0.1;
    currentRate = currentRate + fluctuation + drift;
    
    if (Math.abs(currentRate) < 0.00005 && Math.random() > 0.9) {
      currentRate = -currentRate;
    }
    
    totalRate += currentRate;
  }

  return totalRate;
};

export const findBracket = (brackets: any, notional: number) => {
  if (!brackets) return null;
  
  let list: any[] = [];
  if (Array.isArray(brackets)) {
    if (brackets.length > 0 && brackets[0].brackets) {
      list = brackets[0].brackets;
    } else {
      list = brackets;
    }
  } else if (brackets.brackets) {
    list = brackets.brackets;
  }

  if (!list || list.length === 0) return null;
  
  for (let b of list) {
    const floor = Number(b.notionalFloor || 0);
    const cap = Number(b.notionalCap || Infinity);
    if (notional >= floor && notional < cap) {
      return b;
    }
  }
  return list[list.length - 1];
};

export const getVolatilityAdjustedRisk = (params: {
  baseRiskPercent: number;
  atr: number;
  entryPrice: number;
}) => {
  const { baseRiskPercent, atr, entryPrice } = params;
  if (atr <= 0 || entryPrice <= 0) return baseRiskPercent;
  
  const volatilityMultiplier = atr / entryPrice;
  const adjustedRisk = baseRiskPercent / (1 + volatilityMultiplier * 20); 
  return adjustedRisk;
};

export const calculateRealWorldFriction = (params: {
  entryPrice: number;
  stopLoss: number;
  quantity: number;
  direction: TradeDirection;
  entryOrderType: 'MAKER' | 'TAKER';
  exitTpOrderType: 'MAKER' | 'TAKER';
  exitSlOrderType: 'MAKER' | 'TAKER';
  estimatedHoldHours: number;
  fundingRatePerInterval: number;
  avgFundingRate: number;
  fundingIntervalHours: number;
  atr: number;
  avgOrderBookDepth: number;
  useDiscount: boolean;
  makerFee: number;
  takerFee: number;
}) => {
  const {
    entryPrice,
    entryOrderType,
    estimatedHoldHours,
    fundingRatePerInterval,
    avgFundingRate,
    fundingIntervalHours,
    useDiscount,
    makerFee,
    takerFee,
  } = params;

  const discountMultiplier = useDiscount ? 0.9 : 1.0;
  const entryFeeRate = (entryOrderType === 'MAKER' ? makerFee : takerFee) * discountMultiplier / 100;
  const exitSlFeeRate = takerFee * discountMultiplier / 100; // SL usually taker

  const fundingRateTotal = simulateFundingFee({
    currentFundingRate: fundingRatePerInterval,
    avgFundingRate,
    holdHours: estimatedHoldHours,
    intervalHours: fundingIntervalHours
  });

  const totalFrictionRate = entryFeeRate + exitSlFeeRate + Math.abs(fundingRateTotal);

  return {
    effectiveEntryPrice: entryPrice,
    entryFeeRate,
    exitSlFeeRate,
    totalFrictionRate,
    fundingRateTotal,
    totalFundingPnL: params.quantity * entryPrice * fundingRateTotal
  };
};

export const getMaxLeverageForNotional = (symbol: string, notionalUSDT: number): number => {
  if (symbol === 'BTCUSDT') {
    if (notionalUSDT <= 50000) return 125;
    if (notionalUSDT <= 250000) return 100;
    if (notionalUSDT <= 1000000) return 50;
    if (notionalUSDT <= 5000000) return 20;
    if (notionalUSDT <= 10000000) return 10;
    return 5;
  } else if (symbol === 'ETHUSDT') {
    if (notionalUSDT <= 10000) return 100;
    if (notionalUSDT <= 50000) return 50;
    if (notionalUSDT <= 250000) return 20;
    if (notionalUSDT <= 1000000) return 10;
    return 5;
  }
  if (notionalUSDT <= 5000) return 50;
  if (notionalUSDT <= 25000) return 20;
  if (notionalUSDT <= 100000) return 10;
  return 5;
};

export const getSymbolNotionalLimit = (symbol: string): number => {
  if (symbol === 'BTCUSDT') return 50000000;
  if (symbol === 'ETHUSDT') return 20000000;
  return 5000000;
};

export const calculateTradeMetrics = (trade: Partial<Trade> & { 
  entryPrice: number, 
  stopLoss: number, 
  quantity: number, 
  direction: TradeDirection,
}) => {
  const { 
    entryPrice, 
    stopLoss, 
    quantity, 
    direction, 
    exitPrice, 
    fees = 0, 
    highestPriceReached, 
    lowestPriceReached,
    entryOrderType = 'TAKER',
    exitTpOrderType = 'TAKER',
    exitSlOrderType = 'TAKER',
    estimatedHoldHours = 24,
    fundingRatePerInterval = 0.01,
    avgFundingRate = 0.01,
    fundingIntervalHours = 8,
    atr = 0,
    avgOrderBookDepth = 1000000,
    useDiscount = false,
    makerFee = 0.02,
    takerFee = 0.05,
  } = trade;
  
  if (exitPrice === undefined) return null;

  const friction = calculateRealWorldFriction({
    entryPrice,
    stopLoss: exitPrice,
    quantity,
    direction,
    entryOrderType,
    exitTpOrderType,
    exitSlOrderType,
    estimatedHoldHours,
    fundingRatePerInterval,
    avgFundingRate,
    fundingIntervalHours,
    atr,
    avgOrderBookDepth,
    useDiscount,
    makerFee,
    takerFee,
  });

  const effectiveEntryPrice = friction.effectiveEntryPrice;
  const effectiveExitPrice = exitPrice;
  const fundingPnL = friction.totalFundingPnL;

  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  
  const pnl = direction === 'LONG' 
    ? (effectiveExitPrice - effectiveEntryPrice) * quantity
    : (effectiveEntryPrice - effectiveExitPrice) * quantity;
  
  const netPnl = pnl - fees + fundingPnL;
  const actualRR = pnl / (riskPerUnit * quantity);

  let mfePrice = direction === 'LONG' ? (highestPriceReached || exitPrice) : (lowestPriceReached || exitPrice);
  const maxPossiblePnl = direction === 'LONG'
    ? (mfePrice - effectiveEntryPrice) * quantity
    : (effectiveEntryPrice - mfePrice) * quantity;

  const exitEfficiency = maxPossiblePnl > 0 && pnl > 0 
    ? (pnl / maxPossiblePnl) * 100 
    : (pnl > 0 ? 100 : 0);

  return {
    pnl,
    netPnl,
    actualRR,
    exitEfficiency: Math.max(0, Math.min(100, exitEfficiency)),
    fundingPnL,
    effectiveEntryPrice,
    effectiveExitPrice
  };
};
