import React, { useState, useEffect } from 'react';
import { MapPin, Clock, LogIn, LogOut, Loader2, CheckCircle2, CalendarClock } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { db, handleFirestoreError, OperationType, HrAttendance } from '../../lib/supabase';
import { addDoc, collection, query, where, getDocs, updateDoc, doc } from '../../lib/firebaseAdapter';
import { useAuth } from '../../App';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentAttendance, setCurrentAttendance] = useState<HrAttendance | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    checkTodayAttendance();
  }, [user]);

  const checkTodayAttendance = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const q = query(
        collection('hrAttendance'),
        where('userId', '==', user?.id),
        where('date', '==', today)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setCurrentAttendance({ id: snap.docs[0].id, ...snap.docs[0].data() } as HrAttendance);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const docRef = await addDoc(collection('hrAttendance'), {
        userId: user.id,
        userName: user.email,
        date: today,
        checkInTime: new Date().toISOString(),
        status: 'on_time'
      });
      toast.success('Check-in thành công!');
      checkTodayAttendance();
    } catch (error) {
      handleFirestoreError(error, OperationType.ADD, 'hrAttendance');
      toast.error('Có lỗi xảy ra khi Check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentAttendance?.id) return;
    setLoading(true);
    try {
      await updateDoc(doc('hrAttendance', currentAttendance.id), {
        checkOutTime: new Date().toISOString(),
      });
      toast.success('Check-out thành công!');
      checkTodayAttendance();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hrAttendance');
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = !!currentAttendance?.checkInTime;
  const isCheckedOut = !!currentAttendance?.checkOutTime;

  return (
    <div className="p-4 space-y-6">
      {/* Time Display */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Clock size={100} />
        </div>
        <p className="text-blue-100 mb-1">{format(time, 'EEEE, dd MMMM yyyy', { locale: vi })}</p>
        <h1 className="text-5xl font-black tracking-wider mb-2 font-mono">
          {format(time, 'HH:mm:ss')}
        </h1>
        <p className="flex items-center justify-center gap-1 text-sm text-blue-200">
          <MapPin size={14} /> Chi nhánh Trung Tâm
        </p>
      </div>

      {/* Action Button */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center">
        <h2 className="font-bold text-slate-800 mb-6">Chấm Công Hôm Nay</h2>
        
        {isCheckedOut ? (
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={48} />
            </div>
            <p className="text-slate-600 font-medium">Bạn đã hoàn thành ca làm việc hôm nay.</p>
            <div className="text-sm text-slate-500 space-y-1">
              <p>Giờ vào: <span className="font-semibold">{format(new Date(currentAttendance.checkInTime), 'HH:mm')}</span></p>
              <p>Giờ ra: <span className="font-semibold">{format(new Date(currentAttendance.checkOutTime), 'HH:mm')}</span></p>
            </div>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
            disabled={loading}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-xl transition-all ${
              isCheckedIn 
                ? 'bg-gradient-to-b from-amber-400 to-orange-500 hover:shadow-orange-500/30' 
                : 'bg-gradient-to-b from-blue-500 to-indigo-600 hover:shadow-blue-500/30'
            }`}
          >
            {loading ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : (
              <>
                {isCheckedIn ? <LogOut size={40} className="text-white mb-2" /> : <LogIn size={40} className="text-white mb-2" />}
                <span className="text-white font-bold text-xl tracking-wide uppercase">
                  {isCheckedIn ? 'Check-Out' : 'Check-In'}
                </span>
              </>
            )}
          </motion.button>
        )}
      </div>
      
      {/* Shift Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CalendarClock size={18} className="text-blue-500" />
          Ca làm việc của bạn
        </h3>
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-600">Bạn chưa đăng ký ca nào cho ngày hôm nay.</p>
        </div>
      </div>
    </div>
  );
};
