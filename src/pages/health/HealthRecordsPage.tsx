import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, where } from '../../lib/firebaseAdapter';
import { db, HealthRecord, handleFirestoreError, OperationType } from '../../lib/supabase';
import { DataTable } from '../../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Search, Loader2, Plus, HeartPulse, FileText, User } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../App';
import { HealthRecordForm } from './HealthRecordForm';
import { HealthRecordDrawer } from './HealthRecordDrawer';

export function HealthRecordsPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'draft'>('all');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<HealthRecord | null>(null);

  const canManage = profile?.role === 'admin' || profile?.permissions?.customers?.edit;

  useEffect(() => {
    const q = query(collection(db, 'healthRecords'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q,
      snap => {
        setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as HealthRecord)));
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'healthRecords');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (activeTab !== 'all') {
      list = list.filter(r => r.status === activeTab);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(r =>
        (r.customerName || '').toLowerCase().includes(s) ||
        (r.customerPhone || '').includes(s) ||
        (r.code || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [records, activeTab, searchTerm]);

  const columns = useMemo<ColumnDef<HealthRecord>[]>(() => [
    {
      accessorKey: 'code',
      header: 'Mã HS',
      cell: ({ row }) => <span className="font-mono text-xs font-black text-blue-600">{row.getValue('code') || '—'}</span>
    },
    {
      accessorKey: 'customerName',
      header: 'Khách hàng',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="font-bold text-slate-900">{row.getValue('customerName')}</p>
            <p className="text-[10px] text-slate-500 font-medium">{row.original.customerPhone}</p>
          </div>
        </div>
      )
    },
    {
      accessorKey: 'gender',
      header: 'Giới tính/Tuổi',
      cell: ({ row }) => {
        const gender = row.getValue('gender') as string;
        const dob = row.original.dateOfBirth;
        let ageStr = '';
        if (dob) {
           const age = new Date().getFullYear() - new Date(dob).getFullYear();
           ageStr = ` / ${age}t`;
        }
        const gLabel = gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : 'Khác';
        return <span className="text-sm font-medium text-slate-700">{gender ? gLabel : '—'}{ageStr}</span>;
      }
    },
    {
      accessorKey: 'inChargeStaffName',
      header: 'Phụ trách',
      cell: ({ row }) => <span className="text-sm font-medium text-slate-700">{row.getValue('inChargeStaffName') || '—'}</span>
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngày tạo',
      cell: ({ row }) => {
         const date = row.getValue('createdAt');
         return <span className="text-xs text-slate-500 font-medium">{date ? formatDate(date) : '—'}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const label = status === 'active' ? 'Đang hoạt động' : status === 'draft' ? 'Nháp' : 'Đã đóng';
        const cls = status === 'active' ? 'bg-emerald-100 text-emerald-700' : status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
        return <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest', cls)}>{label}</span>;
      }
    }
  ], []);

  const tabs = [
    { id: 'all', label: 'Tất cả', count: records.length },
    { id: 'active', label: 'Hoạt động', count: records.filter(r => r.status === 'active').length },
    { id: 'draft', label: 'Nháp', count: records.filter(r => r.status === 'draft').length },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9] p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-rose-500" />
            Hồ sơ sức khỏe
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">Quản lý bệnh án và thông tin sức khỏe khách hàng</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setSelectedRecordId(null); setIsFormOpen(true); }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Thêm hồ sơ
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
         <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 w-max overflow-x-auto">
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
               placeholder="Tìm tên, SĐT, Mã hồ sơ..." 
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
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <FileText className="w-12 h-12 mb-3 text-slate-200" />
             <p className="font-bold text-sm">Chưa có hồ sơ sức khỏe nào</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredRecords}
            onRowClick={row => setViewingRecord(row)}
          />
        )}
      </div>

      {/* Forms & Drawers */}
      {isFormOpen && (
         <HealthRecordForm 
            recordId={selectedRecordId}
            onClose={() => setIsFormOpen(false)} 
         />
      )}

      {viewingRecord && (
         <HealthRecordDrawer
            record={viewingRecord}
            onClose={() => setViewingRecord(null)}
            onEdit={() => {
               setSelectedRecordId(viewingRecord.id!);
               setViewingRecord(null);
               setIsFormOpen(true);
            }}
         />
      )}
    </div>
  );
}
