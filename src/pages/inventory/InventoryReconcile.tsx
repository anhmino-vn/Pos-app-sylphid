import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db, Product, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Search, Save, AlertTriangle, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../App';

export function InventoryReconcile() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actualStock, setActualStock] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const canManage = profile?.role === 'admin';

  useEffect(() => {
    const qProds = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(qProds, 
      snapshot => {
        const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setProducts(prods);
      },
      error => handleFirestoreError(error, OperationType.LIST, 'products')
    );
    return unsubscribe;
  }, []);

  const handleUpdateStock = (productId: string, value: string) => {
    const intVal = parseInt(value, 10);
    setActualStock(prev => {
      const next = { ...prev };
      if (isNaN(intVal)) {
        delete next[productId];
      } else {
        next[productId] = intVal;
      }
      return next;
    });
  };

  const handleReconcile = async () => {
    if (!canManage || Object.keys(actualStock).length === 0) return;
    if (!window.confirm('Bạn có chắc chắn muốn cập nhật toàn bộ kiểm kê thực tế vào hệ thống?')) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      for (const [productId, actStock] of Object.entries(actualStock)) {
        const product = products.find(p => p.id === productId);
        if (!product) continue;
        
        const diff = Number(actStock) - Number(product.stock);
        if (diff !== 0) {
          batch.update(doc(db, 'products', productId), {
            stock: actStock,
            updatedAt: serverTimestamp()
          });

          batch.set(doc(collection(db, 'inventoryLogs')), {
            productId,
            productName: product.name,
            type: 'adjustment',
            quantity: diff,
            reason: 'Kiểm kê định kỳ',
            createdAt: serverTimestamp(),
            createdBy: profile?.email || 'System'
          });
        }
      }

      await batch.commit();
      setActualStock({});
      alert('Đã cập nhật hệ thống thành công!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reconcile-batch');
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingChanges = Object.keys(actualStock).filter(id => {
    const p = products.find(prod => prod.id === id);
    return p && actualStock[id] !== p.stock;
  }).length;

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full min-h-[500px]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-10 bg-[#F8FAFC] -mt-4 sm:-mt-6 md:-mt-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 md:pb-8 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Tìm sản phẩm..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 sm:py-2.5 bg-white border-none rounded-xl sm:rounded-2xl shadow-sm text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        {canManage && (
          <button 
            onClick={handleReconcile}
            disabled={pendingChanges === 0 || loading}
            className="px-4 sm:px-6 py-3 sm:py-2.5 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu thay đổi ({pendingChanges})
          </button>
        )}
      </div>

      <div className="bg-white rounded-[24px] sm:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden w-full">
        <div className="p-4 sm:p-8 border-b border-slate-100 bg-amber-50/50 flex flex-col sm:flex-row items-start gap-4">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-amber-900 uppercase tracking-widest text-xs mb-1 mt-1 sm:mt-0">Hướng dẫn kiểm kê</h3>
            <p className="text-[10px] text-amber-700/70 font-bold max-w-2xl leading-relaxed">
              Nhập số lượng tồn thực tế vào cột "Kiểm kê thực tế". Cột "Lệch" sẽ tự động tính toán. Khi hoàn tất, nhấn nút Lưu để hệ thống tự tạo bút toán điều chỉnh kho.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 sm:px-8 py-4 sm:py-5">Sản phẩm / SKU</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-center">Tồn hệ thống</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-center">Kiểm kê thực tế</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-center">Lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(product => {
                const actual = actualStock[product.id!] !== undefined ? actualStock[product.id!] : product.stock;
                const diff = Number(actual) - Number(product.stock);
                
                return (
                  <tr key={product.id} className="hover:bg-slate-50/30 transition-all font-bold text-xs group">
                    <td className="px-4 sm:px-8 py-4 sm:py-5">
                      <p className="text-slate-900 uppercase tracking-tight line-clamp-1 break-all">{product.name}</p>
                      <p className="text-[9px] text-slate-400 uppercase mt-1">SKU: {product.sku}</p>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 text-center">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black">
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 text-center">
                      <input 
                        type="number"
                        min="0"
                        value={actualStock[product.id!] !== undefined ? actualStock[product.id!] : ''}
                        onChange={(e) => handleUpdateStock(product.id!, e.target.value)}
                        placeholder={product.stock.toString()}
                        className={cn(
                          "w-24 text-center bg-transparent border-b-2 outline-none font-black text-sm px-2 py-1 transition-colors mx-auto",
                          actualStock[product.id!] !== undefined 
                            ? "border-blue-500 text-blue-600" 
                            : "border-slate-200 text-slate-400 focus:border-slate-400"
                        )}
                      />
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 text-center">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        diff > 0 ? "text-emerald-500" : diff < 0 ? "text-rose-500" : "text-slate-300"
                      )}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
