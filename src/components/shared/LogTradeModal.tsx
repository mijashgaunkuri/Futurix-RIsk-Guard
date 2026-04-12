import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, Trash2, Upload, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Trade, TradeDirection } from '../../types';
import { STRATEGIES, TIMEFRAMES, EMOTIONS, PREDEFINED_TAGS } from '../../constants';
import { cn } from '../../lib/utils';

interface LogTradeModalProps {
  results: any;
  symbol: string;
  direction: TradeDirection;
  leverage: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  currentBalance: number;
  onClose: () => void;
  onSave: (trade: Trade) => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const LogTradeModal = ({ 
  results, 
  symbol, 
  direction, 
  leverage, 
  entryPrice, 
  stopLoss, 
  takeProfit, 
  currentBalance, 
  onClose, 
  onSave, 
  showNotification 
}: LogTradeModalProps) => {
  const [expectedEntryPrice, setExpectedEntryPrice] = useState(entryPrice.toString());
  const [strategy, setStrategy] = useState(STRATEGIES[0]);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[2]);
  const [notes, setNotes] = useState('');
  const [emotion, setEmotion] = useState(EMOTIONS[4]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [updateGlobalBalance, setUpdateGlobalBalance] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [entryImage1h, setEntryImage1h] = useState<string | null>(null);

  useEffect(() => {
    if (strategy === 'CRT+TBS' && !['1h', '5m'].includes(timeframe)) {
      setTimeframe('1h');
    }
  }, [strategy, timeframe]);

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
    const trade: Trade = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      symbol,
      direction,
      leverage: results.finalLeverage,
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
      fees: results.entryFee, // Use calculated entry fee
      netPnl: 0,
      strategy,
      timeframe,
      notes,
      emotion,
      tags,
      status: 'OPEN',
      marginMode: results.marginMode,
      addedMargin: 0,
      plannedRR: results.plannedRR,
      balanceBefore: currentBalance,
      safetyBufferAtEntry: results.safetyBuffer,
      liqDistAtEntry: results.distToLiq,
      entryImage1h: entryImage1h || undefined,
      // Real Binance matching update – April 2026
      entryOrderType: results.entryOrderType || 'TAKER',
      exitTpOrderType: results.exitTpOrderType || 'TAKER',
      exitSlOrderType: results.exitSlOrderType || 'TAKER',
      estimatedHoldHours: results.estimatedHoldHours || 24,
      fundingRatePerInterval: results.fundingRatePerInterval || 0.01,
      fundingIntervalHours: results.fundingIntervalHours || 8,
      useDiscount: results.useDiscount || false,
      makerFee: results.makerFee || 0.02,
      takerFee: results.takerFee || 0.05,
      fundingPnL: 0,
      effectiveEntryPrice: results.effectiveEntryPrice || entryPrice,
      effectiveExitPrice: results.effectiveExitPrice || (takeProfit || stopLoss),
      atr: results.atr,
      avgOrderBookDepth: results.avgOrderBookDepth,
      avgFundingRate: results.avgFundingRate,
      adjustedRiskPercent: results.adjustedRiskPercent
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
              <span className="font-bold text-emerald-500">{takeProfit > 0 ? takeProfit.toFixed(4) : 'N/A'}</span>
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
                  value={isNaN(Number(expectedEntryPrice)) ? '' : expectedEntryPrice}
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
                <label className="text-xs font-semibold text-zinc-500 uppercase">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((t, idx) => (
                    <span key={`${t}-${idx}`} className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                      {t}
                      <button onClick={() => setTags(tags.filter(tag => tag !== t))}><Trash2 className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {PREDEFINED_TAGS.filter(t => !tags.includes(t)).slice(0, 5).map((t, idx) => (
                    <button 
                      key={`${t}-${idx}`} 
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

          <div className="space-y-4">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Trade Media (Optional)</label>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold">Entry Screenshot (1h)</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer">
                      <div className="border-2 border-dashed border-zinc-800 rounded-xl p-4 hover:border-emerald-500/50 transition-all flex flex-col items-center gap-2 bg-zinc-950/50">
                        <Upload className="w-5 h-5 text-zinc-500" />
                        <span className="text-[10px] text-zinc-400">Upload 1h Entry</span>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setEntryImage1h)} />
                    </label>
                    {entryImage1h && (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 shrink-0">
                        <img src={entryImage1h} alt="Entry 1h" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button onClick={() => setEntryImage1h(null)} className="absolute top-0.5 right-0.5 p-0.5 bg-rose-500 rounded-full text-white"><Trash2 className="w-2.5 h-2.5" /></button>
                      </div>
                    )}
                  </div>
                  <input 
                    type="text"
                    value={entryImage1h && !entryImage1h.startsWith('data:') ? entryImage1h : ''}
                    onChange={(e) => setEntryImage1h(e.target.value)}
                    className="input-field w-full text-[10px]"
                    placeholder="Or paste 1h image URL..."
                  />
                </div>
              </div>
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
