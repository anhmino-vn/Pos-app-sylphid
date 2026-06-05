import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer } from 'lucide-react';

export interface PrintConfig {
  size: 'A4' | 'A5' | 'custom';
  width?: string;
  height?: string;
}

interface PrintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: PrintConfig) => void;
}

export function PrintConfigModal({ isOpen, onClose, onConfirm }: PrintConfigModalProps) {
  const [size, setSize] = useState<'A4' | 'A5' | 'custom'>('A4');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  const handleConfirm = () => {
    onConfirm({ size, width, height });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }} 
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6"
          >
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-black text-slate-900 uppercase">Cấu hình in ấn</h3>
               <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-colors">
                  <X className="w-4 h-4" />
               </button>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Khổ giấy</label>
                  <select 
                     value={size} 
                     onChange={(e) => setSize(e.target.value as any)} 
                     className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
                  >
                     <option value="A4">A4 (210 x 297 mm)</option>
                     <option value="A5">A5 (148 x 210 mm)</option>
                     <option value="custom">Tùy chỉnh</option>
                  </select>
               </div>

               {size === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Chiều Rộng (mm)</label>
                        <input 
                           type="number" 
                           value={width} 
                           onChange={(e) => setWidth(e.target.value)} 
                           placeholder="VD: 80"
                           className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Chiều Cao (mm)</label>
                        <input 
                           type="number" 
                           value={height} 
                           onChange={(e) => setHeight(e.target.value)} 
                           placeholder="VD: 200"
                           className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                     </div>
                  </div>
               )}

               <button 
                  onClick={handleConfirm}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
               >
                  <Printer className="w-4 h-4" />Xác nhận in
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
