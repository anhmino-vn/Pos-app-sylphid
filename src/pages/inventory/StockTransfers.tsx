import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from '../../lib/firebaseAdapter';
import { db, Product, handleFirestoreError, OperationType } from '../../lib/supabase';
import { ArrowLeftRight, Plus, Search, X, CheckCircle2, Loader2, Minus, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../App';
import { cn, formatDate, generateDocCode } from '../../lib/utils';
import toast from 'react-hot-toast';

interface TransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  stock: number;
}

export function StockTransfers() {
  const { profile } = useAuth();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Form state
  const [fromLocation, setFromLocation] = useState('Kho chính');
  const [toLocation, setToLocation] = useState('');
  const [items, setItems] = useState<TransferItem[]>([]);
  const [note, setNote] = useState('');

  const canManage = profile?.role === 'admin' || profile?.permissions?.stock?.import;

  useEffect(() => {
    const q = query(collection(db, 'stockTransfers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qProds = query(collection(db, 'products'));
    onSnapshot(qProds, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))));

    return unsub;
  }, []);

  const handleAddItem = (product: Product) => {
    if (items.some(i => i.productId === product.id)) return;
    setItems(prev => [...prev, {
      productId: product.id!,
      productName: product.name,
      sku: product.sku || '',
      quantity: 1,
      stock: product.stock || 0
    }]);
    setProductSearch('');
  };

  const handleSubmit = async () => {
    if (!toLocation.trim()) return toast.error('Vui lòng nhập kho đích');
    if (items.length === 0) return toast.error('Vui lòng thêm sản phẩm');

    // Validate quantities
    for (const item of items) {
      if (item.quantity > item.stock) {
        return toast.error(`Số lượng chuyển của "${item.productName}" vượt quá tồn kho (${item.stock})`);
      }
    }

    setLoading(true);
    try {
      const code = generateDocCode('CK');
      await addDoc(collection(db, 'stockTransfers'), {
        code,
        fromLocation,
        toLocation,
        items,
        note,
        status: 'completed',
        createdBy: profile?.id || '',
        creatorName: profile?.name || '',
        createdAt: serverTimestamp()
      });

      toast.success(`Đã tạo phiếu chuyển kho ${code}`);
      setIsModalOpen(false);
      setItems([]);
      setToLocation('');
      setNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stockTransfers');
    } finally {
      setLoading(false);
    }
  };

  const filtered = transfers.filter(t =>
    (t.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.toLocation || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const searchProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 6);

  const statusConfig: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600' },
    pending: { label: 'Chờ nhận', cls: 'bg-amber-100 text-amber-700' },
    in_transit: { label: 'Đang chuyển', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Đã hủy', cls: 'bg-rose-100 text-rose-700' },
  };

  return (
    <div className="space-y-5 p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Tìm mã phiếu, kho đích..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-medium text-slate-700"
          />
        </div>
        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Tạo phiếu chuyển
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Chưa có phiếu chuyển kho nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="px-6 py-4">Mã phiếu</th>
                  <th className="px-6 py-4">Từ kho</th>
                  <th className="px-6 py-4">Đến kho</th>
                  <th className="px-6 py-4">Số SP</th>
                  <th className="px-6 py-4">Ngày tạo</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(t => {
                  const status = statusConfig[t.status] || statusConfig.draft;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors text-sm font-bold text-slate-700">
                      <td className="px-6 py-4 text-blue-600 font-mono">#{t.code}</td>
                      <td className="px-6 py-4">{t.fromLocation}</td>
                      <td className="px-6 py-4">{t.toLocation}</td>
                      <td className="px-6 py-4">{t.items?.length || 0} SP</td>
                      <td className="px-6 py-4 text-slate-500">{t.createdAt?.toDate ? formatDate(t.createdAt.toDate()) : '—'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest', status.cls)}>{status.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Phiếu Chuyển Kho</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Di chuyển hàng hóa giữa các kho</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kho xuất</label>
                    <input value={fromLocation} onChange={e => setFromLocation(e.target.value)} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kho nhận (*)</label>
                    <input value={toLocation} onChange={e => setToLocation(e.target.value)} placeholder="VD: Chi nhánh 2, Kho con..." className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" />
                  </div>
                </div>

                {/* Product search */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thêm sản phẩm</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text" placeholder="Tìm sản phẩm..."
                      value={productSearch} onChange={e => setProductSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/10"
                    />
                    {productSearch && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10">
                        {searchProducts.map(p => (
                          <button key={p.id} type="button" onClick={() => handleAddItem(p)} className="w-full px-5 py-3.5 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-sm text-slate-900">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">SKU: {p.sku || '—'} | Tồn: {p.stock || 0}</p>
                            </div>
                            <Plus className="w-4 h-4 text-slate-300" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {items.length > 0 && (
                    <div className="bg-slate-50 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                            <th className="px-5 py-3">Sản phẩm</th>
                            <th className="px-5 py-3 w-36">Số lượng chuyển</th>
                            <th className="px-5 py-3 w-24 text-center">Tồn hiện tại</th>
                            <th className="px-2 py-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {items.map((item, idx) => (
                            <tr key={idx} className="text-sm font-bold text-slate-700">
                              <td className="px-5 py-3">
                                <p>{item.productName}</p>
                                <p className="text-[10px] text-slate-400">{item.sku}</p>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => {
                                    const newItems = [...items];
                                    newItems[idx].quantity = Math.max(1, newItems[idx].quantity - 1);
                                    setItems(newItems);
                                  }} className="w-7 h-7 bg-white rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-100"><Minus className="w-3 h-3" /></button>
                                  <span className="w-8 text-center font-black">{item.quantity}</span>
                                  <button type="button" onClick={() => {
                                    const newItems = [...items];
                                    newItems[idx].quantity = Math.min(item.stock, newItems[idx].quantity + 1);
                                    setItems(newItems);
                                  }} className="w-7 h-7 bg-white rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-100"><Plus className="w-3 h-3" /></button>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className={cn('text-xs font-black', item.quantity > item.stock ? 'text-rose-600' : 'text-slate-600')}>{item.stock}</span>
                              </td>
                              <td className="px-2 py-3">
                                <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none outline-none font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/10 resize-none" placeholder="Lý do chuyển kho..." />
                </div>
              </div>

              <div className="px-8 py-5 bg-white border-t border-slate-100 shrink-0 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-colors uppercase tracking-widest">Hủy</button>
                <button onClick={handleSubmit} disabled={loading} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Xác nhận chuyển kho
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
