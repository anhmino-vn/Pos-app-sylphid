import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from '../../lib/firebaseAdapter';
import { db, InventoryLog, handleFirestoreError, OperationType } from '../../lib/supabase';
import { Search, History, ArrowUpRight, ArrowDownRight, RefreshCw, Filter } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../App';

export function InventoryLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    const q = query(collection(db, 'inventoryLogs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryLog)));
    }, error => handleFirestoreError(error, OperationType.LIST, 'inventoryLogs'));
    return unsubscribe;
  }, []);

  const filtered = logs.filter(log => {
    const matchesSearch = log.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (log.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (log.referenceId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || log.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full min-h-[500px]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-10 bg-[#F8FAFC] -mt-4 sm:-mt-6 md:-mt-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 md:pb-8 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Tìm nhật ký..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 sm:py-2.5 bg-white border-none rounded-xl sm:rounded-2xl shadow-sm text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        <div className="flex bg-white rounded-xl sm:rounded-2xl p-1 shadow-sm overflow-x-auto scrollbar-none">
          <button onClick={() => setFilterType('all')} className={cn("px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap", filterType === 'all' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900")}>Tất cả</button>
          <button onClick={() => setFilterType('in')} className={cn("px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap", filterType === 'in' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900")}>Nhập</button>
          <button onClick={() => setFilterType('out')} className={cn("px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap", filterType === 'out' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900")}>Xuất</button>
          <button onClick={() => setFilterType('adjustment')} className={cn("px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap", filterType === 'adjustment' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900")}>Điều chỉnh</button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] sm:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 sm:px-8 py-4 sm:py-5">Sản phẩm</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Biến động</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Loại</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Lý do / Tham chiếu</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Người thực hiện</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors font-bold text-xs text-slate-700">
                  <td className="px-4 sm:px-8 py-4 sm:py-5">
                    <span className="text-slate-900 uppercase tracking-tight line-clamp-2 break-all">{log.productName}</span>
                  </td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5">
                    <span className={cn(
                      "flex items-center gap-1 font-black",
                      log.type === 'in' ? "text-emerald-600" : log.type === 'out' ? "text-rose-600" : "text-amber-600"
                    )}>
                      {log.type === 'in' && '+'}{log.quantity}
                    </span>
                  </td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", 
                        log.type === 'in' ? "bg-emerald-50 text-emerald-500" : 
                        log.type === 'out' ? "bg-rose-50 text-rose-500" : 
                        "bg-amber-50 text-amber-500"
                      )}>
                        {log.type === 'in' ? <ArrowUpRight className="w-3 h-3" /> : 
                         log.type === 'out' ? <ArrowDownRight className="w-3 h-3" /> : 
                         <RefreshCw className="w-3 h-3" />}
                      </div>
                      <span className="uppercase text-[10px] tracking-widest whitespace-nowrap">
                        {log.type === 'in' ? 'Nhập kho' : log.type === 'out' ? 'Xuất kho' : 'Điều chỉnh'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5">
                    <p className="text-slate-900 line-clamp-1 break-all">{log.reason}</p>
                    {log.referenceId && <p className="text-[9px] text-slate-400 mt-0.5 uppercase break-all">Ref: {log.referenceId}</p>}
                  </td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5 line-clamp-1 break-all">{log.createdBy}</td>
                  <td className="px-4 sm:px-8 py-4 sm:py-5 text-slate-500 font-medium whitespace-nowrap">{log.createdAt ? formatDate(log.createdAt.toDate()) : '...'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Chưa có dữ liệu biến động</div>
          )}
        </div>
      </div>
    </div>
  );
}
