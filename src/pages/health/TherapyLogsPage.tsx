import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from '../../lib/firebaseAdapter';
import { db, TherapyLog, handleFirestoreError, OperationType } from '../../lib/supabase';
import { DataTable } from '../../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Search, Loader2, Plus, Sparkles, User, CalendarDays } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../App';
import { TherapyLogForm } from './TherapyLogForm';

export function TherapyLogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<TherapyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);

  const canManage = profile?.role === 'admin' || profile?.permissions?.services?.edit;

  useEffect(() => {
    const q = query(collection(db, 'therapyLogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      snap => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as TherapyLog)));
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'therapyLogs');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filteredLogs = useMemo(() => {
    let list = logs;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(l =>
        (l.customerName || '').toLowerCase().includes(s) ||
        (l.technicianName || '').toLowerCase().includes(s) ||
        (l.servicesPerformed || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [logs, searchTerm]);

  const columns = useMemo<ColumnDef<TherapyLog>[]>(() => [
    {
      accessorKey: 'createdAt',
      header: 'Ngày thực hiện',
      cell: ({ row }) => {
         const date = row.original.date ? new Date(row.original.date) : row.getValue('createdAt');
         return (
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4 text-blue-500" />
               </div>
               <span className="text-sm font-bold text-slate-700">{date ? formatDate(date) : '—'}</span>
            </div>
         );
      }
    },
    {
      accessorKey: 'customerName',
      header: 'Khách hàng',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User className="w-3 h-3 text-slate-400" />
          </div>
          <span className="font-bold text-slate-900">{row.getValue('customerName')}</span>
        </div>
      )
    },
    {
      accessorKey: 'sessionNumber',
      header: 'Buổi',
      cell: ({ row }) => {
         const session = row.getValue('sessionNumber');
         return <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-black">Buổi {session || '?'}</span>;
      }
    },
    {
      accessorKey: 'servicesPerformed',
      header: 'Dịch vụ thực hiện',
      cell: ({ row }) => <span className="text-sm font-medium text-slate-700 line-clamp-1">{row.getValue('servicesPerformed') || '—'}</span>
    },
    {
      accessorKey: 'technicianName',
      header: 'KTV phụ trách',
      cell: ({ row }) => <span className="text-xs font-bold text-slate-600">{row.getValue('technicianName') || '—'}</span>
    },
    {
      accessorKey: 'results',
      header: 'Kết quả',
      cell: ({ row }) => <span className="text-xs font-medium text-slate-500 line-clamp-1">{row.getValue('results') || '—'}</span>
    }
  ], []);

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9] p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Nhật ký trị liệu
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">Theo dõi chi tiết từng buổi thực hiện dịch vụ</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Thêm nhật ký
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 mb-4">
         <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
               type="text" 
               placeholder="Tìm khách hàng, KTV, dịch vụ..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-medium"
            />
         </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <CalendarDays className="w-12 h-12 mb-3 text-slate-200" />
             <p className="font-bold text-sm">Chưa có nhật ký nào</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredLogs}
            onRowClick={() => {}} // Can implement view drawer later
          />
        )}
      </div>

      {isFormOpen && <TherapyLogForm onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}
