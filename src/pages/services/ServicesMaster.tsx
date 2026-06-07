import React, { useState } from 'react';
import { Sparkles, Layers, ListFilter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { ServicesTab } from './ServicesTab';
import { ServiceCombos } from './ServiceCombos';
import { TreatmentsTab } from './TreatmentsTab';

export function ServicesMaster() {
  const [activeTab, setActiveTab] = useState<'services' | 'combos' | 'treatments'>('services');

  const tabs = [
    { id: 'services', label: 'Danh sách Dịch vụ', icon: Sparkles },
    { id: 'combos', label: 'Combo Dịch vụ', icon: Layers },
    { id: 'treatments', label: 'Liệu trình', icon: ListFilter }
  ] as const;

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="sticky top-0 z-40 bg-[#F1F5F9] pt-4 md:pt-6 pb-4 -mt-4 md:-mt-6">
        <div className="flex bg-white p-1.5 rounded-2xl md:rounded-[20px] shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar w-max max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-6 py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                  isActive ? "text-blue-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="services-master-tab"
                    className="absolute inset-0 bg-blue-50 border border-blue-100 rounded-xl md:rounded-2xl shadow-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn("w-4 h-4 md:w-5 md:h-5 relative z-10", isActive && "animate-pulse")} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col"
          >
            {activeTab === 'services' && <ServicesTab />}
            {activeTab === 'combos' && <ServiceCombos />}
            {activeTab === 'treatments' && <TreatmentsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
