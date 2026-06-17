import React, { useState, useEffect } from 'react';
import { CalendarClock, Check, X, Loader2, Calendar } from 'lucide-react';
import { db, handleFirestoreError, OperationType, HrShiftRegistration, HrAttendance } from '../../lib/supabase';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from '../../lib/firebaseAdapter';
import { DataTable } from '../../components/DataTable';
import { format } from 'date-fns';

export function Timesheets() {
  const [activeTab, setActiveTab] = useState<'requests' | 'attendance'>('requests');
  const [registrations, setRegistrations] = useState<HrShiftRegistration[]>([]);
  const [attendances, setAttendances] = useState<HrAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeReq: any;
    let unsubscribeAtt: any;

    if (activeTab === 'requests') {
      setLoading(true);
      unsubscribeReq = onSnapshot(
        query(collection('hrShiftRegistrations'), where('status', '==', 'pending')),
        (snap) => {
          setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrShiftRegistration)));
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'hrShiftRegistrations');
          setLoading(false);
        }
      );
    } else {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      unsubscribeAtt = onSnapshot(
        query(collection('hrAttendance'), where('date', '==', today)),
        (snap) => {
          setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrAttendance)));
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'hrAttendance');
          setLoading(false);
        }
      );
    }

    return () => {
      if (unsubscribeReq) unsubscribeReq();
      if (unsubscribeAtt) unsubscribeAtt();
    };
  }, [activeTab]);

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc('hrShiftRegistrations', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'hrShiftRegistrations');
    }
  };

  const reqColumns = [
    { header: 'Nhân viên', accessorKey: 'userName' },
    { header: 'Ngày làm', accessorKey: 'date' },
    { header: 'Ca làm', accessorKey: 'shiftName' },
    {
      header: 'Thao tác',
      id: 'actions',
      cell: ({ row }: any) => (
        <div className="flex gap-2">
          <button onClick={() => handleApprove(row.original.id, 'approved')} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={18} /></button>
          <button onClick={() => handleApprove(row.original.id, 'rejected')} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={18} /></button>
        </div>
      )
    }
  ];

  const attColumns = [
    { header: 'Nhân viên', accessorKey: 'userName' },
    { header: 'Giờ vào', accessorKey: 'checkInTime', cell: ({row}: any) => row.original.checkInTime ? format(new Date(row.original.checkInTime), 'HH:mm:ss') : '-' },
    { header: 'Giờ ra', accessorKey: 'checkOutTime', cell: ({row}: any) => row.original.checkOutTime ? format(new Date(row.original.checkOutTime), 'HH:mm:ss') : '-' },
    {
      header: 'Trạng thái',
      accessorKey: 'status',
      cell: ({ row }: any) => {
        const s = row.original.status;
        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            s === 'on_time' ? 'bg-green-100 text-green-700' : 
            s === 'late' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
          }`}>
            {s === 'on_time' ? 'Đúng giờ' : s === 'late' ? 'Đi muộn' : 'Vắng mặt'}
          </span>
        )
      }
    }
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Chấm công & Ca làm</h1>
          <p className="text-slate-500">Quản lý duyệt ca và theo dõi chấm công hằng ngày</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'requests' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Duyệt Ca</button>
          <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'attendance' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Chấm Công Hôm Nay</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        {activeTab === 'attendance' && !loading && (
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đi làm hôm nay</p>
                 <p className="text-2xl font-black text-slate-900">{attendances.length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center bg-emerald-50/30">
                 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Đúng giờ</p>
                 <p className="text-2xl font-black text-emerald-700">{attendances.filter(a => a.status === 'on_time').length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm flex flex-col justify-center bg-orange-50/30">
                 <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Đi muộn</p>
                 <p className="text-2xl font-black text-orange-700">{attendances.filter(a => a.status === 'late').length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-center bg-rose-50/30">
                 <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Vắng mặt (Chưa check-in)</p>
                 <p className="text-2xl font-black text-rose-700">{attendances.filter(a => a.status === 'absent').length}</p>
              </div>
           </div>
        )}

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : (
            activeTab === 'requests' ? (
               <DataTable columns={reqColumns} data={registrations} searchPlaceholder="Tìm nhân viên..." />
            ) : (
               <DataTable columns={attColumns} data={attendances} searchPlaceholder="Tìm nhân viên..." />
            )
          )}
        </div>
      </div>
    </div>
  );
}
