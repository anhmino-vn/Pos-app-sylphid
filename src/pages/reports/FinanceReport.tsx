import React, { useMemo } from 'react';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { collection, onSnapshot, query, where } from '../../lib/firebaseAdapter';
import { db } from '../../lib/supabase';

export function FinanceReport({ dateRange }: { dateRange: string }) {
  // Demo data for now, ideally fetch transactions where is_deleted == false
  const [transactions, setTransactions] = React.useState<any[]>([]);

  React.useEffect(() => {
    const q = query(collection('transactions'), where('is_deleted', '==', false), where('status', '==', 'completed'));
    const unsub = onSnapshot(q, snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const { totalIncome, totalExpense, profit, marketingExpense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    let mkt = 0;
    transactions.forEach(t => {
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') {
        exp += t.amount;
        if (t.category === 'Marketing') mkt += t.amount;
      }
    });
    return {
      totalIncome: inc,
      totalExpense: exp,
      profit: inc - exp,
      marketingExpense: mkt
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><DollarSign className="w-5 h-5"/></div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Tổng Doanh Thu</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600"><TrendingDown className="w-5 h-5"/></div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Tổng Chi Phí</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400"><TrendingUp className="w-5 h-5"/></div>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Lợi Nhuận Gộp (P&L)</p>
          <p className="text-2xl font-black text-white">{formatCurrency(profit)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Activity className="w-5 h-5"/></div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Chi Phí Marketing</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(marketingExpense)}</p>
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 flex items-center justify-center min-h-[300px]">
         <div className="text-center">
            <p className="text-slate-500 font-bold mb-2">Biểu đồ dòng tiền (Cashflow) đang được phát triển</p>
            <p className="text-xs text-slate-400">Dữ liệu thực tế sẽ được tổng hợp từ Sổ quỹ và Doanh số bán hàng</p>
         </div>
      </div>
    </div>
  );
}
