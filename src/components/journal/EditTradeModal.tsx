import React, { useState, useMemo } from 'react';
import { Edit3, RefreshCw, Upload, Trash2 } from 'lucide-react';
import { Trade } from '../../types';
import { STRATEGIES, TIMEFRAMES, EMOTIONS } from '../../constants';
import { cn } from '../../lib/utils';
import { calculateTradeMetrics } from '../../services/tradeService';

interface EditTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onSave: (updatedTrade: Trade) => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const EditTradeModal = ({ trade, onClose, onSave, showNotification }: EditTradeModalProps) => {
  const [strategy, setStrategy] = useState(trade.strategy);
  const [timeframe, setTimeframe] = useState(trade.timeframe);
  const [notes, setNotes] = useState(trade.notes);
  const [emotion, setEmotion] = useState(trade.emotion);
  const [tags, setTags] = useState<string[]>(trade.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [marginMode, setMarginMode] = useState<'ISOLATED' | 'CROSS'>(trade.marginMode || 'ISOLATED');
  const [entryImage1h, setEntryImage1h] = useState<string | null>(trade.entryImage1h || null);
  const [exitImage5min, setExitImage5min] = useState<string | null>(trade.exitImage5min || null);
  
  // For CLOSED trades
  const [exitPrice, setExitPrice] = useState(trade.exitPrice?.toString() || '');
  const [expectedExitPrice, setExpectedExitPrice] = useState(trade.expectedExitPrice?.toString() || trade.takeProfit?.toString() || '');
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showNotification("File size too large. Please upload an image smaller than 2MB.", 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
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
      tags,
      marginMode,
      entryImage1h: entryImage1h || undefined,
      exitImage5min: exitImage5min || undefined,
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
        const expectedExit = parseFloat(expectedExitPrice) || exit;
        const mfePercent = trade.direction === 'LONG'
          ? ((high - trade.entryPrice) / trade.entryPrice) * 100
          : ((trade.entryPrice - low) / trade.entryPrice) * 100;
        
        const maePercent = trade.direction === 'LONG'
          ? ((trade.entryPrice - low) / trade.entryPrice) * 100
          : ((high - trade.entryPrice) / trade.entryPrice) * 100;

        // Slippage Calculations
        const entrySlippageUsdt = trade.direction === 'LONG'
          ? (trade.entryPrice - (trade.expectedEntryPrice || trade.entryPrice)) * trade.quantity
          : ((trade.expectedEntryPrice || trade.entryPrice) - trade.entryPrice) * trade.quantity;
        
        const exitSlippageUsdt = trade.direction === 'LONG'
          ? (expectedExit - exit) * trade.quantity
          : (exit - expectedExit) * trade.quantity;

        const totalSlippageUsdt = entrySlippageUsdt + exitSlippageUsdt;
        const slippagePercent = (totalSlippageUsdt / trade.notionalValue) * 100;

        updatedTrade = {
          ...updatedTrade,
          exitPrice: exit,
          expectedExitPrice: expectedExit,
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
          slippageUsdt: totalSlippageUsdt,
          slippagePercent,
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
                <label className="text-xs font-semibold text-zinc-500 uppercase">Margin Mode</label>
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button 
                    onClick={() => setMarginMode('ISOLATED')}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      marginMode === 'ISOLATED' ? "bg-amber-500/10 text-amber-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Isolated
                  </button>
                  <button 
                    onClick={() => setMarginMode('CROSS')}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      marginMode === 'CROSS' ? "bg-blue-500/10 text-blue-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Cross
                  </button>
                </div>
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
                <label className="text-xs font-semibold text-zinc-500 uppercase">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((t, idx) => (
                    <span key={`${t}-${idx}`} className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
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
                    value={isNaN(Number(exitPrice)) ? '' : exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Planned Exit (for Slippage)</label>
                  <input 
                    type="number"
                    value={isNaN(Number(expectedExitPrice)) ? '' : expectedExitPrice}
                    onChange={(e) => setExpectedExitPrice(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Fees (USDT)</label>
                  <input 
                    type="number"
                    value={isNaN(Number(fees)) ? '' : fees}
                    onChange={(e) => setFees(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col justify-center">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-1">Est. Slippage</span>
                  <div className={cn("text-sm font-mono font-bold", (parseFloat(expectedExitPrice) || 0) !== parseFloat(exitPrice) ? "text-rose-500" : "text-zinc-500")}>
                    {(() => {
                      const exit = parseFloat(exitPrice);
                      const expected = parseFloat(expectedExitPrice) || exit;
                      if (isNaN(exit)) return '0.00%';
                      const sUsdt = trade.direction === 'LONG' ? (expected - exit) * trade.quantity : (exit - expected) * trade.quantity;
                      const sPct = (sUsdt / trade.notionalValue) * 100;
                      return `${sPct.toFixed(2)}%`;
                    })()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Highest Price Reached</label>
                  <input 
                    type="number"
                    value={isNaN(Number(highestPrice)) ? '' : highestPrice}
                    onChange={(e) => setHighestPrice(e.target.value)}
                    className="input-field w-full font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Lowest Price Reached</label>
                  <input 
                    type="number"
                    value={isNaN(Number(lowestPrice)) ? '' : lowestPrice}
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

          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Trade Media</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold">Entry (1h)</label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-zinc-800 rounded-xl p-3 hover:border-blue-500/50 transition-all flex flex-col items-center gap-1 bg-zinc-950/50">
                      <Upload className="w-4 h-4 text-zinc-500" />
                      <span className="text-[10px] text-zinc-400">Update 1h</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setEntryImage1h)} />
                  </label>
                  <input 
                    type="text"
                    value={entryImage1h && !entryImage1h.startsWith('data:') ? entryImage1h : ''}
                    onChange={(e) => setEntryImage1h(e.target.value)}
                    className="input-field w-full text-[10px]"
                    placeholder="Or paste 1h URL..."
                  />
                  {entryImage1h && (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-800">
                      <img src={entryImage1h} alt="Entry 1h" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button onClick={() => setEntryImage1h(null)} className="absolute top-1 right-1 p-1 bg-rose-500 rounded-full text-white"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold">Exit (5min)</label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-zinc-800 rounded-xl p-3 hover:border-blue-500/50 transition-all flex flex-col items-center gap-1 bg-zinc-950/50">
                      <Upload className="w-4 h-4 text-zinc-500" />
                      <span className="text-[10px] text-zinc-400">Update 5min</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setExitImage5min)} />
                  </label>
                  <input 
                    type="text"
                    value={exitImage5min && !exitImage5min.startsWith('data:') ? exitImage5min : ''}
                    onChange={(e) => setExitImage5min(e.target.value)}
                    className="input-field w-full text-[10px]"
                    placeholder="Or paste 5min URL..."
                  />
                  {exitImage5min && (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-800">
                      <img src={exitImage5min} alt="Exit 5min" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button onClick={() => setExitImage5min(null)} className="absolute top-1 right-1 p-1 bg-rose-500 rounded-full text-white"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  )}
                </div>
              </div>
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
