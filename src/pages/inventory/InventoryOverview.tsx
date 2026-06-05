import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, Product, InventoryLog, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Package, AlertTriangle, Search, Filter, History, RefreshCw, ArrowUpRight } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../App';

export function InventoryOverview() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const qProds = query(collection(db, 'products'), orderBy('stock', 'asc'));
    const unsubscribeProds = onSnapshot(qProds, 
      snapshot => setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product))),
      error => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    const qLogs = query(collection(db, 'inventoryLogs'), orderBy('createdAt', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, 
      snapshot => setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLog))),
      error => handleFirestoreError(error, OperationType.LIST, 'inventoryLogs')
    );

    return () => {
      unsubscribeProds();
      unsubscribeLogs();
    };
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-8">
      {/* Low Stock Alerts */}
      <div className="xl:col-span-2 space-y-4 sm:space-y-6">
        <div className="bg-white p-4 sm:p-8 rounded-[24px] sm:rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Sản phẩm sắp hết hàng
            </h3>
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="text" 
                placeholder="Tìm nhanh..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {products.filter(p => p.stock < 10).slice(0, 5).map(product => (
              <div key={product.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100">
                    <Package className="w-5 h-5 text-slate-300" />
                  </div>
                  <div>
                    <p className="font-black text-xs text-slate-900 uppercase tracking-tight">{product.name}</p>
                    <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1">Cảnh báo: {product.stock} sản phẩm</p>
                  </div>
                </div>
              </div>
            ))}
            {products.filter(p => p.stock < 10).length === 0 && (
              <div className="py-10 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-[10px]">
                Không có sản phẩm nào sắp hết
              </div>
            )}
          </div>
        </div>

        {/* Full Inventory Table */}
        <div className="bg-white rounded-[24px] xl:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden w-full">
          <div className="p-4 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs italic">Toàn bộ danh mục tồn</h3>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-300"><Filter className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 sm:px-8 py-4 sm:py-5">Sản phẩm / SKU</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-center">Tồn kho</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5">Giá trị tồn</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50/30 transition-all font-bold text-xs">
                    <td className="px-4 sm:px-8 py-4 sm:py-5">
                      <p className="text-slate-900 uppercase tracking-tight line-clamp-1">{product.name}</p>
                      <p className="text-[9px] text-slate-400 uppercase mt-1">SKU: {product.sku}</p>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black",
                        product.stock < 10 ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 font-black text-slate-900">
                      {((product.listPrice || 0) * product.stock).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5">
                      <div className="flex items-center gap-2 w-max">
                         <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", product.stock > 0 ? "bg-emerald-500" : "bg-rose-500")} />
                         <span className="text-[10px] uppercase tracking-widest">{product.stock > 0 ? 'Còn hàng' : 'Hết hàng'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History Area */}
      <div className="space-y-4 sm:space-y-6">
        <div className="bg-slate-900 rounded-[24px] xl:rounded-[44px] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 sm:p-10 opacity-10">
            <History className="w-16 h-16 sm:w-20 sm:h-20" />
          </div>
          <h3 className="text-xl font-black italic tracking-tighter uppercase mb-2">Biến động kho</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mb-8">Nên nhật ký gần nhất</p>

          <div className="space-y-6 relative z-10">
            {logs.slice(0, 8).map((log, i) => (
              <div key={log.id} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border-2 border-slate-800",
                    log.type === 'in' ? "text-emerald-500" : "text-amber-500"
                  )}>
                    {log.type === 'in' ? <ArrowUpRight className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                  </div>
                  {i < 7 && <div className="w-px flex-1 bg-slate-800 my-2" />}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-[10px] font-black uppercase tracking-tight truncate line-clamp-1 group-hover:text-blue-400 transition-colors">{log.productName}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                    {log.type === 'in' ? 'Số lượng +' : 'Điều chỉnh: '}{Math.abs(log.quantity)} • {log.createdAt ? formatDate(log.createdAt.toDate()) : '...'}
                  </p>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="py-20 text-center text-slate-700 font-black uppercase tracking-widest text-[9px]">Chưa có dữ liệu biến động</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
