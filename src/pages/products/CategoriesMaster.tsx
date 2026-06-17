import React, { useState, useEffect } from 'react';
import { Package, List, Tag, Truck, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ProductCategoriesTab } from './categories/ProductCategoriesTab';
import { ServiceCategoriesTab } from './categories/ServiceCategoriesTab';
import { BrandsTab } from './categories/BrandsTab';
import { SuppliersTab } from './categories/SuppliersTab';
import { collection, onSnapshot, query } from '../../lib/firebaseAdapter';
import { db } from '../../lib/supabase';
import { motion } from 'motion/react';

export function CategoriesMaster() {
  const [activeTab, setActiveTab] = useState('product_categories');
  const [globalSearch, setGlobalSearch] = useState('');
  const [stats, setStats] = useState({ productCats: 0, serviceCats: 0, brands: 0, suppliers: 0 });

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const watch = (col: string, key: keyof typeof stats) => {
      const q = query(collection(db, col));
      const unsub = onSnapshot(q, (snap: any) => {
        setStats(prev => ({ ...prev, [key]: snap.docs?.length || 0 }));
      });
      unsubs.push(unsub);
    };

    watch('productCategories', 'productCats');
    watch('serviceCategories', 'serviceCats');
    watch('brands', 'brands');
    watch('suppliers', 'suppliers');

    return () => unsubs.forEach(u => u());
  }, []);

  const tabs = [
    { id: 'product_categories', label: 'Danh mục sản phẩm', icon: Package, count: stats.productCats, color: 'blue' },
    { id: 'service_categories', label: 'Danh mục dịch vụ', icon: List, count: stats.serviceCats, color: 'teal' },
    { id: 'brands', label: 'Thương hiệu', icon: Tag, count: stats.brands, color: 'amber' },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: Truck, count: stats.suppliers, color: 'slate' },
  ] as const;

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="flex flex-col min-h-full space-y-5">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC] pt-4 md:pt-6 pb-2 -mt-4 md:-mt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">Quản lý danh mục</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">Cấu hình phân loại cho toàn bộ hệ thống</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 justify-end">
             {/* Global Search */}
             <div className="relative max-w-md w-full sm:w-auto flex-1">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="h-4 w-4 text-slate-400" />
               </div>
               <input
                 type="text"
                 placeholder={`Tìm kiếm trong ${activeTabData?.label.toLowerCase()}...`}
                 value={globalSearch}
                 onChange={(e) => setGlobalSearch(e.target.value)}
                 className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-bold transition-all shadow-sm"
               />
             </div>

            {/* Stats Row */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Danh mục SP', value: stats.productCats, color: 'bg-blue-50 text-blue-700' },
                { label: 'Danh mục DV', value: stats.serviceCats, color: 'bg-teal-50 text-teal-700' },
                { label: 'Thương hiệu', value: stats.brands, color: 'bg-amber-50 text-amber-700' },
                { label: 'Nhà cung cấp', value: stats.suppliers, color: 'bg-slate-100 text-slate-700' },
              ].map(s => (
                <div key={s.label} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-xl', s.color)} title={s.label}>
                  <span className="text-sm font-black">{s.value}</span>
                  <span className="text-[10px] font-bold hidden xl:inline uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-1.5 flex overflow-x-auto border border-slate-100 shadow-sm gap-1 hide-scrollbar">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setGlobalSearch(''); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-all relative',
                  isActive
                    ? tab.color === 'blue' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : tab.color === 'teal' ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
                    : tab.color === 'amber' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'bg-slate-800 text-white shadow-md shadow-slate-900/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 flex flex-col min-h-0"
      >
        {activeTab === 'product_categories' && <ProductCategoriesTab globalSearch={globalSearch} />}
        {activeTab === 'service_categories' && <ServiceCategoriesTab globalSearch={globalSearch} />}
        {activeTab === 'brands' && <BrandsTab globalSearch={globalSearch} />}
        {activeTab === 'suppliers' && <SuppliersTab globalSearch={globalSearch} />}
      </motion.div>
    </div>
  );
}
