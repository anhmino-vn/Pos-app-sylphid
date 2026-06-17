import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Appointment, AppointmentStatus, APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS } from '../../lib/supabase';
import { useAuth } from '../../App';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, Calendar, Clock, User, Phone, Briefcase, Home,
  Eye, Edit2, Trash2, CheckCircle, XCircle, ChevronDown, Download,
  MoreVertical, RefreshCw, LogIn, LogOut, LayoutList, CalendarDays,
  Users, AlertTriangle, CheckSquare, Square, Trash, RotateCcw, XOctagon
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../../lib/utils';

const STATUS_TABS = [
  { key: 'all',         label: 'Tất cả' },
  { key: 'today',       label: 'Hôm nay' },
  { key: 'upcoming',    label: 'Sắp tới' },
  { key: 'completed',   label: 'Hoàn thành' },
  { key: 'cancelled',   label: 'Đã hủy' },
  { key: 'trash',       label: 'Thùng rác' },
] as const;

type TabKey = typeof STATUS_TABS[number]['key'];

export function AppointmentList() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | 'all'>('all');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [cancelModal, setCancelModal] = useState<{ open: boolean; id: string; reason: string }>({ open: false, id: '', reason: '' });
  const [processing, setProcessing] = useState<string | null>(null);

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [permanentDeleteModal, setPermanentDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

  // Fetch data
  useEffect(() => {
    fetchAppointments();
    fetchStaff();

    const channel = supabase.channel('appointments-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchAppointments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: false })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAppointments((data || []).map(mapRow));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('id, name').eq('status', 'active');
    setStaffList(data || []);
  };

  const mapRow = (r: any): Appointment => ({
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    serviceId: r.service_id,
    serviceName: r.service_name,
    comboId: r.combo_id,
    comboName: r.combo_name,
    treatmentId: r.treatment_id,
    treatmentName: r.treatment_name,
    staffId: r.staff_id,
    staffName: r.staff_name,
    roomId: r.room_id,
    roomName: r.room_name,
    branchId: r.branch_id,
    branchName: r.branch_name,
    date: r.date,
    startTime: r.start_time?.slice(0, 5),
    endTime: r.end_time?.slice(0, 5),
    duration: r.duration,
    note: r.note,
    status: r.status,
    cancelReason: r.cancel_reason,
    checkinAt: r.checkin_at,
    checkoutAt: r.checkout_at,
    createdBy: r.created_by,
    creatorName: r.creator_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  });

  // Filter logic
  const filtered = useMemo(() => {
    let list = appointments;

    if (activeTab === 'today') {
      list = list.filter(a => a.date === format(new Date(), 'yyyy-MM-dd') && !a.deletedAt);
    } else if (activeTab === 'upcoming') {
      const today = format(new Date(), 'yyyy-MM-dd');
      list = list.filter(a => a.date > today && !a.deletedAt && a.status !== 'cancelled');
    } else if (activeTab === 'completed') {
      list = list.filter(a => a.status === 'completed' && !a.deletedAt);
    } else if (activeTab === 'cancelled') {
      list = list.filter(a => a.status === 'cancelled' && !a.deletedAt);
    } else if (activeTab === 'trash') {
      list = list.filter(a => !!a.deletedAt);
    } else {
      list = list.filter(a => !a.deletedAt);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.customerName?.toLowerCase().includes(q) ||
        a.customerPhone?.includes(q) ||
        a.staffName?.toLowerCase().includes(q) ||
        a.serviceName?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') list = list.filter(a => a.status === filterStatus);
    if (filterStaff) list = list.filter(a => a.staffId === filterStaff);
    if (filterDate) list = list.filter(a => a.date === filterDate);

    return list.sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return a.startTime > b.startTime ? 1 : -1;
    });
  }, [appointments, activeTab, searchQuery, filterStatus, filterStaff, filterDate]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id!)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Individual actions ────────────────────────────────────────────────────
  const handleCheckin = async (a: Appointment) => {
    setProcessing(a.id!);
    try {
      await supabase.from('appointments').update({
        status: 'in_progress',
        checkin_at: new Date().toISOString(),
        checkin_by: profile?.uid,
        checkin_by_name: profile?.name || profile?.email,
        updated_at: new Date().toISOString(),
      }).eq('id', a.id!);
      await logAction(a.id!, 'checkin', { status: a.status }, { status: 'in_progress' });
      toast.success('Check-in thành công!');
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setProcessing(null);
  };

  const handleCheckout = async (a: Appointment) => {
    setProcessing(a.id!);
    try {
      await supabase.from('appointments').update({
        status: 'completed',
        checkout_at: new Date().toISOString(),
        checkout_by: profile?.uid,
        checkout_by_name: profile?.name || profile?.email,
        updated_at: new Date().toISOString(),
      }).eq('id', a.id!);
      await logAction(a.id!, 'checkout', { status: a.status }, { status: 'completed' });
      toast.success('Hoàn thành lịch hẹn!');
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setProcessing(null);
  };

  const handleConfirm = async (a: Appointment) => {
    setProcessing(a.id!);
    try {
      await supabase.from('appointments').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', a.id!);
      await logAction(a.id!, 'confirmed', { status: a.status }, { status: 'confirmed' });
      toast.success('Đã xác nhận lịch hẹn!');
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setProcessing(null);
  };

  const handleCancelSubmit = async () => {
    setProcessing(cancelModal.id);
    try {
      await supabase.from('appointments').update({
        status: 'cancelled',
        cancel_reason: cancelModal.reason,
        updated_at: new Date().toISOString(),
      }).eq('id', cancelModal.id);
      await logAction(cancelModal.id, 'cancelled', {}, { status: 'cancelled', cancelReason: cancelModal.reason });
      toast.success('Đã hủy lịch hẹn!');
      setCancelModal({ open: false, id: '', reason: '' });
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setProcessing(null);
  };

  const handleSoftDelete = async (id: string) => {
    if (!confirm('Chuyển lịch hẹn vào thùng rác?')) return;
    await supabase.from('appointments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    toast.success('Đã chuyển vào thùng rác!');
    fetchAppointments();
  };

  const handleRestore = async (id: string) => {
    await supabase.from('appointments').update({ deleted_at: null }).eq('id', id);
    toast.success('Đã khôi phục!');
    fetchAppointments();
  };

  const handlePermanentDelete = async (ids: string[]) => {
    setBulkProcessing(true);
    try {
      for (const id of ids) {
        await supabase.from('appointments').delete().eq('id', id);
      }
      toast.success(`Đã xóa vĩnh viễn ${ids.length} lịch hẹn!`);
      clearSelection();
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setBulkProcessing(false);
    setPermanentDeleteModal({ open: false, ids: [] });
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const handleBulkRestore = async () => {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    try {
      for (const id of ids) {
        await supabase.from('appointments').update({ deleted_at: null }).eq('id', id);
      }
      toast.success(`Đã khôi phục ${ids.length} lịch hẹn!`);
      clearSelection();
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setBulkProcessing(false);
  };

  const handleBulkSoftDelete = async () => {
    if (!confirm(`Chuyển ${selectedIds.size} lịch hẹn vào thùng rác?`)) return;
    setBulkProcessing(true);
    const ids = [...selectedIds];
    try {
      for (const id of ids) {
        await supabase.from('appointments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      }
      toast.success(`Đã chuyển ${ids.length} lịch hẹn vào thùng rác!`);
      clearSelection();
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setBulkProcessing(false);
  };

  const handleBulkConfirm = async () => {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    try {
      for (const id of ids) {
        await supabase.from('appointments').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', id);
      }
      toast.success(`Đã xác nhận ${ids.length} lịch hẹn!`);
      clearSelection();
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setBulkProcessing(false);
  };

  const handleBulkCheckin = async () => {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    try {
      for (const id of ids) {
        await supabase.from('appointments').update({
          status: 'in_progress',
          checkin_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', id);
      }
      toast.success(`Đã check-in ${ids.length} lịch hẹn!`);
      clearSelection();
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setBulkProcessing(false);
  };

  const handleBulkComplete = async () => {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    try {
      for (const id of ids) {
        await supabase.from('appointments').update({
          status: 'completed',
          checkout_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', id);
      }
      toast.success(`Đã hoàn thành ${ids.length} lịch hẹn!`);
      clearSelection();
      fetchAppointments();
    } catch { toast.error('Có lỗi xảy ra!'); }
    setBulkProcessing(false);
  };

  const logAction = async (appointmentId: string, action: string, oldValues: any, newValues: any) => {
    await supabase.from('appointment_logs').insert({
      appointment_id: appointmentId,
      action,
      old_values: oldValues,
      new_values: newValues,
      changed_by: profile?.uid,
      changed_by_name: profile?.name || profile?.email,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return 'Hôm nay';
      if (isTomorrow(d)) return 'Ngày mai';
      return format(d, 'dd/MM/yyyy', { locale: vi });
    } catch { return dateStr; }
  };

  const tabCount = (key: TabKey) => {
    if (key === 'today') return appointments.filter(a => a.date === format(new Date(), 'yyyy-MM-dd') && !a.deletedAt).length;
    if (key === 'upcoming') return appointments.filter(a => a.date > format(new Date(), 'yyyy-MM-dd') && !a.deletedAt && a.status !== 'cancelled').length;
    if (key === 'completed') return appointments.filter(a => a.status === 'completed' && !a.deletedAt).length;
    if (key === 'cancelled') return appointments.filter(a => a.status === 'cancelled' && !a.deletedAt).length;
    if (key === 'trash') return appointments.filter(a => !!a.deletedAt).length;
    return appointments.filter(a => !a.deletedAt).length;
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filtered.length;
  const isTrash = activeTab === 'trash';

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lịch Hẹn</h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Quản lý tất cả lịch hẹn khách hàng</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/appointments/calendar')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Lịch</span>
          </button>
          <button
            onClick={() => navigate('/appointments/staff')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Nhân viên</span>
          </button>
          <button
            onClick={() => navigate('/appointments/new')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Tạo lịch hẹn
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all',
              activeTab === tab.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            {tab.label}
            {tabCount(tab.key) > 0 && (
              <span className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded-full',
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              )}>
                {tabCount(tab.key)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Filter Row */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT, nhân viên, dịch vụ..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          />
        </div>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        />
        <button
          onClick={() => setShowFilters(f => !f)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-bold border rounded-lg transition-all',
            showFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          <Filter className="w-4 h-4" />
          Bộ lọc
        </button>
        <button onClick={fetchAppointments} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Extended Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-bold text-slate-500 mb-1">Trạng thái</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="all">Tất cả trạng thái</option>
                  {Object.entries(APPOINTMENT_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-bold text-slate-500 mb-1">Nhân viên</label>
                <select
                  value={filterStaff}
                  onChange={e => setFilterStaff(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="">Tất cả nhân viên</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setFilterStatus('all'); setFilterStaff(''); setFilterDate(''); setSearchQuery(''); }}
                  className="px-3 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                >
                  Xóa bộ lọc
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary row + Select All + Bulk Actions */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {/* Select All Checkbox */}
          <button
            onClick={toggleSelectAll}
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded border-2 transition-all shrink-0',
              allSelected ? 'bg-teal-600 border-teal-600 text-white' :
              someSelected ? 'bg-teal-100 border-teal-400' :
              'border-slate-300 hover:border-teal-400'
            )}
          >
            {allSelected && <CheckSquare className="w-3 h-3" />}
            {someSelected && <div className="w-2 h-0.5 bg-teal-600 rounded" />}
          </button>

          <span className="text-xs font-bold text-slate-500">
            {selectedIds.size > 0
              ? <><span className="text-teal-700">{selectedIds.size}</span> / {filtered.length} đã chọn</>
              : <>Hiển thị <span className="text-slate-900">{filtered.length}</span> lịch hẹn</>
            }
          </span>

          {selectedIds.size > 0 && (
            <button onClick={clearSelection} className="text-xs text-slate-400 hover:text-slate-600 font-bold">
              Bỏ chọn
            </button>
          )}
        </div>

        {/* Bulk Action Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-wrap items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl"
            >
              <span className="text-xs font-black text-teal-800 mr-1">
                {selectedIds.size} lịch hẹn đã chọn:
              </span>

              {isTrash ? (
                <>
                  <button
                    onClick={handleBulkRestore}
                    disabled={bulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Khôi phục ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => setPermanentDeleteModal({ open: true, ids: [...selectedIds] })}
                    disabled={bulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all disabled:opacity-50"
                  >
                    <XOctagon className="w-3 h-3" />
                    Xóa vĩnh viễn ({selectedIds.size})
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleBulkConfirm}
                    disabled={bulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Xác nhận
                  </button>
                  <button
                    onClick={handleBulkCheckin}
                    disabled={bulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50"
                  >
                    <LogIn className="w-3 h-3" />
                    Check-in
                  </button>
                  <button
                    onClick={handleBulkComplete}
                    disabled={bulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    <CheckSquare className="w-3 h-3" />
                    Hoàn thành
                  </button>
                  <button
                    onClick={() => setCancelModal({ open: true, id: '__bulk__', reason: '' })}
                    disabled={bulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" />
                    Hủy
                  </button>
                  <button
                    onClick={handleBulkSoftDelete}
                    disabled={bulkProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Xóa ({selectedIds.size})
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="w-12 h-12 text-slate-200 mb-3" />
          <p className="font-bold text-slate-400">Không có lịch hẹn nào</p>
          <p className="text-sm text-slate-300 mt-1">Thử thay đổi bộ lọc hoặc tạo lịch mới</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {filtered.map((appt) => {
              const sc = APPOINTMENT_STATUS_COLORS[appt.status];
              const isProcessingThis = processing === appt.id;
              const isSelected = selectedIds.has(appt.id!);
              return (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={cn(
                    'bg-white border rounded-xl hover:shadow-sm transition-all',
                    isSelected ? 'border-teal-400 bg-teal-50/30' : 'border-slate-200'
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(appt.id!)}
                        className={cn(
                          'flex items-center justify-center w-5 h-5 mt-0.5 rounded border-2 transition-all shrink-0',
                          isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 hover:border-teal-400'
                        )}
                      >
                        {isSelected && <CheckSquare className="w-3 h-3" />}
                      </button>

                      {/* Left: Info */}
                      <div className="flex gap-3 min-w-0 flex-1">
                        {/* Color bar */}
                        <div className="w-1 self-stretch rounded-full bg-teal-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="font-black text-sm text-slate-900">{appt.customerName}</span>
                            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border', sc.bg, sc.text, sc.border)}>
                              {APPOINTMENT_STATUS_LABELS[appt.status]}
                            </span>
                            {appt.id && (
                              <span className="text-[10px] font-bold text-slate-400">#{appt.id}</span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(appt.date)} · {appt.startTime} – {appt.endTime}
                              {appt.duration && <span className="text-slate-400">({appt.duration}ph)</span>}
                            </span>
                            {appt.customerPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {appt.customerPhone}
                              </span>
                            )}
                            {appt.staffName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {appt.staffName}
                              </span>
                            )}
                            {appt.roomName && (
                              <span className="flex items-center gap-1">
                                <Home className="w-3 h-3" />
                                {appt.roomName}
                              </span>
                            )}
                            {(appt.serviceName || appt.comboName) && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                {appt.serviceName || appt.comboName}
                              </span>
                            )}
                          </div>

                          {appt.note && (
                            <p className="text-xs text-slate-400 mt-1.5 italic line-clamp-1">📝 {appt.note}</p>
                          )}
                          {appt.cancelReason && (
                            <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Lý do hủy: {appt.cancelReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {isTrash ? (
                          <>
                            <button
                              onClick={() => handleRestore(appt.id!)}
                              className="text-xs font-bold px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-all"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setPermanentDeleteModal({ open: true, ids: [appt.id!] })}
                              className="text-xs font-bold px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-all"
                              title="Xóa vĩnh viễn"
                            >
                              <XOctagon className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            {appt.status === 'pending' && (
                              <button
                                disabled={isProcessingThis}
                                onClick={() => handleConfirm(appt)}
                                className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50"
                              >
                                Xác nhận
                              </button>
                            )}
                            {(appt.status === 'confirmed' || appt.status === 'pending') && (
                              <button
                                disabled={isProcessingThis}
                                onClick={() => handleCheckin(appt)}
                                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-all disabled:opacity-50"
                              >
                                <LogIn className="w-3 h-3" /> Check-in
                              </button>
                            )}
                            {appt.status === 'in_progress' && (
                              <button
                                disabled={isProcessingThis}
                                onClick={() => handleCheckout(appt)}
                                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-50"
                              >
                                <LogOut className="w-3 h-3" /> Hoàn thành
                              </button>
                            )}
                            {!['completed', 'cancelled'].includes(appt.status) && (
                              <button
                                onClick={() => navigate(`/appointments/${appt.id}/edit`)}
                                className="text-xs font-bold px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {!['completed', 'cancelled'].includes(appt.status) && (
                              <button
                                onClick={() => setCancelModal({ open: true, id: appt.id!, reason: '' })}
                                className="text-xs font-bold px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-all"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleSoftDelete(appt.id!)}
                              className="text-xs font-bold px-3 py-1.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Cancel Modal (single or bulk) */}
      <AnimatePresence>
        {cancelModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setCancelModal({ open: false, id: '', reason: '' }); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
            >
              <h2 className="text-lg font-black text-slate-900 mb-1">
                {cancelModal.id === '__bulk__' ? `Hủy ${selectedIds.size} lịch hẹn` : 'Hủy lịch hẹn'}
              </h2>
              <p className="text-sm text-slate-500 mb-4">Vui lòng nhập lý do hủy để lưu lịch sử.</p>
              <textarea
                value={cancelModal.reason}
                onChange={e => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Nhập lý do hủy..."
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                rows={3}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setCancelModal({ open: false, id: '', reason: '' })}
                  className="flex-1 py-2.5 font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Đóng
                </button>
                <button
                  onClick={async () => {
                    if (cancelModal.id === '__bulk__') {
                      // Bulk cancel
                      setBulkProcessing(true);
                      const ids = [...selectedIds];
                      try {
                        for (const id of ids) {
                          await supabase.from('appointments').update({
                            status: 'cancelled',
                            cancel_reason: cancelModal.reason,
                            updated_at: new Date().toISOString(),
                          }).eq('id', id);
                        }
                        toast.success(`Đã hủy ${ids.length} lịch hẹn!`);
                        clearSelection();
                        fetchAppointments();
                      } catch { toast.error('Có lỗi xảy ra!'); }
                      setBulkProcessing(false);
                      setCancelModal({ open: false, id: '', reason: '' });
                    } else {
                      handleCancelSubmit();
                    }
                  }}
                  disabled={!cancelModal.reason.trim() || !!processing || bulkProcessing}
                  className="flex-1 py-2.5 font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all disabled:opacity-50"
                >
                  Xác nhận hủy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permanent Delete Confirm Modal */}
      <AnimatePresence>
        {permanentDeleteModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
            >
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XOctagon className="w-6 h-6 text-rose-600" />
              </div>
              <h2 className="text-lg font-black text-slate-900 mb-2 text-center">Xóa vĩnh viễn</h2>
              <p className="text-sm text-slate-500 text-center mb-6">
                Bạn sắp xóa vĩnh viễn <strong>{permanentDeleteModal.ids.length}</strong> lịch hẹn.
                Thao tác này <strong className="text-rose-600">không thể hoàn tác</strong>.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPermanentDeleteModal({ open: false, ids: [] })}
                  className="flex-1 py-2.5 font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handlePermanentDelete(permanentDeleteModal.ids)}
                  disabled={bulkProcessing}
                  className="flex-1 py-2.5 font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all disabled:opacity-50"
                >
                  {bulkProcessing ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
