import React, { useState, useEffect } from 'react';
import { DollarSign, Calculator, Loader2, Wallet, TrendingUp, TrendingDown, CheckCircle2, FileText, Banknote } from 'lucide-react';
import { db, HrPayrollSlip, UserProfile } from '../../lib/supabase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from '../../lib/firebaseAdapter';
import { DataTable } from '../../components/DataTable';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

export function Payroll() {
  const [slips, setSlips] = useState<HrPayrollSlip[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubU = onSnapshot(query(collection(db, 'users')), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    const unsubP = onSnapshot(query(collection(db, 'hr_payroll_slips')), snap => {
      setSlips(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrPayrollSlip)));
      setLoading(false);
    });

    return () => { unsubU(); unsubP(); };
  }, []);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      await new Promise(res => setTimeout(res, 1500));
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      for (const u of users) {
         // Mock calculations for each user. In production, this aggregates DB tables.
         const base = u.baseSalary || 5000000;
         const comm = Math.floor(Math.random() * 3000000);
         const bonus = Math.floor(Math.random() * 500000);
         const deduct = Math.floor(Math.random() * 200000);
         const net = base + comm + bonus - deduct;

         // Check if slip exists
         const existing = slips.find(s => s.userId === u.uid && s.month === month && s.year === year);
         if (!existing) {
            await addDoc(collection(db, 'hr_payroll_slips'), {
              userId: u.uid,
              userName: u.name || u.email,
              month,
              year,
              baseSalary: base,
              totalCommission: comm,
              bonus,
              deductions: deduct,
              netSalary: net,
              status: 'draft',
              createdAt: serverTimestamp()
            });
         }
      }
      toast.success(`Đã tính xong lương tháng ${month}!`);
    } catch (err) {
      toast.error('Lỗi khi tính lương');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'finalized' | 'paid') => {
     await updateDoc(doc(db, 'hr_payroll_slips', id), { status, updatedAt: serverTimestamp() });
     toast.success('Cập nhật trạng thái thành công');
  };

  const columns = [
    { header: 'Nhân viên', accessorKey: 'userName', cell: ({row}: any) => {
       const u = users.find(x => x.uid === row.original.userId);
       return <div className="font-bold text-slate-800">{row.original.userName}<div className="text-[10px] text-slate-500 font-medium uppercase">{u?.position || 'Nhân viên'}</div></div>
    }},
    { header: 'Kỳ lương', accessorKey: 'month', cell: ({row}: any) => <span className="font-bold text-slate-600">Tháng {row.original.month}/{row.original.year}</span> },
    { header: 'Lương Cơ bản', accessorKey: 'baseSalary', cell: ({row}: any) => <span className="text-slate-600 font-medium">{formatCurrency(row.original.baseSalary)}</span> },
    { header: 'Tổng Thu nhập (+)', accessorKey: 'totalEarnings', cell: ({row}: any) => <span className="text-blue-600 font-bold">{formatCurrency(row.original.totalCommission + row.original.bonus)}</span> },
    { header: 'Các khoản trừ (-)', accessorKey: 'deductions', cell: ({row}: any) => <span className="text-rose-600 font-bold">{formatCurrency(row.original.deductions)}</span> },
    { header: 'Thực lĩnh', accessorKey: 'netSalary', cell: ({row}: any) => <span className="font-black text-emerald-600 text-lg">{formatCurrency(row.original.netSalary)}</span> },
    {
      header: 'Trạng thái',
      accessorKey: 'status',
      cell: ({ row }: any) => {
        const s = row.original.status;
        return (
          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max ${
            s === 'paid' ? 'bg-green-100 text-green-700' : 
            s === 'finalized' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
          }`}>
            {s === 'paid' ? <><Banknote className="w-3 h-3"/> Đã thanh toán</> : s === 'finalized' ? <><CheckCircle2 className="w-3 h-3"/> Đã chốt</> : <><FileText className="w-3 h-3"/> Tạm tính</>}
          </span>
        )
      }
    },
    { header: 'Tác vụ', accessorKey: 'actions', cell: ({row}: any) => {
       const s = row.original.status;
       return (
          <div className="flex gap-2">
             {s === 'draft' && <button onClick={() => handleUpdateStatus(row.original.id, 'finalized')} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-[10px] uppercase tracking-widest rounded-lg">Chốt lương</button>}
             {s === 'finalized' && <button onClick={() => handleUpdateStatus(row.original.id, 'paid')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[10px] uppercase tracking-widest rounded-lg">Đã TT</button>}
          </div>
       )
    }}
  ];

  const totalPayout = slips.reduce((a,b) => a + b.netSalary, 0);
  const totalBonus = slips.reduce((a,b) => a + b.bonus + b.totalCommission, 0);
  const totalDeduct = slips.reduce((a,b) => a + b.deductions, 0);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Quản lý Phiếu Lương</h1>
          <p className="text-slate-500 font-medium mt-1">Tính toán lương, thưởng và thu nhập tự động</p>
        </div>
        <button 
          onClick={handleCalculate}
          disabled={isCalculating}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 font-bold uppercase tracking-widest text-[10px] disabled:opacity-50"
        >
          {isCalculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
          <span>Tính Lương Tháng Này</span>
        </button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-24 h-24 text-emerald-500" /></div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0 z-10"><DollarSign className="w-6 h-6" /></div>
            <div className="z-10">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Quỹ Lương (Net)</p>
               <p className="text-3xl font-black text-emerald-600">{formatCurrency(totalPayout)}</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shrink-0"><TrendingUp className="w-6 h-6" /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Hoa hồng & Thưởng</p>
               <p className="text-2xl font-black text-blue-600">{formatCurrency(totalBonus)}</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0"><TrendingDown className="w-6 h-6" /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Khoản Phạt/Trừ</p>
               <p className="text-2xl font-black text-rose-600">{formatCurrency(totalDeduct)}</p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-emerald-500 w-8 h-8" /></div>
        ) : (
          <DataTable columns={columns} data={slips} searchPlaceholder="Tìm nhân viên..." />
        )}
      </div>
    </div>
  );
}
