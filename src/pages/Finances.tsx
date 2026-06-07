import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ArrowDownLeft, ArrowUpRight, Search, Filter, DollarSign, Calendar, CreditCard, ChevronRight } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, where } from '../lib/firebaseAdapter';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

export function Finances() {
  const { profile } = useAuth();
  const location = useLocation();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('income');
  
  // Form states
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Bán hàng');
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'transfer'|'card'>('cash');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.action) {
       setTransactionType(location.state.action);
       setCategory(location.state.category || 'Bán hàng');
       setAmount(location.state.amount?.toString() || '');
       setDescription(location.state.description || '');
       setIsAddModalOpen(true);
       window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const q = query(collection('transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by created_at desc
      docs.sort((a, b) => new Date(b.created_at || Date.now()).getTime() - new Date(a.created_at || Date.now()).getTime());
      setTransactions(docs);
      setLoading(false);
    }, (err) => {
      console.error("Lỗi tải Sổ quỹ (Có thể do bảng chưa được tạo):", err);
      // Giả lập dữ liệu nếu lỗi bảng (fallback local storage logic can be added later)
      toast.error("Không thể tải dữ liệu Sổ Quỹ. Vui lòng kiểm tra Database.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return toast.error("Vui lòng nhập số tiền hợp lệ");

    setIsSubmitting(true);
    try {
      await addDoc(collection('transactions'), {
        type: transactionType,
        amount: Number(amount),
        category,
        payment_method: paymentMethod,
        description,
        created_at: new Date().toISOString(),
        created_by: profile?.id || 'system'
      });
      toast.success(`Đã tạo phiếu ${transactionType === 'income' ? 'thu' : 'chi'} thành công!`);
      setIsAddModalOpen(false);
      setAmount('');
      setDescription('');
    } catch (error: any) {
      console.error(error);
      toast.error("Có lỗi xảy ra! Hãy chắc chắn bảng 'transactions' đã được tạo trên Supabase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sổ Quỹ Thu Chi</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Quản lý dòng tiền và các giao dịch phát sinh</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setTransactionType('income'); setIsAddModalOpen(true); }}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowDownLeft className="w-5 h-5" />
            Lập Phiếu Thu
          </button>
          <button 
            onClick={() => { setTransactionType('expense'); setIsAddModalOpen(true); }}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-5 h-5" />
            Lập Phiếu Chi
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-5">
              <ArrowDownLeft className="w-24 h-24 text-emerald-500" />
           </div>
           <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Tổng Thu Trong Kỳ</p>
           <p className="text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-5">
              <ArrowUpRight className="w-24 h-24 text-rose-500" />
           </div>
           <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Tổng Chi Trong Kỳ</p>
           <p className="text-3xl font-black text-rose-600 tracking-tight">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[24px] border border-slate-800 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10">
              <DollarSign className="w-24 h-24 text-blue-500" />
           </div>
           <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Tồn Quỹ Hiện Tại</p>
           <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(balance)}</p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
         <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-black text-lg text-slate-900 tracking-tight">Lịch sử giao dịch</h3>
            <div className="flex items-center gap-3">
               <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Tìm giao dịch..." className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 w-full sm:w-64" />
               </div>
               <button className="p-2 border border-slate-100 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
                  <Filter className="w-4 h-4" />
               </button>
            </div>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50/50">
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Thời gian</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Loại / Hạng mục</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Số tiền</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Phương thức</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nội dung</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {loading ? (
                     <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">Đang tải dữ liệu...</td></tr>
                  ) : transactions.length === 0 ? (
                     <tr><td colSpan={5} className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                           <DollarSign className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold">Chưa có giao dịch nào</p>
                     </td></tr>
                  ) : (
                     transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-900">{new Date(t.created_at || Date.now()).toLocaleDateString('vi-VN')}</p>
                              <p className="text-[10px] font-bold text-slate-400">{new Date(t.created_at || Date.now()).toLocaleTimeString('vi-VN')}</p>
                           </td>
                           <td className="px-6 py-4">
                              <span className={cn("inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest", 
                                 t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              )}>
                                 {t.type === 'income' ? 'Thu' : 'Chi'}
                              </span>
                              <p className="text-sm font-bold text-slate-700 mt-1">{t.category}</p>
                           </td>
                           <td className="px-6 py-4">
                              <p className={cn("text-base font-black tracking-tight", t.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
                                 {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                              </p>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-slate-500">
                                 {t.payment_method === 'cash' ? <DollarSign className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                 <span className="text-xs font-bold uppercase">{t.payment_method === 'cash' ? 'Tiền mặt' : t.payment_method === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-700 max-w-xs truncate">{t.description || 'Không có ghi chú'}</p>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
         {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
                  <div className={cn("p-6 text-white", transactionType === 'income' ? 'bg-emerald-500' : 'bg-rose-500')}>
                     <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                        {transactionType === 'income' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                        Lập Phiếu {transactionType === 'income' ? 'Thu' : 'Chi'}
                     </h2>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-6 space-y-5">
                     <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Số tiền (VNĐ) <span className="text-rose-500">*</span></label>
                        <div className="relative">
                           <input autoFocus type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="0" />
                           <DollarSign className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                     </div>
                     
                     <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Hạng mục <span className="text-rose-500">*</span></label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500">
                           {transactionType === 'income' ? (
                              <>
                                 <option value="Bán hàng">Doanh thu bán hàng</option>
                                 <option value="Thu nợ">Thu nợ khách hàng</option>
                                 <option value="Khác">Nguồn thu khác</option>
                              </>
                           ) : (
                              <>
                                 <option value="Nhập hàng">Chi trả nhà cung cấp (Nhập hàng)</option>
                                 <option value="Điện nước">Chi phí Điện/Nước/Mạng</option>
                                 <option value="Mặt bằng">Chi phí Mặt bằng</option>
                                 <option value="Lương">Lương nhân viên</option>
                                 <option value="Khác">Chi phí khác</option>
                              </>
                           )}
                        </select>
                     </div>

                     <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Phương thức <span className="text-rose-500">*</span></label>
                        <div className="grid grid-cols-3 gap-3">
                           {[
                              { id: 'cash', label: 'Tiền mặt' },
                              { id: 'transfer', label: 'Chuyển khoản' },
                              { id: 'card', label: 'Quẹt thẻ' }
                           ].map((method) => (
                              <button
                                 key={method.id} type="button"
                                 onClick={() => setPaymentMethod(method.id as any)}
                                 className={cn("py-2 px-3 rounded-xl border text-xs font-bold transition-all", paymentMethod === method.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')}
                              >
                                 {method.label}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Nội dung / Ghi chú</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500" placeholder="VD: Thu tiền mặt đơn hàng #123..." />
                     </div>

                     <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                           Hủy
                        </button>
                        <button type="submit" disabled={isSubmitting} className={cn("flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors", transactionType === 'income' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600', isSubmitting && 'opacity-50 cursor-not-allowed')}>
                           {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
                        </button>
                     </div>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
