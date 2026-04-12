import React, { useState, useMemo } from 'react';
import { 
  History, RefreshCw, Shield, TrendingUp, Brain, Eye, Search, 
  Download, FileText, Upload, Camera, AlertTriangle, Trash2, 
  Activity, PlusCircle, Edit3, ChevronDown, ArrowUpDown, 
  ImageIcon, CheckCircle2, X 
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Trade } from '../../types';
import { cn } from '../../lib/utils';
import { CloseTradeModal } from './CloseTradeModal';
import { EditTradeModal } from './EditTradeModal';
import { AddMarginModal } from './AddMarginModal';
import { ReviewTradeModal } from './ReviewTradeModal';
import { LogTradeModal } from '../shared/LogTradeModal';

interface JournalTabProps {
  trades: Trade[];
  setTrades: (trades: Trade[]) => void;
  currentBalance: number;
  startingBalance: number;
  balanceHistory: any[];
  onUpdateBalance: (amount: number, type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'SET', note?: string) => void;
  onDeleteTrade: (id: string) => void;
  onUpdateTrade: (trade: Trade) => void;
  setDeletingTradeId: (id: string | null) => void;
  editingTrade: Trade | null;
  setEditingTrade: (trade: Trade | null) => void;
  exportData: () => void;
  importData: (e: any) => void;
  importBinanceCSV: (e: any) => void;
  clearData: () => void;
  onBinanceSync: () => void;
  isSyncing: boolean;
  setActiveTab: (tab: string) => void;
  binancePositions: any[];
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onLogTrade: (trade: Trade) => void;
  nprRate: number;
  dailyGoals: any;
}

export const JournalTab = ({ 
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
  importBinanceCSV,
  clearData,
  onBinanceSync,
  isSyncing,
  setActiveTab,
  binancePositions,
  showNotification,
  onLogTrade,
  nprRate,
  dailyGoals
}: JournalTabProps) => {
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isUpdateBalanceOpen, setIsUpdateBalanceOpen] = useState(false);
  const [newBalanceValue, setNewBalanceValue] = useState(currentBalance);
  const [balanceNote, setBalanceNote] = useState('');
  const [reviewTrade, setReviewTrade] = useState<Trade | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [editingPnlTrade, setEditingPnlTrade] = useState<Trade | null>(null);
  const [addingMarginTrade, setAddingMarginTrade] = useState<Trade | null>(null);
  const [loggingPosition, setLoggingPosition] = useState<any | null>(null);
  const [editedPnl, setEditedPnl] = useState<string>('');
  const [editedFees, setEditedFees] = useState<string>('');
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Trade>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const loggingResults = useMemo(() => {
    if (!loggingPosition) return null;
    const qty = Math.abs(Number(loggingPosition.contracts));
    const entry = Number(loggingPosition.entryPrice);
    const notional = qty * entry;
    return {
      finalLeverage: loggingPosition.leverage,
      quantity: qty,
      notionalValue: notional,
      initialMargin: notional / loggingPosition.leverage,
      maintenanceMargin: 0,
      liquidationPrice: Number(loggingPosition.liquidationPrice),
      riskAmount: 0,
      entryFee: 0,
      plannedRR: 0,
      marginMode: (loggingPosition.marginType || 'ISOLATED').toUpperCase(),
      safetyBuffer: 0,
      distToLiq: 0,
    };
  }, [loggingPosition]);

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

  const isPositionLive = (trade: Trade) => {
    return binancePositions.some((pos: any) => 
      pos.symbol === trade.symbol && 
      pos.side.toUpperCase() === trade.direction
    );
  };

  const handleUpdateBalance = () => {
    onUpdateBalance(newBalanceValue, 'SET', balanceNote || 'Manual Balance Update');
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
      'MFE %', 'MAE %', 'Efficiency %', 'Followed Plan', 'Emotion',
      'Notes', 'Tags'
    ];

    const rows = trades.map((t: Trade) => [
      t.id,
      (new Date(t.date)).toLocaleString(),
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
      t.notes || '',
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
    onUpdateTrade(updated as Trade);
    setClosingTrade(null);
  };

  const handleEditPnl = (t: Trade) => {
    setEditingPnlTrade(t);
    setEditedPnl((t.pnl || 0).toString());
    setEditedFees((t.fees || 0).toString());
  };

  const saveEditedPnl = () => {
    if (!editingPnlTrade) return;
    const pnl = parseFloat(editedPnl);
    const fees = parseFloat(editedFees);
    if (isNaN(pnl) || isNaN(fees)) return;

    const netPnl = pnl - fees;
    const balanceDiff = netPnl - (editingPnlTrade.netPnl || 0);

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
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes < 60) return `${roundedMinutes}m`;
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;
    if (hours < 24) return `${hours}h ${remainingMinutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  return (
    <div className="space-y-6">
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
                  <span className={cn("text-lg font-mono font-bold", (reviewTrade.netPnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {(reviewTrade.netPnl || 0) >= 0 ? '+' : ''}${(reviewTrade.netPnl || 0).toFixed(2)}
                  </span>
                </div>
                <div className="crypto-card text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Actual RR</span>
                  <span className={cn("text-lg font-mono font-bold", (reviewTrade.actualRR || 0) >= (reviewTrade.plannedRR || 0) ? "text-emerald-500" : "text-rose-500")}>
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
                    <div className="pt-3 border-t border-zinc-800/50 space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-500 uppercase">Total Slippage</span>
                        <span className={cn("font-bold", (reviewTrade.slippagePercent || 0) > 0.1 ? "text-rose-500" : "text-zinc-400")}>
                          {reviewTrade.slippagePercent?.toFixed(2)}% (${reviewTrade.slippageUsdt?.toFixed(2)})
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-500 uppercase">MFE / MAE</span>
                        <span className="font-bold text-zinc-300">
                          +{reviewTrade.mfePercent?.toFixed(2)}% / -{reviewTrade.maePercent?.toFixed(2)}%
                        </span>
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

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-zinc-500">Trade Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviewTrade.entryImage1h && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Entry (1h)</span>
                      <div 
                        className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-emerald-500 transition-all group relative"
                        onClick={() => setFullScreenImage(reviewTrade.entryImage1h!)}
                      >
                        <img src={reviewTrade.entryImage1h} alt="Entry 1h" className="w-full h-auto" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                  {reviewTrade.exitImage5min && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Exit (5min)</span>
                      <div 
                        className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-rose-500 transition-all group relative"
                        onClick={() => setFullScreenImage(reviewTrade.exitImage5min!)}
                      >
                        <img src={reviewTrade.exitImage5min} alt="Exit 5min" className="w-full h-auto" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
          showNotification={showNotification}
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
          showNotification={showNotification}
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
              <label className="btn-secondary p-2 cursor-pointer border-amber-500/30 text-amber-500 hover:bg-amber-500/10" title="Import Binance CSV">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px] font-bold hidden md:inline">BINANCE CSV</span>
                </div>
                <input type="file" className="hidden" onChange={importBinanceCSV} accept=".csv" />
              </label>
              <button 
                onClick={onBinanceSync} 
                disabled={isSyncing}
                className={cn(
                  "btn-secondary p-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 flex items-center gap-1",
                  isSyncing && "opacity-50 cursor-not-allowed"
                )}
                title="Sync Real-time with Binance API"
              >
                <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                <span className="text-[10px] font-bold hidden md:inline">{isSyncing ? 'SYNCING...' : 'BINANCE SYNC'}</span>
              </button>
              <button 
                onClick={() => setActiveTab('calculator')} 
                className="btn-secondary p-2 text-blue-500 hover:bg-blue-500/10" 
                title="Scan Screenshot in Calculator"
              >
                <div className="flex items-center gap-1">
                  <Camera className="w-4 h-4" />
                  <span className="text-[10px] font-bold hidden md:inline">SCAN</span>
                </div>
              </button>
              <button onClick={clearData} className="btn-secondary p-2 text-rose-500 hover:bg-rose-500/10 flex items-center gap-2" title="DANGER: Clear All Data">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] font-bold hidden lg:inline">RESET ALL</span>
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

      {/* Active Binance Positions (Real-time) */}
      {binancePositions.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Live Binance Positions</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Real-time from API</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {binancePositions.map((pos, idx) => (
              <div key={`${pos.symbol}-${pos.side}-${pos.leverage}-${idx}`} className="crypto-card bg-emerald-500/5 border-emerald-500/20 p-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-zinc-100">{pos.symbol}</div>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className={cn("text-[10px] font-bold uppercase", pos.side === 'long' ? "text-emerald-500" : "text-rose-500")}>
                      {pos.side} {pos.leverage}x
                    </div>
                  </div>
                  <div className={cn("text-sm font-mono font-bold", pos.unrealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pos.unrealizedPnl >= 0 ? '+' : ''}${Number(pos.unrealizedPnl).toFixed(2)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px]">
                  <div>
                    <span className="text-zinc-500 block uppercase">Entry Price</span>
                    <span className="text-zinc-300 font-mono">${(Number(pos.entryPrice) || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase">Mark Price</span>
                    <span className="text-zinc-300 font-mono">${(Number(pos.markPrice) || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase">Size</span>
                    <span className="text-zinc-300 font-mono">{Number(pos.contracts).toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase">Liq. Price</span>
                    <span className="text-rose-400 font-mono font-bold">
                      {(Number(pos.liquidationPrice) || 0) > 0 ? `$${Number(pos.liquidationPrice).toLocaleString()}` : 'None'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setLoggingPosition(pos)}
                  className="mt-3 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-3 h-3" />
                  Journal
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade List - Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredTrades.map((t: Trade, idx) => (
          <div 
            key={`${t.id}-${t.symbol}-${t.direction}-${t.date}-${idx}`} 
            className="crypto-card bg-zinc-900/50 border-zinc-800/50 p-4 space-y-3"
            onClick={() => setReviewTrade(t)}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", t.direction === 'LONG' ? "bg-emerald-500" : "bg-rose-500")} />
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-zinc-100">{t.symbol}</div>
                    {isPositionLive(t) && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500">{format(new Date(t.date), 'MMM dd, HH:mm')}</div>
                </div>
              </div>
              <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold", 
                t.status === 'OPEN' ? "bg-blue-500/10 text-blue-500" : "bg-zinc-800 text-zinc-400"
              )}>
                {t.status}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-800/50">
              <div>
                <span className="text-[8px] text-zinc-500 uppercase block">Entry</span>
                <span className="text-xs font-mono text-zinc-300">${(t.entryPrice || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[8px] text-zinc-500 uppercase block">Size</span>
                <span className="text-xs font-mono text-zinc-300">{t.quantity}</span>
              </div>
              <div>
                <span className="text-[8px] text-zinc-500 uppercase block">PNL</span>
                <span className={cn("text-xs font-mono font-bold", (t.netPnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {t.status === 'CLOSED' ? `$${(t.netPnl || 0).toFixed(2)}` : '—'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div className="flex gap-1">
                {t.tags.slice(0, 2).map((tag, tagIdx) => (
                  <span key={`${tag}-${tagIdx}`} className="text-[8px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">{tag}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingTrade(t); }}
                  className="p-1.5 text-zinc-500 hover:text-zinc-100"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteTrade(t.id); }}
                  className="p-1.5 text-zinc-500 hover:text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredTrades.length === 0 && (
          <div className="text-center py-12 text-zinc-500 text-sm">No trades found.</div>
        )}
      </div>

      {/* Active Binance Positions (Desktop) */}
      {binancePositions.length > 0 && (
        <div className="hidden md:block mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Live Binance Positions</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {binancePositions.map((pos, idx) => (
              <div key={`${pos.symbol}-${pos.side}-${pos.leverage}-${idx}`} className="crypto-card bg-emerald-500/5 border-emerald-500/20 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-100">{pos.symbol}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className={cn("text-xs font-mono font-bold", pos.unrealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    ${Number(pos.unrealizedPnl).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mb-2">
                  <span>{pos.side.toUpperCase()} {pos.leverage}x</span>
                  <span className="text-rose-400 font-bold">
                    Liq: {(Number(pos.liquidationPrice) || 0) > 0 ? `$${Number(pos.liquidationPrice).toLocaleString()}` : 'None'}
                  </span>
                </div>
                <button 
                  onClick={() => setLoggingPosition(pos)}
                  className="w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[9px] font-bold uppercase rounded border border-emerald-500/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-2.5 h-2.5" />
                  Add to Journal
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Table (Desktop) */}
      <div className="crypto-card p-0 overflow-hidden border-zinc-800/50 hidden md:block">
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
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase">Eff% / Slip</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase">Media</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredTrades.length > 0 ? filteredTrades.map((t: Trade, idx) => (
                <tr key={`${t.id}-${t.symbol}-${t.direction}-${t.date}-${idx}`} className="hover:bg-zinc-800/20 group transition-colors">
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-100">{t.symbol}</span>
                        {isPositionLive(t) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", 
                          t.direction === 'LONG' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        )}>
                          {t.direction}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{t.leverage}x</span>
                        <span className={cn("text-[9px] font-bold px-1 rounded border", 
                          t.marginMode === 'ISOLATED' ? "border-amber-500/30 text-amber-500" : "border-blue-500/30 text-blue-500"
                        )}>
                          {t.marginMode === 'ISOLATED' ? 'ISO' : 'CROSS'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-3">$</span>
                        <span className="text-xs text-zinc-100 font-mono">${(t.riskAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-3">M</span>
                        <span className="text-xs text-zinc-100 font-mono">${((t.initialMargin || 0) + (t.addedMargin || 0)).toFixed(2)}</span>
                        {(t.addedMargin || 0) > 0 && (
                          <span className="text-[9px] text-emerald-500 font-bold">+{(t.addedMargin || 0).toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-4">EP</span>
                        <span className="text-xs text-zinc-100 font-mono">{(t.entryPrice || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-4">SL</span>
                        <span className="text-xs text-zinc-100 font-mono text-rose-400">{(t.stopLoss || 0).toLocaleString()}</span>
                      </div>
                      {t.takeProfit && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 font-mono w-4">TP</span>
                          <span className="text-xs text-zinc-100 font-mono text-emerald-400">{(t.takeProfit || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {t.status === 'OPEN' && (t.liquidationPrice || 0) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-500 font-bold font-mono w-4">LQ</span>
                          <span className="text-xs text-amber-500 font-mono font-bold">{(t.liquidationPrice || 0).toLocaleString()}</span>
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
                      <span className="text-xs font-mono font-bold text-zinc-100">P: {(t.plannedRR || 0).toFixed(2)}R</span>
                      {t.status === 'CLOSED' && (
                        <span className={cn("text-xs font-mono font-bold", (t.actualRR || 0) >= (t.plannedRR || 0) ? "text-emerald-500" : "text-rose-500")}>
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
                        <span className={cn("text-xs font-mono font-bold", (t.netPnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {(t.netPnl || 0) >= 0 ? '+' : ''}${(t.netPnl || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-zinc-500">Net PNL</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {t.status === 'CLOSED' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-zinc-100">{t.exitEfficiency?.toFixed(0)}%</span>
                          <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden md:block">
                            <div 
                              className="h-full bg-emerald-500" 
                              style={{ width: `${Math.min(100, t.exitEfficiency || 0)}%` }} 
                            />
                          </div>
                        </div>
                        {t.slippagePercent !== undefined && (
                          <span className={cn("text-[9px] font-mono", t.slippagePercent > 0.1 ? "text-rose-500" : "text-zinc-500")}>
                            Slip: {(t.slippagePercent || 0).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      {t.entryImage1h && (
                        <div 
                          onClick={() => setFullScreenImage(t.entryImage1h!)}
                          className="w-10 h-7 rounded border border-emerald-500/30 overflow-hidden cursor-pointer hover:border-emerald-500 transition-colors bg-zinc-950"
                          title="View Entry Screenshot"
                        >
                          <img src={t.entryImage1h} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {t.exitImage5min && (
                        <div 
                          onClick={() => setFullScreenImage(t.exitImage5min!)}
                          className="w-10 h-7 rounded border border-rose-500/30 overflow-hidden cursor-pointer hover:border-rose-500 transition-colors bg-zinc-950"
                          title="View Exit Screenshot"
                        >
                          <img src={t.exitImage5min} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {!t.entryImage1h && !t.exitImage5min && (
                        <div className="w-10 h-7 rounded border border-zinc-800 flex items-center justify-center bg-zinc-950/50 opacity-20">
                          <ImageIcon className="w-3 h-3 text-zinc-500" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {t.status === 'OPEN' && (
                        <>
                          <button 
                            onClick={() => setClosingTrade(t)}
                            className="text-emerald-500 hover:text-emerald-400 transition-colors"
                            title="Close Trade"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          {t.marginMode === 'ISOLATED' && (
                            <button 
                              onClick={() => setAddingMarginTrade(t)}
                              className="text-amber-500 hover:text-amber-400 transition-colors"
                              title="Add Margin"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </>
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
                  value={isNaN(Number(editedPnl)) ? '' : editedPnl}
                  onChange={(e) => setEditedPnl(e.target.value)}
                  className="input-field w-full text-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Fees (USDT)</label>
                <input 
                  type="number"
                  value={isNaN(Number(editedFees)) ? '' : editedFees}
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

      {addingMarginTrade && (
        <AddMarginModal 
          trade={addingMarginTrade}
          onClose={() => setAddingMarginTrade(null)}
          onSave={onUpdateTrade}
        />
      )}

      {closingTrade && (
        <CloseTradeModal 
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onSave={(data) => {
            onUpdateTrade({ ...closingTrade, ...data } as Trade);
            setClosingTrade(null);
          }}
          showNotification={showNotification}
        />
      )}

      {editingTrade && (
        <EditTradeModal 
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSave={(updated) => {
            onUpdateTrade(updated);
            setEditingTrade(null);
          }}
          showNotification={showNotification}
        />
      )}

      {reviewTrade && (
        <ReviewTradeModal 
          trade={reviewTrade}
          onClose={() => setReviewTrade(null)}
        />
      )}

      {loggingPosition && loggingResults && (
        <LogTradeModal 
          results={loggingResults}
          symbol={loggingPosition.symbol}
          direction={loggingPosition.side.toUpperCase()}
          leverage={loggingPosition.leverage}
          entryPrice={Number(loggingPosition.entryPrice)}
          stopLoss={0}
          takeProfit={0}
          currentBalance={currentBalance}
          onClose={() => setLoggingPosition(null)}
          onSave={(trade: Trade) => {
            onLogTrade(trade);
            setLoggingPosition(null);
          }}
          showNotification={showNotification}
        />
      )}

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/95 backdrop-blur-sm"
            onClick={() => setFullScreenImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setFullScreenImage(null)}
                className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors bg-white/10 rounded-full backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={fullScreenImage} 
                alt="Full Screen" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/50 text-xs font-medium">
                Click anywhere outside to close
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
