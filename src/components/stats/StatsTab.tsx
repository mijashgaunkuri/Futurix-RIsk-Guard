import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Trophy, Activity, ArrowDownRight, Zap, 
  Wallet, Brain, Shield, TrendingUp, History, Edit3, RefreshCw, Trash2,
  Dices, LineChart as LineChartIcon, Calendar as CalendarIcon, LayoutGrid
} from 'lucide-react';
import { 
  format, subDays, addDays, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, getDay, getMonth, getYear 
} from 'date-fns';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, LineChart, Line, ReferenceLine
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Trade, BalanceHistory } from '../../types';

interface StatsTabProps {
  trades: Trade[];
  startingBalance: number;
  drawdownResetDate: string | null;
  balanceHistory: BalanceHistory[];
  currentBalance: number;
  onUpdateBalance: (amount: number, type: any, note: string) => void;
  dailyGoals: any;
  onUpdateDailyGoals: (goals: any) => void;
  onResetAll: () => void;
  onClearTrades: () => void;
  onClearHistory: () => void;
  onResetDrawdown: () => void;
}

export const StatsTab = ({ 
  trades, 
  startingBalance, 
  drawdownResetDate,
  balanceHistory, 
  currentBalance,
  onUpdateBalance,
  dailyGoals, 
  onUpdateDailyGoals, 
  onResetAll, 
  onClearTrades, 
  onClearHistory,
  onResetDrawdown
}: StatsTabProps) => {
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState(dailyGoals);
  const [isUpdateBalanceOpen, setIsUpdateBalanceOpen] = useState(false);
  const [newBalanceValue, setNewBalanceValue] = useState(currentBalance);
  const [balanceNote, setBalanceNote] = useState('');

  const stats = useMemo(() => {
    const closed = trades.filter((t: Trade) => t.status === 'CLOSED');
    
    // Daily stats for tracking
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const tradesToday = trades.filter((t: Trade) => format(new Date(t.date), 'yyyy-MM-dd') === todayStr);
    const closedToday = tradesToday.filter((t: Trade) => t.status === 'CLOSED');
    const pnlToday = closedToday.reduce((acc, t) => acc + t.netPnl, 0);
    
    let maxConsecutiveLossesToday = 0;
    let currentConsecutiveLossesToday = 0;
    const sortedClosedToday = [...closedToday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedClosedToday.forEach(t => {
      if (t.netPnl <= 0) {
        currentConsecutiveLossesToday++;
        if (currentConsecutiveLossesToday > maxConsecutiveLossesToday) {
          maxConsecutiveLossesToday = currentConsecutiveLossesToday;
        }
      } else {
        currentConsecutiveLossesToday = 0;
      }
    });

    if (closed.length === 0) return {
      winRate: 0,
      totalNetPnl: 0,
      totalFees: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgEfficiency: 0,
      avgMfe: 0,
      avgMae: 0,
      strategyStats: {},
      emotionStats: {},
      revengeTradeStats: { total: 0, wins: 0, pnl: 0 },
      hourlyData: Array.from({ length: 24 }, (_, i) => ({ hour: i, winRate: 0, total: 0 })),
      monteCarloPaths: [],
      totalFundingFees: 0,
      monthlyData: [],
      equityData: [],
      drawdownData: [],
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
      totalTrades: 0,
      tradesTodayCount: tradesToday.length,
      consecutiveLossesToday: maxConsecutiveLossesToday,
      pnlToday: 0,
      dailyHeatmap: [],
      weeklyHeatmap: [],
      monthlyHeatmap: []
    };

    const wins = closed.filter((t: Trade) => t.netPnl > 0);
    const losses = closed.filter((t: Trade) => t.netPnl <= 0);
    const winRate = (wins.length / closed.length) * 100;

    const totalNetPnl = closed.reduce((acc, t) => acc + t.netPnl, 0);
    const totalFees = closed.reduce((acc, t) => acc + t.fees, 0);
    
    const avgWin = wins.length > 0 ? wins.reduce((acc, t) => acc + t.netPnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((acc, t) => acc + t.netPnl, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (wins.reduce((acc, t) => acc + t.netPnl, 0) / Math.abs(losses.reduce((acc, t) => acc + t.netPnl, 0))) : 0;

    const avgEfficiency = closed.reduce((acc, t) => acc + (t.exitEfficiency || 0), 0) / closed.length;
    const avgMfe = closed.reduce((acc, t) => acc + (t.mfePercent || 0), 0) / closed.length;
    const avgMae = closed.reduce((acc, t) => acc + (t.maePercent || 0), 0) / closed.length;

    // Funding Cost Summary
    const totalFundingFees = closed.reduce((acc, t) => acc + (t.fundingPnL || 0), 0);

    // Psychological Metrics
    const emotionStats: Record<string, { wins: number, total: number, pnl: number }> = {};
    closed.forEach(t => {
      const emotion = t.emotion || 'NEUTRAL';
      if (!emotionStats[emotion]) emotionStats[emotion] = { wins: 0, total: 0, pnl: 0 };
      emotionStats[emotion].total++;
      emotionStats[emotion].pnl += t.netPnl;
      if (t.netPnl > 0) emotionStats[emotion].wins++;
    });

    const revengeTradeStats = {
      total: closed.filter(t => t.isRevengeTrade).length,
      wins: closed.filter(t => t.isRevengeTrade && t.netPnl > 0).length,
      pnl: closed.filter(t => t.isRevengeTrade).reduce((acc, t) => acc + t.netPnl, 0)
    };

    // Time of day performance
    const hourlyStats: Record<number, { wins: number, total: number }> = {};
    closed.forEach(t => {
      const hour = new Date(t.date).getHours();
      if (!hourlyStats[hour]) hourlyStats[hour] = { wins: 0, total: 0 };
      hourlyStats[hour].total++;
      if (t.netPnl > 0) hourlyStats[hour].wins++;
    });

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      winRate: hourlyStats[i] ? (hourlyStats[i].wins / hourlyStats[i].total) * 100 : 0,
      total: hourlyStats[i]?.total || 0
    }));

    // Advanced Monte Carlo Simulation (50 paths, 50 trades into future)
    const monteCarlo = (() => {
      if (closed.length < 5) return { stepData: [], stats: null };
      
      const pnlResults = closed.map(t => t.netPnl);
      const startBalance = currentBalance;
      const numPaths = 50;
      const numTrades = 50;
      const ruinThreshold = startBalance * 0.5; // 50% drawdown
      
      const paths: any[][] = [];
      let ruinCount = 0;
      const endBalances: number[] = [];

      for (let i = 0; i < numPaths; i++) {
        let currentPathBalance = startBalance;
        const path = [{ trade: 0, balance: currentPathBalance }];
        let hitRuin = false;

        for (let j = 1; j <= numTrades; j++) {
          const randomPnl = pnlResults[Math.floor(Math.random() * pnlResults.length)];
          currentPathBalance += randomPnl;
          path.push({ trade: j, balance: currentPathBalance });
          if (currentPathBalance <= ruinThreshold) hitRuin = true;
        }
        
        if (hitRuin) ruinCount++;
        endBalances.push(currentPathBalance);
        paths.push(path);
      }

      const stepData = Array.from({ length: numTrades + 1 }, (_, step) => {
        const stepBalances = paths.map(p => p[step].balance).sort((a, b) => a - b);
        return {
          trade: step,
          p5: stepBalances[Math.floor(numPaths * 0.05)],
          median: stepBalances[Math.floor(numPaths / 2)],
          p95: stepBalances[Math.floor(numPaths * 0.95)],
          path1: paths[0][step].balance,
          path2: paths[1][step].balance,
          path3: paths[2][step].balance,
        };
      });

      endBalances.sort((a, b) => a - b);
      const medianEnd = endBalances[Math.floor(numPaths / 2)];

      return {
        stepData,
        stats: {
          median: medianEnd,
          p5: endBalances[Math.floor(numPaths * 0.05)],
          p95: endBalances[Math.floor(numPaths * 0.95)],
          ruinProbability: (ruinCount / numPaths) * 100,
          expectedGrowth: ((medianEnd - startBalance) / startBalance) * 100
        }
      };
    })();

    // Win rate by strategy
    const strategyStats: Record<string, { wins: number, total: number }> = {};
    closed.forEach(t => {
      if (!strategyStats[t.strategy]) strategyStats[t.strategy] = { wins: 0, total: 0 };
      strategyStats[t.strategy].total++;
      if (t.netPnl > 0) strategyStats[t.strategy].wins++;
    });

    // Monthly PNL
    const monthlyPnl: Record<string, number> = {};
    const monthOfYearStats: Record<number, { pnl: number, wins: number, total: number }> = {};
    const dayOfWeekStats: Record<number, { pnl: number, wins: number, total: number }> = {};
    
    closed.forEach(t => {
      const date = new Date(t.date);
      const monthStr = format(date, 'MMM yyyy');
      monthlyPnl[monthStr] = (monthlyPnl[monthStr] || 0) + t.netPnl;
      
      const monthIdx = date.getMonth(); // 0-11
      if (!monthOfYearStats[monthIdx]) monthOfYearStats[monthIdx] = { pnl: 0, wins: 0, total: 0 };
      monthOfYearStats[monthIdx].pnl += t.netPnl;
      monthOfYearStats[monthIdx].total++;
      if (t.netPnl > 0) monthOfYearStats[monthIdx].wins++;
      
      const dayIdx = date.getDay(); // 0-6 (Sun-Sat)
      if (!dayOfWeekStats[dayIdx]) dayOfWeekStats[dayIdx] = { pnl: 0, wins: 0, total: 0 };
      dayOfWeekStats[dayIdx].pnl += t.netPnl;
      dayOfWeekStats[dayIdx].total++;
      if (t.netPnl > 0) dayOfWeekStats[dayIdx].wins++;
    });

    const monthlyData = Object.entries(monthlyPnl).map(([name, pnl]) => ({ name, pnl }));
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyHeatmap = monthNames.map((name, i) => ({
      name,
      pnl: monthOfYearStats[i]?.pnl || 0,
      winRate: monthOfYearStats[i] ? (monthOfYearStats[i].wins / monthOfYearStats[i].total) * 100 : 0,
      total: monthOfYearStats[i]?.total || 0
    }));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyHeatmap = dayNames.map((name, i) => ({
      name,
      pnl: dayOfWeekStats[i]?.pnl || 0,
      winRate: dayOfWeekStats[i] ? (dayOfWeekStats[i].wins / dayOfWeekStats[i].total) * 100 : 0,
      total: dayOfWeekStats[i]?.total || 0
    }));

    // Advanced Calendar & Heatmap Data
    const calendarData = (() => {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const days = eachDayOfInterval({ start: startOfWeek(start), end: endOfWeek(end) });

      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayTrades = closed.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === dayStr);
        const pnl = dayTrades.reduce((acc, t) => acc + t.netPnl, 0);
        const wins = dayTrades.filter(t => t.netPnl > 0).length;
        
        return {
          date: day,
          dayStr,
          pnl,
          trades: dayTrades.length,
          winRate: dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0,
          isCurrentMonth: isSameMonth(day, now),
          isToday: isSameDay(day, now)
        };
      });
    })();

    // Daily Heatmap (Last 365 days for a full year view)
    const yearHeatmap = [];
    const oneYearAgo = subDays(new Date(), 364);
    for (let i = 0; i <= 364; i++) {
      const d = addDays(oneYearAgo, i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayTrades = closed.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === dStr);
      const pnl = dayTrades.reduce((acc, t) => acc + t.netPnl, 0);
      yearHeatmap.push({
        date: d,
        dayStr: dStr,
        pnl,
        count: dayTrades.length
      });
    }

    // Equity Curve & Drawdown (Synced Data)
    const equityData: any[] = [];
    const sortedHistory = [...balanceHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let peak = startingBalance;
    if (drawdownResetDate) {
      const historyBefore = sortedHistory.filter(h => new Date(h.date) < new Date(drawdownResetDate));
      if (historyBefore.length > 0) {
        peak = historyBefore[historyBefore.length - 1].balanceAfter;
      }
    }

    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    sortedHistory.forEach((h, i) => {
      const isAfterReset = !drawdownResetDate || new Date(h.date) >= new Date(drawdownResetDate);
      
      if (isAfterReset && h.balanceAfter > peak) {
        peak = h.balanceAfter;
      }

      const dd = peak - h.balanceAfter;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
      
      if (isAfterReset) {
        if (dd > maxDrawdown) maxDrawdown = dd;
        if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;
      }

      equityData.push({
        name: format(new Date(h.date), 'MMM dd HH:mm'),
        balance: h.balanceAfter,
        drawdown: parseFloat(ddPct.toFixed(2)),
        drawdownAmount: parseFloat(dd.toFixed(2)),
        tradeIndex: i + 1,
        pnl: h.amount,
        type: h.type,
        peak: peak
      });
    });

    return {
      winRate,
      totalNetPnl,
      totalFees,
      avgWin,
      avgLoss,
      avgEfficiency,
      avgMfe,
      avgMae,
      strategyStats,
      emotionStats,
      revengeTradeStats,
      hourlyData,
      monteCarlo,
      totalFundingFees,
      monthlyData,
      equityData,
      maxDrawdown,
      maxDrawdownPercent,
      currentDrawdown: equityData.length > 0 ? equityData[equityData.length - 1].drawdownAmount : 0,
      currentDrawdownPercent: equityData.length > 0 ? equityData[equityData.length - 1].drawdown : 0,
      totalTrades: closed.length,
      tradesTodayCount: tradesToday.length,
      consecutiveLossesToday: maxConsecutiveLossesToday,
      pnlToday,
      weeklyHeatmap,
      monthlyHeatmap,
      calendarData,
      yearHeatmap,
      expectancy: closed.length > 0 ? totalNetPnl / closed.length : 0,
      recoveryFactor: maxDrawdown > 0 ? totalNetPnl / maxDrawdown : 0,
      profitFactor: (() => {
        const grossProfit = wins.reduce((acc, t) => acc + t.netPnl, 0);
        const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.netPnl, 0));
        return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
      })(),
      kellyCriterion: (() => {
        if (closed.length === 0) return 0;
        const w = winRate / 100;
        const r = avgWin / (avgLoss || 1);
        if (r === 0) return 0;
        const k = w - ((1 - w) / r);
        return Math.max(0, k * 100); // Return as percentage, min 0
      })(),
      insights: (() => {
        if (closed.length === 0) return null;
        const strategies: Record<string, { wins: number, total: number }> = {};
        closed.forEach((t: Trade) => {
          if (!strategies[t.strategy]) strategies[t.strategy] = { wins: 0, total: 0 };
          strategies[t.strategy].total++;
          if (t.netPnl > 0) strategies[t.strategy].wins++;
        });
        const bestStrategy = Object.entries(strategies).reduce((a, b) => 
          (b[1].wins / b[1].total) > (a[1].wins / a[1].total) ? b : a
        );
        return {
          bestStrategy: { name: bestStrategy[0], winRate: (bestStrategy[1].wins / bestStrategy[1].total) * 100 },
          avgEfficiency
        };
      })()
    };
  }, [trades, startingBalance, balanceHistory, drawdownResetDate]);

  const handleUpdateBalance = () => {
    onUpdateBalance(newBalanceValue, 'SET', balanceNote || 'Manual Balance Update');
    setIsUpdateBalanceOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Performance Analytics</h2>
          <p className="text-sm text-zinc-500">Deep dive into your trading behavior and edge.</p>
        </div>
        <button 
          onClick={onResetAll}
          className="btn-secondary text-rose-500 border-rose-500/20 hover:bg-rose-500/10 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          RESET ALL DATA
        </button>
      </div>

      {/* Quick Insights Bar */}
      {stats.insights && (
        <div className="flex flex-wrap gap-3">
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Best Strategy:</span>
            <span className="text-[10px] font-bold text-zinc-100">{stats.insights.bestStrategy.name} ({stats.insights.bestStrategy.winRate.toFixed(0)}%)</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Win:</span>
            <span className="text-[10px] font-bold text-emerald-500">${stats.avgWin.toFixed(2)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Loss:</span>
            <span className="text-[10px] font-bold text-rose-500">${stats.avgLoss.toFixed(2)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Efficiency:</span>
            <span className="text-[10px] font-bold text-zinc-100">{stats.avgEfficiency.toFixed(1)}%</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Balance Card */}
        <div className="crypto-card bg-emerald-500/5 border-emerald-500/20 flex flex-col justify-between group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-emerald-500/70 uppercase font-bold tracking-widest">Current Balance</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold text-emerald-500">
                  ${(currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-500/40 font-mono">USDT</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setNewBalanceValue(currentBalance);
                setIsUpdateBalanceOpen(true);
              }}
              className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-zinc-950 transition-all duration-300 shadow-lg shadow-emerald-500/10"
              title="Update Balance"
            >
              <Wallet className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Psychology Status Card */}
        <div className="lg:col-span-3 crypto-card bg-zinc-900/50 border-zinc-800/50 flex items-center gap-6">
          <div className="p-3 rounded-full bg-emerald-500/10">
            <Brain className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-zinc-100">Trading Psychology Status</h4>
            <p className="text-xs text-zinc-500 mt-1">
              {stats.pnlToday <= -dailyGoals.dailyMaxLoss
                ? "Risk Alert: You've hit your daily loss limit. Stop trading immediately to protect your capital."
                : stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses 
                ? "Discipline Alert: You've hit your consecutive loss limit. Step away from the charts to avoid revenge trading."
                : stats.pnlToday >= dailyGoals.dailyProfitTarget
                ? "Goal Achieved: You've hit your daily profit target. Consider closing for the day to lock in gains."
                : stats.tradesTodayCount >= dailyGoals.maxTradesPerDay
                ? "Daily Limit Reached: You've completed your planned trades for today. Great job sticking to the plan!"
                : "Market Focus: Stick to your setups and maintain your risk parameters. Quality over quantity."}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <span className={cn(
              "text-[10px] font-bold px-3 py-1 rounded-full",
              (stats.tradesTodayCount > dailyGoals.maxTradesPerDay || stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses || stats.pnlToday <= -dailyGoals.dailyMaxLoss)
                ? "bg-rose-500/10 text-rose-500"
                : (stats.pnlToday >= dailyGoals.dailyProfitTarget)
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-emerald-500/10 text-emerald-500"
            )}>
              {(stats.tradesTodayCount > dailyGoals.maxTradesPerDay || stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses || stats.pnlToday <= -dailyGoals.dailyMaxLoss)
                ? "STOP TRADING"
                : (stats.pnlToday >= dailyGoals.dailyProfitTarget)
                  ? "GOAL REACHED"
                  : "SAFE TO TRADE"}
            </span>
          </div>
        </div>
      </div>

      {/* Risk Management Goals */}
      <div className="crypto-card p-6 border-zinc-800/50 bg-zinc-900/30">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-sm font-bold uppercase text-zinc-100 flex items-center gap-2 tracking-wider">
              <Shield className="w-4 h-4 text-emerald-500" /> Daily Risk Management
            </h3>
            <p className="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Protect your capital • Trade with discipline</p>
          </div>
          <button 
            onClick={() => setIsEditingGoals(!isEditingGoals)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-[10px] text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all font-bold uppercase tracking-widest border border-zinc-700/50"
          >
            {isEditingGoals ? 'Cancel' : 'Configure Goals'}
          </button>
        </div>

        {isEditingGoals ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Max Trades / Day</label>
              <input 
                type="number" 
                value={isNaN(tempGoals.maxTradesPerDay) ? '' : tempGoals.maxTradesPerDay}
                onChange={(e) => setTempGoals({...tempGoals, maxTradesPerDay: parseInt(e.target.value) || 0})}
                className="input-field w-full bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Max Consecutive Losses</label>
              <input 
                type="number" 
                value={isNaN(tempGoals.maxConsecutiveLosses) ? '' : tempGoals.maxConsecutiveLosses}
                onChange={(e) => setTempGoals({...tempGoals, maxConsecutiveLosses: parseInt(e.target.value) || 0})}
                className="input-field w-full bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Daily Profit Target ($)</label>
              <input 
                type="number" 
                value={isNaN(tempGoals.dailyProfitTarget) ? '' : tempGoals.dailyProfitTarget}
                onChange={(e) => setTempGoals({...tempGoals, dailyProfitTarget: parseInt(e.target.value) || 0})}
                className="input-field w-full bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Daily Max Loss ($)</label>
              <input 
                type="number" 
                value={isNaN(tempGoals.dailyMaxLoss) ? '' : tempGoals.dailyMaxLoss}
                onChange={(e) => setTempGoals({...tempGoals, dailyMaxLoss: parseInt(e.target.value) || 0})}
                className="input-field w-full bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 transition-all"
              />
            </div>
            <button 
              onClick={() => {
                onUpdateDailyGoals(tempGoals);
                setIsEditingGoals(false);
              }}
              className="btn-primary md:col-span-2 lg:col-span-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black uppercase tracking-widest py-3 shadow-lg shadow-emerald-500/20"
            >
              Apply Risk Parameters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Trade Limit */}
            <div className="p-4 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all group">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest group-hover:text-zinc-400 transition-colors">Trade Limit</span>
                <span className={cn(
                  "text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-900",
                  stats.tradesTodayCount > dailyGoals.maxTradesPerDay ? "text-rose-500" : "text-emerald-500"
                )}>
                  {stats.tradesTodayCount} / {dailyGoals.maxTradesPerDay}
                </span>
              </div>
              <div className="h-2 bg-zinc-900/50 rounded-full overflow-hidden border border-zinc-800/50">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (stats.tradesTodayCount / dailyGoals.maxTradesPerDay) * 100)}%` }}
                  className={cn("h-full transition-all duration-500", stats.tradesTodayCount > dailyGoals.maxTradesPerDay ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]")} 
                />
              </div>
            </div>

            {/* Consecutive Losses */}
            <div className="p-4 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all group">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest group-hover:text-zinc-400 transition-colors">Loss Streak</span>
                <span className={cn(
                  "text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-900",
                  stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses ? "text-rose-500" : "text-emerald-500"
                )}>
                  {stats.consecutiveLossesToday} / {dailyGoals.maxConsecutiveLosses}
                </span>
              </div>
              <div className="h-2 bg-zinc-900/50 rounded-full overflow-hidden border border-zinc-800/50">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (stats.consecutiveLossesToday / dailyGoals.maxConsecutiveLosses) * 100)}%` }}
                  className={cn("h-full transition-all duration-500", stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]")} 
                />
              </div>
            </div>

            {/* Daily PnL */}
            <div className="p-4 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all group">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest group-hover:text-zinc-400 transition-colors">Daily PnL</span>
                <span className={cn(
                  "text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-900",
                  stats.pnlToday >= dailyGoals.dailyProfitTarget ? "text-emerald-500" : (stats.pnlToday <= -dailyGoals.dailyMaxLoss ? "text-rose-500" : "text-zinc-400")
                )}>
                  ${stats.pnlToday.toFixed(0)}
                </span>
              </div>
              <div className="h-2 bg-zinc-900/50 rounded-full overflow-hidden border border-zinc-800/50 relative">
                {/* Center marker for 0 */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-700/50 z-10" />
                <motion.div 
                  initial={{ width: 0, left: '50%' }}
                  animate={{ 
                    width: stats.pnlToday >= 0 
                      ? `${Math.min(50, (stats.pnlToday / dailyGoals.dailyProfitTarget) * 50)}%`
                      : `${Math.min(50, (Math.abs(stats.pnlToday) / dailyGoals.dailyMaxLoss) * 50)}%`,
                    left: stats.pnlToday >= 0 ? '50%' : `${50 - Math.min(50, (Math.abs(stats.pnlToday) / dailyGoals.dailyMaxLoss) * 50)}%`
                  }}
                  className={cn(
                    "h-full transition-all duration-500 absolute", 
                    stats.pnlToday >= 0 
                      ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                      : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                  )} 
                />
              </div>
              <div className="flex justify-between mt-2 px-0.5">
                <span className="text-[8px] text-zinc-600 font-bold">-${dailyGoals.dailyMaxLoss}</span>
                <span className="text-[8px] text-zinc-600 font-bold">+$0</span>
                <span className="text-[8px] text-zinc-600 font-bold">+${dailyGoals.dailyProfitTarget}</span>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="p-4 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 flex items-center justify-center relative overflow-hidden group">
              <div className={cn(
                "absolute inset-0 opacity-5 transition-opacity duration-500 group-hover:opacity-10",
                (stats.tradesTodayCount > dailyGoals.maxTradesPerDay || stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses || stats.pnlToday <= -dailyGoals.dailyMaxLoss)
                  ? "bg-rose-500"
                  : (stats.pnlToday >= dailyGoals.dailyProfitTarget)
                    ? "bg-emerald-500"
                    : "bg-blue-500"
              )} />
              <div className="text-center relative z-10">
                <div className={cn(
                  "text-[10px] font-black px-4 py-2 rounded-xl border uppercase tracking-[0.2em] transition-all duration-500",
                  (stats.tradesTodayCount > dailyGoals.maxTradesPerDay || stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses || stats.pnlToday <= -dailyGoals.dailyMaxLoss)
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                    : (stats.pnlToday >= dailyGoals.dailyProfitTarget)
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                      : "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                )}>
                  {(stats.tradesTodayCount > dailyGoals.maxTradesPerDay || stats.consecutiveLossesToday >= dailyGoals.maxConsecutiveLosses || stats.pnlToday <= -dailyGoals.dailyMaxLoss)
                    ? "STOP TRADING"
                    : (stats.pnlToday >= dailyGoals.dailyProfitTarget)
                      ? "GOAL REACHED"
                      : "SAFE TO TRADE"}
                </div>
              </div>

              {/* Advanced Performance Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expectancy</span>
                  </div>
                  <div className={cn("text-lg font-mono font-black", stats.expectancy >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    ${stats.expectancy.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">/ trade</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recovery Factor</span>
                  </div>
                  <div className="text-lg font-mono font-black text-blue-500">
                    {stats.recoveryFactor.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">x DD</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Profit Factor</span>
                  </div>
                  <div className="text-lg font-mono font-black text-emerald-500">
                    {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">W/L</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sharpe Ratio</span>
                  </div>
                  <div className="text-lg font-mono font-black text-purple-500">
                    {(stats.expectancy / (stats.avgLoss || 1)).toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">Score</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="crypto-card relative">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Win Rate</span>
            <button 
              onClick={onClearTrades}
              className="p-1 rounded-md bg-zinc-800/50 hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-500 transition-all border border-zinc-700/50"
              title="Edit Win Rate (Clears Trades)"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-500 mt-1">{stats.winRate.toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500 mt-1">{stats.totalTrades} total trades</div>
        </div>
        <div className="crypto-card relative">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Profit Factor</span>
            <button 
              onClick={onClearTrades}
              className="p-1 rounded-md bg-zinc-800/50 hover:bg-blue-500/10 text-zinc-500 hover:text-blue-500 transition-all border border-zinc-700/50"
              title="Edit Profit Factor (Clears Trades)"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          <div className="text-2xl font-mono font-bold text-blue-500 mt-1">{(stats.profitFactor || 0).toFixed(2)}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Avg W/L: {(stats.avgWin / (stats.avgLoss || 1)).toFixed(2)}</div>
        </div>
        <div className="crypto-card relative">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Net PNL</span>
            <button 
              onClick={onClearTrades}
              className="p-1 rounded-md bg-zinc-800/50 hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-500 transition-all border border-zinc-700/50"
              title="Edit PNL (Clears Trades)"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          <div className={cn("text-2xl font-mono font-bold mt-1", (stats.totalNetPnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
            ${(stats.totalNetPnl || 0).toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Fees: ${(stats.totalFees || 0).toFixed(2)}</div>
        </div>
        <div className="crypto-card relative">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Avg Duration</span>
            <button 
              onClick={onClearTrades}
              className="p-1 rounded-md bg-zinc-800/50 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-500 transition-all border border-zinc-700/50"
              title="Reset Duration (Clears Trades)"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="text-2xl font-mono font-bold text-purple-500 mt-1">
            {stats.totalTrades > 0 ? (trades.filter((t: Trade) => t.status === 'CLOSED').reduce((acc: number, t: Trade) => acc + (t.durationMinutes || 0), 0) / stats.totalTrades).toFixed(0) : '0'}m
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Efficiency: {stats.avgEfficiency.toFixed(1)}%</div>
        </div>
        <div className="crypto-card relative">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Max Drawdown</span>
            <div className="flex gap-1">
              <button 
                onClick={onResetDrawdown}
                className="p-1 rounded-md bg-zinc-800/50 hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-500 transition-all border border-zinc-700/50"
                title="Reset Max Drawdown (Keep History)"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button 
                onClick={onClearHistory}
                className="p-1 rounded-md bg-zinc-800/50 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-500 transition-all border border-zinc-700/50"
                title="Clear Balance History (Delete Data)"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-rose-500 mt-1">{(stats.maxDrawdownPercent || 0).toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500 mt-1">Current: {(stats.currentDrawdownPercent || 0).toFixed(1)}%</div>
        </div>
        <div className="crypto-card">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Kelly Criterion</span>
          <div className="text-2xl font-mono font-bold text-amber-500 mt-1">{(stats.kellyCriterion || 0).toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500 mt-1">Suggested risk per trade</div>
        </div>
      </div>

      {stats.totalTrades === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <History className="w-12 h-12 mb-4 opacity-20" />
          <p className="italic">Not enough closed trades to generate analytics.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6">
            {/* Equity Curve & Drawdown Sync */}
            <div className="crypto-card p-6 bg-zinc-900/40 border-zinc-800/50 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase text-zinc-100 flex items-center gap-2 tracking-wider">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Equity Growth & Drawdown
                  </h3>
                  <p className="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Cumulative performance over time</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total Growth</div>
                    <div className={cn("text-lg font-mono font-bold", stats.totalNetPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {stats.totalNetPnl >= 0 ? '+' : ''}{((stats.totalNetPnl / startingBalance) * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Max DD</div>
                    <div className="text-lg font-mono font-bold text-rose-500">
                      -{stats.maxDrawdownPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
                           <div className="space-y-2">
                {/* Main Equity Chart */}
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.equityData} syncId="performanceSync">
                      <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#3f3f46" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: '#71717a' }}
                        minTickGap={40}
                      />
                      <YAxis 
                        stroke="#3f3f46" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                        domain={['auto', 'auto']}
                        tick={{ fill: '#71717a' }}
                      />
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl shadow-2xl space-y-3 min-w-[200px]">
                                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{data.name}</p>
                                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-bold">Trade #{data.tradeIndex}</span>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Equity</span>
                                    <span className="text-sm font-mono font-black text-zinc-100">${data.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Change</span>
                                    <span className={cn(
                                      "text-xs font-mono font-bold",
                                      data.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                                    )}>
                                      {data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)} ({((data.pnl / (data.balance - data.pnl)) * 100).toFixed(2)}%)
                                    </span>
                                  </div>

                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Drawdown</span>
                                    <span className="text-xs font-mono font-bold text-rose-500">
                                      -{data.drawdown}% (${data.drawdownAmount.toFixed(2)})
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="pt-2 border-t border-zinc-800">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Peak Equity</span>
                                    <span className="text-[10px] font-mono font-bold text-zinc-400">${data.peak.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#equityGradient)" 
                        animationDuration={1000}
                        activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#09090b' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Sub Drawdown Chart (Synced) */}
                <div className="h-[100px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.equityData} syncId="performanceSync">
                      <defs>
                        <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.2} />
                      <YAxis 
                        hide 
                        domain={[0, 'auto']} 
                        reversed 
                      />
                      <XAxis 
                        hide 
                        dataKey="name" 
                      />
                      <RechartsTooltip 
                        content={() => null} // Hidden as it's synced with the main chart
                      />
                      <Area 
                        type="monotone" 
                        dataKey="drawdown" 
                        stroke="#f43f5e" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#ddGradient)" 
                        animationDuration={1000}
                        activeDot={{ r: 4, stroke: '#f43f5e', strokeWidth: 2, fill: '#09090b' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Advanced Performance Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expectancy</span>
                  </div>
                  <div className={cn("text-lg font-mono font-black", stats.expectancy >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    ${stats.expectancy.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">/ trade</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recovery Factor</span>
                  </div>
                  <div className="text-lg font-mono font-black text-blue-500">
                    {stats.recoveryFactor.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">x DD</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Profit Factor</span>
                  </div>
                  <div className="text-lg font-mono font-black text-emerald-500">
                    {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">W/L</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sharpe Ratio</span>
                  </div>
                  <div className="text-lg font-mono font-black text-purple-500">
                    {(stats.expectancy / (stats.avgLoss || 1)).toFixed(2)}
                    <span className="text-[10px] text-zinc-500 ml-1 font-bold">Score</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trading Performance Calendar */}
          <div className="crypto-card p-6 bg-zinc-900/40 border-zinc-800/50 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/20" />
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold uppercase text-zinc-100 flex items-center gap-2 tracking-wider">
                  <CalendarIcon className="w-4 h-4 text-blue-500" /> Trading Calendar
                </h3>
                <p className="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Daily PnL performance for {format(new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-[10px] font-black text-zinc-600 uppercase text-center py-2 tracking-widest">
                  {day}
                </div>
              ))}
              {stats.calendarData.map((day, i) => (
                <div 
                  key={i}
                  className={cn(
                    "aspect-square rounded-xl border p-2 flex flex-col justify-between transition-all duration-300",
                    !day.isCurrentMonth ? "bg-zinc-950/20 border-transparent opacity-20" : "bg-zinc-950/40 border-zinc-800/50 hover:border-zinc-700",
                    day.isToday && "ring-1 ring-blue-500/50 border-blue-500/30"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "text-[10px] font-bold",
                      day.isToday ? "text-blue-500" : "text-zinc-500"
                    )}>
                      {format(day.date, 'd')}
                    </span>
                    {day.trades > 0 && (
                      <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1 rounded font-black">
                        {day.trades}T
                      </span>
                    )}
                  </div>
                  {day.trades > 0 && (
                    <div className="mt-auto">
                      <div className={cn(
                        "text-[10px] font-mono font-black truncate",
                        day.pnl > 0 ? "text-emerald-500" : day.pnl < 0 ? "text-rose-500" : "text-zinc-500"
                      )}>
                        {day.pnl > 0 ? '+' : ''}{day.pnl.toFixed(0)}
                      </div>
                      <div className="w-full h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                        <div 
                          className={cn("h-full", day.winRate >= 50 ? "bg-emerald-500" : "bg-rose-500")} 
                          style={{ width: `${day.winRate}%` }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Annual Performance Heatmap */}
          <div className="crypto-card p-6 bg-zinc-900/40 border-zinc-800/50 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20" />
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold uppercase text-zinc-100 flex items-center gap-2 tracking-wider">
                  <LayoutGrid className="w-4 h-4 text-amber-500" /> Annual Performance Heatmap
                </h3>
                <p className="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Visualizing 365 days of trading consistency</p>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-4 scrollbar-hide">
              {Array.from({ length: 52 }).map((_, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-1">
                  {Array.from({ length: 7 }).map((_, dayIdx) => {
                    const dataIdx = weekIdx * 7 + dayIdx;
                    const dayData = stats.yearHeatmap[dataIdx];
                    if (!dayData) return null;

                    const intensity = dayData.pnl === 0 ? 0 : Math.min(Math.abs(dayData.pnl) / (stats.avgWin * 2 || 100), 1);
                    
                    return (
                      <div 
                        key={dayIdx}
                        className={cn(
                          "w-3 h-3 rounded-sm transition-all duration-500 hover:scale-150 hover:z-10 cursor-pointer",
                          dayData.pnl > 0 ? "bg-emerald-500" : dayData.pnl < 0 ? "bg-rose-500" : "bg-zinc-800/30"
                        )}
                        style={{ 
                          opacity: dayData.pnl === 0 ? 0.1 : 0.3 + (intensity * 0.7)
                        }}
                        title={`${dayData.dayStr}: $${dayData.pnl.toFixed(2)} (${dayData.count} trades)`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-zinc-600 uppercase font-black">Loss</span>
                <div className="flex gap-0.5">
                  <div className="w-2 h-2 rounded-sm bg-rose-500 opacity-20" />
                  <div className="w-2 h-2 rounded-sm bg-rose-500 opacity-50" />
                  <div className="w-2 h-2 rounded-sm bg-rose-500 opacity-100" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-zinc-600 uppercase font-black">Profit</span>
                <div className="flex gap-0.5">
                  <div className="w-2 h-2 rounded-sm bg-emerald-500 opacity-20" />
                  <div className="w-2 h-2 rounded-sm bg-emerald-500 opacity-50" />
                  <div className="w-2 h-2 rounded-sm bg-emerald-500 opacity-100" />
                </div>
              </div>
            </div>
          </div>

          {/* Monte Carlo Projection */}
          {stats.monteCarlo.stats && (
            <div className="crypto-card p-6 bg-zinc-900/40 border-zinc-800/50 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-purple-500/20" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase text-zinc-100 flex items-center gap-2 tracking-wider">
                    <Dices className="w-4 h-4 text-purple-500" /> Monte Carlo Equity Projection
                  </h3>
                  <p className="text-[10px] text-zinc-500 uppercase mt-1 font-bold">50-Trade future simulation based on your edge</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Prob. of Ruin</div>
                    <div className={cn("text-lg font-mono font-bold", stats.monteCarlo.stats.ruinProbability > 10 ? "text-rose-500" : "text-emerald-500")}>
                      {stats.monteCarlo.stats.ruinProbability.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Exp. Growth</div>
                    <div className={cn("text-lg font-mono font-bold", stats.monteCarlo.stats.expectedGrowth >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {stats.monteCarlo.stats.expectedGrowth >= 0 ? '+' : ''}{stats.monteCarlo.stats.expectedGrowth.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.monteCarlo.stepData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.3} />
                    <XAxis 
                      dataKey="trade" 
                      stroke="#3f3f46" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: '#71717a' }}
                      label={{ value: 'Future Trades', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#52525b' }}
                    />
                    <YAxis 
                      stroke="#3f3f46" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `$${val.toLocaleString()}`}
                      domain={['auto', 'auto']}
                      tick={{ fill: '#71717a' }}
                    />
                    <RechartsTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl shadow-2xl space-y-3 min-w-[200px]">
                              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Trade +{data.trade}</p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase">95th Percentile</span>
                                  <span className="text-xs font-mono font-bold text-emerald-500">${data.p95.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Median Projection</span>
                                  <span className="text-sm font-mono font-black text-zinc-100">${data.median.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase">5th Percentile</span>
                                  <span className="text-xs font-mono font-bold text-rose-500">${data.p5.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* Sample Paths */}
                    <Line type="monotone" dataKey="path1" stroke="#3f3f46" strokeWidth={1} dot={false} opacity={0.3} />
                    <Line type="monotone" dataKey="path2" stroke="#3f3f46" strokeWidth={1} dot={false} opacity={0.3} />
                    <Line type="monotone" dataKey="path3" stroke="#3f3f46" strokeWidth={1} dot={false} opacity={0.3} />
                    
                    {/* Confidence Intervals */}
                    <Line type="monotone" dataKey="p95" stroke="#10b981" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="p5" stroke="#f43f5e" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                    
                    {/* Median Path */}
                    <Line type="monotone" dataKey="median" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                    
                    <ReferenceLine y={currentBalance} stroke="#52525b" strokeDasharray="3 3" label={{ value: 'Current', position: 'right', fill: '#52525b', fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-800/50">
                <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Conservative (P5)</div>
                  <div className="text-sm font-mono font-bold text-rose-500">${stats.monteCarlo.stats.p5.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <div className="text-[10px] text-purple-500/70 uppercase font-bold mb-1">Median Forecast</div>
                  <div className="text-sm font-mono font-bold text-zinc-100">${stats.monteCarlo.stats.median.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Optimistic (P95)</div>
                  <div className="text-sm font-mono font-bold text-emerald-500">${stats.monteCarlo.stats.p95.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Update Balance Modal */}
      {isUpdateBalanceOpen && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-zinc-100 mb-4">Update Account Balance</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 block">New Balance (USDT)</label>
                <input 
                  type="number" 
                  value={newBalanceValue}
                  onChange={(e) => setNewBalanceValue(parseFloat(e.target.value) || 0)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 block">Note (Optional)</label>
                <input 
                  type="text" 
                  value={balanceNote}
                  onChange={(e) => setBalanceNote(e.target.value)}
                  placeholder="e.g. Manual sync with Binance"
                  className="input-field w-full"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsUpdateBalanceOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateBalance}
                  className="btn-primary flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                >
                  Update Balance
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
