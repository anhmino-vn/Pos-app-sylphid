import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, getDocs } from '../../lib/firebaseAdapter';
import { useAuth } from '../../App';
import { Receipt, Plus, Search, CheckCircle2, X } from 'lucide-react';
import { formatCurrency, generateDocCode, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export function Incomes() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState('');
  const [category, setCategory] = useState('Góp quỹ');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [payerId, setPayerId] = useState('');

  useEffect(() => {
    // Fetch users
    getDocs(collection('users')).then(snap => setAllUsers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    
    // Fetch user's visible funds
    const unsubFunds = onSnapshot(collection('internalFunds'), snap => {
      const allFunds = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const visible = allFunds.filter(f => f.manager_id === user?.id || (f.members || []).includes(user?.id) || profile?.role === 'admin');
      setFunds(visible);
    });

    // Fetch incomes
    const unsubTx = onSnapshot(collection('internalTransactions'), snap => {
      const txs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((t: any) => t.type === 'income' && !t.is_deleted);
      setTransactions(txs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
      setLoading(false);
    });

    return () => { unsubFunds(); unsubTx(); };
  }, [user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundId) return toast.error('Vui lòng chọn quỹ nhận');
    if (amount <= 0) return toast.error('Số tiền thu phải lớn hơn 0');

    try {
      const txData = {
        code: generateDocCode('PT'),
        fund_id: selectedFundId,
        type: 'income',
        amount: Number(amount),
        category,
        description,
        status: 'pending', // Chờ duyệt
        payer_payee_id: payerId || user?.id,
        created_by: user?.id,
      };

      await addDoc(collection('internalTransactions'), txData);
      toast.success('Đã tạo phiếu thu. Vui lòng chờ kế toán duyệt!');
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tạo phiếu thu');
    }
  };

  const resetForm = () => {
    setCategory('Góp quỹ');
    setDescription('');
    setAmount(0);
    setPayerId('');
    setSelectedFundId('');
  };

  const handleApprove = async (tx: any) => {
    if (!window.confirm('Xác nhận duyệt khoản thu này? Số dư quỹ sẽ tăng lên.')) return;
    try {
      const fund = funds.find(f => f.id === tx.fund_id);
      if (!fund) return toast.error('Không tìm thấy thông tin quỹ');

      await updateDoc(doc(collection('internalTransactions'), tx.id), {
        status: 'approved',
        approved_by: user?.id
      });

      await updateDoc(doc(collection('internalFunds'), fund.id), {
        current_balance: fund.current_balance + tx.amount,
        total_income: (fund.total_income || 0) + tx.amount
      });

      toast.success('Đã duyệt phiếu thu thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi duyệt phiếu');
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Từ chối phiếu thu này?')) return;
    await updateDoc(doc(collection('internalTransactions'), id), { status: 'rejected' });
    toast.success('Đã từ chối phiếu thu');
  };

  const visibleTransactions = transactions.filter(t => {
     if (!funds.find(f => f.id === t.fund_id) && profile?.role !== 'admin') return false;
     if (!searchQuery) return true;
     const q = searchQuery.toLowerCase();
     return (t.code?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Phiếu Thu Nội Bộ
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Quản lý các khoản nộp tiền vào quỹ nhóm</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30">
          <Plus className="w-5 h-5" /> Tạo phiếu thu
        </button>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
          <div className="relative w-64">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Tìm phiếu thu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-emerald-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Mã / Ngày</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Vào Quỹ</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Người nộp</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nội dung</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Số tiền</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">Đang tải dữ liệu...</td></tr>
              ) : visibleTransactions.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-bold">Chưa có phiếu thu nào</td></tr>
              ) : (
                visibleTransactions.map(t => {
                   const fund = funds.find(f => f.id === t.fund_id);
                   const payer = allUsers.find(u => u.id === t.payer_payee_id);
                   return (
                     <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-6 py-4">
                         <p className="text-sm font-black text-slate-900">{t.code}</p>
                         <p className="text-[10px] font-bold text-slate-400">{new Date(t.created_at || Date.now()).toLocaleString('vi-VN')}</p>
                       </td>
                       <td className="px-6 py-4">
                         <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">{fund?.name || '---'}</span>
                       </td>
                       <td className="px-6 py-4">
                         <span className="text-sm font-bold text-slate-800">{payer?.name || payer?.email || 'N/A'}</span>
                       </td>
                       <td className="px-6 py-4">
                         <p className="text-sm font-bold text-slate-700">{t.description || t.category}</p>
                       </td>
                       <td className="px-6 py-4 text-right">
                         <p className="text-sm font-black text-emerald-600">+{formatCurrency(t.amount)} đ</p>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <span className={cn("inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest", 
                            t.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                            t.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                          )}>
                            {t.status === 'approved' ? 'Đã duyệt' : t.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-center">
                          {t.status === 'pending' && (profile?.role === 'admin' || profile?.role === 'manager' || fund?.manager_id === user?.id) ? (
                            <div className="flex justify-center gap-2">
                               <button onClick={() => handleApprove(t)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors" title="Duyệt"><CheckCircle2 className="w-4 h-4"/></button>
                               <button onClick={() => handleReject(t.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition-colors" title="Từ chối"><X className="w-4 h-4"/></button>
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                       </td>
                     </tr>
                   );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
               <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h2 className="text-xl font-black text-slate-900">Tạo Phiếu Thu Nội Bộ</h2>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"><X className="w-5 h-5"/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/30">
                  <div>
                     <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nộp vào Quỹ</label>
                     <select value={selectedFundId} onChange={(e) => setSelectedFundId(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                        <option value="">-- Chọn quỹ nhận --</option>
                        {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Người nộp</label>
                     <select value={payerId} onChange={(e) => setPayerId(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                        <option value="">-- Chọn người nộp --</option>
                        {allUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Loại thu</label>
                     <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                        {['Góp quỹ', 'Hoàn ứng', 'Thu nợ', 'Khác'].map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Số tiền (VNĐ)</label>
                     <input type="number" min="0" required value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-slate-900 text-lg outline-none focus:border-emerald-500" />
                  </div>

                  <div>
                     <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nội dung</label>
                     <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="VD: Góp quỹ tháng 6..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 outline-none focus:border-emerald-500" />
                  </div>
               </div>

               <div className="p-6 border-t border-slate-100 bg-white">
                  <button onClick={handleSubmit} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-lg">
                     Tạo phiếu thu
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
