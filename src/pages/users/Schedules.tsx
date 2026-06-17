import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, User, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { db, HrShiftRegistration, HrLeaveRequest, UserProfile } from '../../lib/supabase';
import { collection, query, onSnapshot, updateDoc, doc } from '../../lib/firebaseAdapter';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, startOfWeek, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';

export function Schedules() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'leave'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [registrations, setRegistrations] = useState<HrShiftRegistration[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<HrLeaveRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubU = onSnapshot(query(collection(db, 'users')), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    const unsubR = onSnapshot(query(collection(db, 'hr_shift_registrations')), snap => {
      setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrShiftRegistration)));
    });

    const unsubL = onSnapshot(query(collection(db, 'hr_leave_requests')), snap => {
      setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrLeaveRequest)));
      setLoading(false);
    });

    return () => { unsubU(); unsubR(); unsubL(); };
  }, []);

  const handleLeaveStatus = async (id: string, status: 'approved' | 'rejected') => {
     await updateDoc(doc(db, 'hr_leave_requests', id), { status });
  };

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = addDays(startDate, 41); // 6 weeks to fill grid

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Lịch làm việc & Ca trực</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý lịch làm việc và đơn xin nghỉ phép</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setActiveTab('calendar')} className={`px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Lịch trực</button>
           <button onClick={() => setActiveTab('leave')} className={`px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'leave' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Đơn xin nghỉ ({leaveRequests.filter(r => r.status === 'pending').length})</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
        ) : (
          activeTab === 'calendar' ? (
             <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-lg font-black uppercase text-slate-800">{format(currentDate, 'MMMM yyyy', { locale: vi })}</h2>
                   <div className="flex gap-2">
                      <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-800 font-bold text-sm">Hôm nay</button>
                      <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronRight className="w-5 h-5" /></button>
                   </div>
                </div>

                <div className="grid grid-cols-7 gap-[1px] bg-slate-200 rounded-2xl overflow-hidden border border-slate-200">
                   {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                      <div key={d} className="bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-widest text-slate-500">{d}</div>
                   ))}
                   
                   {days.map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      const isToday = isSameDay(day, new Date());
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dayRegs = registrations.filter(r => r.date === dateStr && r.status === 'approved');

                      return (
                         <div key={idx} className={`bg-white p-2 sm:p-3 min-h-[100px] sm:min-h-[140px] flex flex-col ${!isCurrentMonth ? 'opacity-50 bg-slate-50' : ''}`}>
                            <div className={`text-right text-xs font-bold mb-2 ${isToday ? 'text-white bg-blue-600 w-6 h-6 flex items-center justify-center rounded-full ml-auto' : 'text-slate-400'}`}>
                               {format(day, 'd')}
                            </div>
                            <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                               {dayRegs.map(reg => {
                                  const user = users.find(u => u.uid === reg.userId);
                                  return (
                                     <div key={reg.id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold truncate" title={`${user?.name} - ${reg.shiftName}`}>
                                        {user?.name?.split(' ').pop()} ({reg.shiftName?.split(' ')[1] || 'C'})
                                     </div>
                                  );
                               })}
                               {leaveRequests.filter(l => l.status === 'approved' && day >= new Date(l.startDate) && day <= new Date(l.endDate)).map(l => {
                                  const user = users.find(u => u.uid === l.userId);
                                  return (
                                     <div key={l.id} className="px-2 py-1 bg-rose-50 text-rose-700 rounded text-[10px] font-bold truncate">
                                        [Nghỉ] {user?.name?.split(' ').pop()}
                                     </div>
                                  );
                               })}
                            </div>
                         </div>
                      )
                   })}
                </div>
             </div>
          ) : (
             <div className="p-0">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                         <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân viên</th>
                         <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                         <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại nghỉ</th>
                         <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lý do</th>
                         <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                         <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tác vụ</th>
                      </tr>
                   </thead>
                   <tbody>
                      {leaveRequests.length === 0 ? (
                         <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Chưa có đơn nghỉ phép nào.</td></tr>
                      ) : leaveRequests.map(req => {
                         const user = users.find(u => u.uid === req.userId);
                         return (
                            <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                               <td className="p-4">
                                  <div className="font-bold text-slate-800">{user?.name || req.userId}</div>
                                  <div className="text-xs text-slate-500 font-medium">{user?.position}</div>
                               </td>
                               <td className="p-4">
                                  <div className="font-bold text-slate-700">{format(new Date(req.startDate), 'dd/MM/yyyy')} - {format(new Date(req.endDate), 'dd/MM/yyyy')}</div>
                               </td>
                               <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                                     req.leaveType === 'sick' ? 'bg-orange-100 text-orange-700' :
                                     req.leaveType === 'annual' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                                  }`}>
                                     {req.leaveType === 'sick' ? 'Ốm đau' : req.leaveType === 'annual' ? 'Phép năm' : req.leaveType === 'unpaid' ? 'Không lương' : 'Cá nhân'}
                                  </span>
                               </td>
                               <td className="p-4">
                                  <p className="text-sm text-slate-600 max-w-[200px] truncate" title={req.reason}>{req.reason || '-'}</p>
                               </td>
                               <td className="p-4">
                                  {req.status === 'pending' ? <span className="flex items-center gap-1 text-amber-600 text-xs font-bold"><Clock className="w-4 h-4"/> Chờ duyệt</span> :
                                   req.status === 'approved' ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle2 className="w-4 h-4"/> Đã duyệt</span> :
                                   <span className="flex items-center gap-1 text-rose-600 text-xs font-bold"><XCircle className="w-4 h-4"/> Từ chối</span>}
                               </td>
                               <td className="p-4 text-right">
                                  {req.status === 'pending' && (
                                     <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleLeaveStatus(req.id!, 'approved')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors">Duyệt</button>
                                        <button onClick={() => handleLeaveStatus(req.id!, 'rejected')} className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors">Từ chối</button>
                                     </div>
                                  )}
                               </td>
                            </tr>
                         )
                      })}
                   </tbody>
                </table>
             </div>
          )
        )}
      </div>
    </div>
  );
}
