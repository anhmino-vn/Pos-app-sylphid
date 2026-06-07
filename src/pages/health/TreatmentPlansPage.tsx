import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from '../../lib/firebaseAdapter';
import { db, TreatmentPlan, handleFirestoreError, OperationType } from '../../lib/supabase';
import { DataTable } from '../../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Search, Loader2, Plus, Calendar, Activity } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { useAuth } from '../../App';
import { TreatmentPlanForm } from './TreatmentPlanForm';

export function TreatmentPlansPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  
  const [isFormOpen, setIsFormOpen] = useState(false);

  const canManage = profile?.role === 'admin' || profile?.permissions?.services?.edit;

  useEffect(() => {
    const q = query(collection(db, 'treatmentPlans'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      snap => {
        setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as TreatmentPlan)));
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'treatmentPlans');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filteredPlans = useMemo(() => {
    let list = plans;
    if (activeTab !== 'all') {
      list = list.filter(p => p.status === activeTab);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p =>
        (p.customerName || '').toLowerCase().includes(s) ||
        (p.serviceName || '').toLowerCase().includes(s) ||
        (p.code || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [plans, activeTab, searchTerm]);

  const columns = useMemo<ColumnDef<TreatmentPlan>[]>(() => [
    {
      accessorKey: 'code',
      header: 'Mã LT',
      cell: ({ row }) => <span className="font-mono text-xs font-black text-rose-600">#{row.getValue('code') || '—'}</span>
    },
    {
      accessorKey: 'customerName',
      header: 'Khách hàng',
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-slate-900">{row.getValue('customerName')}</p>
          <p className="text-[10px] text-slate-500 font-medium">{row.original.customerPhone}</p>
        </div>
      )
    },
    {
      accessorKey: 'serviceName',
      header: 'Dịch vụ điều trị',
      cell: ({ row }) => <span className="text-sm font-bold text-slate-700">{row.getValue('serviceName')}</span>
    },
    {
      id: 'progress',
      header: 'Tiến độ',
      cell: ({ row }) => {
        const total = row.original.totalSessions || 0;
        const comp = row.original.completedSessions || 0;
        const pct = total > 0 ? (comp / total) * 100 : 0;
        return (
          <div className="w-32">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5 text-slate-500">
               <span>{comp}/{total} buổi</span>
               <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className={cn("h-full rounded-full transition-all", pct === 100 ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const label = status === 'active' ? 'Đang ĐT' : status === 'completed' ? 'Hoàn thành' : status === 'paused' ? 'Tạm dừng' : 'Đã hủy';
        const cls = status === 'active' ? 'bg-blue-100 text-blue-700' : status === 'completed' ? 'bg-emerald-100 text-emerald-700' : status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
        return <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest', cls)}>{label}</span>;
      }
    }
  ], []);

  const tabs = [
    { id: 'all', label: 'Tất cả', count: plans.length },
    { id: 'active', label: 'Đang điều trị', count: plans.filter(p => p.status === 'active').length },
    { id: 'completed', label: 'Hoàn thành', count: plans.filter(p => p.status === 'completed').length },
    { id: 'paused', label: 'Tạm dừng', count: plans.filter(p => p.status === 'paused').length },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9] p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Quản lý Liệu trình
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">Theo dõi tiến độ điều trị của khách hàng</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Tạo liệu trình
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
         <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 w-max overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
               <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                     'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap',
                     activeTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                  )}
               >
                  {tab.label}
                  <span className={cn(
                     'px-1.5 py-0.5 rounded-full text-[10px]',
                     activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100'
                  )}>{tab.count}</span>
               </button>
            ))}
         </div>
         <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
               type="text" 
               placeholder="Tìm khách hàng, dịch vụ..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
            />
         </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <Calendar className="w-12 h-12 mb-3 text-slate-200" />
             <p className="font-bold text-sm">Chưa có liệu trình nào</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredPlans}
            onRowClick={() => {}} // Will implement drawer later if requested
          />
        )}
      </div>

      {isFormOpen && <TreatmentPlanForm onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}
