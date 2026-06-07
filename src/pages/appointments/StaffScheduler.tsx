import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Appointment, Staff, Room, APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Plus, LayoutList, Calendar, Users,
  Home, Clock, X, User, Layers, Filter
} from 'lucide-react';
import {
  format, addDays, subDays, parseISO
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../../lib/utils';

type SchedulerView = 'timeline' | 'by_staff' | 'by_room';
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
const SLOT_HEIGHT = 60;

const STAFF_COLORS = [
  '#0D9488', '#0891B2', '#7C3AED', '#DC2626', '#D97706',
  '#059669', '#2563EB', '#DB2777', '#65A30D', '#9333EA',
];

export function StaffScheduler() {
  const navigate = useNavigate();
  const [view, setView] = useState<SchedulerView>('timeline');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [filterStaffIds, setFilterStaffIds] = useState<string[]>([]);
  const [filterRoomIds, setFilterRoomIds] = useState<string[]>([]);

  const dateKey = format(currentDate, 'yyyy-MM-dd');

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel('scheduler')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentDate]);

  const fetchAll = async () => {
    setLoading(true);
    const [apptRes, staffRes, roomRes] = await Promise.all([
      supabase.from('appointments').select('*').eq('date', dateKey).is('deleted_at', null).order('start_time'),
      supabase.from('staff').select('*').eq('status', 'active').order('name'),
      supabase.from('rooms').select('*').neq('status', 'maintenance').order('name'),
    ]);

    setAppointments((apptRes.data || []).map(r => ({
      id: r.id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      serviceName: r.service_name,
      staffId: r.staff_id,
      staffName: r.staff_name,
      roomId: r.room_id,
      roomName: r.room_name,
      date: r.date,
      startTime: r.start_time?.slice(0, 5),
      endTime: r.end_time?.slice(0, 5),
      duration: r.duration,
      status: r.status,
      note: r.note,
    } as Appointment)));

    setStaffList((staffRes.data || []).map((r, i) => ({
      id: r.id, name: r.name, position: r.position,
      color: r.color || STAFF_COLORS[i % STAFF_COLORS.length],
      status: r.status,
    } as Staff)));

    setRoomList((roomRes.data || []).map(r => ({
      id: r.id, name: r.name, floor: r.floor, color: r.color,
      status: r.status,
    } as Room)));

    setLoading(false);
  };

  const timeToY = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return ((h - 7) + m / 60) * SLOT_HEIGHT;
  };
  const durationToPx = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.max(((eh - sh) + (em - sm) / 60) * SLOT_HEIGHT, 28);
  };

  // Filtered lists
  const visibleStaff = filterStaffIds.length > 0
    ? staffList.filter(s => filterStaffIds.includes(s.id!))
    : staffList;
  const visibleRooms = filterRoomIds.length > 0
    ? roomList.filter(r => filterRoomIds.includes(r.id!))
    : roomList;

  // Stats per staff
  const staffStats = useMemo(() => {
    const map: Record<string, { total: number; inProgress: number; completed: number; cancelled: number }> = {};
    staffList.forEach(s => {
      const appts = appointments.filter(a => a.staffId === s.id!);
      map[s.id!] = {
        total: appts.length,
        inProgress: appts.filter(a => a.status === 'in_progress').length,
        completed: appts.filter(a => a.status === 'completed').length,
        cancelled: appts.filter(a => a.status === 'cancelled').length,
      };
    });
    return map;
  }, [staffList, appointments]);

  // ─── TIMELINE VIEW ───────────────────────────────────────────────────────────
  const TimelineView = () => (
    <div className="flex-1 overflow-auto">
      {/* Sticky header: time axis + staff columns */}
      <div className="flex sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="w-16 shrink-0 border-r border-slate-200" />
        {visibleStaff.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-3 text-sm text-slate-400 font-bold">
            Chưa có nhân viên nào
          </div>
        ) : visibleStaff.map(staff => (
          <div key={staff.id} className="flex-1 min-w-[140px] text-center px-2 py-2 border-r border-slate-100">
            <div
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-black mb-1 mx-auto"
              style={{ backgroundColor: staff.color || '#0D9488' }}
            >
              {staff.name?.[0]?.toUpperCase()}
            </div>
            <p className="text-xs font-black text-slate-800 truncate">{staff.name}</p>
            {staff.position && <p className="text-[10px] text-slate-400 truncate">{staff.position}</p>}
            <div className="flex justify-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-teal-600">{staffStats[staff.id!]?.total || 0} lịch</span>
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex">
        {/* Hour column */}
        <div className="w-16 shrink-0 border-r border-slate-200">
          {HOURS.map(h => (
            <div key={h} className="flex items-start justify-end pr-2 text-[10px] font-bold text-slate-400 border-t border-slate-100" style={{ height: SLOT_HEIGHT }}>
              <span className="-mt-2">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Staff columns */}
        {visibleStaff.map(staff => {
          const staffAppts = appointments.filter(a => a.staffId === staff.id);
          return (
            <div
              key={staff.id}
              className="flex-1 min-w-[140px] relative border-r border-slate-100"
              style={{ height: HOURS.length * SLOT_HEIGHT }}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-slate-100 cursor-pointer hover:bg-teal-50/40 transition-all"
                  style={{ top: (h - 7) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  onClick={() => navigate(`/appointments/new?date=${dateKey}&time=${String(h).padStart(2,'0')}:00&staff=${staff.id}`)}
                />
              ))}

              {/* 30-min sub-lines */}
              {HOURS.map(h => (
                <div
                  key={`${h}-30`}
                  className="absolute left-0 right-0 border-t border-dashed border-slate-50"
                  style={{ top: (h - 7) * SLOT_HEIGHT + SLOT_HEIGHT / 2 }}
                />
              ))}

              {/* Appointments */}
              {staffAppts.map(a => {
                if (!a.startTime || !a.endTime) return null;
                const top = timeToY(a.startTime);
                const height = durationToPx(a.startTime, a.endTime);
                const sc = APPOINTMENT_STATUS_COLORS[a.status];
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAppt(a)}
                    className={cn(
                      'absolute left-1 right-1 rounded-lg px-2 py-1 text-[10px] overflow-hidden cursor-pointer border transition-all hover:shadow-md hover:z-10 hover:scale-[1.02]',
                      sc.bg, sc.text, sc.border
                    )}
                    style={{ top, height }}
                  >
                    <div className="font-black truncate leading-tight">{a.customerName}</div>
                    <div className="truncate opacity-70 mt-0.5">{a.startTime}–{a.endTime}</div>
                    {height > 50 && a.serviceName && (
                      <div className="truncate opacity-60">{a.serviceName}</div>
                    )}
                    {height > 70 && a.roomName && (
                      <div className="truncate opacity-50 flex items-center gap-0.5"><Home className="w-2.5 h-2.5" />{a.roomName}</div>
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

  // ─── BY STAFF VIEW ───────────────────────────────────────────────────────────
  const ByStaffView = () => (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {visibleStaff.length === 0 && (
        <div className="text-center py-12 text-slate-400 font-bold">Chưa có nhân viên nào</div>
      )}
      {visibleStaff.map(staff => {
        const staffAppts = appointments
          .filter(a => a.staffId === staff.id)
          .sort((a, b) => (a.startTime || '') < (b.startTime || '') ? -1 : 1);
        const stats = staffStats[staff.id!];

        return (
          <div key={staff.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* Staff header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-100" style={{ borderLeftColor: staff.color, borderLeftWidth: 4 }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0"
                style={{ backgroundColor: staff.color || '#0D9488' }}
              >
                {staff.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900">{staff.name}</h3>
                {staff.position && <p className="text-xs text-slate-400 font-medium">{staff.position}</p>}
              </div>
              <div className="flex gap-3 text-xs font-bold">
                <span className="text-teal-600">{stats?.total || 0} lịch</span>
                <span className="text-emerald-600">{stats?.completed || 0} xong</span>
                {(stats?.cancelled || 0) > 0 && <span className="text-rose-500">{stats.cancelled} hủy</span>}
              </div>
            </div>

            {/* Appointments */}
            {staffAppts.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400 font-bold">Không có lịch hẹn hôm nay</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {staffAppts.map(a => {
                  const sc = APPOINTMENT_STATUS_COLORS[a.status];
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAppt(a)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-all"
                    >
                      <div className="text-xs font-black text-slate-500 w-20 shrink-0 tabular-nums">
                        {a.startTime}<br /><span className="text-slate-300">{a.endTime}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{a.customerName}</p>
                        <p className="text-xs text-slate-400 truncate">{a.serviceName || ''} {a.roomName ? `· ${a.roomName}` : ''}</p>
                      </div>
                      <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0', sc.bg, sc.text, sc.border)}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── BY ROOM VIEW ────────────────────────────────────────────────────────────
  const ByRoomView = () => (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleRooms.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 font-bold">Chưa có phòng nào</div>
        )}
        {visibleRooms.map(room => {
          const roomAppts = appointments
            .filter(a => a.roomId === room.id)
            .sort((a, b) => (a.startTime || '') < (b.startTime || '') ? -1 : 1);
          const isOccupied = roomAppts.some(a => a.status === 'in_progress');

          return (
            <div key={room.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                <div
                  className="w-3 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: room.color || '#0891B2' }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900">{room.name}</h3>
                  {room.floor && <p className="text-xs text-slate-400 font-medium">Tầng {room.floor}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isOccupied ? (
                    <span className="text-[10px] font-black px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full border border-teal-200">Đang dùng</span>
                  ) : (
                    <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">Trống</span>
                  )}
                  <span className="text-xs font-bold text-slate-500">{roomAppts.length} lịch</span>
                </div>
              </div>

              {roomAppts.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Không có lịch hôm nay</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {roomAppts.map(a => {
                    const sc = APPOINTMENT_STATUS_COLORS[a.status];
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAppt(a)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        <span className="text-xs font-black text-slate-500 w-14 shrink-0 tabular-nums">{a.startTime}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-800 truncate">{a.customerName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{a.staffName}</p>
                        </div>
                        <span className={cn('w-2 h-2 rounded-full shrink-0', sc.bg.replace('bg-', 'bg-').replace('-50', '-500'))} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-all"
            >
              Hôm nay
            </button>
            <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <h2 className="font-black text-slate-900 text-sm md:text-base capitalize">
            {format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            <button onClick={() => setView('timeline')} className={cn('px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1', view === 'timeline' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500')}>
              <Layers className="w-3 h-3" /> Timeline
            </button>
            <button onClick={() => setView('by_staff')} className={cn('px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1', view === 'by_staff' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500')}>
              <Users className="w-3 h-3" /> Nhân viên
            </button>
            <button onClick={() => setView('by_room')} className={cn('px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1', view === 'by_room' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500')}>
              <Home className="w-3 h-3" /> Phòng
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200" />
          <button onClick={() => navigate('/appointments')} className="p-2 hover:bg-slate-100 rounded-lg transition-all" title="Danh sách">
            <LayoutList className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => navigate('/appointments/calendar')} className="p-2 hover:bg-slate-100 rounded-lg transition-all" title="Calendar">
            <Calendar className="w-4 h-4 text-slate-600" />
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

      {/* Summary stats bar */}
      <div className="flex gap-4 px-4 md:px-6 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 overflow-x-auto shrink-0">
        <span>📅 {appointments.length} lịch hẹn</span>
        <span className="text-teal-600">🏃 {appointments.filter(a => a.status === 'in_progress').length} đang thực hiện</span>
        <span className="text-emerald-600">✅ {appointments.filter(a => a.status === 'completed').length} hoàn thành</span>
        <span className="text-amber-600">⏳ {appointments.filter(a => a.status === 'pending').length} chờ xác nhận</span>
        <span className="text-rose-500">❌ {appointments.filter(a => a.status === 'cancelled').length} hủy</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'timeline' ? (
        <TimelineView />
      ) : view === 'by_staff' ? (
        <ByStaffView />
      ) : (
        <ByRoomView />
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
              <div className={cn('h-1.5 w-full', APPOINTMENT_STATUS_COLORS[selectedAppt.status].bg)} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
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
                  <button onClick={() => setSelectedAppt(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold">{selectedAppt.startTime} – {selectedAppt.endTime}</span>
                  </div>
                  {selectedAppt.serviceName && <div className="flex items-center gap-2 text-slate-500"><span>💆</span><span>{selectedAppt.serviceName}</span></div>}
                  {selectedAppt.staffName && <div className="flex items-center gap-2 text-slate-500"><User className="w-4 h-4 text-slate-400" /><span>{selectedAppt.staffName}</span></div>}
                  {selectedAppt.roomName && <div className="flex items-center gap-2 text-slate-500"><Home className="w-4 h-4 text-slate-400" /><span>{selectedAppt.roomName}</span></div>}
                  {selectedAppt.note && <p className="text-slate-400 italic text-xs">📝 {selectedAppt.note}</p>}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { navigate(`/appointments/${selectedAppt.id}/edit`); setSelectedAppt(null); }} className="flex-1 py-2.5 font-bold text-sm text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl transition-all">Chỉnh sửa</button>
                  <button onClick={() => setSelectedAppt(null)} className="flex-1 py-2.5 font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Đóng</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
