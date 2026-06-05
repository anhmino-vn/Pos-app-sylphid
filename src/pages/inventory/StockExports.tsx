import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, Product, handleFirestoreError, OperationType, StockExportItem, StockExport } from '../../lib/firebase';
import { Plus, Search, LogOut, Trash2, X, CheckCircle2, Loader2, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../App';
import { cn, formatDate, generateDocCode } from '../../lib/utils';
import { useLocation } from 'react-router-dom';

export function StockExports() {
  const { profile } = useAuth();
  const location = useLocation();
  const [exports, setExports] = useState<StockExport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingExport, setViewingExport] = useState<StockExport | null>(null);

  useEffect(() => {
    if (location.state?.action === 'create') {
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const [products, setProducts] = useState<Product[]>([]);
  
  const [reason, setReason] = useState<'order' | 'internal' | 'damage' | 'other'>('other');
  const [items, setItems] = useState<StockExportItem[]>([]);
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const canManage = profile?.role === 'admin' || profile?.permissions?.stock?.export;

  useEffect(() => {
    const qExports = query(collection(db, 'stockExports'), orderBy('createdAt', 'desc'));
    const unsubscribeExports = onSnapshot(qExports, (snapshot) => {
      setExports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockExport)));
    });

    const qProds = query(collection(db, 'products'));
    onSnapshot(qProds, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))));

    return () => unsubscribeExports();
  }, []);

  const handleAddItem = (product: Product) => {
    if (items.some(i => i.productId === product.id)) return;
    setItems(prev => [...prev, {
      productId: product.id!,
      productName: product.name,
      sku: product.sku,
      quantity: 1
    }]);
    setProductSearch('');
  };

  const updateItem = (index: number, updates: Partial<StockExportItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || items.length === 0) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const code = generateDocCode('PX');

      // 1. Tạo phiếu xuất
      const exportRef = doc(collection(db, 'stockExports'));
      const exportData: Omit<StockExport, 'id'> = {
        code,
        reason,
        items,
        notes,
        status: 'completed',
        createdBy: profile?.id || '',
        creatorName: profile?.name || 'System',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(exportRef, exportData);

      // 2. Cập nhật tồn kho & tạo log
      for (const item of items) {
        const prodRef = doc(db, 'products', item.productId);
        const prodMatch = products.find(p => p.id === item.productId);
        if (prodMatch) {
          batch.update(prodRef, {
            stock: Math.max(0, prodMatch.stock - item.quantity),
            updatedAt: serverTimestamp()
          });

          const logRef = doc(collection(db, 'inventoryLogs'));
          batch.set(logRef, {
            productId: item.productId,
            productName: item.productName,
            type: 'out',
            quantity: -item.quantity,
            reason: `Xuất kho: ${reason === 'order' ? 'Bán hàng' : reason === 'internal' ? 'Nội bộ' : reason === 'damage' ? 'Hư hỏng' : 'Khác'}`,
            referenceId: exportRef.id,
            createdAt: serverTimestamp(),
            createdBy: profile?.email || 'System'
          });
        }
      }

      await batch.commit();
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stockExports');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReason('other');
    setItems([]);
    setNotes('');
  };

  const filtered = exports.filter(s => 
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const searchProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 5);

  const reasonLabels = {
    order: 'Xuất bán hàng',
    internal: 'Xuất dùng nội bộ',
    damage: 'Xuất hủy/hư hỏng',
    other: 'Lý do khác'
  };

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full min-h-[500px]">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-[#F8FAFC] -mt-4 sm:-mt-6 md:-mt-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 md:pb-8 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Tìm mã phiếu xuất..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 sm:py-2.5 bg-white border-none rounded-xl sm:rounded-2xl shadow-sm text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        {canManage && (
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="hidden sm:flex px-6 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-600/20 active:scale-95 transition-all items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tạo phiếu xuất
          </button>
        )}
      </div>

      <div className="bg-white rounded-[24px] sm:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 sm:px-8 py-4 sm:py-5 w-32">Mã phiếu</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Ngày xuất</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Lý do</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Người tạo</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(exp => (
                <tr key={exp.id} onClick={() => setViewingExport(exp)} className="hover:bg-slate-50/50 cursor-pointer transition-colors font-bold text-xs text-slate-700">
                  <td className="px-4 sm:px-8 py-4 sm:py-5">
                    <span className="text-rose-600 uppercase">#{exp.code}</span>
                  </td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5">{exp.createdAt ? formatDate(exp.createdAt.toDate()) : '...'}</td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5 uppercase tracking-widest text-[10px]">{reasonLabels[exp.reason]}</td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5 line-clamp-1 break-all">{exp.creatorName}</td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5 text-center">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Đã xuất</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Chưa có phiếu xuất kho</div>
          )}
        </div>
      </div>
      
      {canManage && (
         <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-rose-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all z-20"
         >
            <Plus className="w-6 h-6" />
         </button>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[44px] shadow-2xl overflow-hidden flex flex-col">
              <div className="px-10 py-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-rose-600 uppercase tracking-tighter italic">Phiếu Xuất Kho</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Trừ hàng khỏi tồn kho</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lý do xuất (*)</label>
                    <select value={reason} onChange={e => setReason(e.target.value as any)} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 text-slate-700">
                      <option value="order">Xuất bán hàng</option>
                      <option value="internal">Xuất dùng nội bộ</option>
                      <option value="damage">Xuất hủy/Hư hỏng</option>
                      <option value="other">Lý do khác</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" placeholder="VD: Khách lấy mang về..." />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] border-b border-slate-200 pb-2">Thêm Sản Phẩm</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input 
                      type="text" 
                      placeholder="Tìm sản phẩm theo tên hoặc SKU..." 
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500/10"
                    />
                    {productSearch && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-10">
                        {searchProducts.map(p => (
                          <button key={p.id} type="button" disabled={p.stock <= 0} onClick={() => handleAddItem(p)} className="w-full px-6 py-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-none flex items-center justify-between group disabled:opacity-50">
                            <div>
                              <p className="font-bold text-sm text-slate-900 uppercase tracking-tight">{p.name}</p>
                              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1">SKU: {p.sku} | Tồn hiện tại: {p.stock}</p>
                            </div>
                            <Plus className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {items.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                            <th className="px-6 py-4">Sản phẩm</th>
                            <th className="px-6 py-4 text-center w-32">Số lượng xuất</th>
                            <th className="px-4 py-4 w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map((item, idx) => {
                            const pMatch = products.find(p => p.id === item.productId);
                            const maxStock = pMatch?.stock || 0;
                            return (
                              <tr key={idx} className="font-bold text-xs text-slate-700">
                                <td className="px-6 py-4">
                                  <p className="text-slate-900 uppercase">{item.productName}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{item.sku}</p>
                                </td>
                                <td className="px-6 py-4 flex justify-center">
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"><Minus className="w-3 h-3" /></button>
                                    <input type="number" min="1" max={maxStock} value={item.quantity} onChange={e => updateItem(idx, { quantity: Math.min(maxStock, Number(e.target.value)) })} className="w-12 text-center bg-transparent border-none outline-none font-black" />
                                    <button type="button" onClick={() => updateItem(idx, { quantity: Math.min(maxStock, item.quantity + 1) })} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"><Plus className="w-3 h-3" /></button>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <button type="button" onClick={() => removeItem(idx)} className="p-2 text-slate-300 hover:text-rose-500 rounded-xl hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-white border-t border-slate-50 shrink-0 flex justify-end">
                <button type="button" onClick={handleSubmit} disabled={loading || items.length === 0} className="px-10 py-4 bg-rose-600 text-white rounded-3xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-rose-600/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center gap-3">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Hoàn tất xuất kho
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
