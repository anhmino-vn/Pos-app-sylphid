import React, { useState, useEffect } from 'react';
import { RefreshCcw, Trash2, Search, Filter, AlertTriangle } from 'lucide-react';
import { collection, onSnapshot, query, where, updateDoc, deleteDoc, doc } from '../../lib/firebaseAdapter';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function FinanceTrash() {
  const [deletedItems, setDeletedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection('transactions'), where('is_deleted', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));
      docs.sort((a, b) => new Date(b.deleted_at || Date.now()).getTime() - new Date(a.deleted_at || Date.now()).getTime());
      setDeletedItems(docs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error("Lỗi tải danh sách thùng rác");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRestore = async (id: string) => {
    try {
      await updateDoc(doc(collection('transactions'), id), {
         is_deleted: false,
         deleted_at: null,
         deleted_by: null
      });
      toast.success('Đã khôi phục dữ liệu thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi khôi phục dữ liệu');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu này? Hành động này không thể hoàn tác.')) return;
    try {
      await deleteDoc(doc(collection('transactions'), id));
      toast.success('Đã xóa vĩnh viễn dữ liệu!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa vĩnh viễn');
    }
  };

  const filteredItems = deletedItems.filter(i => 
    (i.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
             <Trash2 className="w-6 h-6 text-rose-500" /> Thùng Rác Tài Chính
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Dữ liệu tài chính đã xóa (Sẽ bị xóa vĩnh viễn sau 30 ngày)</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
         <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
         <div>
            <p className="text-sm font-bold text-amber-800">Lưu ý bảo mật</p>
            <p className="text-xs text-amber-700 mt-1">Chỉ Admin và Kế toán trưởng mới có quyền Khôi phục hoặc Xóa vĩnh viễn dữ liệu tài chính. Việc xóa vĩnh viễn sẽ mất dữ liệu hoàn toàn không thể phục hồi.</p>
         </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm theo mã phiếu, nội dung..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-rose-500 w-full" 
            />
          </div>
          <button className="p-2 border border-slate-100 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Mã / Ngày xóa</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Loại phiếu</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nội dung</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Số tiền</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-[200px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">Đang tải dữ liệu...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold">Thùng rác trống</td></tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900">{item.code || '---'}</p>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(item.deleted_at || Date.now()).toLocaleString('vi-VN')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mb-1", item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                        {item.type === 'income' ? 'Phiếu Thu' : 'Phiếu Chi'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700 max-w-xs truncate">{item.description || item.category}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className={cn("text-base font-black tracking-tight", item.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
                        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                         <button onClick={() => handleRestore(item.id)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-blue-100 transition-colors">
                            <RefreshCcw className="w-3 h-3" /> Phục hồi
                         </button>
                         <button onClick={() => handlePermanentDelete(item.id)} className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-rose-100 transition-colors">
                            <Trash2 className="w-3 h-3" /> Xóa
                         </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
