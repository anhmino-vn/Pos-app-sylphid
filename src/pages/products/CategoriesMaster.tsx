import React, { useState } from 'react';
import { Package, List, Tag, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ProductCategoriesTab } from './categories/ProductCategoriesTab';
import { ServiceCategoriesTab } from './categories/ServiceCategoriesTab';
import { BrandsTab } from './categories/BrandsTab';
import { SuppliersTab } from './categories/SuppliersTab';

export function CategoriesMaster() {
  const [activeTab, setActiveTab] = useState('product_categories');

  const tabs = [
    { id: 'product_categories', label: 'Danh mục sản phẩm', icon: Package },
    { id: 'service_categories', label: 'Danh mục dịch vụ', icon: List },
    { id: 'brands', label: 'Thương hiệu', icon: Tag },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: Truck },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-30 bg-[#F8FAFC] pt-4 md:pt-6 pb-4 md:pb-6 -mt-4 md:-mt-6">
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">Quản lý danh mục</h1>
        <p className="text-slate-500 text-xs md:text-sm mt-1">Cấu hình phân loại cho toàn bộ hệ thống</p>
      </div>

      <div className="bg-white rounded-[32px] p-2 flex overflow-x-auto border border-slate-100 shadow-sm mb-6 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs md:text-sm font-bold uppercase tracking-widest whitespace-nowrap transition-all",
              activeTab === tab.id ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 flex flex-col min-h-0">
        {activeTab === 'product_categories' && <ProductCategoriesTab />}
        {activeTab === 'service_categories' && <ServiceCategoriesTab />}
        {activeTab === 'brands' && <BrandsTab />}
        {activeTab === 'suppliers' && <SuppliersTab />}
      </div>
    </div>
  );
}
