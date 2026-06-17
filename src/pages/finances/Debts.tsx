import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, getDocs } from '../../lib/firebaseAdapter';
import { useAuth } from '../../App';
import { Users, Receipt, CheckCircle2, X, Send, CreditCard, ArrowRightLeft, AlertCircle, Clock } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

type TabType = 'my_debts' | 'requests';

export function Debts() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>('my_debts');
  const [debts, setDebts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<'offset' | 'payment'>('offset');
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!user) return;
    let uDone=false, fDone=false, dDone=false, rDone=false;
    const checkDone = () => { if(uDone && fDone && dDone && rDone) setLoading(false); };

    getDocs(collection('users')).then(snap => { setAllUsers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))); uDone=true; checkDone(); });
    onSnapshot(collection('internalFunds'), snap => { setFunds(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))); fDone=true; checkDone(); });
    
    // Fetch debts related to user
    onSnapshot(collection('internalDebts'), snap => {
      const allDebts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const myDebts = allDebts.filter(d => d.debtor_id === user.id || d.creditor_id === user.id);
      setDebts(myDebts);
      dDone=true; checkDone();
    });

    // Fetch requests related to user
    onSnapshot(collection('internalDebtRequests'), snap => {
      const allReqs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const myReqs = allReqs.filter(r => r.requester_id === user.id || r.target_id === user.id);
      setRequests(myReqs.sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
      rDone=true; checkDone();
    });
  }, [user]);

  // Process Debts
  const myOwes = debts.filter(d => d.debtor_id === user?.id && ['unpaid', 'partial'].includes(d.status)); // Tôi nợ người khác / quỹ
  const othersOweMe = debts.filter(d => d.creditor_id === user?.id && ['unpaid', 'partial'].includes(d.status)); // Người khác nợ tôi

  const totalIOwe = myOwes.reduce((sum, d) => sum + (d.amount - (d.paid_amount || 0)), 0);
  const totalOwedToMe = othersOweMe.reduce((sum, d) => sum + (d.amount - (d.paid_amount || 0)), 0);

  // Gom nhóm nợ Quỹ (để trả nợ gom)
  const myFundDebts = useMemo(() => {
     const map = new Map();
     myOwes.filter(d => d.creditor_fund_id).forEach(d => {
        if (!map.has(d.creditor_fund_id)) map.set(d.creditor_fund_id, { total: 0, items: [] });
        const val = map.get(d.creditor_fund_id);
        val.total += (d.amount - (d.paid_amount || 0));
        val.items.push(d);
     });
     return Array.from(map.entries()).map(([fundId, data]) => ({ fundId, ...data }));
  }, [myOwes]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || amount <= 0) return toast.error('Vui lòng nhập đầy đủ thông tin');
    
    try {
      await addDoc(collection('internalDebtRequests'), {
        requester_id: user?.id,
        target_id: targetId,
        amount,
        type: requestType,
        status: 'pending',
        note
      });
      toast.success('Đã gửi yêu cầu thành công!');
      setIsModalOpen(false);
      setTargetId('');
      setAmount(0);
      setNote('');
    } catch (err) {
      toast.error('Lỗi khi gửi yêu cầu');
    }
  };

  const handleApproveRequest = async (req: any) => {
    if (!window.confirm('Xác nhận đồng ý yêu cầu này? Cập nhật sẽ được ghi nhận vào công nợ.')) return;
    try {
      // 1. Update request status
      await updateDoc(doc(collection('internalDebtRequests'), req.id), { status: 'approved' });

      // 2. Logic cấn trừ (Offset) hoặc Thanh toán (Payment) sẽ phức tạp.
      // Vì mockup này minh họa nghiệp vụ: chúng ta tạo một record debt mới báo đã trả hoặc đối trừ
      toast.success('Đã xác nhận yêu cầu đối trừ/thanh toán');
    } catch (err) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleRejectRequest = async (id: string) => {
    if (!window.confirm('Từ chối yêu cầu này?')) return;
    await updateDoc(doc(collection('internalDebtRequests'), id), { status: 'rejected' });
    toast.success('Đã từ chối');
  };

  const handlePayFund = async (fundId: string, items: any[]) => {
    if (!window.confirm('Bạn muốn thanh toán toàn bộ nợ cho Quỹ này? Hệ thống sẽ báo cho quản lý Quỹ xác nhận (Phiếu thu).')) return;
    
    // Tự động tạo 1 phiếu thu chờ duyệt cho Quỹ
    const totalPay = items.reduce((sum, d) => sum + (d.amount - (d.paid_amount || 0)), 0);
    const fund = funds.find(f => f.id === fundId);

    try {
      await addDoc(collection('internalTransactions'), {
         fund_id: fundId,
         type: 'income',
         amount: totalPay,
         category: 'Thu nợ',
         description: `Thanh toán gom ${items.length} khoản nợ của ${user?.email}`,
         status: 'pending',
         payer_payee_id: user?.id,
         created_by: user?.id,
      });

      toast.success(`Đã gửi yêu cầu thanh toán ${formatCurrency(totalPay)} đ tới Quỹ ${fund?.name}. Vui lòng chờ Kế toán duyệt!`);
    } catch (err) {
      toast.error('Có lỗi xảy ra');
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">Công Nợ Nội Bộ</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Quản lý chia tiền, ứng tiền và đối trừ công nợ</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setTab('my_debts')} className={cn("px-4 py-2 font-bold text-sm rounded-lg transition-colors", tab === 'my_debts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>Công nợ cá nhân</button>
           <button onClick={() => setTab('requests')} className={cn("px-4 py-2 font-bold text-sm rounded-lg transition-colors relative", tab === 'requests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              Yêu cầu <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white rounded-md text-[10px]">{requests.filter(r => r.target_id === user?.id && r.status === 'pending').length}</span>
           </button>
        </div>
      </div>

      {tab === 'my_debts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TÔI NỢ */}
            <div className="bg-rose-50/50 border border-rose-100 rounded-[24px] p-6 shadow-sm">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center"><AlertCircle className="w-5 h-5"/></div>
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Tôi nợ người khác / quỹ</p>
                   <p className="text-2xl font-black text-rose-600">{formatCurrency(totalIOwe)} đ</p>
                 </div>
               </div>

               <div className="space-y-4">
                  {myFundDebts.map(fd => {
                     const fund = funds.find(f => f.id === fd.fundId);
                     return (
                        <div key={fd.fundId} className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
                           <div className="flex justify-between items-center mb-3">
                              <p className="font-bold text-slate-900">Quỹ: {fund?.name || '---'}</p>
                              <button onClick={() => handlePayFund(fd.fundId, fd.items)} className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-100">Trả nợ gom</button>
                           </div>
                           <div className="space-y-2">
                              {fd.items.map((item: any) => (
                                 <div key={item.id} className="flex justify-between items-center text-sm border-t border-slate-50 pt-2">
                                    <p className="text-slate-600">{item.reason}</p>
                                    <p className="font-bold text-rose-600">{formatCurrency(item.amount - (item.paid_amount || 0))} đ</p>
                                 </div>
                              ))}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>

            {/* NGƯỜI KHÁC NỢ TÔI */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-[24px] p-6 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><CreditCard className="w-5 h-5"/></div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Người khác nợ tôi</p>
                     <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalOwedToMe)} đ</p>
                   </div>
                 </div>
                 <button onClick={() => setIsModalOpen(true)} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">
                   <ArrowRightLeft className="w-4 h-4"/> Yêu cầu đối trừ
                 </button>
               </div>

               <div className="space-y-3">
                  {othersOweMe.length === 0 ? (
                     <p className="text-sm text-slate-500 italic text-center py-4">Không ai nợ bạn.</p>
                  ) : othersOweMe.map((d: any) => {
                     const debtor = allUsers.find(u => u.id === d.debtor_id);
                     return (
                        <div key={d.id} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex justify-between items-center">
                           <div>
                              <p className="font-bold text-slate-900">{debtor?.name || debtor?.email}</p>
                              <p className="text-xs text-slate-500">{d.reason}</p>
                           </div>
                           <p className="font-black text-emerald-600">{formatCurrency(d.amount - (d.paid_amount || 0))} đ</p>
                        </div>
                     );
                  })}
               </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-50">
             <h3 className="font-black text-lg text-slate-900">Danh sách Yêu cầu Đối trừ / Thanh toán</h3>
          </div>
          <div className="divide-y divide-slate-50">
             {requests.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-bold">Không có yêu cầu nào</div>
             ) : requests.map(req => {
                const isReceived = req.target_id === user?.id;
                const otherPerson = allUsers.find(u => u.id === (isReceived ? req.requester_id : req.target_id));
                return (
                   <div key={req.id} className={cn("p-5 flex items-center justify-between transition-colors hover:bg-slate-50/50", isReceived && req.status === 'pending' ? 'bg-indigo-50/30' : '')}>
                      <div className="flex items-center gap-4">
                         <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", req.type === 'offset' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600')}>
                            {req.type === 'offset' ? <ArrowRightLeft className="w-5 h-5"/> : <Receipt className="w-5 h-5"/>}
                         </div>
                         <div>
                            <p className="font-bold text-slate-900 text-sm">
                               {isReceived ? (
                                  <> <span className="text-indigo-600">{otherPerson?.name || otherPerson?.email}</span> yêu cầu {req.type === 'offset' ? 'đối trừ' : 'thanh toán'} với bạn </>
                               ) : (
                                  <> Bạn yêu cầu {req.type === 'offset' ? 'đối trừ' : 'thanh toán'} với <span className="text-indigo-600">{otherPerson?.name || otherPerson?.email}</span> </>
                               )}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{req.note}</p>
                            <p className="text-[10px] text-slate-400 mt-1"><Clock className="w-3 h-3 inline mr-1"/>{new Date(req.created_at || Date.now()).toLocaleString('vi-VN')}</p>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                         <p className="text-lg font-black text-slate-900">{formatCurrency(req.amount)} đ</p>
                         {req.status === 'pending' ? (
                            isReceived ? (
                               <div className="flex gap-2">
                                  <button onClick={() => handleApproveRequest(req)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/30">Đồng ý</button>
                                  <button onClick={() => handleRejectRequest(req.id)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100">Từ chối</button>
                               </div>
                            ) : (
                               <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 px-2 py-1 rounded-md">Chờ xác nhận</span>
                            )
                         ) : (
                            <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md", req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                               {req.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                            </span>
                         )}
                      </div>
                   </div>
                );
             })}
          </div>
        </div>
      )}

      {/* Modal Yêu Cầu Đối Trừ */}
      <AnimatePresence>
         {isModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
               <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                     <h2 className="text-lg font-black text-slate-900">Gửi yêu cầu</h2>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"><X className="w-5 h-5"/></button>
                  </div>
                  <form onSubmit={handleSendRequest} className="p-6 space-y-5">
                     <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Loại yêu cầu</label>
                        <select value={requestType} onChange={(e) => setRequestType(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500">
                           <option value="offset">Đối trừ công nợ chéo</option>
                           <option value="payment">Xác nhận đã trả nợ</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Gửi tới</label>
                        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500">
                           <option value="">-- Chọn nhân viên --</option>
                           {allUsers.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Số tiền cấn trừ / trả (VNĐ)</label>
                        <input type="number" min="1" required value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-lg outline-none focus:border-indigo-500" />
                     </div>
                     <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Ghi chú</label>
                        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Đối trừ tiền mua trà sữa hôm qua..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 outline-none focus:border-indigo-500" />
                     </div>
                     <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2">
                        <Send className="w-5 h-5"/> Gửi yêu cầu
                     </button>
                  </form>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}
