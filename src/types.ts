import { LucideIcon } from 'lucide-react';

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
  takeProfit?: number;
  exitPrice?: number;
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
  postTradeReflection?: string;
  exitRationale?: string;
  marketCondition: string;
  tags: string[];
  status: 'OPEN' | 'CLOSED';
  plannedRR: number;
  actualRR?: number;
  balanceBefore: number;
  balanceAfter?: number;
  highestPriceReached?: number;
  lowestPriceReached?: number;
  mfeUsdt?: number;
  maeUsdt?: number;
  mfePercent?: number;
  maePercent?: number;
  exitEfficiency?: number;
  isBreakevenMoved?: boolean;
  partialExitsCount?: number;
  isRevengeTrade?: boolean;
  followedPlan?: 'YES' | 'PARTIAL' | 'NO';
  safetyBufferAtEntry?: number;
  liqDistAtEntry?: number;
  durationMinutes?: number;
  screenshot?: string;
}

export interface BalanceHistory {
  id: string;
  date: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'RESET';
  note: string;
  balanceAfter: number;
}

export interface MMRTier {
  bracket: number;
  mmr: number;
  maintenanceAmount: number;
}
