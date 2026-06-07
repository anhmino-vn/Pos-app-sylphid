import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Appointment, APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Plus, LayoutList, Users, Calendar,
  Clock, User, Home, X
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addWeeks, addMonths, subMonths, subWeeks, subDays,
  isSameDay, isSameMonth, isToday, parseISO, eachDayOfInterval, getDay, startOfDay
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../../lib/utils';

type ViewMode = 'month' | 'week' | 'day';
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 – 22:00
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const SLOT_HEIGHT = 60; // px per hour

export function AppointmentCalendar() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    fetchAppointments();
    const channel = supabase.channel('calendar-appts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchAppointments)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentDate, viewMode]);

  const fetchAppointments = async () => {
    let startDate: string, endDate: string;
    if (viewMode === 'day') {
      startDate = endDate = format(currentDate, 'yyyy-MM-dd');
    } else if (viewMode === 'week') {
      startDate = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      endDate = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    }
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .is('deleted_at', null)
      .order('start_time');
    setAppointments((data || []).map(mapRow));
    setLoading(false);
  };

  const mapRow = (r: any): Appointment => ({
    id: r.id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    serviceId: r.service_id, serviceName: r.service_name,
    staffId: r.staff_id, staffName: r.staff_name,
    roomId: r.room_id, roomName: r.room_name,
    date: r.date,
    startTime: r.start_time?.slice(0, 5),
    endTime: r.end_time?.slice(0, 5),
    duration: r.duration,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
  });

  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  const navigate_prev = () => {
    if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const navigate_next = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  const headerTitle = () => {
    if (viewMode === 'day') return format(currentDate, 'EEEE, dd MMMM yyyy', { locale: vi });
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM/yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: vi });
  };

  // Time → pixel offset (slot height = 60px/hr)
  const timeToY = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return ((h - 7) + m / 60) * SLOT_HEIGHT;
  };
  const durationToPx = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return ((eh - sh) + (em - sm) / 60) * SLOT_HEIGHT;
  };

  // ─── MONTH VIEW ──────────────────────────────────────────────────────────────
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    return (
      <div className="flex-1 overflow-auto">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-black text-slate-500 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1">
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayAppts = apptsByDate[key] || [];
            const sameMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const VISIBLE_MAX = 3;

            return (
              <div
                key={key}
                className={cn(
                  'min-h-[100px] p-1.5 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-all',
                  !sameMonth && 'bg-slate-50/50',
                )}
                onClick={() => { setCurrentDate(day); setViewMode('day'); }}
              >
                <span className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-black mb-1 transition-all',
                  today ? 'bg-teal-600 text-white' : sameMonth ? 'text-slate-800' : 'text-slate-300'
                )}>
                  {format(day, 'd')}
                </span>

                <div className="space-y-0.5">
                  {dayAppts.slice(0, VISIBLE_MAX).map(a => {
                    const sc = APPOINTMENT_STATUS_COLORS[a.status];
                    return (
                      <div
                        key={a.id}
                        onClick={e => { e.stopPropagation(); setSelectedAppt(a); }}
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity',
                          sc.bg, sc.text, 'border', sc.border
                        )}
                      >
                        {a.startTime} {a.customerName}
                      </div>
                    );
                  })}
                  {dayAppts.length > VISIBLE_MAX && (
                    <div className="text-[10px] font-black text-slate-400 pl-1.5">
                      +{dayAppts.length - VISIBLE_MAX} lịch nữa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── WEEK / DAY VIEW ─────────────────────────────────────────────────────────
  const TimeGridView = ({ days }: { days: Date[] }) => (
    <div className="flex-1 overflow-auto">
      {/* Header row */}
      <div className="flex sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="w-14 shrink-0" />
        {days.map(day => {
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="flex-1 text-center py-2 min-w-[80px]">
              <p className="text-xs font-bold text-slate-500 uppercase">{format(day, 'EEE', { locale: vi })}</p>
              <button
                onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                className={cn(
                  'w-8 h-8 mx-auto mt-0.5 rounded-full flex items-center justify-center text-sm font-black transition-all',
                  today ? 'bg-teal-600 text-white' : 'text-slate-800 hover:bg-slate-100'
                )}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex">
        {/* Hour labels */}
        <div className="w-14 shrink-0">
          {HOURS.map(h => (
            <div key={h} className="flex items-start justify-end pr-2 text-[10px] font-bold text-slate-400" style={{ height: SLOT_HEIGHT }}>
              <span className="-mt-2">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayAppts = apptsByDate[key] || [];
          const today = isToday(day);

          return (
            <div
              key={key}
              className={cn(
                'flex-1 relative border-l border-slate-100 min-w-[80px]',
                today && 'bg-teal-50/30'
              )}
              style={{ height: HOURS.length * SLOT_HEIGHT }}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-slate-100 cursor-pointer hover:bg-teal-50/50 transition-all"
                  style={{ top: (h - 7) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  onClick={() => navigate(`/appointments/new?date=${key}&time=${String(h).padStart(2,'0')}:00`)}
                />
              ))}

              {/* Appointments */}
              {dayAppts.map((a, idx) => {
                if (!a.startTime || !a.endTime) return null;
                const top = timeToY(a.startTime);
                const height = Math.max(durationToPx(a.startTime, a.endTime), 24);
                const sc = APPOINTMENT_STATUS_COLORS[a.status];
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAppt(a)}
                    className={cn(
                      'absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 text-[10px] overflow-hidden cursor-pointer transition-all hover:opacity-80 hover:shadow-sm border',
                      sc.bg, sc.text, sc.border
                    )}
                    style={{ top, height }}
                  >
                    <div className="font-black truncate leading-tight">{a.customerName}</div>
                    <div className="truncate opacity-70">{a.startTime} {a.serviceName || ''}</div>
                    {height > 45 && a.staffName && (
                      <div className="truncate opacity-60">{a.staffName}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={navigate_prev} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-all"
            >
              Hôm nay
            </button>
            <button onClick={navigate_next} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <h2 className="font-black text-slate-900 capitalize text-sm md:text-base">{headerTitle()}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-black rounded-lg transition-all',
                  viewMode === v ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {v === 'day' ? 'Ngày' : v === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200" />
          <button onClick={() => navigate('/appointments')} className="p-2 hover:bg-slate-100 rounded-lg transition-all" title="Danh sách">
            <LayoutList className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => navigate('/appointments/staff')} className="p-2 hover:bg-slate-100 rounded-lg transition-all" title="Lịch nhân viên">
            <Users className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => navigate('/appointments/new')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tạo lịch</span>
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === 'month' ? (
        <MonthView />
      ) : viewMode === 'week' ? (
        <TimeGridView days={weekDays} />
      ) : (
        <TimeGridView days={[currentDate]} />
      )}

      {/* Appointment detail popup */}
      <AnimatePresence>
        {selectedAppt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedAppt(null); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            >
              {/* Status stripe */}
              <div className={cn('h-1.5 w-full', APPOINTMENT_STATUS_COLORS[selectedAppt.status].bg)} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-black text-slate-900 text-base">{selectedAppt.customerName}</h3>
                    <span className={cn(
                      'text-[10px] font-black px-2 py-0.5 rounded-full border mt-1 inline-block',
                      APPOINTMENT_STATUS_COLORS[selectedAppt.status].bg,
                      APPOINTMENT_STATUS_COLORS[selectedAppt.status].text,
                      APPOINTMENT_STATUS_COLORS[selectedAppt.status].border,
                    )}>
                      {APPOINTMENT_STATUS_LABELS[selectedAppt.status]}
                    </span>
                  </div>
                  <button onClick={() => setSelectedAppt(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">{format(parseISO(selectedAppt.date), 'dd/MM/yyyy')} · {selectedAppt.startTime} – {selectedAppt.endTime}</span>
                  </div>
                  {selectedAppt.customerPhone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-slate-400 text-sm">📱</span>
                      <span>{selectedAppt.customerPhone}</span>
                    </div>
                  )}
                  {selectedAppt.serviceName && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-slate-400">💆</span>
                      <span>{selectedAppt.serviceName}</span>
                    </div>
                  )}
                  {selectedAppt.staffName && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{selectedAppt.staffName}</span>
                    </div>
                  )}
                  {selectedAppt.roomName && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Home className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{selectedAppt.roomName}</span>
                    </div>
                  )}
                  {selectedAppt.note && (
                    <p className="text-slate-500 italic text-xs mt-1">📝 {selectedAppt.note}</p>
                  )}
                </div>

                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => { navigate(`/appointments/${selectedAppt.id}/edit`); setSelectedAppt(null); }}
                    className="flex-1 py-2.5 font-bold text-sm text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl transition-all"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    onClick={() => { navigate('/appointments'); setSelectedAppt(null); }}
                    className="flex-1 py-2.5 font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    Xem danh sách
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
