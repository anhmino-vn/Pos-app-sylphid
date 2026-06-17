import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, getDocs } from '../../lib/firebaseAdapter';
import { useAuth } from '../../App';
import { Receipt, Plus, Search, Filter, CheckCircle2, X, PlusCircle, Trash2, Split, Users } from 'lucide-react';
import { formatCurrency, generateDocCode, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export function Expenses() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState('');
  const [category, setCategory] = useState('Ăn uống');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([{ name: '', price: 0, quantity: 1, note: '' }]);
  const [isSplit, setIsSplit] = useState(false);
  const [splitMembers, setSplitMembers] = useState<string[]>([]); // User IDs

  useEffect(() => {
    // Fetch users
    getDocs(collection('users')).then(snap => setAllUsers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    
    // Fetch user's visible funds
    const unsubFunds = onSnapshot(collection('internalFunds'), snap => {
      const allFunds = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const visible = allFunds.filter(f => f.manager_id === user?.id || (f.members || []).includes(user?.id) || profile?.role === 'admin');
      setFunds(visible);
    });

    // Fetch expenses
    const unsubTx = onSnapshot(collection('internalTransactions'), snap => {
      const txs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((t: any) => t.type === 'expense' && !t.is_deleted);
      setTransactions(txs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
      setLoading(false);
    });

    return () => { unsubFunds(); unsubTx(); };
  }, [user, profile]);

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundId) return toast.error('Vui lòng chọn quỹ chi');
    if (totalAmount <= 0) return toast.error('Số tiền chi phải lớn hơn 0');
    if (isSplit && splitMembers.length === 0) return toast.error('Vui lòng chọn người để chia tiền');

    const validItems = items.filter(i => i.name.trim() !== '' && i.price > 0 && i.quantity > 0);
    if (validItems.length === 0) return toast.error('Danh sách mặt hàng không hợp lệ');

    try {
      const txData = {
        code: generateDocCode('PC'),
        fund_id: selectedFundId,
        type: 'expense',
        amount: totalAmount,
        category,
        description,
        status: 'pending', // Chờ duyệt
        split_members: isSplit ? splitMembers : [],
        created_by: user?.id,
        payer_payee_id: user?.id,
        items: validItems
      };

      await addDoc(collection('internalTransactions'), txData);
      toast.success('Đã tạo phiếu chi. Vui lòng chờ duyệt!');
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tạo phiếu chi');
    }
  };

  const resetForm = () => {
    setCategory('Ăn uống');
    setDescription('');
    setItems([{ name: '', price: 0, quantity: 1, note: '' }]);
    setIsSplit(false);
    setSplitMembers([]);
    setSelectedFundId('');
  };

  // Duyệt phiếu chi -> Trừ Quỹ + Tự động sinh công nợ (nếu Split)
  const handleApprove = async (tx: any) => {
    if (!window.confirm('Xác nhận duyệt khoản chi này? Số dư quỹ sẽ bị trừ.')) return;
    try {
      const fund = funds.find(f => f.id === tx.fund_id);
      if (!fund) return toast.error('Không tìm thấy thông tin quỹ');
      if (fund.current_balance < tx.amount) return toast.error('Số dư quỹ không đủ để chi');

      // 1. Update Transaction Status
      await updateDoc(doc(collection('internalTransactions'), tx.id), {
        status: 'approved',
        approved_by: user?.id
      });

      // 2. Deduct Fund Balance
      await updateDoc(doc(collection('internalFunds'), fund.id), {
        current_balance: fund.current_balance - tx.amount,
        total_expense: (fund.total_expense || 0) + tx.amount
      });

      // 3. Generate Debts if Split
      if (tx.split_members && tx.split_members.length > 0) {
        const splitAmount = tx.amount / tx.split_members.length;
        for (const memberId of tx.split_members) {
          await addDoc(collection('internalDebts'), {
             debtor_id: memberId,
             creditor_fund_id: fund.id, // Nợ Quỹ
             amount: splitAmount,
             reason: `Chia tiền: ${tx.description || tx.category}`,
             source_transaction_id: tx.id,
             status: 'unpaid'
          });
        }
        toast.success(`Đã duyệt và tự động sinh công nợ cho ${tx.split_members.length} người!`);
      } else {
        toast.success('Đã duyệt phiếu chi thành công!');
      }

    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi duyệt phiếu');
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Từ chối phiếu chi này?')) return;
    await updateDoc(doc(collection('internalTransactions'), id), { status: 'rejected' });
    toast.success('Đã từ chối phiếu chi');
  };

  const visibleTransactions = transactions.filter(t => {
     // User only sees tx from funds they are part of
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
            Phiếu Chi Nội Bộ
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Quản lý các khoản chi tiêu từ quỹ nhóm</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30">
          <Plus className="w-5 h-5" /> Tạo phiếu chi
        </button>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
          <div className="relative w-64">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Tìm phiếu chi..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-rose-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Mã / Ngày</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Từ Quỹ</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nội dung</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Tổng tiền</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">Đang tải dữ liệu...</td></tr>
              ) : visibleTransactions.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-500 font-bold">Chưa có phiếu chi nào</td></tr>
              ) : (
                visibleTransactions.map(t => {
                   const fund = funds.find(f => f.id === t.fund_id);
                   const isSplit = t.split_members && t.split_members.length > 0;
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
                         <p className="text-sm font-bold text-slate-700">{t.description || t.category}</p>
                         {isSplit && (
                            <p className="text-[10px] font-bold text-indigo-500 mt-1 flex items-center gap-1"><Split className="w-3 h-3"/> Chia cho {t.split_members.length} người</p>
                         )}
                       </td>
                       <td className="px-6 py-4 text-right">
                         <p className="text-sm font-black text-rose-600">{formatCurrency(t.amount)} đ</p>
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
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
               <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h2 className="text-xl font-black text-slate-900">Tạo Phiếu Chi Nội Bộ</h2>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"><X className="w-5 h-5"/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                  <div className="grid grid-cols-2 gap-6">
                     <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Trích từ Quỹ</label>
                        <select value={selectedFundId} onChange={(e) => setSelectedFundId(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-rose-500">
                           <option value="">-- Chọn quỹ chi --</option>
                           {funds.map(f => <option key={f.id} value={f.id}>{f.name} (Tồn: {formatCurrency(f.current_balance)})</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Danh mục</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-rose-500">
                           {['Ăn uống', 'Văn phòng phẩm', 'Sinh nhật / Sự kiện', 'Thiết bị', 'Khác'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Lý do chi</label>
                     <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="VD: Mua cơm trưa ngày 10/06..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 outline-none focus:border-rose-500" />
                  </div>

                  {/* Chi tiết hạng mục */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                     <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Hạng mục chi tiết</span>
                     </div>
                     <div className="p-4 space-y-3">
                        {items.map((item, index) => (
                           <div key={index} className="flex gap-3 items-start">
                              <div className="flex-1">
                                 <input type="text" placeholder="Tên món đồ / dịch vụ" value={item.name} onChange={e => { const newItems = [...items]; newItems[index].name = e.target.value; setItems(newItems); }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-rose-500" />
                              </div>
                              <div className="w-32">
                                 <input type="number" min="0" placeholder="Đơn giá" value={item.price || ''} onChange={e => { const newItems = [...items]; newItems[index].price = Number(e.target.value); setItems(newItems); }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-rose-500" />
                              </div>
                              <div className="w-20">
                                 <input type="number" min="1" placeholder="SL" value={item.quantity || ''} onChange={e => { const newItems = [...items]; newItems[index].quantity = Number(e.target.value); setItems(newItems); }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 text-center outline-none focus:border-rose-500" />
                              </div>
                              <button type="button" onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== index))} className="p-2 text-slate-300 hover:text-rose-500 mt-1 transition-colors"><Trash2 className="w-4 h-4"/></button>
                           </div>
                        ))}
                        <button type="button" onClick={() => setItems([...items, { name: '', price: 0, quantity: 1, note: '' }])} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 mt-2">
                           <PlusCircle className="w-4 h-4"/> Thêm dòng
                        </button>
                     </div>
                     <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 text-right">
                        <span className="text-sm font-bold text-slate-500 mr-4">Tổng cộng:</span>
                        <span className="text-2xl font-black text-rose-600">{formatCurrency(totalAmount)} đ</span>
                     </div>
                  </div>

                  {/* Split Bill */}
                  <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-5">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={isSplit} onChange={(e) => { setIsSplit(e.target.checked); if(e.target.checked && splitMembers.length === 0) setSplitMembers([user?.id || '']); }} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"/>
                        <span className="font-bold text-indigo-900 flex items-center gap-2"><Split className="w-5 h-5"/> Yêu cầu mọi người đóng góp (Chia tiền)</span>
                     </label>

                     {isSplit && (
                        <div className="mt-4 pt-4 border-t border-indigo-100">
                           <p className="text-xs font-bold text-indigo-700 mb-3">Chọn những người tham gia ăn uống / sử dụng chung:</p>
                           <div className="max-h-40 overflow-y-auto border border-indigo-100 bg-white rounded-xl p-2 grid grid-cols-2 gap-2">
                              {allUsers.map(u => (
                                 <label key={u.id} className={cn("flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors", splitMembers.includes(u.id) ? "bg-indigo-50 border-indigo-200" : "hover:bg-slate-50 border-transparent")}>
                                    <input type="checkbox" checked={splitMembers.includes(u.id)} onChange={e => {
                                       if(e.target.checked) setSplitMembers([...splitMembers, u.id]);
                                       else setSplitMembers(splitMembers.filter(id => id !== u.id));
                                    }} className="rounded text-indigo-600" />
                                    <span className="text-sm font-bold text-slate-700">{u.name || u.email}</span>
                                 </label>
                              ))}
                           </div>
                           {splitMembers.length > 0 && (
                              <p className="mt-3 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg inline-block">
                                 Sẽ tự động tạo công nợ: Mỗi người nợ quỹ {formatCurrency(totalAmount / splitMembers.length)} đ
                              </p>
                           )}
                        </div>
                     )}
                  </div>

               </div>

               <div className="p-6 border-t border-slate-100 bg-white">
                  <button onClick={handleSubmit} className="w-full py-4 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-2 text-lg">
                     Tạo phiếu chi <span className="font-normal text-rose-200">({formatCurrency(totalAmount)} đ)</span>
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
