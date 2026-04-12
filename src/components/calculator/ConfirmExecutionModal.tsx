import React from 'react';
import { motion } from 'motion/react';
import { Zap, Plus, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmExecutionModalProps {
  results: any;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  isExecuting: boolean;
  marginMode: 'ISOLATED' | 'CROSS';
  onClose: () => void;
  onConfirm: () => void;
  pricePrecision: number;
  quantityPrecision: number;
}

export const ConfirmExecutionModal: React.FC<ConfirmExecutionModalProps> = ({ 
  results, 
  symbol, 
  direction, 
  leverage, 
  entryPrice, 
  stopLoss, 
  takeProfit, 
  isExecuting, 
  marginMode,
  onClose, 
  onConfirm,
  pricePrecision,
  quantityPrecision
}) => {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-2xl",
              direction === 'LONG' ? "bg-emerald-500/10" : "bg-rose-500/10"
            )}>
              {direction === 'LONG' ? <TrendingUp className="w-6 h-6 text-emerald-500" /> : <TrendingDown className="w-6 h-6 text-rose-500" />}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">Confirm Execution</h2>
              <p className="text-zinc-500 text-sm font-bold">{direction} {symbol} • {marginMode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45 text-zinc-500" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Quantity</p>
              <p className="text-2xl font-black text-white">{results.quantity.toFixed(quantityPrecision)} <span className="text-sm text-zinc-500">{symbol.replace('USDT', '')}</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Leverage</p>
              <p className="text-2xl font-black text-emerald-500">{leverage}x</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Entry Price</p>
              <p className="text-2xl font-black text-white">${entryPrice.toFixed(pricePrecision)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stop Loss</p>
              <p className="text-2xl font-black text-rose-500">${stopLoss.toFixed(pricePrecision)}</p>
            </div>
          </div>

          <div className="p-6 bg-zinc-950 rounded-3xl border border-zinc-800 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-400">Required Margin</span>
              <span className="text-lg font-black text-emerald-500">${results.initialMargin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-400">Est. Entry Fee</span>
              <span className="text-sm font-bold text-zinc-200">${results.entryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-400">Liquidation Price</span>
              <span className="text-sm font-bold text-rose-500">${results.liquidationPrice.toFixed(pricePrecision)}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-200/80 leading-relaxed">
              You are about to execute a live trade on Binance Futures. Ensure your API keys have "Enable Futures" permissions.
            </p>
          </div>
        </div>

        <div className="p-8 bg-zinc-950/50 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-black text-zinc-400 hover:bg-zinc-800 transition-all"
          >
            CANCEL
          </button>
          <button 
            onClick={onConfirm}
            disabled={isExecuting}
            className="flex-[2] py-4 bg-emerald-500 text-zinc-950 rounded-2xl font-black text-lg hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3"
          >
            {isExecuting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
            CONFIRM & EXECUTE
          </button>
        </div>
      </motion.div>
    </div>
  );
};
