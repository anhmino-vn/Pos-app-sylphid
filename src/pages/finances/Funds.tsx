import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, getDocs } from '../../lib/firebaseAdapter';
import { useAuth } from '../../App';
import { Wallet, Plus, Users, Search, MoreVertical, Edit2, Shield, Activity, ChevronRight, X, Receipt } from 'lucide-react';
import { formatCurrency, generateDocCode, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function Funds() {
  const { user } = useAuth();
  const [funds, setFunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', initialBalance: 0, members: [] as string[] });

  // Detail View State
  const [selectedFund, setSelectedFund] = useState<any | null>(null);
  const [fundTransactions, setFundTransactions] = useState<any[]>([]);

  useEffect(() => {
    // Fetch all users for member selection
    getDocs(collection('users')).then(snap => {
      setAllUsers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });

    // We fetch ALL funds, then filter locally if `members` array contains `user?.id`
    // because array-contains might be tricky with our current adapter if not fully supported.
    // Assuming internal_funds is a small table.
    const unsubscribe = onSnapshot(collection('internalFunds'), (snapshot) => {
      const allFunds = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      // Filter: Admin sees all OR user is in members array
      const visibleFunds = allFunds.filter(f => f.manager_id === user?.id || (f.members || []).includes(user?.id) || user?.email === 'admin@gmail.com');
      setFunds(visibleFunds);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('Lỗi tải danh sách quỹ');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedFund) return;
    const q = query(collection('internalTransactions'), where('fund_id', '==', selectedFund.id));
    const unsub = onSnapshot(q, snap => {
      setFundTransactions(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
    });
    return () => unsub();
  }, [selectedFund]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Vui lòng nhập tên quỹ');

    try {
      const fundData = {
        name: formData.name,
        description: formData.description,
        initial_balance: Number(formData.initialBalance),
        current_balance: Number(formData.initialBalance),
        manager_id: user?.id,
        members: [...new Set([...formData.members, user?.id])], // Auto include creator
        code: generateDocCode('FUND'),
        total_income: 0,
        total_expense: 0
      };

      if (editingFund) {
        // Prevent changing balance if not new
        const { current_balance, initial_balance, code, total_income, total_expense, manager_id, ...updateData } = fundData as any;
        await updateDoc(doc(collection('internalFunds'), editingFund.id), updateData);
        toast.success('Cập nhật quỹ thành công');
      } else {
        await addDoc(collection('internalFunds'), fundData);
        toast.success('Tạo quỹ thành công');
      }
      setIsModalOpen(false);
      setEditingFund(null);
      setFormData({ name: '', description: '', initialBalance: 0, members: [] });
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra');
    }
  };

  const openEdit = (fund: any) => {
    setEditingFund(fund);
    setFormData({
      name: fund.name,
      description: fund.description || '',
      initialBalance: fund.initial_balance || 0,
      members: fund.members || []
    });
    setIsModalOpen(true);
  };

  if (selectedFund) {
    return (
      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        <button onClick={() => setSelectedFund(null)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" /> Quay lại danh sách quỹ
        </button>

        <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row gap-6 items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Wallet className="w-6 h-6" /></div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">{selectedFund.name}</h1>
                <p className="text-sm font-bold text-slate-500">Mã: {selectedFund.code}</p>
              </div>
            </div>
            <p className="text-slate-600 font-medium mt-4">{selectedFund.description}</p>
            
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1">
                <Users className="w-4 h-4" /> {(selectedFund.members || []).length} thành viên
              </span>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-white min-w-[250px] shadow-xl">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tồn quỹ hiện tại</p>
             <p className="text-3xl font-black">{formatCurrency(selectedFund.current_balance)} đ</p>
             <div className="flex gap-4 mt-4 pt-4 border-t border-slate-800">
               <div>
                 <p className="text-[10px] font-black uppercase text-slate-500">Tổng thu</p>
                 <p className="text-sm font-bold text-emerald-400">+{formatCurrency(selectedFund.total_income)} đ</p>
               </div>
               <div>
                 <p className="text-[10px] font-black uppercase text-slate-500">Tổng chi</p>
                 <p className="text-sm font-bold text-rose-400">-{formatCurrency(selectedFund.total_expense)} đ</p>
               </div>
             </div>
          </div>
        </div>

        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-50">
            <h3 className="font-black text-lg text-slate-900">Lịch sử Giao dịch (Sao kê)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Ngày</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nội dung</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Số tiền</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {fundTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="p-12 text-center text-slate-500 font-bold">Chưa có giao dịch nào</td></tr>
                ) : (
                  fundTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-slate-900">{t.code}</p>
                        <p className="text-[10px] font-bold text-slate-400">{new Date(t.created_at || Date.now()).toLocaleString('vi-VN')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">{t.description}</p>
                        <p className="text-xs text-slate-500">{t.category}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className={cn("text-base font-black", t.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn("inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest", 
                          t.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                          t.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                        )}>
                          {t.status === 'approved' ? 'Đã duyệt' : t.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                        </span>
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

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Quản lý Sổ Quỹ (Nhóm)
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Các quỹ nội bộ bạn đang tham gia</p>
        </div>
        <button onClick={() => { setEditingFund(null); setFormData({ name: '', description: '', initialBalance: 0, members: [] }); setIsModalOpen(true); }} 
          className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30">
          <Plus className="w-5 h-5" /> Tạo quỹ mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Activity className="w-8 h-8 animate-pulse text-blue-500" /></div>
      ) : funds.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Wallet className="w-8 h-8" />
          </div>
          <p className="text-lg font-bold text-slate-900">Bạn chưa tham gia quỹ nào</p>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">Tạo quỹ mới để quản lý tiền ăn trưa, trà sữa, mua sắm văn phòng cùng đồng nghiệp.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {funds.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer relative group" onClick={() => setSelectedFund(f)}>
              
              <button onClick={(e) => { e.stopPropagation(); openEdit(f); }} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                <Edit2 className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg text-slate-900 truncate pr-8">{f.name}</h3>
              <p className="text-sm font-medium text-slate-500 mt-1 line-clamp-2 min-h-[40px]">{f.description}</p>
              
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tồn quỹ</p>
                  <p className="text-xl font-black text-slate-900">{formatCurrency(f.current_balance)} đ</p>
                </div>
                <div className="flex -space-x-2">
                  {(f.members || []).slice(0, 3).map((mid: string, i: number) => {
                     const usr = allUsers.find(u => u.id === mid);
                     return (
                       <div key={mid} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden z-[3]" style={{ zIndex: 10 - i }}>
                          <span className="text-[10px] font-black text-slate-600">{usr?.name?.charAt(0).toUpperCase() || '?'}</span>
                       </div>
                     );
                  })}
                  {(f.members || []).length > 3 && (
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center z-0">
                      <span className="text-[10px] font-black text-slate-500">+{f.members.length - 3}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-900">{editingFund ? 'Cập nhật Quỹ' : 'Tạo Quỹ Mới'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tên quỹ</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-500" placeholder="VD: Quỹ ăn trưa phòng IT" />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Mô tả mục đích</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-blue-500 h-24 resize-none" placeholder="Quỹ dùng để..." />
              </div>

              {!editingFund && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Số dư ban đầu (VNĐ)</label>
                  <input type="number" required min="0" value={formData.initialBalance} onChange={e => setFormData({...formData, initialBalance: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-500" />
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Thành viên tham gia ({formData.members.length})</label>
                <div className="border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto bg-slate-50/50 space-y-1">
                  {allUsers.map(u => (
                    <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300"
                        checked={formData.members.includes(u.id) || u.id === user?.id} // Always checked for creator
                        disabled={u.id === user?.id}
                        onChange={e => {
                          if (e.target.checked) setFormData(p => ({...p, members: [...p.members, u.id]}));
                          else setFormData(p => ({...p, members: p.members.filter(m => m !== u.id)}));
                        }}
                      />
                      <span className="font-bold text-sm text-slate-700">{u.name || u.email}</span>
                      <span className="text-xs text-slate-400">{u.role}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium italic">* Những người được chọn mới có thể nhìn thấy và sử dụng quỹ này.</p>
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-white">
              <button onClick={handleSubmit} className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all">
                {editingFund ? 'Lưu thay đổi' : 'Hoàn tất tạo quỹ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
