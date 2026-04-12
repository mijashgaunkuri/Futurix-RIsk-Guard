import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { Trade } from '../../types';
import { SYMBOL_MMR_TIERS } from '../../constants';

interface AddMarginModalProps {
  trade: Trade;
  onClose: () => void;
  onSave: (updated: Trade) => void;
}

export const AddMarginModal = ({ trade, onClose, onSave }: AddMarginModalProps) => {
  const [amount, setAmount] = useState<string>('');
  
  const handleSave = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    const newAddedMargin = (trade.addedMargin || 0) + val;
    const totalMargin = trade.initialMargin + newAddedMargin;
    
    // Recalculate Liquidation Price
    // We need to re-estimate maintenance margin based on notional value
    const tiers = SYMBOL_MMR_TIERS[trade.symbol] || SYMBOL_MMR_TIERS['DEFAULT'];
    const tier = tiers.find(t => trade.notionalValue <= t.bracket) || tiers[tiers.length - 1];
    const mmr = tier.mmr;
    const maintenanceAmount = tier.maintenanceAmount;
    
    // Approximate liquidation fee (taker fee)
    // We don't have takerFee here, but we can assume a standard 0.05% or use what's in the trade if we stored it.
    const liqFee = trade.notionalValue * 0.0005; 
    const maintenanceMargin = (trade.notionalValue * mmr) - maintenanceAmount + liqFee;

    const newLiquidationPrice = trade.direction === 'LONG'
      ? trade.entryPrice - ((totalMargin - maintenanceMargin) / trade.quantity)
      : trade.entryPrice + ((totalMargin - maintenanceMargin) / trade.quantity);

    const updated: Trade = {
      ...trade,
      addedMargin: newAddedMargin,
      liquidationPrice: Math.max(0, newLiquidationPrice)
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-500" />
            Add Margin: {trade.symbol}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <RefreshCw className="w-5 h-5 rotate-45" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
            <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
              <span>Current Margin</span>
              <span className="text-zinc-100">${(trade.initialMargin + (trade.addedMargin || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
              <span>Mode</span>
              <span className="text-emerald-500">{trade.marginMode}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount to Add (USDT)</label>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full text-lg font-mono"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <p className="text-[10px] text-zinc-500 italic">
            Adding margin will lower your liquidation price for LONGs or raise it for SHORTs.
          </p>
        </div>
        <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={!amount || parseFloat(amount) <= 0}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
};
