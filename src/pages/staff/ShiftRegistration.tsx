import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType, HrShift, HrShiftRegistration } from '../../lib/supabase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, onSnapshot } from '../../lib/firebaseAdapter';
import { useAuth } from '../../App';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';

export const ShiftRegistration = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<HrShift[]>([]);
  const [registrations, setRegistrations] = useState<HrShiftRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Generate 7 days for the current week
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

  useEffect(() => {
    // Load Shifts
    const loadShifts = async () => {
      try {
        const snap = await getDocs(query(collection('hrShifts'), where('isActive', '==', true)));
        // If empty, create default shifts (for demo)
        if (snap.empty) {
          await addDoc(collection('hrShifts'), { name: 'Ca sáng', startTime: '08:00', endTime: '12:00', isActive: true });
          await addDoc(collection('hrShifts'), { name: 'Ca chiều', startTime: '13:00', endTime: '17:00', isActive: true });
          await addDoc(collection('hrShifts'), { name: 'Cả ngày', startTime: '08:00', endTime: '17:00', isActive: true });
          // reload
          const reloadSnap = await getDocs(query(collection('hrShifts'), where('isActive', '==', true)));
          setShifts(reloadSnap.docs.map(d => ({ id: d.id, ...d.data() } as HrShift)));
        } else {
          setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrShift)));
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadShifts();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Load user registrations for the week
    const startDate = format(weekDays[0], 'yyyy-MM-dd');
    const endDate = format(weekDays[6], 'yyyy-MM-dd');

    const unsubscribe = onSnapshot(
      query(
        collection('hrShiftRegistrations'), 
        where('userId', '==', user.id),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      ),
      (snap) => {
        setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrShiftRegistration)));
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'hrShiftRegistrations');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, currentWeekStart]);

  const toggleRegistration = async (date: Date, shift: HrShift) => {
    if (!user) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = registrations.find(r => r.date === dateStr && r.shiftId === shift.id);

    try {
      if (existing && existing.id) {
        await deleteDoc(doc('hrShiftRegistrations', existing.id));
        toast.success('Đã hủy đăng ký');
      } else {
        await addDoc(collection('hrShiftRegistrations'), {
          userId: user.id,
          userName: user.email,
          shiftId: shift.id,
          shiftName: shift.name,
          date: dateStr,
          status: 'pending' // requires admin approval
        });
        toast.success('Đăng ký thành công');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'hrShiftRegistrations');
    }
  };

  const isRegistered = (date: Date, shiftId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return registrations.find(r => r.date === dateStr && r.shiftId === shiftId);
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Đăng Ký Ca Làm</h1>
          <p className="text-sm text-slate-500">Tuần {format(weekDays[0], 'dd/MM')} - {format(weekDays[6], 'dd/MM/yyyy')}</p>
        </div>
        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
          <CalendarIcon size={24} />
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 snap-x hide-scrollbar">
        {[0, 1, 2, 3].map(offset => {
          const wStart = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offset * 7);
          const isCurrent = isSameDay(wStart, currentWeekStart);
          return (
            <button
              key={offset}
              onClick={() => setCurrentWeekStart(wStart)}
              className={`snap-start whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isCurrent ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {offset === 0 ? 'Tuần này' : `Tuần ${format(wStart, 'dd/MM')}`}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>
      ) : (
        <div className="space-y-4">
          {weekDays.map(date => {
            const isToday = isSameDay(date, new Date());
            return (
              <div key={date.toISOString()} className={`bg-white rounded-xl border p-4 shadow-sm ${isToday ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{format(date, 'EEEE', { locale: vi })}</span>
                    <span className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>{format(date, 'dd/MM')}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {shifts.map(shift => {
                    const reg = isRegistered(date, shift.id!);
                    return (
                      <button
                        key={shift.id}
                        onClick={() => toggleRegistration(date, shift)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          reg 
                            ? reg.status === 'approved' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-blue-50 border-blue-200'
                            : 'bg-slate-50 border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className={`font-medium ${reg ? 'text-slate-800' : 'text-slate-600'}`}>{shift.name}</span>
                          <span className="text-xs text-slate-500">{shift.startTime} - {shift.endTime}</span>
                        </div>
                        <div>
                          {reg ? (
                            reg.status === 'approved' 
                              ? <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium flex items-center gap-1"><CheckCircle2 size={12}/> Đã duyệt</div>
                              : <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">Chờ duyệt</div>
                          ) : (
                            <Circle size={20} className="text-slate-300" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
