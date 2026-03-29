/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calculator, 
  BookOpen, 
  BarChart3, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  ChevronDown,
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
  FileText
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
import { format, subMonths, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { Trade, TradeDirection, BalanceHistory, MMRTier } from './types';
import { SYMBOL_MMR_TIERS, COMMON_SYMBOLS, STRATEGIES, TIMEFRAMES, EMOTIONS, MARKET_CONDITIONS, PREDEFINED_TAGS } from './constants';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  writeBatch,
  deleteDoc
} from 'firebase/firestore';

// Helper Functions
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const cleanObject = (obj: any) => {
  const clean: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  });
  return clean;
};

// Trade Calculation Utilities
const calculateTradeMetrics = (trade: Partial<Trade> & { entryPrice: number, stopLoss: number, quantity: number, direction: TradeDirection }) => {
  const { entryPrice, stopLoss, quantity, direction, exitPrice, fees = 0, highestPriceReached, lowestPriceReached } = trade;
  
  if (exitPrice === undefined) return null;

  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const pnl = direction === 'LONG' 
    ? (exitPrice - entryPrice) * quantity 
    : (entryPrice - exitPrice) * quantity;
  
  const netPnl = pnl - fees;
  const actualRR = pnl / (riskPerUnit * quantity);

  // Exit Efficiency: How much of the maximum favorable move was captured
  let mfePrice = direction === 'LONG' ? (highestPriceReached || exitPrice) : (lowestPriceReached || exitPrice);
  const maxPossiblePnl = direction === 'LONG'
    ? (mfePrice - entryPrice) * quantity
    : (entryPrice - mfePrice) * quantity;

  const exitEfficiency = maxPossiblePnl > 0 && pnl > 0 
    ? (pnl / maxPossiblePnl) * 100 
    : (pnl > 0 ? 100 : 0);

  return {
    pnl,
    netPnl,
    actualRR,
    exitEfficiency: Math.max(0, Math.min(100, exitEfficiency))
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'journal' | 'stats'>('calculator');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistory[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [nprRate, setNprRate] = useState<number>(134); // Fallback rate
  const [user, setUser] = useState<{ uid: string, displayName: string, email: string, photoURL?: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Auth Listener
  useEffect(() => {
    const savedUser = localStorage.getItem('simple_auth_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsAuthReady(true);
  }, []);

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
        setCurrentBalance(data.currentBalance || 0);
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
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data.rates && data.rates.NPR) {
          setNprRate(data.rates.NPR);
        }
      } catch (e) {
        console.error("Failed to fetch NPR rate", e);
      }
    };
    fetchNprRate();
    // Refresh every 30 minutes
    const interval = setInterval(fetchNprRate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const updateBalance = async (amount: number, type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'RESET', note: string = '') => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const newBalance = type === 'TRADE' || type === 'DEPOSIT' || type === 'RESET' ? currentBalance + amount : type === 'WITHDRAWAL' ? currentBalance - amount : amount;
      
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
      
      batch.set(historyRef, cleanObject(newEntry));
      batch.update(userRef, { currentBalance: newBalance });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogTrade = async (trade: Trade) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'trades', trade.id), cleanObject(trade));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/trades/${trade.id}`);
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!user) return;
    try {
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
      
      // If it's a CLOSED trade and Net PNL changed, update balance
      if (oldTrade && oldTrade.status === 'CLOSED' && updatedTrade.status === 'CLOSED') {
        const pnlDiff = updatedTrade.netPnl - oldTrade.netPnl;
        if (Math.abs(pnlDiff) > 0.001) {
          await updateBalance(pnlDiff, 'TRADE', `Adjustment for trade ${updatedTrade.symbol}`);
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
            currentBalance: data.balanceHistory?.[data.balanceHistory.length - 1]?.amount || data.startingBalance
          });
        }
        
        await batch.commit();
        alert('Data imported and synced to cloud successfully!');
      } catch (err) {
        console.error("Import error", err);
        alert('Invalid backup file or sync failed.');
      }
    };
    reader.readAsText(file);
  };

  const clearData = async () => {
    if (!user) return;
    if (window.confirm('Are you sure you want to clear ALL data from the cloud? This cannot be undone.')) {
      try {
        const batch = writeBatch(db);
        
        // Delete all trades
        trades.forEach(trade => {
          batch.delete(doc(db, 'users', user.uid, 'trades', trade.id));
        });
        
        // Delete all balance history
        balanceHistory.forEach(history => {
          batch.delete(doc(db, 'users', user.uid, 'balanceHistory', history.id));
        });
        
        // Reset user profile
        batch.update(doc(db, 'users', user.uid), {
          startingBalance: 1000,
          currentBalance: 1000
        });
        
        await batch.commit();
        alert('Cloud data cleared.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
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
    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      const validUsers = [
        { id: 'mijash', name: 'Mijash', pass: '00000000' },
        { id: 'barsha', name: 'Barsha', pass: '00000000' }
      ];

      const found = validUsers.find(u => u.id === username.toLowerCase() && u.pass === password);

      if (found) {
        const userData = {
          uid: found.id,
          displayName: found.name,
          email: `${found.id}@app.com`,
          photoURL: `https://ui-avatars.com/api/?name=${found.name}&background=10b981&color=fff`
        };
        setUser(userData);
        localStorage.setItem('simple_auth_user', JSON.stringify(userData));
        setAuthError(null);
      } else {
        setAuthError('Invalid username or password');
      }
    };

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full crypto-card space-y-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20">
              <TrendingUp className="w-10 h-10 text-zinc-950" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Futurix <span className="text-emerald-500">Risk Guard</span>
            </h1>
            <p className="text-zinc-400">Professional Trade Journaling & Risk Management</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4 pt-4">
            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Username</label>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field w-full"
                placeholder="mijash or barsha"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit"
              className="btn-primary w-full py-3 mt-4 font-bold"
            >
              Sign In
            </button>
          </form>

          <div className="text-center pt-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold italic">Authorized Access Only</p>
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-zinc-950" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Futurix <span className="text-emerald-500">Risk Guard</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs text-zinc-500 uppercase font-semibold">Current Balance</span>
              <div className="flex flex-col items-end">
                <span className="text-lg font-mono font-bold text-emerald-500">${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-[10px] font-mono font-bold text-zinc-500">≈ Rs. {(currentBalance * nprRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-zinc-800 hidden md:block" />
            
            <div className="flex items-center gap-2">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-8 h-8 rounded-full border border-zinc-800"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => {
                  setUser(null);
                  localStorage.removeItem('simple_auth_user');
                }}
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
                Delete
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
            clearData={clearData}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab 
            trades={trades} 
            balanceHistory={balanceHistory}
            startingBalance={startingBalance}
          />
        )}
      </main>

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

// Placeholder components to be implemented in next steps
const CalculatorTab = ({ currentBalance, onLogTrade, onUpdateBalance, nprRate }: { currentBalance: number, onLogTrade: (t: Trade) => void, onUpdateBalance: (a: number, t: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE', n: string) => void, nprRate: number }) => {
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
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-save persistence
  useEffect(() => {
    const dataToSave = {
      direction,
      symbol,
      riskPercent,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage
    };
    localStorage.setItem('calculator_trade_params', JSON.stringify(dataToSave));
  }, [direction, symbol, riskPercent, entryPrice, stopLoss, takeProfit, leverage]);

  const balance = useJournalBalance ? currentBalance : manualBalance;

  const results = useMemo(() => {
    if (!entryPrice || !stopLoss || entryPrice === stopLoss) return null;

    const riskAmount = balance * (riskPercent / 100);
    const priceDiff = Math.abs(entryPrice - stopLoss);
    const quantity = riskAmount / priceDiff;
    const notionalValue = quantity * entryPrice;

    // MMR Tier calculation
    const tiers = SYMBOL_MMR_TIERS[symbol] || SYMBOL_MMR_TIERS['DEFAULT'];
    const tier = tiers.find(t => notionalValue <= t.bracket) || tiers[tiers.length - 1];
    const mmr = tier.mmr;
    const maintenanceAmount = tier.maintenanceAmount;
    const maintenanceMargin = (notionalValue * mmr) - maintenanceAmount;

    // Initial Margin
    const initialMargin = notionalValue / leverage;

    // Bankruptcy Price (price where loss = Initial Margin)
    const bankruptcyPrice = direction === 'LONG' 
      ? entryPrice - (initialMargin / quantity)
      : entryPrice + (initialMargin / quantity);

    // Liquidation Price formulas (more accurate approximation for Isolated)
    // For Long: Liq Price = Bankruptcy + (Maintenance Margin / Quantity)
    // For Short: Liq Price = Bankruptcy - (Maintenance Margin / Quantity)
    const liquidationPrice = direction === 'LONG'
      ? bankruptcyPrice + (maintenanceMargin / quantity)
      : bankruptcyPrice - (maintenanceMargin / quantity);

    const simpleLiq = direction === 'LONG'
      ? entryPrice * (1 - 1 / leverage)
      : entryPrice * (1 + 1 / leverage);

    const distToSL = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
    const distToLiq = (Math.abs(entryPrice - liquidationPrice) / entryPrice) * 100;
    const safetyBuffer = distToLiq / distToSL;

    const pnlAtSL = direction === 'LONG' ? (stopLoss - entryPrice) * quantity : (entryPrice - stopLoss) * quantity;
    const pnlAtTP = takeProfit ? (direction === 'LONG' ? (takeProfit - entryPrice) * quantity : (entryPrice - takeProfit) * quantity) : 0;
    const plannedRR = takeProfit ? Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss) : 0;

    const suggestedTP2 = direction === 'LONG' ? entryPrice + (priceDiff * 2) : entryPrice - (priceDiff * 2);
    const suggestedTP3 = direction === 'LONG' ? entryPrice + (priceDiff * 3) : entryPrice - (priceDiff * 3);

    // Max Safe Leverage (aiming for 2.5x buffer)
    const maxSafeLeverage = Math.max(1, Math.floor(1 / ((distToSL / 100) * 2.5 + mmr)));
    
    // Optimal Leverage Calculation (aiming for 3x buffer)
    const optimalLeverage = Math.max(1, Math.floor(1 / ((distToSL / 100) * 3 + mmr)));

    // 9 Rules Evaluation
    const rules = [
      {
        id: 1,
        name: "Risk Control",
        passed: riskPercent <= 2,
        value: `${riskPercent}%`,
        advice: riskPercent > 2 ? "Risk exceeds 2%. High risk of ruin." : "Risk is within safe limits (≤ 2%)."
      },
      {
        id: 2,
        name: "Profit Potential",
        passed: plannedRR >= 2,
        value: `${plannedRR.toFixed(2)}:1`,
        advice: plannedRR < 2 ? "Aim for at least 2:1 RR for long-term edge." : "Excellent risk-to-reward ratio."
      },
      {
        id: 3,
        name: "Liquidation Safety",
        passed: safetyBuffer >= 3,
        value: `${safetyBuffer.toFixed(1)}x`,
        advice: safetyBuffer < 3 ? "Liq. price is too close to SL. Reduce leverage." : "Strong safety buffer against liquidation."
      },
      {
        id: 4,
        name: "Leverage Efficiency",
        passed: leverage <= maxSafeLeverage,
        value: `${leverage}x`,
        advice: leverage > maxSafeLeverage ? `Leverage exceeds safe limit (${maxSafeLeverage}x).` : "Leverage is optimized for this SL distance."
      },
      {
        id: 5,
        name: "Stop Loss Distance",
        passed: distToSL >= 0.5,
        value: `${distToSL.toFixed(2)}%`,
        advice: distToSL < 0.5 ? "SL is very tight. High noise sensitivity." : "SL distance allows for normal market noise."
      },
      {
        id: 6,
        name: "Position Sizing",
        passed: initialMargin <= balance * 0.2,
        value: `$${initialMargin.toFixed(2)}`,
        advice: initialMargin > balance * 0.2 ? "Margin exceeds 20% of balance. Over-exposure." : "Margin usage is conservative."
      },
      {
        id: 7,
        name: "Exit Strategy",
        passed: takeProfit > 0,
        value: takeProfit > 0 ? "SET" : "NONE",
        advice: takeProfit === 0 ? "No Take Profit set. Trading without a target." : "Clear exit target established."
      },
      {
        id: 8,
        name: "Bankruptcy Risk",
        passed: Math.abs(entryPrice - bankruptcyPrice) > Math.abs(entryPrice - stopLoss) * 1.5,
        value: "PROTECTED",
        advice: Math.abs(entryPrice - bankruptcyPrice) <= Math.abs(entryPrice - stopLoss) * 1.5 ? "Bankruptcy price is dangerously close to SL." : "Bankruptcy risk is well beyond SL."
      },
      {
        id: 9,
        name: "Entry Precision",
        passed: Math.abs(entryPrice - stopLoss) / entryPrice > 0.001,
        value: "VALID",
        advice: Math.abs(entryPrice - stopLoss) / entryPrice <= 0.001 ? "Entry/SL gap is too small for exchange precision." : "Entry precision is within valid ranges."
      }
    ];

    const qualityScore = rules.filter(r => r.passed).length;

    return {
      riskAmount,
      quantity,
      notionalValue,
      initialMargin,
      maintenanceMargin,
      bankruptcyPrice,
      liquidationPrice,
      simpleLiq,
      distToSL,
      distToLiq,
      safetyBuffer,
      pnlAtSL,
      pnlAtTP,
      plannedRR,
      suggestedTP2,
      suggestedTP3,
      mmr: mmr * 100,
      optimalLeverage,
      maxSafeLeverage,
      rules,
      qualityScore
    };
  }, [balance, riskPercent, entryPrice, stopLoss, takeProfit, leverage, direction, symbol]);

  const fetchPrice = async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol.toUpperCase()}`);
      const data = await res.json();
      if (data.price) {
        setEntryPrice(parseFloat(data.price));
      }
    } catch (e) {
      console.error("Failed to fetch price", e);
    } finally {
      setIsFetching(false);
    }
  };

  const getSafetyColor = (buffer: number) => {
    if (buffer < 1.5) return 'text-rose-600';
    if (buffer < 2.0) return 'text-rose-400';
    if (buffer < 3.0) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getSafetyStatus = (buffer: number) => {
    if (buffer < 1.5) return 'CRITICAL';
    if (buffer < 2.0) return 'HIGH RISK';
    if (buffer < 3.0) return 'CAUTION';
    return 'SAFE';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Input Panel */}
      <div className="lg:col-span-5 space-y-6">
        <div className="crypto-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-500" />
              Trade Parameters
            </h2>
            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button 
                onClick={() => setDirection('LONG')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
                  direction === 'LONG' ? "bg-emerald-500 text-zinc-950" : "text-zinc-500"
                )}
              >
                LONG
              </button>
              <button 
                onClick={() => setDirection('SHORT')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
                  direction === 'SHORT' ? "bg-rose-500 text-zinc-950" : "text-zinc-500"
                )}
              >
                SHORT
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Symbol</label>
                <div className="relative">
                  <input 
                    list="symbols"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="input-field w-full"
                    placeholder="BTCUSDT"
                  />
                  <datalist id="symbols">
                    {COMMON_SYMBOLS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Leverage</label>
                <input 
                  type="number"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="input-field w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Account Balance (USDT)</label>
                <button 
                  onClick={() => setUseJournalBalance(!useJournalBalance)}
                  className="text-[10px] text-emerald-500 hover:underline"
                >
                  {useJournalBalance ? "Use Manual" : "Use Journal"}
                </button>
              </div>
              <input 
                type="number"
                value={useJournalBalance ? currentBalance : manualBalance}
                onChange={(e) => !useJournalBalance && setManualBalance(Number(e.target.value))}
                disabled={useJournalBalance}
                className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Risk %</label>
                <span className="text-sm font-mono text-emerald-500">{riskPercent}%</span>
              </div>
              <div className="flex gap-4 items-center">
                <input 
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <input 
                  type="number"
                  max="2"
                  min="0.1"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Math.min(2, Number(e.target.value)))}
                  className="input-field w-20 text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Entry Price</label>
                  <button 
                    onClick={fetchPrice}
                    disabled={isFetching}
                    className="text-[10px] flex items-center gap-1 text-blue-500 hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                    Live Price
                  </button>
                </div>
                <input 
                  type="number"
                  value={entryPrice || ''}
                  onChange={(e) => setEntryPrice(Number(e.target.value))}
                  className="input-field w-full font-mono"
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Stop Loss</label>
                  <input 
                    type="number"
                    value={stopLoss || ''}
                    onChange={(e) => setStopLoss(Number(e.target.value))}
                    className="input-field w-full font-mono text-rose-500"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Take Profit</label>
                  <input 
                    type="number"
                    value={takeProfit || ''}
                    onChange={(e) => setTakeProfit(Number(e.target.value))}
                    className="input-field w-full font-mono text-emerald-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              disabled={!results}
              className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Log Trade to Journal
            </button>
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div className="lg:col-span-7 space-y-6">
        {results ? (
          <>
            {/* High Risk Warning Banner */}
            {results.safetyBuffer < 2 && (
              <div className={cn(
                "p-4 rounded-xl border flex items-start gap-4 animate-pulse",
                results.safetyBuffer < 1.5 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              )}>
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  results.safetyBuffer < 1.5 ? "bg-rose-500/20" : "bg-amber-500/20"
                )}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm uppercase tracking-wider mb-1">
                    {results.safetyBuffer < 1.5 ? "Critical Risk: Liquidation Near SL" : "High Risk: Tight Safety Buffer"}
                  </h4>
                  <p className="text-xs opacity-80 leading-relaxed">
                    {results.safetyBuffer < 1.5 
                      ? `Your liquidation price ($${results.liquidationPrice.toFixed(results.liquidationPrice < 1 ? 6 : 2)}) is extremely close to your stop loss ($${stopLoss}). A small amount of slippage or market volatility could liquidate your position before your stop loss is triggered.`
                      : `Your liquidation price ($${results.liquidationPrice.toFixed(results.liquidationPrice < 1 ? 6 : 2)}) is within a dangerous range of your stop loss. Consider reducing your leverage or widening the gap between your entry and stop loss.`}
                  </p>
                </div>
              </div>
            )}

            {/* Position Metrics Section */}
            <div className="crypto-card border-zinc-800/50 bg-zinc-900/30">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="text-base font-bold text-zinc-100">Position Metrics</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Position Size (USDT)</span>
                  <div className="text-lg font-mono font-bold text-zinc-100">${results.notionalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Quantity</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-mono font-bold text-zinc-100">{results.quantity.toFixed(results.quantity < 0.01 ? 6 : 4)}</span>
                    <span className="text-[10px] text-zinc-500 font-bold">{symbol.replace('USDT', '')}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Initial Margin</span>
                  <div className="text-lg font-mono font-bold text-zinc-100">${results.initialMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <span className="text-[10px] text-blue-500/70 uppercase font-bold block mb-1">Risk-to-Reward</span>
                  <div className={cn("text-lg font-mono font-bold", results.plannedRR >= 2 ? "text-emerald-500" : "text-amber-500")}>
                    {results.plannedRR.toFixed(2)}:1
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <span className="text-[10px] text-rose-500/70 uppercase font-bold block mb-1">Risk Amount</span>
                  <div className="text-lg font-mono font-bold text-rose-500">-${results.riskAmount.toFixed(2)}</div>
                  <div className="text-[10px] text-rose-500/40 font-mono">≈ Rs. {(results.riskAmount * nprRate).toLocaleString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Dist. to SL</span>
                      {results.safetyBuffer < 2 && <AlertTriangle className={cn("w-3 h-3", results.safetyBuffer < 1.5 ? "text-rose-500" : "text-amber-500")} />}
                    </div>
                    <span className="text-sm font-mono font-bold text-zinc-100">{results.distToSL.toFixed(3)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">PNL at SL</span>
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold text-rose-500">-${Math.abs(results.pnlAtSL).toFixed(2)}</div>
                      <div className="text-[10px] text-rose-500/60 font-mono">≈ Rs. {(Math.abs(results.pnlAtSL) * nprRate).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {takeProfit && (
                  <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Dist. to TP</span>
                      <span className="text-sm font-mono font-bold text-zinc-100">
                        {((Math.abs(takeProfit - entryPrice) / entryPrice) * 100).toFixed(3)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">PNL at TP</span>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-emerald-500">+${results.pnlAtTP.toFixed(2)}</div>
                        <div className="text-[10px] text-emerald-500/60 font-mono">≈ Rs. {(results.pnlAtTP * nprRate).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Liquidation Analysis Section */}
            <div className="crypto-card border-zinc-800/50 bg-zinc-900/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Advanced Liquidation Analysis</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Binance USDT-M tiered MMR approximation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Simple Liq. Price</span>
                  <div className="text-lg font-mono font-bold text-zinc-400">${results.simpleLiq.toFixed(results.simpleLiq < 1 ? 6 : 2)}</div>
                  <div className="text-[10px] text-zinc-600 mt-1">1/leverage formula</div>
                </div>
                <div className={cn(
                  "p-4 rounded-xl border-2 relative overflow-hidden",
                  results.safetyBuffer < 1.5 ? "bg-rose-600/5 border-rose-600/30" :
                  results.safetyBuffer < 2.0 ? "bg-rose-400/5 border-rose-400/30" :
                  results.safetyBuffer < 3.0 ? "bg-amber-500/5 border-amber-500/30" :
                  "bg-emerald-500/5 border-emerald-500/30"
                )}>
                  <div className="absolute top-2 right-2 flex gap-1">
                    {results.safetyBuffer < 1.5 && (
                      <div className="px-1.5 py-0.5 rounded bg-rose-600 text-[8px] font-black text-white uppercase animate-pulse">Danger</div>
                    )}
                    <div className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[8px] font-black text-amber-500 uppercase">Advanced</div>
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Adv. Liq. Price</span>
                  <div className={cn("text-xl font-mono font-bold", getSafetyColor(results.safetyBuffer))}>
                    ${results.liquidationPrice.toFixed(results.liquidationPrice < 1 ? 6 : 2)}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">MMR-adjusted (isolated)</div>
                </div>
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <span className="text-[10px] text-rose-500/70 uppercase font-bold block mb-1">Bankruptcy Price</span>
                  <div className="text-lg font-mono font-bold text-rose-400">${results.bankruptcyPrice.toFixed(results.bankruptcyPrice < 1 ? 6 : 2)}</div>
                  <div className="text-[10px] text-rose-500/40 mt-1">Loss = full initial margin</div>
                </div>
              </div>

              {/* Safety Buffer vs SL Indicator */}
              <div className="mt-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-6 rounded-full", 
                      results.safetyBuffer < 1.5 ? "bg-rose-600" :
                      results.safetyBuffer < 2.0 ? "bg-rose-400" :
                      results.safetyBuffer < 3.0 ? "bg-amber-500" :
                      "bg-emerald-500"
                    )} />
                    <div>
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Safety Buffer vs SL</h4>
                      <span className={cn("text-xs font-black", getSafetyColor(results.safetyBuffer))}>
                        {getSafetyStatus(results.safetyBuffer)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <span className="text-[9px] text-zinc-600 uppercase block">Dist to Liq</span>
                      <span className="text-[11px] font-mono font-bold text-zinc-300">{results.distToLiq.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-600 uppercase block">Dist to SL</span>
                      <span className="text-[11px] font-mono font-bold text-zinc-300">{results.distToSL.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-600 uppercase block">MMR</span>
                      <span className="text-[11px] font-mono font-bold text-zinc-300">{results.mmr.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                <div className="relative h-2 bg-zinc-900 rounded-full overflow-hidden mb-2">
                  <div className="absolute inset-0 flex">
                    <div className="h-full bg-rose-600/10 border-r border-zinc-950/50" style={{ width: '37.5%' }} />
                    <div className="h-full bg-rose-400/10 border-r border-zinc-950/50" style={{ width: '12.5%' }} />
                    <div className="h-full bg-amber-500/10 border-r border-zinc-950/50" style={{ width: '25%' }} />
                    <div className="h-full bg-emerald-500/10" style={{ width: '25%' }} />
                  </div>
                  <div 
                    className={cn("h-full transition-all duration-700 ease-out", 
                      results.safetyBuffer < 1.5 ? "bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.5)]" :
                      results.safetyBuffer < 2.0 ? "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]" :
                      results.safetyBuffer < 3.0 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" :
                      "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    )}
                    style={{ width: `${Math.min(100, (results.safetyBuffer / 4) * 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[7px] font-bold text-zinc-600 uppercase tracking-tighter">
                  <span>Critical (&lt;1.5x)</span>
                  <span>High Risk (&lt;2x)</span>
                  <span>Caution (&lt;3x)</span>
                  <span>Safe (&ge;3x)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Maint. Margin Required:</span>
                  <span className="text-xs font-mono font-bold text-amber-500">${results.maintenanceMargin.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Effective MMR:</span>
                  <span className="text-xs font-mono font-bold text-amber-500">{results.mmr.toFixed(2)}%</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/50">
                <div className="flex gap-2">
                  <Info className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-zinc-600 leading-relaxed italic">
                    Advanced calculation approximates Binance isolated margin tiers. For exact liquidation price, always verify in your exchange after opening — fees, mark price, and cross margin affect the real result.
                  </p>
                </div>
              </div>
            </div>

            {/* Trade Quality Section */}
            <div className="crypto-card border-zinc-800/50 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">Trade Quality Score</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">9-Point Risk & Strategy Validation</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-3xl font-black font-mono",
                    results.qualityScore >= 8 ? "text-emerald-500" :
                    results.qualityScore >= 6 ? "text-amber-500" : "text-rose-500"
                  )}>
                    {results.qualityScore}
                  </span>
                  <span className="text-zinc-600 font-bold">/9</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {results.rules.map((rule: any) => (
                  <div 
                    key={rule.id} 
                    className={cn(
                      "p-3 rounded-xl border transition-all duration-300",
                      rule.passed 
                        ? "bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30" 
                        : "bg-rose-500/5 border-rose-500/10 hover:border-rose-500/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{rule.name}</span>
                      {rule.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-sm font-mono font-bold", rule.passed ? "text-emerald-400" : "text-rose-400")}>
                        {rule.value}
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-tight mt-1.5">
                      {rule.advice}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-blue-500/10 mt-0.5">
                    <Brain className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-100 uppercase mb-1">Constructive Advice</h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {results.qualityScore === 9 
                        ? "This trade meets all safety and strategy criteria. Execution is highly recommended if the technical setup is valid."
                        : results.qualityScore >= 7
                        ? "Good trade quality, but some parameters could be optimized for better safety or profitability."
                        : "Low trade quality. Consider adjusting your entry, leverage, or risk percentage to improve the safety profile."}
                      {results.rules.find((r: any) => !r.passed && r.id === 3) && " Priority: Your liquidation price is too close to your stop loss. This is a critical risk."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-700 py-20 border-2 border-dashed border-zinc-900 rounded-2xl">
            <Calculator className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Ready to calculate your risk?</p>
            <p className="text-sm">Enter your trade parameters on the left to see advanced analytics.</p>
          </div>
        )}
      </div>

      {isModalOpen && results && (
        <LogTradeModal 
          results={results}
          symbol={symbol}
          direction={direction}
          leverage={leverage}
          entryPrice={entryPrice}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          currentBalance={currentBalance}
          onClose={() => setIsModalOpen(false)}
          onSave={(trade) => {
            onLogTrade(trade);
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

const LogTradeModal = ({ results, symbol, direction, leverage, entryPrice, stopLoss, takeProfit, currentBalance, onClose, onSave }: any) => {
  const [expectedEntryPrice, setExpectedEntryPrice] = useState(entryPrice.toString());
  const [strategy, setStrategy] = useState(STRATEGIES[0]);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[2]);
  const [notes, setNotes] = useState('');
  const [emotion, setEmotion] = useState(EMOTIONS[4]);
  const [marketCondition, setMarketCondition] = useState(MARKET_CONDITIONS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [updateGlobalBalance, setUpdateGlobalBalance] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if (strategy === 'CRT+TBS' && !['1h', '5m'].includes(timeframe)) {
      setTimeframe('1h');
    }
  }, [strategy, timeframe]);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size too large. Please upload an image smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const handleSave = () => {
    const trade: Trade = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      symbol,
      direction,
      leverage,
      entryPrice,
      expectedEntryPrice: parseFloat(expectedEntryPrice) || entryPrice,
      stopLoss,
      takeProfit: takeProfit || null,
      quantity: results.quantity,
      notionalValue: results.notionalValue,
      initialMargin: results.initialMargin,
      maintenanceMargin: results.maintenanceMargin,
      liquidationPrice: results.liquidationPrice,
      riskAmount: results.riskAmount,
      pnl: 0,
      fees: results.notionalValue * 0.0004, // Default fee estimation
      netPnl: 0,
      strategy,
      timeframe,
      notes,
      emotion,
      marketCondition,
      tags,
      status: 'OPEN',
      plannedRR: results.plannedRR,
      balanceBefore: currentBalance,
      safetyBufferAtEntry: results.safetyBuffer,
      liqDistAtEntry: results.distToLiq,
      screenshot,
    };
    onSave(trade);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            Log Trade to Journal
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <RefreshCw className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Symbol</span>
              <span className="font-bold">{symbol}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Direction</span>
              <span className={cn("font-bold", direction === 'LONG' ? "text-emerald-500" : "text-rose-500")}>{direction}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Entry</span>
              <span className="font-bold text-zinc-100">${entryPrice.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Stop Loss</span>
              <span className="font-bold text-rose-500">${stopLoss.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Take Profit</span>
              <span className="font-bold text-emerald-500">${takeProfit > 0 ? takeProfit.toFixed(4) : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Risk Amount</span>
              <span className="font-bold text-rose-500">-${results.riskAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Expected Entry Price (for Slippage)</label>
                <input 
                  type="number"
                  value={expectedEntryPrice}
                  onChange={(e) => setExpectedEntryPrice(e.target.value)}
                  className="input-field w-full"
                  placeholder="Price you wanted to get..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Strategy</label>
                <select 
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="input-field w-full"
                >
                  {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Timeframe</label>
                <div className="flex flex-wrap gap-2">
                  {TIMEFRAMES.filter(t => strategy === 'CRT+TBS' ? ['1h', '5m'].includes(t) : true).map(t => (
                    <button
                      key={t}
                      onClick={() => setTimeframe(t)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-all",
                        timeframe === t ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Emotion</label>
                <select 
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  className="input-field w-full"
                >
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Market Condition</label>
                <select 
                  value={marketCondition}
                  onChange={(e) => setMarketCondition(e.target.value)}
                  className="input-field w-full"
                >
                  {MARKET_CONDITIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(t => (
                    <span key={t} className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                      {t}
                      <button onClick={() => setTags(tags.filter(tag => tag !== t))}><Trash2 className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {PREDEFINED_TAGS.filter(t => !tags.includes(t)).slice(0, 5).map(t => (
                    <button 
                      key={t} 
                      onClick={() => handleAddTag(t)}
                      className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input 
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag(tagInput)}
                  className="input-field w-full"
                  placeholder="Type and press Enter..."
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Why are you taking this trade? (Required)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field w-full h-24 resize-none"
              placeholder="Describe your thesis, confluence, and plan..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Trade Screenshot (Optional)</label>
            <div className="flex items-center gap-4">
              <label className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed border-zinc-800 rounded-xl p-4 hover:border-emerald-500/50 transition-all flex flex-col items-center gap-2 bg-zinc-950/50">
                  <Upload className="w-6 h-6 text-zinc-500" />
                  <span className="text-xs text-zinc-400">Click to upload or drag and drop</span>
                  <span className="text-[10px] text-zinc-600">PNG, JPG up to 2MB</span>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleScreenshotChange} />
              </label>
              {screenshot && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-800 shrink-0">
                  <img src={screenshot} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setScreenshot(undefined)}
                    className="absolute top-1 right-1 p-1 bg-rose-500 rounded-full text-white hover:bg-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Final Review Required</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Please verify that your entry price, stop loss, and risk amount are correct. 
                  Once logged, these parameters define your trade's risk profile in the journal.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="checkbox"
                id="confirmTrade"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
              <label htmlFor="confirmTrade" className="text-xs font-medium text-zinc-300 cursor-pointer select-none">
                I have reviewed the trade parameters and confirm they are accurate
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox"
              id="updateBalance"
              checked={updateGlobalBalance}
              onChange={(e) => setUpdateGlobalBalance(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            <label htmlFor="updateBalance" className="text-sm text-zinc-400">Update global balance automatically on exit</label>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 flex gap-4 sticky bottom-0 bg-zinc-900">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button 
            onClick={handleSave}
            disabled={!notes.trim() || !isConfirmed}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed group relative"
          >
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Confirm & Save Trade</span>
            </div>
            {!isConfirmed && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-zinc-200 text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-zinc-700">
                Check the confirmation box to save
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const CloseTradeModal = ({ trade, onClose, onSave }: { trade: Trade, onClose: () => void, onSave: (data: Partial<Trade>) => void }) => {
  const [exitPrice, setExitPrice] = useState(trade.exitPrice?.toString() || '');
  const [fees, setFees] = useState('0.5');
  const [highestPrice, setHighestPrice] = useState('');
  const [lowestPrice, setLowestPrice] = useState('');
  const [postReflection, setPostReflection] = useState('');
  const [exitRationale, setExitRationale] = useState('');
  const [isRevenge, setIsRevenge] = useState(false);
  const [followedPlan, setFollowedPlan] = useState<'YES' | 'PARTIAL' | 'NO'>('YES');
  const [isBreakevenMoved, setIsBreakevenMoved] = useState(false);
  const [partialExits, setPartialExits] = useState('0');

  const preview = useMemo(() => {
    const exit = parseFloat(exitPrice);
    if (isNaN(exit)) return null;

    const high = parseFloat(highestPrice) || exit;
    const low = parseFloat(lowestPrice) || exit;
    const totalFees = parseFloat(fees) || 0;

    return calculateTradeMetrics({
      ...trade,
      exitPrice: exit,
      fees: totalFees,
      highestPriceReached: high,
      lowestPriceReached: low
    });
  }, [exitPrice, highestPrice, lowestPrice, fees, trade]);

  const handleSave = () => {
    const exit = parseFloat(exitPrice);
    if (isNaN(exit)) return;

    const high = parseFloat(highestPrice) || exit;
    const low = parseFloat(lowestPrice) || exit;
    const totalFees = parseFloat(fees) || 0;
    
    const metrics = calculateTradeMetrics({
      ...trade,
      exitPrice: exit,
      fees: totalFees,
      highestPriceReached: high,
      lowestPriceReached: low
    });

    if (!metrics) return;

    // MFE / MAE Percent Calculations
    const mfePercent = trade.direction === 'LONG'
      ? ((high - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - low) / trade.entryPrice) * 100;
    
    const maePercent = trade.direction === 'LONG'
      ? ((trade.entryPrice - low) / trade.entryPrice) * 100
      : ((high - trade.entryPrice) / trade.entryPrice) * 100;

    onSave({
      status: 'CLOSED',
      exitPrice: exit,
      highestPriceReached: high,
      lowestPriceReached: low,
      mfeUsdt: trade.direction === 'LONG' ? (high - trade.entryPrice) * trade.quantity : (trade.entryPrice - low) * trade.quantity,
      maeUsdt: trade.direction === 'LONG' ? (trade.entryPrice - low) * trade.quantity : (high - trade.entryPrice) * trade.quantity,
      mfePercent,
      maePercent,
      pnl: metrics.pnl,
      fees: totalFees,
      netPnl: metrics.netPnl,
      exitEfficiency: metrics.exitEfficiency,
      actualRR: metrics.actualRR,
      postTradeReflection: postReflection,
      exitRationale,
      isRevengeTrade: isRevenge,
      followedPlan,
      isBreakevenMoved,
      partialExitsCount: parseInt(partialExits) || 0,
      durationMinutes: Math.floor((new Date().getTime() - new Date(trade.date).getTime()) / 60000),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Close Trade: {trade.symbol}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <RefreshCw className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {preview && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <div className="text-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Preview Net PNL</span>
                <div className={cn("text-lg font-mono font-bold", preview.netPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {preview.netPnl >= 0 ? '+' : ''}${preview.netPnl.toFixed(2)}
                </div>
              </div>
              <div className="text-center border-x border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Actual RR</span>
                <div className={cn("text-lg font-mono font-bold", preview.actualRR >= 0 ? "text-blue-500" : "text-rose-500")}>
                  {preview.actualRR.toFixed(2)}R
                </div>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Exit Efficiency</span>
                <div className="text-lg font-mono font-bold text-amber-500">
                  {preview.exitEfficiency.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Exit Price (USDT)</label>
              <input 
                type="number"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="input-field w-full text-lg font-mono"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Total Fees (USDT)</label>
              <input 
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="input-field w-full text-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase">Highest Price Reached (MFE)</label>
              <input 
                type="number"
                value={highestPrice}
                onChange={(e) => setHighestPrice(e.target.value)}
                className="input-field w-full text-sm font-mono"
                placeholder="Max price during trade"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase">Lowest Price Reached (MAE)</label>
              <input 
                type="number"
                value={lowestPrice}
                onChange={(e) => setLowestPrice(e.target.value)}
                className="input-field w-full text-sm font-mono"
                placeholder="Min price during trade"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Followed Plan?</label>
                <select 
                  value={followedPlan}
                  onChange={(e) => setFollowedPlan(e.target.value as any)}
                  className="input-field w-full"
                >
                  <option value="YES">Yes, followed perfectly</option>
                  <option value="PARTIAL">Partially followed</option>
                  <option value="NO">No, deviated from plan</option>
                </select>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <input 
                  type="checkbox"
                  id="breakeven"
                  checked={isBreakevenMoved}
                  onChange={(e) => setIsBreakevenMoved(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <label htmlFor="breakeven" className="text-xs font-semibold text-zinc-400 cursor-pointer">Moved SL to Breakeven?</label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Partial Exits Count</label>
                <input 
                  type="number"
                  value={partialExits}
                  onChange={(e) => setPartialExits(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <input 
                  type="checkbox"
                  id="revenge"
                  checked={isRevenge}
                  onChange={(e) => setIsRevenge(e.target.checked)}
                  className="w-4 h-4 accent-rose-500"
                />
                <label htmlFor="revenge" className="text-xs font-semibold text-zinc-400 cursor-pointer">Was this Revenge Trading?</label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Exit Strategy & Rationale</label>
            <textarea 
              value={exitRationale}
              onChange={(e) => setExitRationale(e.target.value)}
              className="input-field w-full h-24 resize-none"
              placeholder="Why are you exiting now? Did you hit your target or see a reversal?..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Post-Trade Reflection</label>
            <textarea 
              value={postReflection}
              onChange={(e) => setPostReflection(e.target.value)}
              className="input-field w-full h-24 resize-none"
              placeholder="How do you feel about the exit? What did you learn?..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 flex gap-4 sticky bottom-0 bg-zinc-900">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button 
            onClick={handleSave}
            disabled={!exitPrice}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            Close Trade
          </button>
        </div>
      </div>
    </div>
  );
};

const EditTradeModal = ({ trade, onClose, onSave }: { trade: Trade, onClose: () => void, onSave: (updatedTrade: Trade) => void }) => {
  const [strategy, setStrategy] = useState(trade.strategy);
  const [timeframe, setTimeframe] = useState(trade.timeframe);
  const [notes, setNotes] = useState(trade.notes);
  const [emotion, setEmotion] = useState(trade.emotion);
  const [marketCondition, setMarketCondition] = useState(trade.marketCondition);
  const [tags, setTags] = useState<string[]>(trade.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(trade.screenshot || null);
  
  // For CLOSED trades
  const [exitPrice, setExitPrice] = useState(trade.exitPrice?.toString() || '');
  const [fees, setFees] = useState(trade.fees?.toString() || '0');
  const [highestPrice, setHighestPrice] = useState(trade.highestPriceReached?.toString() || '');
  const [lowestPrice, setLowestPrice] = useState(trade.lowestPriceReached?.toString() || '');
  const [exitRationale, setExitRationale] = useState(trade.exitRationale || '');
  const [postReflection, setPostReflection] = useState(trade.postTradeReflection || '');
  const [followedPlan, setFollowedPlan] = useState<'YES' | 'PARTIAL' | 'NO'>(trade.followedPlan || 'YES');

  const preview = useMemo(() => {
    if (trade.status !== 'CLOSED') return null;
    const exit = parseFloat(exitPrice);
    if (isNaN(exit)) return null;
    const totalFees = parseFloat(fees) || 0;
    const high = parseFloat(highestPrice) || exit;
    const low = parseFloat(lowestPrice) || exit;

    return calculateTradeMetrics({
      ...trade,
      exitPrice: exit,
      fees: totalFees,
      highestPriceReached: high,
      lowestPriceReached: low
    });
  }, [exitPrice, fees, highestPrice, lowestPrice, trade]);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size too large. Please upload an image smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const handleSave = () => {
    let updatedTrade: Trade = {
      ...trade,
      strategy,
      timeframe,
      notes,
      emotion,
      marketCondition,
      tags,
      screenshot,
    };

    if (trade.status === 'CLOSED') {
      const exit = parseFloat(exitPrice);
      const totalFees = parseFloat(fees) || 0;
      const high = parseFloat(highestPrice) || exit;
      const low = parseFloat(lowestPrice) || exit;

      const metrics = calculateTradeMetrics({
        ...trade,
        exitPrice: exit,
        fees: totalFees,
        highestPriceReached: high,
        lowestPriceReached: low
      });

      if (metrics) {
        const mfePercent = trade.direction === 'LONG'
          ? ((high - trade.entryPrice) / trade.entryPrice) * 100
          : ((trade.entryPrice - low) / trade.entryPrice) * 100;
        
        const maePercent = trade.direction === 'LONG'
          ? ((trade.entryPrice - low) / trade.entryPrice) * 100
          : ((high - trade.entryPrice) / trade.entryPrice) * 100;

        updatedTrade = {
          ...updatedTrade,
          exitPrice: exit,
          fees: totalFees,
          highestPriceReached: high,
          lowestPriceReached: low,
          pnl: metrics.pnl,
          netPnl: metrics.netPnl,
          actualRR: metrics.actualRR,
          exitEfficiency: metrics.exitEfficiency,
          mfeUsdt: trade.direction === 'LONG' ? (high - trade.entryPrice) * trade.quantity : (trade.entryPrice - low) * trade.quantity,
          maeUsdt: trade.direction === 'LONG' ? (trade.entryPrice - low) * trade.quantity : (high - trade.entryPrice) * trade.quantity,
          mfePercent,
          maePercent,
          exitRationale,
          postTradeReflection: postReflection,
          followedPlan,
        };
      }
    }

    onSave(updatedTrade);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-500" />
            Edit Trade: {trade.symbol}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <RefreshCw className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {preview && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <div className="text-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">New Net PNL</span>
                <div className={cn("text-lg font-mono font-bold", preview.netPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {preview.netPnl >= 0 ? '+' : ''}${preview.netPnl.toFixed(2)}
                </div>
              </div>
              <div className="text-center border-x border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">New RR</span>
                <div className={cn("text-lg font-mono font-bold", preview.actualRR >= 0 ? "text-blue-500" : "text-rose-500")}>
                  {preview.actualRR.toFixed(2)}R
                </div>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">New Efficiency</span>
                <div className="text-lg font-mono font-bold text-amber-500">
                  {preview.exitEfficiency.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Strategy</label>
                <select 
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="input-field w-full"
                >
                  {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Timeframe</label>
                <select 
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="input-field w-full"
                >
                  {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Emotion</label>
                <select 
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  className="input-field w-full"
                >
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Market Condition</label>
                <select 
                  value={marketCondition}
                  onChange={(e) => setMarketCondition(e.target.value)}
                  className="input-field w-full"
                >
                  {MARKET_CONDITIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(t => (
                    <span key={t} className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                      {t}
                      <button onClick={() => setTags(tags.filter(tag => tag !== t))}><Trash2 className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <input 
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag(tagInput)}
                  className="input-field w-full"
                  placeholder="Add tag..."
                />
              </div>
            </div>
          </div>

          {trade.status === 'CLOSED' && (
            <div className="space-y-6 pt-6 border-t border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Closed Trade Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Exit Price (USDT)</label>
                  <input 
                    type="number"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Fees (USDT)</label>
                  <input 
                    type="number"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Highest Price Reached</label>
                  <input 
                    type="number"
                    value={highestPrice}
                    onChange={(e) => setHighestPrice(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Lowest Price Reached</label>
                  <input 
                    type="number"
                    value={lowestPrice}
                    onChange={(e) => setLowestPrice(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Followed Plan?</label>
                <select 
                  value={followedPlan}
                  onChange={(e) => setFollowedPlan(e.target.value as any)}
                  className="input-field w-full"
                >
                  <option value="YES">Yes</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="NO">No</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Exit Rationale</label>
                <textarea 
                  value={exitRationale}
                  onChange={(e) => setExitRationale(e.target.value)}
                  className="input-field w-full h-20 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Post-Trade Reflection</label>
                <textarea 
                  value={postReflection}
                  onChange={(e) => setPostReflection(e.target.value)}
                  className="input-field w-full h-20 resize-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-2 pt-6 border-t border-zinc-800">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Trade Notes</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field w-full h-24 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Screenshot</label>
            <div className="flex items-center gap-4">
              <label className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed border-zinc-800 rounded-xl p-4 hover:border-blue-500/50 transition-all flex flex-col items-center gap-2 bg-zinc-950/50">
                  <Upload className="w-6 h-6 text-zinc-500" />
                  <span className="text-xs text-zinc-400">Update screenshot</span>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleScreenshotChange} />
              </label>
              {screenshot && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-800 shrink-0">
                  <img src={screenshot} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setScreenshot(null)}
                    className="absolute top-1 right-1 p-1 bg-rose-500 rounded-full text-white hover:bg-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 flex gap-4 sticky bottom-0 bg-zinc-900">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

const JournalTab = ({ 
  trades, 
  setTrades, 
  currentBalance, 
  startingBalance, 
  balanceHistory, 
  onUpdateBalance, 
  onDeleteTrade,
  onUpdateTrade,
  setDeletingTradeId,
  editingTrade,
  setEditingTrade,
  exportData, 
  importData, 
  clearData 
}: any) => {
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isUpdateBalanceOpen, setIsUpdateBalanceOpen] = useState(false);
  const [newBalanceValue, setNewBalanceValue] = useState(currentBalance);
  const [balanceNote, setBalanceNote] = useState('');
  const [reviewTrade, setReviewTrade] = useState<Trade | null>(null);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [editingPnlTrade, setEditingPnlTrade] = useState<Trade | null>(null);
  const [editedPnl, setEditedPnl] = useState<string>('');
  const [editedFees, setEditedFees] = useState<string>('');
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [dashboardTab, setDashboardTab] = useState('overview');
  const [sortField, setSortField] = useState<keyof Trade>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const dashboardStats = useMemo(() => {
    const closed = trades.filter((t: Trade) => t.status === 'CLOSED');
    const open = trades.filter((t: Trade) => t.status === 'OPEN');
    const wins = closed.filter((t: Trade) => t.netPnl > 0);
    const losses = closed.filter((t: Trade) => t.netPnl <= 0);
    
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    
    const grossProfit = wins.reduce((acc, t) => acc + t.netPnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.netPnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
    const netPnl = closed.reduce((acc, t) => acc + t.netPnl, 0);

    const avgRR = closed.length > 0 
      ? closed.reduce((acc, t) => acc + (t.actualRR || 0), 0) / closed.length 
      : 0;
    
    const avgEfficiency = closed.length > 0
      ? closed.reduce((acc, t) => acc + (t.exitEfficiency || 0), 0) / closed.length
      : 0;

    const totalDuration = closed.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);
    const avgDuration = closed.length > 0 ? totalDuration / closed.length : 0;
    const avgWin = wins.length > 0 ? wins.reduce((acc, t) => acc + t.netPnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((acc, t) => acc + t.netPnl, 0)) / losses.length : 0;
    const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss);

    // Daily Heatmap (last 60 days)
    const heatmapData = [];
    const now = new Date();
    for (let i = 59; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const dayTrades = closed.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === dateStr);
      const dayPnl = dayTrades.reduce((acc, t) => acc + t.netPnl, 0);
      
      let status: 'win' | 'loss' | 'none' = 'none';
      if (dayTrades.length > 0) {
        status = dayPnl > 0 ? 'win' : 'loss';
      }
      
      heatmapData.push({ date: dateStr, pnl: dayPnl, status });
    }

    return {
      total: trades.length,
      closed: closed.length,
      open: open.length,
      winRate,
      wins: wins.length,
      losses: losses.length,
      profitFactor,
      netPnl,
      avgRR,
      avgEfficiency,
      heatmapData,
      avgDuration,
      expectancy,
      avgWin,
      avgLoss
    };
  }, [trades]);

  const filteredTrades = useMemo(() => {
    const filtered = trades.filter((t: Trade) => {
      const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase()) || 
                           t.strategy.toLowerCase().includes(search.toLowerCase()) ||
                           t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
      const matchesDirection = filterDirection === 'ALL' || t.direction === filterDirection;
      const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
      return matchesSearch && matchesDirection && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal === undefined || bVal === undefined) return 0;
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [trades, search, filterDirection, filterStatus, sortField, sortDirection]);

  const toggleSort = (field: keyof Trade) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const insights = useMemo(() => {
    const closed = trades.filter((t: Trade) => t.status === 'CLOSED');
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

    const avgEfficiency = closed.reduce((acc, t) => acc + (t.exitEfficiency || 0), 0) / closed.length;

    return {
      bestStrategy: { name: bestStrategy[0], winRate: (bestStrategy[1].wins / bestStrategy[1].total) * 100 },
      avgEfficiency
    };
  }, [trades]);

  const monthlyPnlData = useMemo(() => {
    const closed = trades.filter((t: Trade) => t.status === 'CLOSED');
    const months: Record<string, number> = {};
    
    // Sort by date first
    const sortedTrades = [...closed].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedTrades.forEach((t: Trade) => {
      const month = format(new Date(t.date), 'MMM yyyy');
      months[month] = (months[month] || 0) + (t.netPnl || 0);
    });

    return Object.entries(months).map(([name, pnl]) => ({
      name,
      pnl: parseFloat(pnl.toFixed(2))
    }));
  }, [trades]);

  const equityCurveData = useMemo(() => {
    const sortedHistory = [...balanceHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sortedHistory.map((h: BalanceHistory) => ({
      date: format(new Date(h.date), 'MMM dd HH:mm'),
      balance: parseFloat(h.amount.toFixed(2))
    }));
  }, [balanceHistory]);

  const handleUpdateBalance = () => {
    onUpdateBalance(newBalanceValue, 'TRADE', balanceNote || 'Manual Balance Update');
    setIsUpdateBalanceOpen(false);
  };

  const deleteTrade = (id: string) => {
    setDeletingTradeId(id);
  };

  const deleteSelected = () => {
    if (selectedTrades.length === 0) return;
    selectedTrades.forEach(id => onDeleteTrade(id));
    setSelectedTrades([]);
  };

  const exportSelected = () => {
    const selected = trades.filter((t: Trade) => selectedTrades.includes(t.id));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selected));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `futurix_selected_trades_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportToCSV = () => {
    if (trades.length === 0) return;

    const headers = [
      'ID', 'Date', 'Symbol', 'Direction', 'Strategy', 'Timeframe', 'Status',
      'Entry Price', 'Exit Price', 'Quantity', 'Leverage', 'Notional Value',
      'Risk Amount', 'PNL', 'Fees', 'Net PNL', 'Planned RR', 'Actual RR',
      'MFE %', 'MAE %', 'Efficiency %', 'Followed Plan', 'Emotion', 'Market Condition',
      'Notes', 'Tags'
    ];

    const rows = trades.map((t: Trade) => [
      t.id,
      new Date(t.date).toLocaleString(),
      t.symbol,
      t.direction,
      t.strategy,
      t.timeframe,
      t.status,
      t.entryPrice,
      t.exitPrice !== undefined ? t.exitPrice : '',
      t.quantity,
      t.leverage,
      t.notionalValue,
      t.riskAmount,
      t.pnl !== undefined ? t.pnl : '',
      t.fees !== undefined ? t.fees : '',
      t.netPnl !== undefined ? t.netPnl : '',
      t.plannedRR,
      t.actualRR !== undefined ? t.actualRR : '',
      t.mfePercent !== undefined ? t.mfePercent : '',
      t.maePercent !== undefined ? t.maePercent : '',
      t.exitEfficiency !== undefined ? t.exitEfficiency : '',
      t.followedPlan || '',
      t.emotion || '',
      t.marketCondition || '',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${(t.tags || []).join(', ')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `futurix_trades_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseSave = (data: Partial<Trade>) => {
    if (!closingTrade) return;
    
    const updated = { ...closingTrade, ...data };
    if (updated.netPnl !== undefined) {
      onUpdateBalance(updated.netPnl, 'TRADE', `Trade Exit: ${closingTrade.symbol} ${closingTrade.direction}`);
    }
    onUpdateTrade(updated);
    setClosingTrade(null);
  };

  const handleEditPnl = (t: Trade) => {
    setEditingPnlTrade(t);
    setEditedPnl(t.pnl.toString());
    setEditedFees(t.fees.toString());
  };

  const saveEditedPnl = () => {
    if (!editingPnlTrade) return;
    const pnl = parseFloat(editedPnl);
    const fees = parseFloat(editedFees);
    if (isNaN(pnl) || isNaN(fees)) return;

    const netPnl = pnl - fees;
    const balanceDiff = netPnl - editingPnlTrade.netPnl;

    const updated = {
      ...editingPnlTrade,
      pnl,
      fees,
      netPnl,
      balanceAfter: (editingPnlTrade.balanceAfter || 0) + balanceDiff
    };

    onUpdateTrade(updated);

    if (balanceDiff !== 0) {
      onUpdateBalance(currentBalance + balanceDiff, 'TRADE', `PNL Correction: ${editingPnlTrade.symbol}`);
    }

    setEditingPnlTrade(null);
  };

  const formatTradeDuration = (minutes?: number) => {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return `${hours}h ${remainingMinutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Performance Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Stats */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="crypto-card bg-zinc-900/50 border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Net PNL</span>
            </div>
            <div className={cn("text-2xl font-mono font-bold", dashboardStats.netPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {dashboardStats.netPnl >= 0 ? '+' : ''}${dashboardStats.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">Avg RR: {dashboardStats.avgRR.toFixed(2)}</div>
          </div>

          <div className="crypto-card bg-zinc-900/50 border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Target className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Win Rate</span>
            </div>
            <div className="text-2xl font-mono font-bold text-zinc-100">
              {dashboardStats.winRate.toFixed(1)}%
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-emerald-500 font-bold">{dashboardStats.wins}W</span>
              <span className="text-[10px] text-rose-500 font-bold">{dashboardStats.losses}L</span>
            </div>
          </div>

          <div className="crypto-card bg-zinc-900/50 border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Profit Factor</span>
            </div>
            <div className="text-2xl font-mono font-bold text-zinc-100">
              {dashboardStats.profitFactor === Infinity ? '∞' : dashboardStats.profitFactor.toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">Expectancy: ${dashboardStats.expectancy.toFixed(2)}</div>
          </div>

          <div className="crypto-card bg-zinc-900/50 border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Avg Duration</span>
            </div>
            <div className="text-2xl font-mono font-bold text-zinc-100">
              {formatTradeDuration(dashboardStats.avgDuration)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">Efficiency: {dashboardStats.avgEfficiency.toFixed(1)}%</div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="crypto-card bg-emerald-500/5 border-emerald-500/20 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-emerald-500/70 uppercase font-bold">Current Balance</span>
              <div className="text-2xl font-mono font-bold text-emerald-500 mt-1">
                ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <button 
              onClick={() => setIsUpdateBalanceOpen(true)}
              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
            >
              <Wallet className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Insights Bar */}
      {insights && (
        <div className="flex flex-wrap gap-3">
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Best Strategy:</span>
            <span className="text-[10px] font-bold text-zinc-100">{insights.bestStrategy.name} ({insights.bestStrategy.winRate.toFixed(0)}%)</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Win:</span>
            <span className="text-[10px] font-bold text-emerald-500">${dashboardStats.avgWin.toFixed(2)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Loss:</span>
            <span className="text-[10px] font-bold text-rose-500">${dashboardStats.avgLoss.toFixed(2)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Open Trades:</span>
            <span className="text-[10px] font-bold text-zinc-100">{dashboardStats.open}</span>
          </div>
        </div>
      )}

      {/* Trade Review Modal */}
      {reviewTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-500" />
                Trade Review: {reviewTrade.symbol}
              </h2>
              <button onClick={() => setReviewTrade(null)} className="text-zinc-500 hover:text-zinc-100">
                <RefreshCw className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="crypto-card text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Net PNL</span>
                  <span className={cn("text-lg font-mono font-bold", reviewTrade.netPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {reviewTrade.netPnl >= 0 ? '+' : ''}${reviewTrade.netPnl.toFixed(2)}
                  </span>
                </div>
                <div className="crypto-card text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Actual RR</span>
                  <span className={cn("text-lg font-mono font-bold", (reviewTrade.actualRR || 0) >= reviewTrade.plannedRR ? "text-emerald-500" : "text-rose-500")}>
                    {reviewTrade.actualRR?.toFixed(2) || '—'}
                  </span>
                </div>
                <div className="crypto-card text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Efficiency</span>
                  <span className="text-lg font-mono font-bold text-emerald-500">{reviewTrade.exitEfficiency?.toFixed(1)}%</span>
                </div>
                <div className="crypto-card text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Status</span>
                  <span className={cn("text-xs font-bold block mt-1", reviewTrade.status === 'OPEN' ? "text-blue-500" : "text-zinc-500")}>
                    {reviewTrade.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Risk & Liquidation Summary
                  </h3>
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Safety Buffer at Entry</span>
                      <span className={cn("text-xs font-bold", 
                        (reviewTrade.safetyBufferAtEntry || 0) < 2 ? "text-rose-500" : 
                        (reviewTrade.safetyBufferAtEntry || 0) < 3 ? "text-amber-500" : "text-emerald-500"
                      )}>
                        {(reviewTrade.safetyBufferAtEntry || 0).toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Leverage Used</span>
                      <span className="text-xs font-bold text-zinc-200">{reviewTrade.leverage}x</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Liq. Distance at Entry</span>
                      <span className="text-xs font-bold text-amber-500">{(reviewTrade.liqDistAtEntry || 0).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Exit Analysis
                  </h3>
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500 uppercase">
                        <span>Capture Efficiency</span>
                        <span>{reviewTrade.exitEfficiency?.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${Math.min(100, reviewTrade.exitEfficiency || 0)}%` }} 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[10px]">
                      <div>
                        <span className="text-zinc-500 block">Planned RR</span>
                        <span className="font-bold text-zinc-200">{reviewTrade.plannedRR.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Actual RR</span>
                        <span className="font-bold text-blue-500">{reviewTrade.actualRR?.toFixed(2) || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Psychology & Behavior
                  </h3>
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Followed Plan?</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", 
                        reviewTrade.followedPlan === 'YES' ? "bg-emerald-500/10 text-emerald-500" :
                        reviewTrade.followedPlan === 'PARTIAL' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {reviewTrade.followedPlan || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Revenge Trade?</span>
                      <span className={cn("text-[10px] font-bold", reviewTrade.isRevengeTrade ? "text-rose-500" : "text-emerald-500")}>
                        {reviewTrade.isRevengeTrade ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Breakeven Moved?</span>
                      <span className="text-[10px] font-bold text-zinc-300">{reviewTrade.isBreakevenMoved ? 'YES' : 'NO'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-zinc-500">Post-Trade Reflection</h3>
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs leading-relaxed italic text-zinc-400">
                    {reviewTrade.postTradeReflection || "No reflection recorded."}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-zinc-500">Trade Notes (Pre-Trade)</h3>
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {reviewTrade.notes || "No notes provided."}
                </div>
              </div>

              {reviewTrade.screenshot && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-zinc-500">Screenshot</h3>
                  <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                    <img src={reviewTrade.screenshot} alt="Trade Screenshot" className="w-full h-auto" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-zinc-800">
              <button onClick={() => setReviewTrade(null)} className="btn-secondary w-full">Close Review</button>
            </div>
          </div>
        </div>
      )}

      {closingTrade && (
        <CloseTradeModal 
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onSave={handleCloseSave}
        />
      )}

      {editingTrade && (
        <EditTradeModal 
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSave={(updatedTrade) => {
            onUpdateTrade(updatedTrade);
            setEditingTrade(null);
          }}
        />
      )}

      {/* Filters & Bulk Actions */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full pl-10"
              placeholder="Search symbol, strategy, tags..."
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              className="input-field text-xs flex-1 md:flex-none"
            >
              <option value="ALL">All Directions</option>
              <option value="LONG">Long Only</option>
              <option value="SHORT">Short Only</option>
            </select>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field text-xs flex-1 md:flex-none"
            >
              <option value="ALL">All Status</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
            <div className="flex gap-1">
              <button onClick={exportData} className="btn-secondary p-2" title="Export Full Backup">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={exportToCSV} className="btn-secondary p-2" title="Export to CSV">
                <FileText className="w-4 h-4" />
              </button>
              <label className="btn-secondary p-2 cursor-pointer" title="Import Backup">
                <Upload className="w-4 h-4" />
                <input type="file" className="hidden" onChange={importData} accept=".json" />
              </label>
              <button onClick={clearData} className="btn-secondary p-2 text-rose-500 hover:bg-rose-500/10" title="Clear All Data">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {selectedTrades.length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-bold text-emerald-500">{selectedTrades.length} trades selected</span>
            <div className="h-4 w-px bg-emerald-500/20" />
            <button onClick={exportSelected} className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1">
              <Download className="w-3 h-3" /> Export Selected
            </button>
            <button onClick={deleteSelected} className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Delete Selected
            </button>
            <button onClick={() => setSelectedTrades([])} className="text-xs font-bold text-zinc-500 hover:underline ml-auto">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Trade Table */}
      <div className="crypto-card p-0 overflow-hidden border-zinc-800/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/80 border-b border-zinc-800">
                <th className="px-4 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedTrades.length === filteredTrades.length && filteredTrades.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTrades(filteredTrades.map((t: Trade) => t.id));
                      else setSelectedTrades([]);
                    }}
                    className="w-4 h-4 accent-emerald-500 rounded border-zinc-700 bg-zinc-800"
                  />
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date {sortField === 'date' ? (sortDirection === 'asc' ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => toggleSort('symbol')}
                >
                  <div className="flex items-center gap-1">
                    Asset {sortField === 'symbol' ? (sortDirection === 'asc' ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase">Setup</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase">Prices (EP/SL/TP)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase">Strategy</th>
                <th 
                  className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => toggleSort('plannedRR')}
                >
                  <div className="flex items-center gap-1">
                    RR {sortField === 'plannedRR' ? (sortDirection === 'asc' ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => toggleSort('netPnl')}
                >
                  <div className="flex items-center gap-1">
                    PNL {sortField === 'netPnl' ? (sortDirection === 'asc' ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase">Eff%</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase">Media</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredTrades.length > 0 ? filteredTrades.map((t: Trade) => (
                <tr key={t.id} className="hover:bg-zinc-800/20 group transition-colors">
                  <td className="px-4 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedTrades.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTrades([...selectedTrades, t.id]);
                        else setSelectedTrades(selectedTrades.filter(id => id !== t.id));
                      }}
                      className="w-4 h-4 accent-emerald-500 rounded border-zinc-700 bg-zinc-800"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-100">{format(new Date(t.date), 'MMM dd')}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{format(new Date(t.date), 'HH:mm')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-zinc-100">{t.symbol}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", 
                          t.direction === 'LONG' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        )}>
                          {t.direction}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{t.leverage}x</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-3">$</span>
                        <span className="text-xs text-zinc-100 font-mono">${t.riskAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-3">Q</span>
                        <span className="text-xs text-zinc-100 font-mono">{t.quantity.toFixed(4)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-4">EP</span>
                        <span className="text-xs text-zinc-100 font-mono">{t.entryPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-4">SL</span>
                        <span className="text-xs text-zinc-100 font-mono text-rose-400">{t.stopLoss.toLocaleString()}</span>
                      </div>
                      {t.takeProfit && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 font-mono w-4">TP</span>
                          <span className="text-xs text-zinc-100 font-mono text-emerald-400">{t.takeProfit.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-emerald-500 w-fit">
                        {t.strategy}
                      </span>
                      <span className="text-[10px] text-zinc-500">{t.timeframe}</span>
                      <span className="text-[10px] text-zinc-500 italic">{t.emotion}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono font-bold text-zinc-100">P: {t.plannedRR.toFixed(2)}R</span>
                      {t.status === 'CLOSED' && (
                        <span className={cn("text-xs font-mono font-bold", (t.actualRR || 0) >= t.plannedRR ? "text-emerald-500" : "text-rose-500")}>
                          A: {t.actualRR?.toFixed(2)}R
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {t.status === 'OPEN' ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Open</span>
                        <span className="text-[10px] text-zinc-500">In Progress</span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-mono font-bold", t.netPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {t.netPnl >= 0 ? '+' : ''}${t.netPnl.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-zinc-500">Net PNL</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {t.status === 'CLOSED' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-zinc-100">{t.exitEfficiency?.toFixed(0)}%</span>
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden md:block">
                          <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${Math.min(100, t.exitEfficiency || 0)}%` }} 
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="w-10 h-8 rounded border border-dashed border-zinc-800 flex items-center justify-center bg-zinc-950/50">
                      <ImageIcon className="w-4 h-4 text-zinc-700" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {t.status === 'OPEN' && (
                        <button 
                          onClick={() => setClosingTrade(t)}
                          className="text-emerald-500 hover:text-emerald-400 transition-colors"
                          title="Close Trade"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => setEditingTrade(t)}
                        className="text-zinc-500 hover:text-blue-500 transition-colors"
                        title="Edit Trade"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setReviewTrade(t)}
                        className="text-zinc-500 hover:text-zinc-100 transition-colors"
                        title="Review Trade"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteTrade(t.id)}
                        className="text-zinc-500 hover:text-rose-500 transition-colors"
                        title="Delete Trade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-zinc-500 italic">
                    No trades found. Start by logging your first trade from the calculator.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center py-4">
        <p className="text-xs italic text-zinc-600">
          "Journal everything — even small losses. Consistency beats perfection."
        </p>
      </div>

      {isUpdateBalanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Update Balance</h2>
              <button onClick={() => setIsUpdateBalanceOpen(false)} className="text-zinc-500 hover:text-zinc-100">
                <RefreshCw className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">New Balance (USDT)</label>
                <input 
                  type="number"
                  value={newBalanceValue}
                  onChange={(e) => setNewBalanceValue(Number(e.target.value))}
                  className="input-field w-full text-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Note</label>
                <input 
                  value={balanceNote}
                  onChange={(e) => setBalanceNote(e.target.value)}
                  className="input-field w-full"
                  placeholder="Deposit, Withdrawal, Correction..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsUpdateBalanceOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleUpdateBalance} className="btn-primary flex-1">Update Balance</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingPnlTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Edit PNL: {editingPnlTrade.symbol}</h2>
              <button onClick={() => setEditingPnlTrade(null)} className="text-zinc-500 hover:text-zinc-100">
                <RefreshCw className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Gross PNL (USDT)</label>
                <input 
                  type="number"
                  value={editedPnl}
                  onChange={(e) => setEditedPnl(e.target.value)}
                  className="input-field w-full text-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Fees (USDT)</label>
                <input 
                  type="number"
                  value={editedFees}
                  onChange={(e) => setEditedFees(e.target.value)}
                  className="input-field w-full text-xl font-mono"
                />
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 uppercase">Net PNL</span>
                  <span className={cn("text-lg font-mono font-bold", (parseFloat(editedPnl) - parseFloat(editedFees)) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    ${(parseFloat(editedPnl || '0') - parseFloat(editedFees || '0')).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setEditingPnlTrade(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={saveEditedPnl} className="btn-primary flex-1">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Dashboard */}
      <div className="space-y-6 mt-8">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl font-bold text-zinc-100">Performance Dashboard</h2>
        </div>

        {/* Dashboard Tabs */}
        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'risk', label: 'Risk', icon: Shield },
            { id: 'psychology', label: 'Psychology', icon: Brain },
            { id: 'efficiency', label: 'Efficiency', icon: Zap }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDashboardTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all",
                dashboardTab === tab.id 
                  ? "bg-zinc-800 text-zinc-100 shadow-lg" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <tab.icon className={cn("w-4 h-4", dashboardTab === tab.id ? "text-emerald-500" : "")} />
              {tab.label}
            </button>
          ))}
        </div>

        {dashboardTab === 'overview' && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="crypto-card p-6">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Total Trades</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-zinc-100">{dashboardStats.total}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {dashboardStats.closed} closed · {dashboardStats.open} open
                </p>
              </div>

              <div className="crypto-card p-6">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Win Rate</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-500">{dashboardStats.winRate.toFixed(1)}%</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {dashboardStats.wins}W / {dashboardStats.losses}L
                </p>
              </div>

              <div className="crypto-card p-6">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Profit Factor</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-zinc-100">
                    {dashboardStats.profitFactor === Infinity ? '∞' : dashboardStats.profitFactor.toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Gross P / Gross L</p>
              </div>

              <div className="crypto-card p-6">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Net PNL</p>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-3xl font-bold",
                    dashboardStats.netPnl >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {dashboardStats.netPnl >= 0 ? '+' : ''}${Math.abs(dashboardStats.netPnl).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Avg RR: {dashboardStats.avgRR.toFixed(2)}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="crypto-card p-6">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">Equity Curve</h3>
                <div className="h-[250px] w-full flex items-center justify-center">
                  {dashboardStats.closed < 2 ? (
                    <p className="text-sm text-zinc-500 italic">Log at least 2 closed trades to see equity curve</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={equityCurveData}>
                        <defs>
                          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9ca3af" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          hide={equityCurveData.length > 20}
                        />
                        <YAxis 
                          stroke="#9ca3af" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `$${value}`}
                          domain={['auto', 'auto']}
                        />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#3b82f6' }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorBalance)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="crypto-card p-6">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">Monthly PNL</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyPnlData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#9ca3af" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `$${value}`}
                      />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#10b981' }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                      />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {monthlyPnlData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Daily Heatmap */}
            <div className="crypto-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Daily PNL Heatmap</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-zinc-500">Win</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-[10px] text-zinc-500">Loss</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-zinc-800" />
                    <span className="text-[10px] text-zinc-500">None</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dashboardStats.heatmapData.map((day) => (
                  <div 
                    key={day.date}
                    title={`${day.date}: $${day.pnl.toFixed(2)}`}
                    className={cn(
                      "w-3 h-3 rounded-full transition-all cursor-help",
                      day.status === 'win' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" :
                      day.status === 'loss' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" :
                      "bg-zinc-800"
                    )}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {dashboardTab === 'risk' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="crypto-card p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">Risk Distribution</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Avg Risk per Trade</span>
                  <span className="text-sm font-mono font-bold text-rose-500">
                    ${(trades.reduce((acc: number, t: Trade) => acc + t.riskAmount, 0) / (trades.length || 1)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Avg Leverage</span>
                  <span className="text-sm font-mono font-bold text-amber-500">
                    {(trades.reduce((acc: number, t: Trade) => acc + t.leverage, 0) / (trades.length || 1)).toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Avg Safety Buffer</span>
                  <span className="text-sm font-mono font-bold text-emerald-500">
                    {(trades.reduce((acc: number, t: Trade) => acc + (t.safetyBufferAtEntry || 0), 0) / (trades.length || 1)).toFixed(2)}x
                  </span>
                </div>
              </div>
            </div>
            <div className="crypto-card p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">Strategy Performance</h3>
              <div className="space-y-3">
                {Object.entries(
                  trades.filter((t: Trade) => t.status === 'CLOSED').reduce((acc: any, t: Trade) => {
                    if (!acc[t.strategy]) acc[t.strategy] = { wins: 0, total: 0 };
                    acc[t.strategy].total++;
                    if (t.netPnl > 0) acc[t.strategy].wins++;
                    return acc;
                  }, {})
                ).map(([name, stats]: [string, any]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${(stats.wins / stats.total) * 100}%` }} 
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-200">{((stats.wins / stats.total) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {dashboardTab === 'psychology' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="crypto-card p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">Plan Adherence</h3>
              <div className="grid grid-cols-3 gap-4">
                {['YES', 'PARTIAL', 'NO'].map(status => {
                  const count = trades.filter(t => t.followedPlan === status).length;
                  const percent = trades.length > 0 ? (count / trades.length) * 100 : 0;
                  return (
                    <div key={status} className="text-center">
                      <div className="text-lg font-bold text-zinc-100">{count}</div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold">{status}</div>
                      <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full",
                            status === 'YES' ? "bg-emerald-500" : status === 'PARTIAL' ? "bg-amber-500" : "bg-rose-500"
                          )} 
                          style={{ width: `${percent}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="crypto-card p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">Emotional Impact</h3>
              <div className="space-y-3">
                {EMOTIONS.map(emotion => {
                  const emotionTrades = trades.filter(t => t.emotion === emotion);
                  const winRate = emotionTrades.length > 0 
                    ? (emotionTrades.filter(t => t.netPnl > 0).length / emotionTrades.length) * 100 
                    : 0;
                  if (emotionTrades.length === 0) return null;
                  return (
                    <div key={emotion} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{emotion}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500">{emotionTrades.length} trades</span>
                        <span className={cn("text-xs font-bold", winRate >= 50 ? "text-emerald-500" : "text-rose-500")}>
                          {winRate.toFixed(0)}% WR
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {dashboardTab === 'efficiency' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="crypto-card p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">Capture Efficiency</h3>
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-mono font-bold text-emerald-500">
                    {dashboardStats.avgEfficiency.toFixed(1)}%
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 uppercase font-bold tracking-widest">Average Exit Efficiency</p>
                </div>
              </div>
            </div>
            <div className="crypto-card p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-6">MFE vs MAE</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold">
                    <span>Avg Max Favorable Excursion (MFE)</span>
                    <span className="text-emerald-500">
                      +{(trades.reduce((acc: number, t: Trade) => acc + (t.mfePercent || 0), 0) / (trades.length || 1)).toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500" 
                      style={{ width: `${Math.min(100, trades.reduce((acc: number, t: Trade) => acc + (t.mfePercent || 0), 0) / (trades.length || 1) * 5)}%` }} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold">
                    <span>Avg Max Adverse Excursion (MAE)</span>
                    <span className="text-rose-500">
                      -{(trades.reduce((acc: number, t: Trade) => acc + (t.maePercent || 0), 0) / (trades.length || 1)).toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500" 
                      style={{ width: `${Math.min(100, trades.reduce((acc: number, t: Trade) => acc + (t.maePercent || 0), 0) / (trades.length || 1) * 5)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const StatsTab = ({ trades, startingBalance, balanceHistory }: any) => {
  const stats = useMemo(() => {
    const closed = trades.filter((t: Trade) => t.status === 'CLOSED');
    if (closed.length === 0) return null;

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

    // Win rate by strategy
    const strategyStats: Record<string, { wins: number, total: number }> = {};
    closed.forEach(t => {
      if (!strategyStats[t.strategy]) strategyStats[t.strategy] = { wins: 0, total: 0 };
      strategyStats[t.strategy].total++;
      if (t.netPnl > 0) strategyStats[t.strategy].wins++;
    });

    // Monthly PNL
    const monthlyPnl: Record<string, number> = {};
    closed.forEach(t => {
      const month = format(new Date(t.date), 'MMM yyyy');
      monthlyPnl[month] = (monthlyPnl[month] || 0) + t.netPnl;
    });

    const monthlyData = Object.entries(monthlyPnl).map(([name, pnl]) => ({ name, pnl }));

    // Equity Curve (using balance history for accuracy)
    const equityData = [...balanceHistory]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((h, i) => ({
        name: format(new Date(h.date), 'MMM dd'),
        balance: h.amount,
        tradeIndex: i
      }));

    return {
      winRate,
      totalNetPnl,
      totalFees,
      profitFactor,
      avgWin,
      avgLoss,
      avgEfficiency,
      avgMfe,
      avgMae,
      strategyStats,
      monthlyData,
      equityData,
      totalTrades: closed.length
    };
  }, [trades, startingBalance, balanceHistory]);

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
        <History className="w-12 h-12 mb-4 opacity-20" />
        <p className="italic">Not enough closed trades to generate analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="crypto-card">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Win Rate</span>
          <div className="text-2xl font-mono font-bold text-emerald-500 mt-1">{stats.winRate.toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500 mt-1">{stats.totalTrades} total trades</div>
        </div>
        <div className="crypto-card">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Profit Factor</span>
          <div className="text-2xl font-mono font-bold text-blue-500 mt-1">{stats.profitFactor.toFixed(2)}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Avg W/L: {(stats.avgWin / (stats.avgLoss || 1)).toFixed(2)}</div>
        </div>
        <div className="crypto-card">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Net PNL</span>
          <div className={cn("text-2xl font-mono font-bold mt-1", stats.totalNetPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
            ${stats.totalNetPnl.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Fees: ${stats.totalFees.toFixed(2)}</div>
        </div>
        <div className="crypto-card">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Avg Efficiency</span>
          <div className="text-2xl font-mono font-bold text-amber-500 mt-1">{stats.avgEfficiency.toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500 mt-1">MFE: {stats.avgMfe.toFixed(1)}% | MAE: {stats.avgMae.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity Curve */}
        <div className="crypto-card p-6">
          <h3 className="text-sm font-bold uppercase text-zinc-500 mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Equity Curve
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equityData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  hide={stats.equityData.length > 15}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `$${val}`}
                  domain={['auto', 'auto']}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
                />
                <Area type="monotone" dataKey="balance" stroke="#10b981" fillOpacity={1} fill="url(#colorBalance)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly PNL */}
        <div className="crypto-card p-6">
          <h3 className="text-sm font-bold uppercase text-zinc-500 mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Monthly Performance
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  cursor={{ fill: '#27272a' }}
                />
                <Bar dataKey="pnl">
                  {stats.monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategy Performance */}
      <div className="crypto-card p-6">
        <h3 className="text-sm font-bold uppercase text-zinc-500 mb-6">Win Rate by Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(stats.strategyStats).map(([name, data]: [string, any]) => {
            const wr = (data.wins / data.total) * 100;
            return (
              <div key={name} className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-zinc-200">{name}</span>
                  <span className={cn("text-xs font-bold", wr >= 50 ? "text-emerald-500" : "text-rose-500")}>
                    {wr.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${wr}%` }} />
                </div>
                <div className="mt-2 text-[10px] text-zinc-500">
                  {data.wins} wins / {data.total} total
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


