import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, Plus, Tag, Smile, Clock, Target, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STRATEGIES, TIMEFRAMES, EMOTIONS } from '../../constants';
import { Trade } from '../../types';

interface LogTradeModalProps {
  results: any;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  currentBalance: number;
  addedMargin: number;
  onClose: () => void;
  onSave: (trade: Trade) => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const LogTradeModal: React.FC<LogTradeModalProps> = ({ 
  results, 
  symbol, 
  direction, 
  leverage, 
  entryPrice, 
  stopLoss, 
  takeProfit, 
  currentBalance, 
  addedMargin,
  onClose, 
  onSave, 
  showNotification 
}) => {
  const [expectedEntryPrice, setExpectedEntryPrice] = useState(entryPrice.toString());
  const [strategy, setStrategy] = useState(STRATEGIES[0]);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[2]);
  const [notes, setNotes] = useState('');
  const [emotion, setEmotion] = useState(EMOTIONS[4]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
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
      fees: results.entryFee,
      netPnl: 0,
      strategy,
      timeframe,
      notes,
      emotion,
      tags,
      status: 'OPEN',
      marginMode: results.marginMode,
      addedMargin,
      plannedRR: results.plannedRR,
      balanceBefore: currentBalance,
      safetyBufferAtEntry: results.safetyBuffer,
      liqDistAtEntry: results.distToLiq,
      entryImage1h: entryImage1h || undefined,
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            Log Trade to Journal
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <Plus className="w-5 h-5 rotate-45 text-zinc-500" />
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
              <span className="font-bold text-emerald-500">{takeProfit > 0 ? `$${takeProfit.toFixed(4)}` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Risk</span>
              <span className="font-bold text-rose-500">-${results.riskAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Expected Entry Price</label>
                <input 
                  type="number"
                  value={expectedEntryPrice}
                  onChange={(e) => setExpectedEntryPrice(e.target.value)}
                  className="input-field w-full"
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
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => setEmotion(e)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                        emotion === e ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field w-full h-32 resize-none"
                  placeholder="Why are you taking this trade? What is the context?"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Tags</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag(tagInput)}
                    className="input-field flex-1"
                    placeholder="Add tag..."
                  />
                  <button 
                    onClick={() => handleAddTag(tagInput)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(t => (
                    <span key={t} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded-md text-[10px] font-bold flex items-center gap-1">
                      {t}
                      <button onClick={() => setTags(tags.filter(tag => tag !== t))}>
                        <Plus className="w-3 h-3 rotate-45" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Entry Chart (1h)</label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => document.getElementById('entry-img-1h')?.click()}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold"
                  >
                    Upload Image
                  </button>
                  <input 
                    id="entry-img-1h"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setEntryImage1h)}
                  />
                  {entryImage1h && <span className="text-[10px] text-emerald-500 font-bold">Image Attached</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-950/50 flex gap-4 sticky bottom-0 border-t border-zinc-800">
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-black text-zinc-400 hover:bg-zinc-800 transition-all"
          >
            CANCEL
          </button>
          <button 
            onClick={handleSave}
            className="flex-[2] py-4 bg-emerald-500 text-zinc-950 rounded-2xl font-black text-lg hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all"
          >
            LOG TRADE TO JOURNAL
          </button>
        </div>
      </div>
    </div>
  );
};
