import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, ArrowLeftRight, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { StockImports } from './StockImports';
import { StockExports } from './StockExports';
import { StockTransfers } from './StockTransfers';
import { InventoryReconcile } from './InventoryReconcile';

type TransTab = 'imports' | 'exports' | 'transfers' | 'reconcile';

export function TransactionsMaster() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab from URL
  const pathParts = location.pathname.split('/');
  const urlTab = pathParts[pathParts.length - 1] as TransTab;
  const validTabs: TransTab[] = ['imports', 'exports', 'transfers', 'reconcile'];
  const [activeTab, setActiveTab] = useState<TransTab>(validTabs.includes(urlTab) ? urlTab : 'imports');

  const handleTabChange = (tab: TransTab) => {
    setActiveTab(tab);
    navigate(`/inventory/transactions/${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'imports' as TransTab, label: 'Nhập kho', icon: LogIn, color: 'text-emerald-600' },
    { id: 'exports' as TransTab, label: 'Xuất kho', icon: LogOut, color: 'text-rose-600' },
    { id: 'transfers' as TransTab, label: 'Chuyển kho', icon: ArrowLeftRight, color: 'text-blue-600' },
    { id: 'reconcile' as TransTab, label: 'Kiểm kho', icon: ClipboardList, color: 'text-amber-600' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* Tab switcher */}
      <div className="sticky top-0 z-40 bg-[#F1F5F9] pt-4 md:pt-6 pb-4 -mt-4 md:-mt-6">
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase mb-4">
          Giao dịch kho
        </h1>
        <div className="flex bg-white p-1.5 rounded-2xl md:rounded-[20px] shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar gap-1 w-max max-w-full">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-5 py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap',
                  isActive ? tab.color : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="trans-tab-bg"
                    className="absolute inset-0 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl shadow-sm"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex flex-col overflow-y-auto"
          >
            {activeTab === 'imports' && <StockImports />}
            {activeTab === 'exports' && <StockExports />}
            {activeTab === 'transfers' && <StockTransfers />}
            {activeTab === 'reconcile' && <InventoryReconcile />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
