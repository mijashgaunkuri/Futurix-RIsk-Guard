/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Calculator, 
  BookOpen, 
  BarChart3, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Camera,
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Eye,
  Edit3,
  Image as ImageIcon,
  Clock,
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  Wallet,
  History,
  Tag,
  MessageSquare,
  Smile,
  Activity,
  Zap,
  Trophy,
  Target,
  Shield,
  ShieldCheck,
  Brain,
  FileText,
  PlusCircle,
  X,
  Copy,
  Percent,
  CircleDollarSign,
  ArrowLeftRight,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, subMonths, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { Trade, TradeDirection, BalanceHistory, MMRTier } from './types';
import { SYMBOL_MMR_TIERS, COMMON_SYMBOLS, STRATEGIES, TIMEFRAMES, EMOTIONS, PREDEFINED_TAGS } from './constants';
import { cn, cleanObject, safeFetchJson } from './lib/utils';
import { 
  simulateFundingFee, 
  findBracket, 
  getVolatilityAdjustedRisk, 
  calculateRealWorldFriction, 
  getMaxLeverageForNotional, 
  getSymbolNotionalLimit, 
  calculateTradeMetrics 
} from './services/tradeService';
import { CalculatorTab } from './components/calculator/CalculatorTab';
import { JournalTab } from './components/journal/JournalTab';
import { StatsTab } from './components/stats/StatsTab';
import { TransactionsTab } from './components/transactions/TransactionsTab';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logOut, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  writeBatch,
  deleteDoc,
  updateDoc,
  getDocFromServer
} from 'firebase/firestore';

// Trade Calculation Utilities
// Real Binance matching update – April 2026

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'journal' | 'stats' | 'settings' | 'transactions'>('calculator');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });
  const [calculationHistory, setCalculationHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('calculation_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistory[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [binancePositions, setBinancePositions] = useState<any[]>([]);
  const [binanceTransactions, setBinanceTransactions] = useState<any[]>([]);
  const [binanceUsedMargin, setBinanceUsedMargin] = useState(0);
  const [isSyncingBalance, setIsSyncingBalance] = useState(false);
  const [isSyncingTrades, setIsSyncingTrades] = useState(false);
  const [isSyncingTransactions, setIsSyncingTransactions] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ 
    title: string, 
    message: string, 
    onConfirm: () => void, 
    confirmText?: string,
    type?: 'danger' | 'info'
  } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };
  const [drawdownResetDate, setDrawdownResetDate] = useState<string | null>(null);
  const [nprRate, setNprRate] = useState<number>(134); // Fallback rate
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [dailyGoals, setDailyGoals] = useState({
    maxTradesPerDay: 4,
    maxConsecutiveLosses: 2,
    dailyProfitTarget: 50,
    dailyMaxLoss: 30
  });

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Calculation history persistence
  useEffect(() => {
    localStorage.setItem('calculation_history', JSON.stringify(calculationHistory));
  }, [calculationHistory]);

  // Test Firestore connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Auto-refresh Binance Balance every 60s
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        refreshBinanceBalance();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Initial Binance Sync
  useEffect(() => {
    if (!user) return;
    
    // Initial sync
    refreshBinanceBalance();
    handleBinanceSync();
    fetchBinanceTransactions();
  }, [user]);

  // Sync User Profile and Data
  useEffect(() => {
    if (!user) {
      setTrades([]);
      setBalanceHistory([]);
      setCurrentBalance(1000);
      setStartingBalance(1000);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    // Real-time profile sync
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthKey = `${currentYear}-${currentMonth}`;

        let sBalance = data.startingBalance ?? 0;
        
        // Monthly Reset Logic (only if it hasn't been reset yet)
        if (data.lastResetMonth !== monthKey) {
          sBalance = 0;
          setDoc(userDocRef, { 
            startingBalance: 0, 
            lastResetMonth: monthKey 
          }, { merge: true });
        }

        setStartingBalance(sBalance);
        setDrawdownResetDate(data.drawdownResetDate || null);
        setCurrentBalance(data.currentBalance || 0);
        if (data.dailyGoals) {
          setDailyGoals(data.dailyGoals);
        }
      } else {
        // Create user document if it doesn't exist
        const initialUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          startingBalance: 0,
          currentBalance: 0,
          createdAt: new Date().toISOString(),
          role: 'user',
          lastResetMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`
        };
        setDoc(userDocRef, initialUser);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Real-time trades sync
    const tradesQuery = query(collection(db, 'users', user.uid, 'trades'), orderBy('date', 'desc'));
    const unsubscribeTrades = onSnapshot(tradesQuery, (snapshot) => {
      const updatedTrades = snapshot.docs.map(doc => doc.data() as Trade);
      setTrades(updatedTrades);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/trades`);
    });

    // Real-time balance history sync
    const historyQuery = query(collection(db, 'users', user.uid, 'balanceHistory'), orderBy('date', 'asc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const updatedHistory = snapshot.docs.map(doc => doc.data() as BalanceHistory);
      setBalanceHistory(updatedHistory);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/balanceHistory`);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeTrades();
      unsubscribeHistory();
    };
  }, [user]);

  // Fetch NPR Rate
  useEffect(() => {
    const fetchNprRate = async () => {
      try {
        // Try Primary API
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (res.ok) {
          const data = await res.json();
          if (data.rates && data.rates.NPR) {
            setNprRate(data.rates.NPR);
            return;
          }
        }
        
        // Try Secondary API if primary fails
        const res2 = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.rates && data2.rates.NPR) {
            setNprRate(data2.rates.NPR);
            return;
          }
        }
      } catch (e) {
        // Silent fallback to avoid console noise for non-critical environment-related fetch failures
        setNprRate(134);
      }
    };
    fetchNprRate();
    // Refresh every 60 minutes
    const interval = setInterval(fetchNprRate, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const totalUsedMargin = useMemo(() => {
    const journalMargin = trades
      .filter(t => t.status === 'OPEN')
      .reduce((sum, t) => sum + t.initialMargin + (t.addedMargin || 0), 0);
    
    // If we have real-time binance margin, use it as the source of truth for "Real" feel
    return binanceUsedMargin > 0 ? binanceUsedMargin : journalMargin;
  }, [trades, binanceUsedMargin]);

  const updateDailyGoals = async (goals: { 
    maxTradesPerDay: number, 
    maxConsecutiveLosses: number,
    dailyProfitTarget: number,
    dailyMaxLoss: number
  }) => {
    if (!user) return;
    try {
      setDailyGoals(goals);
      await setDoc(doc(db, 'users', user.uid), { dailyGoals: goals }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateBalance = async (amount: number, type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'RESET' | 'SET', note: string = '') => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      let newBalance = currentBalance;
      
      if (type === 'SET') {
        newBalance = amount;
      } else if (type === 'WITHDRAWAL') {
        newBalance = currentBalance - amount;
      } else {
        // TRADE, DEPOSIT, RESET (adding amount)
        newBalance = currentBalance + amount;
      }
      
      const historyId = crypto.randomUUID();
      const newEntry: BalanceHistory = {
        id: historyId,
        date: new Date().toISOString(),
        amount,
        type,
        note,
        balanceAfter: newBalance
      };

      const batch = writeBatch(db);
      const historyRef = doc(db, 'users', user.uid, 'balanceHistory', historyId);
      
      const updates: any = { currentBalance: newBalance };
      if (startingBalance === 0 && type === 'SET') {
        updates.startingBalance = newBalance;
        setStartingBalance(newBalance);
      }
      
      batch.set(historyRef, cleanObject(newEntry));
      batch.update(userRef, updates);
      
      await batch.commit();
      setCurrentBalance(newBalance);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogTrade = async (trade: Trade) => {
    if (!user) return;
    try {
      // Deduct initial margin on open (Binance style)
      await updateBalance(-trade.initialMargin, 'TRADE', `Margin for ${trade.symbol}`);
      await setDoc(doc(db, 'users', user.uid, 'trades', trade.id), cleanObject(trade));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/trades/${trade.id}`);
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!user) return;
    try {
      const tradeToDelete = trades.find(t => t.id === tradeId);
      if (tradeToDelete) {
        if (tradeToDelete.status === 'OPEN') {
          // Refund margin if an open trade is deleted
          await updateBalance(tradeToDelete.initialMargin, 'TRADE', `Refund margin for deleted trade ${tradeToDelete.symbol}`);
        } else {
          // Revert PNL if a closed trade is deleted
          await updateBalance(-tradeToDelete.netPnl, 'TRADE', `Revert PNL for deleted trade ${tradeToDelete.symbol}`);
        }
      }
      await deleteDoc(doc(db, 'users', user.uid, 'trades', tradeId));
      setDeletingTradeId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/trades/${tradeId}`);
    }
  };

  const handleUpdateTrade = async (updatedTrade: Trade) => {
    if (!user) return;
    try {
      const oldTrade = trades.find(t => t.id === updatedTrade.id);
      
      if (oldTrade) {
        // 1. Handle trade closing (OPEN -> CLOSED)
        if (oldTrade.status === 'OPEN' && updatedTrade.status === 'CLOSED') {
          const releaseAmount = oldTrade.initialMargin + updatedTrade.netPnl;
          await updateBalance(releaseAmount, 'TRADE', `Close trade ${updatedTrade.symbol}`);
        }
        
        // 2. Handle trade reopening (CLOSED -> OPEN)
        else if (oldTrade.status === 'CLOSED' && updatedTrade.status === 'OPEN') {
          const revertAmount = -(oldTrade.initialMargin + oldTrade.netPnl);
          await updateBalance(revertAmount, 'TRADE', `Reopen trade ${updatedTrade.symbol}`);
        }
        
        // 3. Handle margin adjustments for OPEN trades (e.g. quantity/leverage change or added margin)
        else if (oldTrade.status === 'OPEN' && updatedTrade.status === 'OPEN') {
          const oldTotalMargin = oldTrade.initialMargin + (oldTrade.addedMargin || 0);
          const newTotalMargin = updatedTrade.initialMargin + (updatedTrade.addedMargin || 0);
          const marginDiff = oldTotalMargin - newTotalMargin;
          if (Math.abs(marginDiff) > 0.001) {
            await updateBalance(marginDiff, 'TRADE', `Margin adjustment for ${updatedTrade.symbol}`);
          }
        }
        
        // 4. Handle PNL adjustments for CLOSED trades
        else if (oldTrade.status === 'CLOSED' && updatedTrade.status === 'CLOSED') {
          const pnlDiff = updatedTrade.netPnl - oldTrade.netPnl;
          if (Math.abs(pnlDiff) > 0.001) {
            await updateBalance(pnlDiff, 'TRADE', `Adjustment for trade ${updatedTrade.symbol}`);
          }
        }
      }

      await setDoc(doc(db, 'users', user.uid, 'trades', updatedTrade.id), cleanObject(updatedTrade));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/trades/${updatedTrade.id}`);
    }
  };

  const exportData = () => {
    const data = {
      trades,
      balanceHistory,
      startingBalance
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `futurix_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const batch = writeBatch(db);
        
        if (data.trades) {
          data.trades.forEach((t: Trade) => {
            batch.set(doc(db, 'users', user.uid, 'trades', t.id), t);
          });
        }
        
        if (data.balanceHistory) {
          data.balanceHistory.forEach((h: BalanceHistory) => {
            batch.set(doc(db, 'users', user.uid, 'balanceHistory', h.id), h);
          });
        }
        
        if (data.startingBalance !== undefined) {
          batch.update(doc(db, 'users', user.uid), { 
            startingBalance: data.startingBalance,
            currentBalance: data.balanceHistory?.[data.balanceHistory.length - 1]?.balanceAfter || data.startingBalance
          });
        }
        
        await batch.commit();
        showNotification('Data imported and synced to cloud successfully!', 'success');
      } catch (err) {
        console.error("Import error", err);
        showNotification('Invalid backup file or sync failed.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const importBinanceCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const trades_to_import: Trade[] = [];

      // Simple heuristic to find columns
      const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('time'));
      const symbolIdx = headers.findIndex(h => h.toLowerCase().includes('symbol') || h.toLowerCase().includes('market'));
      const sideIdx = headers.findIndex(h => h.toLowerCase().includes('side') || h.toLowerCase().includes('direction'));
      const priceIdx = headers.findIndex(h => h.toLowerCase().includes('price'));
      const qtyIdx = headers.findIndex(h => h.toLowerCase().includes('qty') || h.toLowerCase().includes('amount') || h.toLowerCase().includes('quantity'));
      const pnlIdx = headers.findIndex(h => h.toLowerCase().includes('realized profit') || h.toLowerCase().includes('pnl'));
      const feeIdx = headers.findIndex(h => h.toLowerCase().includes('fee'));

      if (dateIdx === -1 || symbolIdx === -1 || priceIdx === -1) {
        showNotification("Could not detect required columns (Date, Symbol, Price) in CSV.", 'error');
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length < headers.length) continue;

        const d = new Date(cols[dateIdx]);
        if (isNaN(d.getTime())) continue;
        const date = d.toISOString();

        const symbol = cols[symbolIdx].toUpperCase();
        const direction = cols[sideIdx]?.toUpperCase().includes('BUY') || cols[sideIdx]?.toUpperCase().includes('LONG') ? 'LONG' : 'SHORT';
        const entryPrice = parseFloat(cols[priceIdx]);
        const quantity = parseFloat(cols[qtyIdx]) || 0;
        const pnl = parseFloat(cols[pnlIdx]) || 0;
        const fees = Math.abs(parseFloat(cols[feeIdx])) || 0;

        // Create a basic trade object
        const newTrade: Trade = {
          id: `binance_${Date.now()}_${i}`,
          date,
          symbol,
          direction,
          entryPrice,
          quantity,
          leverage: 1,
          notionalValue: entryPrice * quantity,
          initialMargin: entryPrice * quantity, // Assuming 1x leverage
          maintenanceMargin: 0,
          liquidationPrice: 0,
          riskAmount: 0,
          stopLoss: 0,
          takeProfit: 0,
          plannedRR: 0,
          strategy: 'Imported (Binance)',
          timeframe: 'Unknown',
          status: pnl !== 0 ? 'CLOSED' : 'OPEN',
          notes: 'Imported from Binance CSV Trade History',
          tags: ['#imported', '#binance'],
          marginMode: 'CROSS',
          addedMargin: 0,
          pnl: pnl + fees,
          fees,
          netPnl: pnl,
          actualRR: 0,
          exitEfficiency: 0,
          emotion: 'Neutral',
          balanceBefore: currentBalance
        };

        trades_to_import.push(newTrade);
      }

      if (trades_to_import.length > 0) {
        try {
          const batch = writeBatch(db);
          trades_to_import.forEach(t => {
            batch.set(doc(db, 'users', user.uid, 'trades', t.id), t);
          });
          await batch.commit();
          showNotification(`Successfully imported ${trades_to_import.length} trades from Binance CSV!`, 'success');
        } catch (err) {
          console.error("CSV Import error", err);
          showNotification("Failed to sync imported trades to cloud.", 'error');
        }
      } else {
        showNotification("No valid trades found in CSV.", 'info');
      }
    };
    reader.readAsText(file);
  };

  const clearData = async () => {
    if (!user) return;
    setConfirmModal({
      title: 'Clear All Data',
      message: 'Are you sure you want to clear ALL data from the cloud? This cannot be undone.',
      type: 'danger',
      confirmText: 'Clear All',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          
          trades.forEach(trade => {
            batch.delete(doc(db, 'users', user.uid, 'trades', trade.id));
          });
          
          balanceHistory.forEach(history => {
            batch.delete(doc(db, 'users', user.uid, 'balanceHistory', history.id));
          });
          
          batch.update(doc(db, 'users', user.uid), {
            startingBalance: 1000,
            currentBalance: 1000
          });
          
          await batch.commit();
          showNotification('Cloud data cleared.', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
        }
      }
    });
  };

  const clearTrades = async () => {
    if (!user) return;
    setConfirmModal({
      title: 'Clear Trade History',
      message: 'Are you sure you want to clear all trade history? This will reset Win Rate, Profit Factor, and PnL stats.',
      type: 'danger',
      confirmText: 'Clear Trades',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          trades.forEach(trade => {
            batch.delete(doc(db, 'users', user.uid, 'trades', trade.id));
          });
          await batch.commit();
          showNotification('Trade history cleared.', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/trades`);
        }
      }
    });
  };

  const clearHistory = async () => {
    if (!user) return;
    setConfirmModal({
      title: 'Clear Balance History',
      message: 'Are you sure you want to clear all balance history? This will reset Drawdown stats.',
      type: 'danger',
      confirmText: 'Clear History',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          balanceHistory.forEach(history => {
            batch.delete(doc(db, 'users', user.uid, 'balanceHistory', history.id));
          });
          batch.update(doc(db, 'users', user.uid), {
            startingBalance: currentBalance,
            drawdownResetDate: null
          });
          await batch.commit();
          showNotification('Balance history cleared.', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/balanceHistory`);
        }
      }
    });
  };

  const resetDrawdown = async () => {
    if (!user) return;
    setConfirmModal({
      title: 'Reset Max Drawdown',
      message: 'Reset Max Drawdown? This will start tracking drawdown from your current balance without deleting history.',
      type: 'info',
      confirmText: 'Reset Drawdown',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            drawdownResetDate: new Date().toISOString()
          });
          showNotification('Drawdown reset successfully.', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
    });
  };

  async function refreshBinanceBalance() {
    if (!user || isSyncingBalance) return;
    setIsSyncingBalance(true);
    try {
      const data = await safeFetchJson('/api/binance/balance');
      
      if (data.error) {
        if (data.error.includes("not configured")) return;
        throw new Error(data.error);
      }
      
      if (data.usdt !== undefined) {
        await updateBalance(data.usdt, 'SET', 'Real-time Binance Balance Sync');
      }
      if (data.usedMargin !== undefined) {
        setBinanceUsedMargin(data.usedMargin);
      }
      if (data.positions) {
        setBinancePositions(data.positions);
      }
    } catch (error: any) {
      console.error("Failed to refresh Binance balance:", error);
    } finally {
      setIsSyncingBalance(false);
    }
  }

  async function handleBinanceSync() {
    if (!user) return;
    setIsSyncingTrades(true);
    try {
      const data = await safeFetchJson('/api/binance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update balance if returned
      if (data.balance && data.balance.USDT) {
        await updateBalance(data.balance.USDT, 'SET', 'Binance Sync Balance');
      }
      
      // Save trades to Firestore
      if (data.trades && data.trades.length > 0) {
        const batch = writeBatch(db);
        data.trades.forEach((t: any) => {
          const tradeRef = doc(collection(db, 'users', user!.uid, 'trades'), t.id);
          const fees = t.fees || 0;
          const pnl = t.pnl || 0;
          const netPnl = pnl - fees;
          
          batch.set(tradeRef, {
            ...t,
            netPnl,
            strategy: 'BINANCE_SYNC',
            timeframe: 'N/A',
            notes: 'Synced from Binance',
            emotion: 'NEUTRAL',
            tags: ['BINANCE'],
            stopLoss: 0,
            marginMode: 'CROSS',
            addedMargin: 0,
            plannedRR: 0,
            riskAmount: 0,
            initialMargin: 0,
            maintenanceMargin: 0,
            liquidationPrice: 0
          }, { merge: true });
        });
        await batch.commit();
      }
      
      // Also fetch transactions after sync
      fetchBinanceTransactions();
      
      showNotification(data.info || "Sync successful!", 'success');
    } catch (error: any) {
      showNotification(`Sync failed: ${error.message}`, 'error');
    } finally {
      setIsSyncingTrades(false);
    }
  }

  async function fetchBinanceTransactions() {
    if (!user) return;
    setIsSyncingTransactions(true);
    try {
      const data = await safeFetchJson('/api/binance/transactions');
      if (data.error) throw new Error(data.error);
      setBinanceTransactions(data.transactions || []);
    } catch (error: any) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setIsSyncingTransactions(false);
    }
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.warn("Sign-in popup was closed by the user.");
      } else {
        console.error("Error signing in with Google", error);
      }
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full crypto-card space-y-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20">
              <TrendingUp className="w-10 h-10 text-zinc-950" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Barsha <span className="text-emerald-500">Journal</span>
            </h1>
            <p className="text-zinc-400">Trade Journaling & Calculation</p>
          </div>
          
          <div className="space-y-4 pt-4">
            <button 
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3 bg-white text-zinc-900 py-3 px-4 rounded-xl font-bold hover:bg-zinc-100 transition-all active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Sign in with Google
            </button>
          </div>

          <div className="text-center pt-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold italic">Secure Cloud Sync Enabled</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setActiveTab('calculator')}
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-zinc-950" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Barsha <span className="text-emerald-500">Journal</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end md:hidden">
              <div className="flex items-center gap-1">
                <button 
                  onClick={refreshBinanceBalance}
                  disabled={isSyncingBalance}
                  className={cn("text-zinc-500", isSyncingBalance && "animate-spin")}
                >
                  <RefreshCw className="w-2 h-2" />
                </button>
                <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-wider">Balance</span>
              </div>
              <span className="text-sm font-mono font-bold text-emerald-500">${(currentBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="hidden md:flex flex-col items-end">
              <div className="flex items-center gap-2">
                <button 
                  onClick={refreshBinanceBalance}
                  disabled={isSyncingBalance}
                  className={cn("p-1 text-zinc-500 hover:text-emerald-500 transition-colors", isSyncingBalance && "animate-spin")}
                  title="Refresh Binance Balance"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Available Balance</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-lg font-mono font-bold text-emerald-500">${(currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-zinc-800 hidden md:block" />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Used Margin</span>
              <div className="flex flex-col items-end">
                <span className="text-lg font-mono font-bold text-amber-500">${(totalUsedMargin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-zinc-800 hidden md:block" />
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors"
                title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === 'dark' ? <Zap className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </button>
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-8 h-8 rounded-full border border-zinc-800"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={logOut}
                className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                title="Sign Out"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="w-px h-8 bg-zinc-800" />
            <button 
              onClick={() => setActiveTab('calculator')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                activeTab === 'calculator' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              <Calculator className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setActiveTab('journal')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                activeTab === 'journal' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              <BookOpen className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                activeTab === 'stats' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              <BarChart3 className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setActiveTab('transactions')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                activeTab === 'transactions' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-zinc-100"
              )}
              title="Transaction History"
            >
              <History className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {deletingTradeId && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Delete Trade?</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-6">
              Are you sure you want to delete this trade? This action cannot be undone and will not automatically reverse any balance changes.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingTradeId(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteTrade(deletingTradeId)}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold transition-all flex-1"
              >
                Delete Trade
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === 'calculator' && (
          <CalculatorTab 
            currentBalance={currentBalance} 
            onLogTrade={handleLogTrade}
            onUpdateBalance={updateBalance}
            nprRate={nprRate}
            trades={trades}
            calculationHistory={calculationHistory}
            setCalculationHistory={setCalculationHistory}
            showNotification={showNotification}
            safeFetchJson={safeFetchJson}
            binancePositions={binancePositions}
          />
        )}
        {activeTab === 'journal' && (
          <JournalTab 
            trades={trades} 
            setTrades={setTrades}
            currentBalance={currentBalance}
            startingBalance={startingBalance}
            balanceHistory={balanceHistory}
            onUpdateBalance={updateBalance}
            onDeleteTrade={handleDeleteTrade}
            onUpdateTrade={handleUpdateTrade}
            setDeletingTradeId={setDeletingTradeId}
            editingTrade={editingTrade}
            setEditingTrade={setEditingTrade}
            exportData={exportData}
            importData={importData}
            importBinanceCSV={importBinanceCSV}
            clearData={clearData}
            onBinanceSync={handleBinanceSync}
            isSyncing={isSyncingTrades}
            setActiveTab={setActiveTab}
            dailyGoals={dailyGoals}
            binancePositions={binancePositions}
            showNotification={showNotification}
            onLogTrade={handleLogTrade}
            nprRate={nprRate}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab 
            trades={trades} 
            balanceHistory={balanceHistory}
            startingBalance={startingBalance}
            drawdownResetDate={drawdownResetDate}
            currentBalance={currentBalance}
            onUpdateBalance={updateBalance}
            dailyGoals={dailyGoals}
            onUpdateDailyGoals={updateDailyGoals}
            onResetAll={clearData}
            onClearTrades={clearTrades}
            onClearHistory={clearHistory}
            onResetDrawdown={resetDrawdown}
          />
        )}
        {activeTab === 'transactions' && (
          <TransactionsTab 
            transactions={binanceTransactions}
            isSyncing={isSyncingTransactions}
            onRefresh={fetchBinanceTransactions}
          />
        )}
      </main>

      {/* Generic Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">{confirmModal.title}</h2>
              <button onClick={() => setConfirmModal(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-zinc-400 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="p-6 bg-zinc-950/50 flex gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 rounded-xl font-bold text-zinc-400 hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold transition-all",
                  confirmModal.type === 'danger' ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                )}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={cn(
          "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4",
          notification.type === 'success' ? "bg-emerald-500 text-zinc-950" : 
          notification.type === 'error' ? "bg-rose-500 text-zinc-100" : 
          "bg-blue-500 text-zinc-100"
        )}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
           notification.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : 
           <Info className="w-5 h-5" />}
          <span className="text-sm font-bold">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>
      )}

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 md:hidden z-50">
        <div className="flex justify-around items-center h-16">
          <button 
            onClick={() => setActiveTab('calculator')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'calculator' ? "text-emerald-500" : "text-zinc-500")}
          >
            <Calculator className="w-5 h-5" />
            <span className="text-[10px] font-medium">Calculator</span>
          </button>
          <button 
            onClick={() => setActiveTab('journal')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'journal' ? "text-emerald-500" : "text-zinc-500")}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] font-medium">Journal</span>
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'stats' ? "text-emerald-500" : "text-zinc-500")}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Stats</span>
          </button>
        </div>
      </nav>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-zinc-600 border-t border-zinc-900 mt-12">
        <p className="text-sm italic">"The goal of a successful trader is to make the best trades. Money is secondary." — Alexander Elder</p>
        <p className="mt-4 text-xs font-mono">Futurix Risk Guard v1.0.0 • Built for Professional Traders</p>
      </footer>
    </div>
  );
}
