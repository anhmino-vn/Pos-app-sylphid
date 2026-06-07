import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot } from '../../lib/firebaseAdapter';
import { db, Product } from '../../lib/supabase';
import { X, Package, BarChart2, History, Layers, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';

interface Props {
  product: Product;
  onClose: () => void;
}

type DrawerTab = 'info' | 'stock' | 'batches' | 'history' | 'stats';

export function StockDetailDrawer({ product, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('stock');
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!product.id) return;
    const q = query(
      collection(db, 'inventoryLogs'),
      where('productId', '==', product.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [product.id]);

  const totalIn = useMemo(() => logs.filter(l => l.type === 'in').reduce((s, l) => s + (l.quantity || 0), 0), [logs]);
  const totalOut = useMemo(() => logs.filter(l => l.type === 'out').reduce((s, l) => s + Math.abs(l.quantity || 0), 0), [logs]);

  const tabs: { id: DrawerTab; label: string; icon: any }[] = [
    { id: 'info', label: 'Thông tin', icon: Package },
    { id: 'stock', label: 'Tồn kho', icon: BarChart2 },
    { id: 'history', label: 'Lịch sử', icon: History },
    { id: 'stats', label: 'Thống kê', icon: TrendingUp },
  ];

  const stock = product.stock || 0;
  const stockValue = (product.listPrice || 0) * stock;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-4">
              {product.images?.[0]
                ? <img src={product.images[0]} className="w-12 h-12 rounded-2xl object-cover" />
                : <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center"><Package className="w-6 h-6 text-blue-500" /></div>
              }
              <div>
                <h3 className="font-black text-slate-900 text-sm">{product.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">SKU: {product.sku || '—'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-6 pt-4 gap-1 border-b border-slate-100 shrink-0 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all -mb-px',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* INFO TAB */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {[
                  { label: 'Tên sản phẩm', value: product.name },
                  { label: 'SKU', value: product.sku || '—' },
                  { label: 'Barcode', value: product.barcode || '—' },
                  { label: 'Đơn vị tính', value: product.baseUnit || 'Cái' },
                  { label: 'Giá vốn', value: formatCurrency(product.listPrice || 0) },
                  { label: 'Giá bán', value: formatCurrency(product.salePrice || 0) },
                  { label: 'Trạng thái', value: product.status === 'active' ? 'Đang bán' : 'Ngừng bán' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                    <span className="text-sm font-bold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* STOCK TAB */}
            {activeTab === 'stock' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Tồn hiện tại', value: stock, color: stock <= 0 ? 'text-rose-600' : 'text-slate-900', bg: stock <= 0 ? 'bg-rose-50' : 'bg-blue-50' },
                    { label: 'Tổng nhập', value: totalIn, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { label: 'Tổng xuất', value: totalOut, color: 'text-rose-700', bg: 'bg-rose-50' },
                    { label: 'Giá trị tồn kho', value: formatCurrency(stockValue), color: 'text-blue-700', bg: 'bg-blue-50', full: true },
                  ].map(item => (
                    <div key={item.label} className={cn('p-5 rounded-2xl', item.bg, item.full ? 'col-span-2' : '')}>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{item.label}</p>
                      <p className={cn('text-2xl font-black', item.color)}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Stock level bar */}
                <div className="bg-slate-50 rounded-2xl p-5">
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                    <span>Mức tồn</span>
                    <span>{stock} / {Math.max(stock, totalIn)} đơn vị</span>
                  </div>
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', stock <= 0 ? 'bg-rose-500' : stock <= 5 ? 'bg-amber-500' : 'bg-emerald-500')}
                      style={{ width: `${totalIn > 0 ? Math.min(100, (stock / totalIn) * 100) : stock > 0 ? 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {logs.length === 0 && (
                  <div className="py-16 text-center text-slate-400">
                    <History className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold">Chưa có lịch sử biến động</p>
                  </div>
                )}
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      log.type === 'in' ? 'bg-emerald-100' : log.type === 'out' ? 'bg-rose-100' : 'bg-amber-100'
                    )}>
                      {log.type === 'in' ? <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        : log.type === 'out' ? <ArrowDownRight className="w-4 h-4 text-rose-600" />
                        : <RefreshCw className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{log.reason || (log.type === 'in' ? 'Nhập kho' : 'Xuất kho')}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        {log.createdAt?.toDate ? formatDate(log.createdAt.toDate()) : '—'}
                      </p>
                    </div>
                    <span className={cn('text-sm font-black', log.type === 'in' ? 'text-emerald-600' : 'text-rose-600')}>
                      {log.type === 'in' ? '+' : '-'}{Math.abs(log.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* STATS TAB */}
            {activeTab === 'stats' && (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-2xl p-6 text-white">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giá trị tồn kho</p>
                  <p className="text-3xl font-black">{formatCurrency(stockValue)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Tổng nhập</p>
                    <p className="text-xl font-black text-emerald-700">{totalIn} đơn vị</p>
                  </div>
                  <div className="bg-rose-50 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Tổng xuất</p>
                    <p className="text-xl font-black text-rose-700">{totalOut} đơn vị</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-5">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Tốc độ bán trung bình</p>
                  <p className="text-xl font-black text-blue-700">
                    {logs.length > 0 ? `~${Math.round(totalOut / Math.max(1, logs.length))} đơn vị / giao dịch` : 'Chưa có dữ liệu'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
