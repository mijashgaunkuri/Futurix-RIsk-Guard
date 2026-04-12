import React from 'react';
import { 
  Eye, X, TrendingUp, TrendingDown, Clock, Target, Shield, 
  Brain, MessageSquare, Tag, Smile, ShieldCheck, AlertTriangle, ImageIcon 
} from 'lucide-react';
import { format } from 'date-fns';
import { Trade } from '../../types';
import { cn } from '../../lib/utils';

interface ReviewTradeModalProps {
  trade: Trade;
  onClose: () => void;
}

export const ReviewTradeModal = ({ trade, onClose }: ReviewTradeModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-xl">
              <Eye className="w-5 h-5 text-zinc-100" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Trade Review: {trade.symbol}
                <span className={cn("text-xs px-2 py-0.5 rounded", 
                  trade.direction === 'LONG' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {trade.direction}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 font-mono">{format(new Date(trade.date), 'MMMM dd, yyyy HH:mm:ss')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-6 h-6 text-zinc-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Status</span>
              <div className={cn("text-lg font-bold", trade.status === 'OPEN' ? "text-amber-500" : "text-zinc-100")}>
                {trade.status}
              </div>
            </div>
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Net PNL</span>
              <div className={cn("text-lg font-mono font-bold", (trade.netPnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {(trade.netPnl || 0) >= 0 ? '+' : ''}${(trade.netPnl || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Actual RR</span>
              <div className="text-lg font-mono font-bold text-blue-500">
                {trade.actualRR?.toFixed(2) || '0.00'}R
              </div>
            </div>
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Efficiency</span>
              <div className="text-lg font-mono font-bold text-amber-500">
                {trade.exitEfficiency?.toFixed(1) || '0.0'}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Execution Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4" />
                Execution Details
              </h3>
              <div className="space-y-3 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Entry Price</span>
                  <span className="text-sm font-mono font-bold">${trade.entryPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Stop Loss</span>
                  <span className="text-sm font-mono font-bold text-rose-500">${trade.stopLoss.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Take Profit</span>
                  <span className="text-sm font-mono font-bold text-emerald-500">${trade.takeProfit?.toLocaleString() || 'N/A'}</span>
                </div>
                {trade.status === 'CLOSED' && (
                  <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                    <span className="text-xs text-zinc-500">Exit Price</span>
                    <span className="text-sm font-mono font-bold text-zinc-100">${trade.exitPrice?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Quantity</span>
                  <span className="text-sm font-mono font-bold">{trade.quantity.toLocaleString()} {trade.symbol.replace('USDT', '')}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-zinc-500">Leverage / Margin</span>
                  <span className="text-sm font-mono font-bold">{trade.leverage}x ({trade.marginMode})</span>
                </div>
              </div>
            </div>

            {/* Risk & Friction */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Risk & Friction
              </h3>
              <div className="space-y-3 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Risk Amount</span>
                  <span className="text-sm font-mono font-bold text-rose-500">-${trade.riskAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Initial Margin</span>
                  <span className="text-sm font-mono font-bold">${trade.initialMargin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Total Fees</span>
                  <span className="text-sm font-mono font-bold text-rose-400">-${trade.fees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Slippage</span>
                  <span className="text-sm font-mono font-bold text-rose-400">
                    {trade.slippageUsdt ? `-$${trade.slippageUsdt.toFixed(2)}` : 'N/A'} 
                    {trade.slippagePercent ? ` (${trade.slippagePercent.toFixed(2)}%)` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-zinc-500">Funding PNL</span>
                  <span className={cn("text-sm font-mono font-bold", (trade.fundingPnL || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {(trade.fundingPnL || 0) >= 0 ? '+' : ''}${(trade.fundingPnL || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Psychology & Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Psychology
              </h3>
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400">Emotion:</span>
                  <span className="text-xs font-bold text-zinc-100">{trade.emotion}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400">Followed Plan:</span>
                  <span className={cn("text-xs font-bold", 
                    trade.followedPlan === 'YES' ? "text-emerald-500" : 
                    trade.followedPlan === 'PARTIAL' ? "text-amber-500" : "text-rose-500"
                  )}>
                    {trade.followedPlan || 'N/A'}
                  </span>
                </div>
                {trade.isRevengeTrade && (
                  <div className="flex items-center gap-2 text-rose-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Revenge Trade Detected</span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Notes & Reflection
              </h3>
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-4">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Entry Thesis</span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{trade.notes || 'No entry notes provided.'}</p>
                </div>
                {trade.status === 'CLOSED' && (
                  <>
                    <div className="pt-4 border-t border-zinc-900">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Exit Rationale</span>
                      <p className="text-sm text-zinc-300 leading-relaxed">{trade.exitRationale || 'No exit rationale provided.'}</p>
                    </div>
                    <div className="pt-4 border-t border-zinc-900">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Post-Trade Reflection</span>
                      <p className="text-sm text-zinc-300 leading-relaxed">{trade.postTradeReflection || 'No post-trade reflection provided.'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Media */}
          {(trade.entryImage1h || trade.exitImage5min) && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Trade Media
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {trade.entryImage1h && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Entry (1h)</span>
                    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video">
                      <img src={trade.entryImage1h} alt="Entry 1h" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                )}
                {trade.exitImage5min && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Exit (5min)</span>
                    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video">
                      <img src={trade.exitImage5min} alt="Exit 5min" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {trade.tags && trade.tags.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {trade.tags.map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-xs font-medium border border-zinc-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 flex justify-end sticky bottom-0 bg-zinc-900">
          <button onClick={onClose} className="btn-primary px-8">Close Review</button>
        </div>
      </div>
    </div>
  );
};
