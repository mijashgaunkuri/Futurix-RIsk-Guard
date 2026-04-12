/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MMRTier } from './types';

export const SYMBOL_MMR_TIERS: Record<string, MMRTier[]> = {
  'BTCUSDT': [
    { bracket: 50000, mmr: 0.004, maintenanceAmount: 0 },
    { bracket: 250000, mmr: 0.005, maintenanceAmount: 50 },
    { bracket: 1000000, mmr: 0.01, maintenanceAmount: 1300 },
    { bracket: 5000000, mmr: 0.025, maintenanceAmount: 16300 },
    { bracket: 10000000, mmr: 0.05, maintenanceAmount: 141300 },
    { bracket: 20000000, mmr: 0.1, maintenanceAmount: 641300 },
    { bracket: 50000000, mmr: 0.125, maintenanceAmount: 1141300 },
  ],
  'ETHUSDT': [
    { bracket: 10000, mmr: 0.005, maintenanceAmount: 0 },
    { bracket: 50000, mmr: 0.01, maintenanceAmount: 250 },
    { bracket: 250000, mmr: 0.025, maintenanceAmount: 1000 },
    { bracket: 1000000, mmr: 0.05, maintenanceAmount: 7250 },
    { bracket: 2000000, mmr: 0.1, maintenanceAmount: 57250 },
    { bracket: 5000000, mmr: 0.125, maintenanceAmount: 107250 },
  ],
  'DEFAULT': [
    { bracket: 5000, mmr: 0.01, maintenanceAmount: 0 },
    { bracket: 25000, mmr: 0.025, maintenanceAmount: 75 },
    { bracket: 100000, mmr: 0.05, maintenanceAmount: 700 },
    { bracket: 250000, mmr: 0.1, maintenanceAmount: 5700 },
    { bracket: 500000, mmr: 0.125, maintenanceAmount: 11950 },
  ]
};

export const COMMON_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'TRXUSDT', 'LTCUSDT', 'BCHUSDT', 'SHIBUSDT', 'NEARUSDT', 'ATOMUSDT', 'UNIUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'OPUSDT', 'ARBUSDT', 'INJUSDT', 'TIAUSDT', 'ORDIUSDT', 'SATSUSDT', 'RUNEUSDT', 'STXUSDT', 'IMXUSDT', 'KASUSDT', 'SEIUSDT', 'PYTHUSDT', 'JUPUSDT', 'DYMUSDT', 'STRKUSDT', 'WUSDT', 'ENAUSDT', 'TAOUSDT', 'TNSRUSDT', 'SAGAUSDT', 'OMNIUSDT', 'REZUSDT', 'NOTUSDT', 'IOUSDT', 'ZKUSDT', 'LISTAUSDT'
];

export const STRATEGIES = [
  'CRT+TBS', 'FVG Entry', 'MSS + FVG', 'OB Entry', 'Breaker Block', 'Liquidity Sweep', 'Silver Bullet', 'London Open', 'NY Open', 'Power of 3', 'Turtle Soup', 'Unicorn', '2022 Model', 'Scalp', 'Swing', 'Trend Following', 'Mean Reversion', 'News Trade', 'Breakout', 'Rejection'
];

export const TIMEFRAMES = [
  '1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'
];

export const EMOTIONS = [
  'Greedy', 'Fearful', 'Anxious', 'Confident', 'Neutral', 'Bored', 'Frustrated', 'Excited', 'Revengeful', 'Disciplined'
];

export const PREDEFINED_TAGS = [
  '#A+Setup', '#HighRisk', '#FOMO', '#LateEntry', '#PerfectExit', '#EarlyExit', '#NewsEvent', '#TrendlineBreak', '#FibRetracement', '#Divergence', '#VolumeClimax', '#RangeBound', '#Breakout', '#Fakeout', '#Reversal', '#Continuation', '#Scalp', '#Swing', '#DayTrade', '#PositionTrade'
];

export const BEHAVIORAL_TAGS = [
  'Followed Plan', 'Impulsive Entry', 'Moved Stop Loss', 'Averaged Down', 'Early Exit', 'Held Too Long', 'Over-leveraged', 'Revenge Trade', 'Missed Entry', 'Perfect Execution', 'Chased Price', 'Ignored Rules'
];
