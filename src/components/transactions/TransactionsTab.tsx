import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Clock, Percent, Shield, 
  CircleDollarSign, ArrowLeftRight, Download, RefreshCw, Search, Copy, History 
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

interface TransactionsTabProps {
  transactions: any[];
  isSyncing: boolean;
  onRefresh: () => void;
}

export const TransactionsTab = ({ transactions, isSyncing, onRefresh }: TransactionsTabProps) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.type === 'FUNDING_FEE') acc.funding += tx.income;
      if (tx.type === 'REALIZED_PNL') acc.pnl += tx.income;
      if (tx.type === 'COMMISSION') acc.commission += tx.income;
      return acc;
    }, { funding: 0, pnl: 0, commission: 0 });
  }, [transactions]);

  const filteredTransactions = transactions.filter(tx => {
    const matchesFilter = filter === 'ALL' || tx.type === filter;
    const matchesSearch = tx.description.toLowerCase().includes(search.toLowerCase()) || 
                         tx.asset.toLowerCase().includes(search.toLowerCase()) ||
                         tx.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ['Date', 'ID', 'Type', 'Description', 'Amount', 'Asset'];
    const rows = filteredTransactions.map(tx => [
      format(new Date(tx.time), 'yyyy-MM-dd HH:mm:ss'),
      tx.id,
      tx.type,
      tx.description,
      tx.income.toFixed(8),
      tx.asset
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `binance_transactions_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getIcon = (type: string, income: number) => {
    switch (type) {
      case 'TRANSFER': return <ArrowLeftRight className="w-4 h-4 text-blue-500" />;
      case 'REALIZED_PNL': return income >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-rose-500" />;
      case 'FUNDING_FEE': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'COMMISSION': return <Percent className="w-4 h-4 text-purple-500" />;
      case 'INSURANCE_CLEAR': return <Shield className="w-4 h-4 text-zinc-400" />;
      default: return <CircleDollarSign className="w-4 h-4 text-zinc-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Refresh */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">Live Ledger</span>
          </div>
          <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">
            Account Activity
          </h2>
          <p className="text-sm text-zinc-500 font-medium">Historical record of all futures wallet movements and fees.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={exportToCSV}
            className="btn-secondary flex items-center gap-2 flex-1 md:flex-none justify-center border-zinc-800 hover:bg-zinc-800/50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button 
            onClick={onRefresh}
            disabled={isSyncing}
            className={cn(
              "btn-primary flex items-center gap-2 flex-1 md:flex-none justify-center",
              isSyncing && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary Stats - Technical Grid Style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/20">
        <div className="p-6 border-b sm:border-b-0 sm:border-r border-zinc-800 hover:bg-zinc-800/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic font-serif">Realized PnL</span>
            <TrendingUp className="w-4 h-4 text-emerald-500/30 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className={cn("text-2xl font-mono font-bold tracking-tighter", stats.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(4)}
            <span className="text-xs ml-2 opacity-50">USDT</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono">NET PROFIT/LOSS (7D)</div>
        </div>
        <div className="p-6 border-b sm:border-b-0 sm:border-r border-zinc-800 hover:bg-zinc-800/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic font-serif">Funding Fees</span>
            <Clock className="w-4 h-4 text-amber-500/30 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className={cn("text-2xl font-mono font-bold tracking-tighter", stats.funding >= 0 ? "text-emerald-500" : "text-amber-500")}>
            {stats.funding.toFixed(4)}
            <span className="text-xs ml-2 opacity-50">USDT</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono">TOTAL FUNDING PAID/REC</div>
        </div>
        <div className="p-6 hover:bg-zinc-800/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic font-serif">Commissions</span>
            <Percent className="w-4 h-4 text-purple-500/30 group-hover:text-purple-500 transition-colors" />
          </div>
          <div className="text-2xl font-mono font-bold tracking-tighter text-rose-500">
            {stats.commission.toFixed(4)}
            <span className="text-xs ml-2 opacity-50">USDT</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono">TRADING FEES INCURRED</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-end">
        <div className="w-full lg:flex-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block italic font-serif">Search Ledger</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filter by ID, Asset, or Description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
            />
          </div>
        </div>
        <div className="w-full lg:w-auto">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block italic font-serif">Filter by Type</label>
          <div className="flex gap-1 bg-zinc-950/50 p-1 border border-zinc-800 rounded-xl overflow-x-auto no-scrollbar">
            {['ALL', 'REALIZED_PNL', 'FUNDING_FEE', 'COMMISSION', 'TRANSFER'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all",
                  filter === t 
                    ? "bg-zinc-800 text-emerald-400 shadow-lg" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table - Mission Control Style */}
      <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0 opacity-30" />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/50 border-b border-zinc-800">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic font-serif">Timestamp & ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic font-serif">Classification</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic font-serif">Event Description</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic font-serif text-right">Net Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                        <History className="w-8 h-8 text-zinc-700" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No Records Found</div>
                        <div className="text-zinc-600 text-[10px] italic font-serif">Adjust your filters or search query to see results</div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, idx) => (
                  <tr key={`${tx.id}-${tx.type}-${tx.time}-${idx}`} className="hover:bg-emerald-500/[0.02] transition-colors group border-l-2 border-l-transparent hover:border-l-emerald-500">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center group-hover:border-emerald-500/30 transition-all">
                          {getIcon(tx.type, tx.income)}
                        </div>
                        <div>
                          <div className="text-xs font-mono font-bold text-zinc-100">{format(new Date(tx.time), 'yyyy-MM-dd HH:mm:ss')}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-zinc-500 font-mono tracking-tighter bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{tx.id}</span>
                            <button 
                              onClick={() => navigator.clipboard.writeText(tx.id)}
                              className="text-zinc-600 hover:text-emerald-500 transition-colors p-1 hover:bg-zinc-800 rounded"
                              title="Copy Transaction ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase border w-fit tracking-wider",
                          tx.type === 'TRANSFER' ? "bg-blue-500/5 text-blue-500 border-blue-500/20" :
                          tx.type === 'REALIZED_PNL' ? (tx.income >= 0 ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" : "bg-rose-500/5 text-rose-500 border-rose-500/20") :
                          tx.type === 'FUNDING_FEE' ? "bg-amber-500/5 text-amber-500 border-amber-500/20" :
                          tx.type === 'COMMISSION' ? "bg-purple-500/5 text-purple-500 border-purple-500/20" :
                          "bg-zinc-800/50 text-zinc-400 border-zinc-700/50"
                        )}>
                          {tx.type.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-emerald-500" />
                          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Completed</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="max-w-md">
                        <div className="text-xs text-zinc-300 font-medium leading-relaxed" title={tx.description}>
                          {tx.description}
                        </div>
                        <div className="text-[9px] text-zinc-600 mt-1 uppercase tracking-tighter font-mono">Asset: {tx.asset}</div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <div className={cn(
                          "text-sm font-mono font-bold tracking-tighter",
                          tx.income >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {tx.income >= 0 ? '+' : ''}{tx.income.toFixed(8)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-bold mt-1">{tx.asset}</div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Info */}
        <div className="bg-zinc-900/50 px-6 py-3 border-t border-zinc-800 flex justify-between items-center">
          <div className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
            Showing {filteredTransactions.length} of {transactions.length} Records
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold">Secure Connection</span>
            </div>
            <div className="text-[9px] text-zinc-500 uppercase font-bold">Ledger Version 2.4.0</div>
          </div>
        </div>
      </div>
    </div>
  );
};
