import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Users as UsersIcon, Building2, ShieldCheck } from 'lucide-react';
import { EmployeeList } from './users/EmployeeList';
import { Departments } from './users/Departments';
import { Roles } from './users/Roles';

export function Users() {
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'roles'>('employees');

  const tabs = [
    { id: 'employees', label: 'Danh sách nhân sự', icon: UsersIcon },
    { id: 'departments', label: 'Cơ cấu phòng ban', icon: Building2 },
    { id: 'roles', label: 'Vai trò & Phân quyền', icon: ShieldCheck }
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Hệ Thống Nhân Sự</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý hồ sơ, cấu trúc doanh nghiệp và phân quyền truy cập</p>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 items-start">
         <div className="w-full lg:w-64 shrink-0 rounded-2xl bg-white border border-slate-100 p-2 md:p-3 shadow-sm z-20 overflow-hidden">
            <nav className="flex flex-row flex-nowrap overflow-x-auto lg:flex-col gap-2 md:gap-1 pb-2 md:pb-0 scrollbar-none w-full">
               {tabs.map(tab => (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                       "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 md:py-4 rounded-xl text-left transition-all relative overflow-hidden group shrink-0",
                       activeTab === tab.id 
                          ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10" 
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 bg-slate-50 lg:bg-transparent"
                    )}
                 >
                    <tab.icon className={cn("w-4 h-4 md:w-5 md:h-5 shrink-0 transition-transform group-hover:scale-110", activeTab === tab.id ? "text-blue-400" : "")} />
                    <span className="font-black text-[10px] md:text-xs uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
                    {activeTab === tab.id && (
                       <motion.div layoutId="activeTabBadgeUsers" className="absolute left-0 bottom-0 lg:top-1/2 lg:-translate-y-1/2 w-full lg:w-1 h-1 lg:h-8 bg-blue-500 lg:rounded-r-full" />
                    )}
                 </button>
               ))}
            </nav>
            
            <div className="mt-8 pt-6 border-t border-slate-100 hidden lg:flex flex-col items-center justify-center p-4">
               <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                  <ShieldCheck className="w-8 h-8 text-slate-300" />
               </div>
               <p className="text-xs text-center text-slate-400 font-medium">Hệ thống phân quyền theo chuẩn doanh nghiệp (RBAC)</p>
            </div>
         </div>

         <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
               <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
               >
                  {activeTab === 'employees' && <EmployeeList />}
                  {activeTab === 'departments' && <Departments />}
                  {activeTab === 'roles' && <Roles />}
               </motion.div>
            </AnimatePresence>
         </div>
      </div>
    </div>
  );
}
