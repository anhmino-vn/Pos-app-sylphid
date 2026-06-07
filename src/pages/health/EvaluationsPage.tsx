import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from '../../lib/firebaseAdapter';
import { db, HealthEvaluation, handleFirestoreError, OperationType } from '../../lib/supabase';
import { DataTable } from '../../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Search, Loader2, BarChart3, TrendingUp, Users, HeartHandshake } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../App';

export function EvaluationsPage() {
  const { profile } = useAuth();
  const [evals, setEvals] = useState<HealthEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'healthEvaluations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      snap => {
        setEvals(snap.docs.map(d => ({ id: d.id, ...d.data() } as HealthEvaluation)));
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'healthEvaluations');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filteredEvals = useMemo(() => {
    let list = evals;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(e =>
        (e.customerName || '').toLowerCase().includes(s) ||
        (e.treatmentPlanName || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [evals, searchTerm]);

  const columns = useMemo<ColumnDef<HealthEvaluation>[]>(() => [
    {
      accessorKey: 'customerName',
      header: 'Khách hàng',
      cell: ({ row }) => <span className="font-bold text-slate-900">{row.getValue('customerName')}</span>
    },
    {
      accessorKey: 'treatmentPlanName',
      header: 'Liệu trình',
      cell: ({ row }) => <span className="text-sm font-bold text-emerald-700">{row.getValue('treatmentPlanName')}</span>
    },
    {
      id: 'weight',
      header: 'Cân nặng (Trước - Sau)',
      cell: ({ row }) => {
         const before = row.original.weightBefore;
         const after = row.original.weightAfter;
         if (!before && !after) return <span className="text-slate-400">—</span>;
         return (
            <div className="flex items-center gap-2 text-sm font-medium">
               <span className="text-slate-500">{before || '?'} kg</span>
               <span className="text-slate-300">→</span>
               <span className={cn("font-bold", (after || 0) < (before || 0) ? "text-emerald-500" : "text-rose-500")}>{after || '?'} kg</span>
            </div>
         );
      }
    },
    {
      accessorKey: 'improvementRate',
      header: 'Mức độ cải thiện',
      cell: ({ row }) => {
         const rate = row.getValue('improvementRate') as number;
         if (!rate) return <span className="text-slate-400">—</span>;
         return (
            <div className="flex items-center gap-2">
               <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(rate, 100)}%` }} />
               </div>
               <span className="text-xs font-black text-emerald-600">{rate}%</span>
            </div>
         );
      }
    },
    {
      accessorKey: 'customerRating',
      header: 'Khách hàng ĐG',
      cell: ({ row }) => {
         const rating = row.getValue('customerRating') as number;
         if (!rating) return <span className="text-slate-400">—</span>;
         return (
            <div className="flex text-amber-400">
               {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < rating ? "text-amber-400" : "text-slate-200"}>★</span>
               ))}
            </div>
         );
      }
    },
    {
      accessorKey: 'evaluatedAt',
      header: 'Ngày đánh giá',
      cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.getValue('evaluatedAt'))}</span>
    }
  ], []);

  // Dashboard Stats
  const stats = useMemo(() => {
     return [
        { label: 'Tổng số khách điều trị', value: '156', icon: Users, color: 'blue' },
        { label: 'Tỷ lệ hoàn thành', value: '82%', icon: TrendingUp, color: 'emerald' },
        { label: 'Tỷ lệ hài lòng', value: '96%', icon: HeartHandshake, color: 'rose' },
        { label: 'Liệu trình đang HĐ', value: '45', icon: BarChart3, color: 'amber' },
     ]
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9] p-4 md:p-6 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-500" />
            Kết quả đánh giá
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">Theo dõi hiệu quả và mức độ hài lòng của khách hàng</p>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
         {stats.map((stat, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-${stat.color}-50 text-${stat.color}-500`}>
                  <stat.icon className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
               </div>
            </div>
         ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 mb-4">
         <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
               type="text" 
               placeholder="Tìm theo khách hàng..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
            />
         </div>
      </div>

      <div className="flex-1 min-h-[400px] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : filteredEvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
             <BarChart3 className="w-12 h-12 mb-3 text-slate-200" />
             <p className="font-bold text-sm">Chưa có kết quả đánh giá nào</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredEvals}
            onRowClick={() => {}} // Will implement view drawer when clicking
          />
        )}
      </div>
    </div>
  );
}
