import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc } from '../../lib/firebaseAdapter';
import { db, Product, handleFirestoreError, OperationType } from '../../lib/supabase';
import { DataTable } from '../../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import {
  Package, AlertTriangle, Search, Loader2, Warehouse,
  TrendingDown, XCircle, Clock, Archive
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { StockDetailDrawer } from './StockDetailDrawer';
import { motion } from 'motion/react';

type StockTab = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';



export function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<StockTab>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q,
      snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'products')
    );
    const unsubSettings = onSnapshot(doc(db, 'system_configs', 'global'),
      snap => {
        if (snap.exists()) {
           setLowStockThreshold(snap.data()?.inventory?.lowStockThreshold || 10);
        }
      }
    );

    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  // KPIs
  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(p => (p.stock || 0) > lowStockThreshold).length;
    const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= lowStockThreshold).length;
    const outOfStock = products.filter(p => (p.stock || 0) <= 0).length;
    const totalValue = products.reduce((sum, p) => sum + ((p.listPrice || 0) * (p.stock || 0)), 0);
    return { total, inStock, lowStock, outOfStock, totalValue };
  }, [products, lowStockThreshold]);

  const filteredProducts = useMemo(() => {
    let list = products;

    // Tab filter
    if (activeTab === 'in_stock') list = list.filter(p => (p.stock || 0) > lowStockThreshold);
    else if (activeTab === 'low_stock') list = list.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= lowStockThreshold);
    else if (activeTab === 'out_of_stock') list = list.filter(p => (p.stock || 0) <= 0);

    // Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(s) ||
        (p.sku || '').toLowerCase().includes(s) ||
        (p.barcode || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [products, activeTab, searchTerm, lowStockThreshold]);

  const tabs: { id: StockTab; label: string; icon: any; count: number; color: string }[] = [
    { id: 'all', label: 'Tất cả', icon: Archive, count: stats.total, color: 'text-slate-600' },
    { id: 'in_stock', label: 'Còn hàng', icon: Package, count: stats.inStock, color: 'text-emerald-600' },
    { id: 'low_stock', label: 'Sắp hết', icon: TrendingDown, count: stats.lowStock, color: 'text-amber-600' },
    { id: 'out_of_stock', label: 'Hết hàng', icon: XCircle, count: stats.outOfStock, color: 'text-rose-600' },
  ];

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.getValue('sku') || '—'}</span>
    },
    {
      accessorKey: 'name',
      header: 'Sản phẩm',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.images?.[0]
            ? <img src={row.original.images[0]} className="w-9 h-9 rounded-xl object-cover bg-slate-100" />
            : <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><Package className="w-4 h-4 text-slate-300" /></div>
          }
          <span className="font-bold text-slate-800">{row.getValue('name')}</span>
        </div>
      )
    },
    {
      accessorKey: 'stock',
      header: 'Tồn thực tế',
      cell: ({ row }) => {
        const stock = (row.getValue('stock') as number) || 0;
        return (
          <span className={cn(
            'px-2.5 py-1 rounded-full text-xs font-black',
            stock <= 0 ? 'bg-rose-100 text-rose-600' :
            stock <= lowStockThreshold ? 'bg-amber-100 text-amber-700' :
            'bg-emerald-100 text-emerald-700'
          )}>
            {stock}
          </span>
        );
      }
    },
    {
      accessorKey: 'listPrice',
      header: 'Giá vốn',
      cell: ({ row }) => <span className="text-slate-600 text-sm">{formatCurrency(row.getValue('listPrice') || 0)}</span>
    },
    {
      id: 'inventory_value',
      header: 'Giá trị tồn',
      cell: ({ row }) => {
        const val = ((row.original.listPrice || 0) * (row.original.stock || 0));
        return <span className="font-bold text-slate-900">{formatCurrency(val)}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const stock = (row.original.stock || 0);
        const label = stock <= 0 ? 'Hết hàng' : stock <= lowStockThreshold ? 'Sắp hết' : 'Còn hàng';
        const cls = stock <= 0 ? 'bg-rose-100 text-rose-700' : stock <= lowStockThreshold ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
        return <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest', cls)}>{label}</span>;
      }
    }
  ], [lowStockThreshold]);

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F1F5F9] pt-4 md:pt-6 pb-4 -mt-4 md:-mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
              <Warehouse className="w-6 h-6 text-blue-600" />
              Kho hàng
            </h1>
            <p className="text-slate-500 text-xs mt-1">Tổng quan tồn kho thời gian thực</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Tổng SP', value: stats.total, sub: 'mặt hàng', color: 'bg-blue-600', icon: Archive },
            { label: 'Còn hàng', value: stats.inStock, sub: 'sản phẩm', color: 'bg-emerald-600', icon: Package },
            { label: 'Sắp hết', value: stats.lowStock, sub: 'cần nhập', color: 'bg-amber-500', icon: TrendingDown },
            { label: 'Giá trị kho', value: formatCurrency(stats.totalValue), sub: 'tổng tồn', color: 'bg-slate-800', icon: Warehouse },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
            >
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-3', kpi.color)}>
                <kpi.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-xl font-black text-slate-900">{kpi.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{kpi.sub}</p>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">{kpi.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto hide-scrollbar gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all',
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={cn(
                  'ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black',
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, SKU, Barcode..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-medium text-slate-700 w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredProducts}
            onRowClick={row => setSelectedProduct(row)}
          />
        )}
      </div>

      {/* Detail Drawer */}
      {selectedProduct && (
        <StockDetailDrawer
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
