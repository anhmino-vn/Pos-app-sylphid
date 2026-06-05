import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, Product, InventoryLog, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Package, 
  Plus, 
  Minus, 
  History, 
  Search, 
  Loader2, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertTriangle,
  X,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  LogIn, 
  LogOut, 
  Truck
} from 'lucide-react';

import { InventoryOverview } from './inventory/InventoryOverview';
import { StockImports } from './inventory/StockImports';
import { StockExports } from './inventory/StockExports';
import { InventoryReconcile } from './inventory/InventoryReconcile';
import { InventoryLogs } from './inventory/InventoryLogs';
import { Suppliers } from './inventory/Suppliers';

export function Inventory() {
  const { tab = 'overview' } = useParams<{ tab: string }>();
  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  
  const tabs = [
    { id: 'overview', name: 'Tổng quan', icon: BarChart2 },
    { id: 'logs', name: 'Biến động kho', icon: History },
    { id: 'imports', name: 'Nhập kho', icon: LogIn },
    { id: 'exports', name: 'Xuất kho', icon: LogOut },
    { id: 'reconcile', name: 'Kiểm kê', icon: RefreshCw },
    { id: 'suppliers', name: 'Nhà cung cấp', icon: Truck },
  ];

  const mainTabs = tabs.slice(0, 2);
  const extraTabs = tabs.slice(2);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-4 sm:-m-6 md:-m-8">
      <div className="shrink-0 bg-[#F8FAFC] pt-4 sm:pt-6 md:pt-8 px-4 sm:px-6 md:px-8 z-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Kho hàng</h1>
            <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">Quản lý nhập xuất, cảnh báo tồn kho và chuỗi cung ứng</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-2 mt-4 sm:mt-6 border-b border-slate-200">
          <div className="flex flex-1 overflow-x-auto scrollbar-none gap-2">
            {mainTabs.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/inventory/${t.id}`)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 sm:px-6 sm:py-3 rounded-t-xl font-bold text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap transition-colors border-b-2",
                  tab === t.id 
                    ? "text-blue-600 border-blue-600 bg-blue-50/50" 
                    : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50"
                )}
              >
                <t.icon className="w-4 h-4 hidden sm:block" />
                {t.name}
              </button>
            ))}
            
            {tab !== 'overview' && tab !== 'logs' && (
              <div className="flex items-center gap-2 px-4 py-3 sm:px-6 sm:py-3 rounded-t-xl font-bold text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap border-b-2 text-blue-600 border-blue-600 bg-blue-50/50">
                 {(() => {
                   const t = extraTabs.find(x => x.id === tab);
                   return t ? <><t.icon className="w-4 h-4 hidden sm:block" /> {t.name}</> : null;
                 })()}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                 "flex items-center justify-center w-10 h-10 sm:w-12 sm:h-11 rounded-xl transition-colors border-2",
                 extraTabs.some(t => t.id === tab) && tab !== 'overview' && tab !== 'logs'
                   ? "border-blue-600 bg-blue-50 text-blue-600" 
                   : "border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMenu(false)} className="fixed inset-0 z-40" />
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                    {extraTabs.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { navigate(`/inventory/${t.id}`); setShowMenu(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-left transition-colors",
                          tab === t.id ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <t.icon className="w-4 h-4" />
                        {t.name}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        {tab === 'overview' && <InventoryOverview />}
        {tab === 'imports' && <StockImports />}
        {tab === 'exports' && <StockExports />}
        {tab === 'reconcile' && <InventoryReconcile />}
        {tab === 'logs' && <InventoryLogs />}
        {tab === 'suppliers' && <Suppliers />}
      </div>
    </div>
  );
}
