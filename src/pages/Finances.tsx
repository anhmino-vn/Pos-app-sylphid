import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from '../lib/firebaseAdapter';
import { useAuth } from '../App';
import { Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck, Activity, Users, CreditCard } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export function Finances() {
  const { user, profile } = useAuth();
  const [funds, setFunds] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let fDone=false, tDone=false, dDone=false;
    const checkDone = () => { if(fDone && tDone && dDone) setLoading(false); };

    // Fetch user's visible funds
    const unsubFunds = onSnapshot(collection('internalFunds'), snap => {
      const allFunds = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const visible = allFunds.filter(f => f.manager_id === user?.id || (f.members || []).includes(user?.id) || profile?.role === 'admin');
      setFunds(visible);
      fDone=true; checkDone();
    });

    // Fetch transactions of those funds for this month
    const unsubTx = onSnapshot(collection('internalTransactions'), snap => {
      const txs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((t: any) => t.status === 'approved');
      setTransactions(txs);
      tDone=true; checkDone();
    });

    // Fetch user's debts
    const unsubDebts = onSnapshot(collection('internalDebts'), snap => {
      const allDebts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const myDebts = allDebts.filter(d => d.debtor_id === user?.id || d.creditor_id === user?.id);
      setDebts(myDebts);
      dDone=true; checkDone();
    });

    return () => { unsubFunds(); unsubTx(); unsubDebts(); };
  }, [user, profile]);

  const totalFundBalance = funds.reduce((acc, f) => acc + (f.current_balance || 0), 0);
  
  // Lọc thu/chi trong tháng này (demo: check created_at in current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const txThisMonth = transactions.filter(t => {
     const d = new Date(t.created_at || 0);
     return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const incomeThisMonth = txThisMonth.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expenseThisMonth = txThisMonth.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  // Nợ
  const owedByMe = debts.filter(d => d.debtor_id === user?.id && ['unpaid', 'partial'].includes(d.status))
                        .reduce((acc, d) => acc + (d.amount - (d.paid_amount || 0)), 0);
  const owedToMe = debts.filter(d => d.creditor_id === user?.id && ['unpaid', 'partial'].includes(d.status))
                        .reduce((acc, d) => acc + (d.amount - (d.paid_amount || 0)), 0);

  if (loading) return <div className="flex justify-center p-12"><Activity className="w-8 h-8 animate-pulse text-indigo-500" /></div>;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Tài Chính</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Tổng quan quỹ nội bộ, chi tiêu và công nợ cá nhân</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-[24px] shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
           <div className="absolute -right-4 -bottom-4 opacity-10">
              <Wallet className="w-32 h-32 text-white" />
           </div>
           <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Tổng Tồn Quỹ ({funds.length} quỹ)</p>
              <p className="text-3xl font-black text-white">{formatCurrency(totalFundBalance)}</p>
           </div>
           <Link to="/finances/funds" className="mt-8 inline-block px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-xl text-white text-xs font-bold w-fit">Xem chi tiết Sổ Quỹ</Link>
        </div>
        
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ArrowDownRight className="w-5 h-5" /></div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Thu tháng này</p>
           </div>
           <p className="text-2xl font-black text-slate-900">+{formatCurrency(incomeThisMonth)}</p>
           
           <div className="flex items-center gap-3 mt-8">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><ArrowUpRight className="w-5 h-5" /></div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Chi tháng này</p>
                 <p className="text-lg font-black text-rose-600">-{formatCurrency(expenseThisMonth)}</p>
              </div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><CreditCard className="w-5 h-5" /></div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Công nợ cá nhân</p>
           </div>
           
           <div className="space-y-4">
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex justify-between items-center">
                 <p className="text-xs font-bold text-rose-600">Bạn đang nợ</p>
                 <p className="font-black text-rose-600">{formatCurrency(owedByMe)}</p>
              </div>
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                 <p className="text-xs font-bold text-emerald-600">Người khác nợ bạn</p>
                 <p className="font-black text-emerald-600">{formatCurrency(owedToMe)}</p>
              </div>
           </div>
           
           <Link to="/finances/debts" className="mt-4 block text-center px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl text-slate-600 text-xs font-bold">Xử lý công nợ / Chia tiền</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6">
          <h3 className="font-black text-lg text-slate-900 mb-6">Luồng tiền cần duyệt</h3>
          <div className="bg-amber-50 rounded-xl p-6 text-center border border-amber-100">
             <ShieldCheck className="w-8 h-8 text-amber-500 mx-auto mb-3" />
             <p className="text-sm font-bold text-amber-800">Các yêu cầu chi tiêu / ứng tiền sẽ được hiển thị ở các module Thu - Chi tương ứng.</p>
             <div className="flex justify-center gap-4 mt-4">
               <Link to="/finances/expenses" className="px-4 py-2 bg-white text-rose-600 text-xs font-bold rounded-lg shadow-sm">Tạo phiếu chi mới</Link>
               <Link to="/finances/incomes" className="px-4 py-2 bg-white text-emerald-600 text-xs font-bold rounded-lg shadow-sm">Báo cáo nộp quỹ</Link>
             </div>
          </div>
        </div>

        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6">
          <h3 className="font-black text-lg text-slate-900 mb-6">Hoạt động tài chính</h3>
          <div className="space-y-4">
             {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                   <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')}>
                         {t.type === 'income' ? <ArrowDownRight className="w-5 h-5"/> : <ArrowUpRight className="w-5 h-5"/>}
                      </div>
                      <div>
                         <p className="font-bold text-sm text-slate-900">{t.description || t.category}</p>
                         <p className="text-[10px] text-slate-500">{new Date(t.created_at || 0).toLocaleString('vi-VN')}</p>
                      </div>
                   </div>
                   <p className={cn("font-black text-sm", t.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                   </p>
                </div>
             ))}
             {transactions.length === 0 && <p className="text-sm text-slate-500 text-center italic py-4">Chưa có giao dịch nào trong tháng</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
