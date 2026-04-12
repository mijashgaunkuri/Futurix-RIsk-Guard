/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TradeDirection = 'LONG' | 'SHORT';

export interface Trade {
  id: string;
  date: string;
  symbol: string;
  direction: TradeDirection;
  leverage: number;
  entryPrice: number;
  expectedEntryPrice?: number;
  stopLoss: number;
  takeProfit: number | null;
  quantity: number;
  notionalValue: number;
  initialMargin: number;
  maintenanceMargin: number;
  liquidationPrice: number;
  riskAmount: number;
  pnl: number;
  fees: number;
  netPnl: number;
  strategy: string;
  timeframe: string;
  notes: string;
  emotion: string;
  tags: string[];
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitDate?: string;
  marginMode: 'ISOLATED' | 'CROSS';
  addedMargin: number;
  plannedRR: number;
  actualRR?: number;
  exitEfficiency?: number;
  balanceBefore: number;
  safetyBufferAtEntry?: number;
  liqDistAtEntry?: number;
  entryImage1h?: string;
  exitImage1h?: string;
  entryOrderType?: 'MAKER' | 'TAKER';
  exitTpOrderType?: 'MAKER' | 'TAKER';
  exitSlOrderType?: 'MAKER' | 'TAKER';
  estimatedHoldHours?: number;
  fundingRatePerInterval?: number;
  fundingIntervalHours?: number;
  useDiscount?: boolean;
  makerFee?: number;
  takerFee?: number;
  fundingPnL?: number;
  effectiveEntryPrice?: number;
  effectiveExitPrice?: number;
  atr?: number;
  avgOrderBookDepth?: number;
  avgFundingRate?: number;
  adjustedRiskPercent?: number;
  highestPriceReached?: number;
  lowestPriceReached?: number;
  exitRationale?: string;
  postTradeReflection?: string;
  followedPlan?: 'YES' | 'PARTIAL' | 'NO';
  mfeUsdt?: number;
  maeUsdt?: number;
  mfePercent?: number;
  maePercent?: number;
  slippageUsdt?: number;
  slippagePercent?: number;
  durationMinutes?: number;
  isRevengeTrade?: boolean;
  partialExitsCount?: number;
  isBreakevenMoved?: boolean;
  expectedExitPrice?: number;
  exitImage5min?: string;
  finalLeverageUsed?: number;
  behavioralTags?: string[];
  psychologicalScore?: number;
  mae?: number;
  mfe?: number;
  slippage?: number;
}

export interface BalanceHistory {
  id: string;
  date: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'RESET' | 'SET';
  note: string;
  balanceAfter: number;
}

export interface MMRTier {
  bracket: number;
  mmr: number;
  maintenanceAmount: number;
}
