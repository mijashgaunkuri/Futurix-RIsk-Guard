import React, { useState, useMemo } from 'react';
import { CheckCircle2, RefreshCw, Upload, Trash2 } from 'lucide-react';
import { Trade } from '../../types';
import { cn } from '../../lib/utils';
import { calculateTradeMetrics } from '../../services/tradeService';

interface CloseTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onSave: (data: Partial<Trade>) => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CloseTradeModal = ({ trade, onClose, onSave, showNotification }: CloseTradeModalProps) => {
  const [exitPrice, setExitPrice] = useState(trade.exitPrice?.toString() || '');
  const [expectedExitPrice, setExpectedExitPrice] = useState(trade.takeProfit?.toString() || '');
  const [fees, setFees] = useState('0.5');
  const [highestPrice, setHighestPrice] = useState('');
  const [lowestPrice, setLowestPrice] = useState('');
  const [postReflection, setPostReflection] = useState('');
  const [exitRationale, setExitRationale] = useState('');
  const [exitImage5min, setExitImage5min] = useState<string | undefined>(undefined);
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

    const expectedExit = parseFloat(expectedExitPrice) || exit;
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

    // Slippage Calculations
    const entrySlippageUsdt = trade.direction === 'LONG'
      ? (trade.entryPrice - (trade.expectedEntryPrice || trade.entryPrice)) * trade.quantity
      : ((trade.expectedEntryPrice || trade.entryPrice) - trade.entryPrice) * trade.quantity;
    
    const exitSlippageUsdt = trade.direction === 'LONG'
      ? (expectedExit - exit) * trade.quantity
      : (exit - expectedExit) * trade.quantity;

    const totalSlippageUsdt = entrySlippageUsdt + exitSlippageUsdt;
    const slippagePercent = (totalSlippageUsdt / trade.notionalValue) * 100;

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
      expectedExitPrice: expectedExit,
      highestPriceReached: high,
      lowestPriceReached: low,
      mfeUsdt: trade.direction === 'LONG' ? (high - trade.entryPrice) * trade.quantity : (trade.entryPrice - low) * trade.quantity,
      maeUsdt: trade.direction === 'LONG' ? (trade.entryPrice - low) * trade.quantity : (high - trade.entryPrice) * trade.quantity,
      mfePercent,
      maePercent,
      slippageUsdt: totalSlippageUsdt,
      slippagePercent,
      pnl: metrics.pnl,
      fees: totalFees,
      netPnl: metrics.netPnl,
      exitEfficiency: metrics.exitEfficiency,
      actualRR: metrics.actualRR,
      postTradeReflection: postReflection,
      exitRationale,
      exitImage5min,
      isRevengeTrade: isRevenge,
      followedPlan,
      isBreakevenMoved,
      partialExitsCount: parseInt(partialExits) || 0,
      durationMinutes: Math.floor((new Date().getTime() - new Date(trade.date).getTime()) / 60000),
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
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
                value={isNaN(Number(exitPrice)) ? '' : exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="input-field w-full text-lg font-mono"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Planned Exit (for Slippage)</label>
              <input 
                type="number"
                value={isNaN(Number(expectedExitPrice)) ? '' : expectedExitPrice}
                onChange={(e) => setExpectedExitPrice(e.target.value)}
                className="input-field w-full text-lg font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Total Fees (USDT)</label>
              <input 
                type="number"
                value={isNaN(Number(fees)) ? '' : fees}
                onChange={(e) => setFees(e.target.value)}
                className="input-field w-full text-lg font-mono"
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

          <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase">Highest Price Reached (MFE)</label>
              <input 
                type="number"
                value={isNaN(Number(highestPrice)) ? '' : highestPrice}
                onChange={(e) => setHighestPrice(e.target.value)}
                className="input-field w-full text-sm font-mono"
                placeholder="Max price during trade"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase">Lowest Price Reached (MAE)</label>
              <input 
                type="number"
                value={isNaN(Number(lowestPrice)) ? '' : lowestPrice}
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
                  value={isNaN(Number(partialExits)) ? '' : partialExits}
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
            <label className="text-xs font-semibold text-zinc-500 uppercase">Exit Screenshot (5min)</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <label className="flex-1 cursor-pointer">
                  <div className="border-2 border-dashed border-zinc-800 rounded-xl p-4 hover:border-emerald-500/50 transition-all flex flex-col items-center gap-2 bg-zinc-950/50">
                    <Upload className="w-6 h-6 text-zinc-500" />
                    <span className="text-xs text-zinc-400">Upload 5min Exit Screenshot</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setExitImage5min)} />
                </label>
                {exitImage5min && (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-800 shrink-0">
                    <img src={exitImage5min} alt="Exit 5min" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => setExitImage5min(undefined)}
                      className="absolute top-1 right-1 p-1 bg-rose-500 rounded-full text-white hover:bg-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <input 
                type="text"
                value={exitImage5min && !exitImage5min.startsWith('data:') ? exitImage5min : ''}
                onChange={(e) => setExitImage5min(e.target.value)}
                className="input-field w-full text-xs"
                placeholder="Or paste 5min exit image URL..."
              />
            </div>
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
