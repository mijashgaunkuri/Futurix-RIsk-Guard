import { MMRTier } from './types';

export const SYMBOL_MMR_TIERS: Record<string, MMRTier[]> = {
  'BTCUSDT': [
    { bracket: 100000, mmr: 0.004, maintenanceAmount: 0 },
    { bracket: 500000, mmr: 0.005, maintenanceAmount: 100 },
    { bracket: 1000000, mmr: 0.01, maintenanceAmount: 2600 },
    { bracket: 5000000, mmr: 0.025, maintenanceAmount: 17600 },
    { bracket: 20000000, mmr: 0.05, maintenanceAmount: 167600 },
  ],
  'ETHUSDT': [
    { bracket: 50000, mmr: 0.004, maintenanceAmount: 0 },
    { bracket: 250000, mmr: 0.005, maintenanceAmount: 50 },
    { bracket: 1000000, mmr: 0.01, maintenanceAmount: 1300 },
    { bracket: 5000000, mmr: 0.025, maintenanceAmount: 16300 },
    { bracket: 10000000, mmr: 0.05, maintenanceAmount: 141300 },
  ],
  'SOLUSDT': [
    { bracket: 25000, mmr: 0.004, maintenanceAmount: 0 },
    { bracket: 100000, mmr: 0.005, maintenanceAmount: 25 },
    { bracket: 500000, mmr: 0.01, maintenanceAmount: 525 },
    { bracket: 2500000, mmr: 0.025, maintenanceAmount: 8025 },
    { bracket: 5000000, mmr: 0.05, maintenanceAmount: 70525 },
  ],
  'DEFAULT': [
    { bracket: 10000, mmr: 0.004, maintenanceAmount: 0 },
    { bracket: 50000, mmr: 0.005, maintenanceAmount: 10 },
    { bracket: 250000, mmr: 0.01, maintenanceAmount: 260 },
    { bracket: 1000000, mmr: 0.025, maintenanceAmount: 4010 },
    { bracket: 5000000, mmr: 0.05, maintenanceAmount: 29010 },
  ]
};

export const MMR_TIERS: MMRTier[] = SYMBOL_MMR_TIERS['DEFAULT'];

export const COMMON_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 
  'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT'
];

export const STRATEGIES = [
  'Scalping', 'Breakout', 'Trend Following', 'Mean Reversion', 
  'Range Trade', 'Fibonacci Retracement', 'Order Block', 'SMC', 'CRT+TBS'
];

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

export const EMOTIONS = ['Confident', 'Anxious', 'Greedy', 'Fearful', 'Neutral', 'FOMO'];

export const PREDEFINED_TAGS = [
  '#breakeven', '#trailed', '#overleveraged', '#news', '#FOMO', 
  '#revenge', '#plan-followed', '#early-exit', '#fat-finger', '#liquidity-grab'
];
