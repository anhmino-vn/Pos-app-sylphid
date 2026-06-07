import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, Appointment, AppointmentStatus, Staff, Room, Customer } from '../../lib/supabase';
import { addDoc, collection, serverTimestamp } from '../../lib/firebaseAdapter';
import { db } from '../../lib/supabase';
import { useAuth } from '../../App';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, User, Phone, Briefcase, Home, Clock, Calendar,
  AlertTriangle, CheckCircle, CheckCircle2, Search, X, ChevronDown, Info, Loader2, Plus, Users
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { format, addMinutes, parse, differenceInMinutes } from 'date-fns';
import { cn } from '../../lib/utils';

interface ConflictInfo {
  type: 'staff' | 'room';
  name: string;
  conflicting: Appointment[];
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];
const DEFAULT_HOURS = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

export function AppointmentForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const isEdit = !!id;

  // Form state
  const [form, setForm] = useState<Partial<Appointment>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    status: 'pending',
    customerName: '',
  });

  // Data
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [serviceList, setServiceList] = useState<any[]>([]);
  const [customerList, setCustomerList] = useState<any[]>([]);

  // UI state
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  
  // New Customer Form State (Same as Customers.tsx)
  const [formData, setFormData] = useState<Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'lastPurchaseDate'> & { referredById?: string, code?: string }>({
    code: '', name: '', phone: '', email: '', address: '', gender: '', birthDate: '', note: '', status: 'active', inChargeStaff: '', totalSpend: 0, orderCount: 0, tier: 'bronze', referredById: '', customerSource: '', customerGroup: ''
  });
  const [referrerSearchTerm, setReferrerSearchTerm] = useState('');
  const [isReferrerDropdownOpen, setIsReferrerDropdownOpen] = useState(false);
  const referrerDropdownRef = React.useRef<HTMLDivElement>(null);
  
  const [addingCustomer, setAddingCustomer] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (referrerDropdownRef.current && !referrerDropdownRef.current.contains(event.target as Node)) {
        setIsReferrerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
    if (isEdit) fetchAppointment();
  }, [id]);

  const fetchData = async () => {
    const [staffRes, roomRes, serviceRes, customerRes] = await Promise.all([
      supabase.from('staff').select('*').eq('status', 'active').order('name'),
      supabase.from('rooms').select('*').eq('status', 'active').order('name'),
      supabase.from('services').select('id, name, duration').eq('status', 'active').order('name'),
      supabase.from('customers').select('id, name, phone').eq('status', 'active').order('name').limit(200),
    ]);
    setStaffList(staffRes.data?.map(r => ({
      id: r.id, name: r.name, color: r.color, position: r.position,
      status: r.status, serviceIds: r.service_ids, workingHours: r.working_hours
    })) || []);
    setRoomList(roomRes.data?.map(r => ({
      id: r.id, name: r.name, color: r.color, floor: r.floor,
      status: r.status, capacity: r.capacity
    })) || []);
    setServiceList(serviceRes.data || []);
    setCustomerList(customerRes.data || []);
  };

  const fetchAppointment = async () => {
    setLoading(true);
    const { data } = await supabase.from('appointments').select('*').eq('id', id).single();
    if (data) {
      setForm({
        ...data,
        startTime: data.start_time?.slice(0, 5),
        endTime: data.end_time?.slice(0, 5),
        customerName: data.customer_name,
        customerPhone: data.customer_phone,
        serviceId: data.service_id,
        serviceName: data.service_name,
        staffId: data.staff_id,
        staffName: data.staff_name,
        roomId: data.room_id,
        roomName: data.room_name,
        cancelReason: data.cancel_reason,
      });
      setCustomerSearch(data.customer_name || '');
    }
    setLoading(false);
  };

  // Auto-compute end time from start + duration
  const handleDurationChange = (duration: number) => {
    if (!form.startTime) return;
    try {
      const start = parse(form.startTime, 'HH:mm', new Date());
      const end = addMinutes(start, duration);
      setForm(prev => ({ ...prev, duration, endTime: format(end, 'HH:mm') }));
    } catch {}
  };

  const handleStartTimeChange = (startTime: string) => {
    try {
      const start = parse(startTime, 'HH:mm', new Date());
      const end = addMinutes(start, form.duration || 60);
      setForm(prev => ({ ...prev, startTime, endTime: format(end, 'HH:mm') }));
    } catch {
      setForm(prev => ({ ...prev, startTime }));
    }
  };

  const handleEndTimeChange = (endTime: string) => {
    try {
      const start = parse(form.startTime || '09:00', 'HH:mm', new Date());
      const end = parse(endTime, 'HH:mm', new Date());
      const duration = differenceInMinutes(end, start);
      setForm(prev => ({ ...prev, endTime, duration: duration > 0 ? duration : prev.duration }));
    } catch {
      setForm(prev => ({ ...prev, endTime }));
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = serviceList.find(s => s.id === serviceId);
    if (service) {
      setForm(prev => ({ ...prev, serviceId, serviceName: service.name }));
      if (service.duration) handleDurationChange(service.duration);
    } else {
      setForm(prev => ({ ...prev, serviceId: '', serviceName: '' }));
    }
  };

  // Conflict detection
  const checkConflicts = useCallback(async () => {
    if (!form.date || !form.startTime || !form.endTime) return;
    setCheckingConflict(true);

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('date', form.date)
      .not('status', 'in', '(cancelled,completed)')
      .neq('id', id || '___none___');

    const newConflicts: ConflictInfo[] = [];

    if (data && form.staffId) {
      const staffConflicts = data
        .filter(a => a.staff_id === form.staffId)
        .filter(a => {
          const aStart = a.start_time?.slice(0, 5) || '00:00';
          const aEnd = a.end_time?.slice(0, 5) || '23:59';
          return form.startTime! < aEnd && form.endTime! > aStart;
        })
        .map(a => ({
          customerName: a.customer_name,
          startTime: a.start_time?.slice(0, 5),
          endTime: a.end_time?.slice(0, 5),
          id: a.id,
        }) as any);

      if (staffConflicts.length > 0) {
        newConflicts.push({
          type: 'staff',
          name: form.staffName || 'Nhân viên',
          conflicting: staffConflicts,
        });
      }
    }

    if (data && form.roomId) {
      const roomConflicts = data
        .filter(a => a.room_id === form.roomId)
        .filter(a => {
          const aStart = a.start_time?.slice(0, 5) || '00:00';
          const aEnd = a.end_time?.slice(0, 5) || '23:59';
          return form.startTime! < aEnd && form.endTime! > aStart;
        })
        .map(a => ({
          customerName: a.customer_name,
          startTime: a.start_time?.slice(0, 5),
          endTime: a.end_time?.slice(0, 5),
          id: a.id,
        }) as any);

      if (roomConflicts.length > 0) {
        newConflicts.push({
          type: 'room',
          name: form.roomName || 'Phòng',
          conflicting: roomConflicts,
        });
      }
    }

    setConflicts(newConflicts);
    setCheckingConflict(false);
  }, [form.date, form.startTime, form.endTime, form.staffId, form.roomId, id]);

  useEffect(() => {
    const timer = setTimeout(() => { checkConflicts(); }, 500);
    return () => clearTimeout(timer);
  }, [checkConflicts]);

  const handleSubmit = async () => {
    if (!form.customerName?.trim()) { toast.error('Vui lòng nhập tên khách hàng!'); return; }
    if (!form.date) { toast.error('Vui lòng chọn ngày!'); return; }
    if (!form.startTime) { toast.error('Vui lòng chọn giờ bắt đầu!'); return; }
    if (conflicts.length > 0) {
      if (!confirm('Có trùng lịch! Bạn vẫn muốn lưu không?')) return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_name: form.customerName,
        customer_phone: form.customerPhone || null,
        customer_id: form.customerId || null,
        service_id: form.serviceId || null,
        service_name: form.serviceName || null,
        combo_id: form.comboId || null,
        combo_name: form.comboName || null,
        staff_id: form.staffId || null,
        staff_name: form.staffName || null,
        room_id: form.roomId || null,
        room_name: form.roomName || null,
        date: form.date,
        start_time: form.startTime,
        end_time: form.endTime,
        duration: form.duration || null,
        note: form.note || null,
        status: form.status || 'pending',
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase.from('appointments').update(payload).eq('id', id!);
        if (error) throw error;
        // Log update
        await supabase.from('appointment_logs').insert({
          appointment_id: id!,
          action: 'updated',
          new_values: payload,
          changed_by: profile?.uid,
          changed_by_name: profile?.name || profile?.email,
        });
        toast.success('Đã cập nhật lịch hẹn!');
      } else {
        const { data, error } = await supabase.from('appointments').insert({
          ...payload,
          created_by: profile?.uid,
          creator_name: profile?.name || profile?.email,
        }).select().single();
        if (error) throw error;
        await supabase.from('appointment_logs').insert({
          appointment_id: data.id,
          action: 'created',
          new_values: payload,
          changed_by: profile?.uid,
          changed_by_name: profile?.name || profile?.email,
        });
        toast.success('Đã tạo lịch hẹn!');
      }
      navigate('/appointments');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Có lỗi xảy ra!');
    }
    setSaving(false);
  };

  const filteredCustomers = customerList.filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  ).slice(0, 10);

  const filteredReferrers = React.useMemo(() => {
     if (!showAddCustomerModal) return [];
     let filtered = customerList;
     if (referrerSearchTerm) {
        const term = referrerSearchTerm.toLowerCase();
        filtered = customerList.filter(c => 
           (c.name && c.name.toLowerCase().includes(term)) || 
           (c.phone && c.phone.includes(term))
        );
     }
     return filtered.slice(0, 50);
  }, [customerList, referrerSearchTerm, showAddCustomerModal]);

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Vui lòng nhập tên khách hàng!');
    if (!formData.phone.trim()) return toast.error('Vui lòng nhập số điện thoại!');
    setAddingCustomer(true);
    try {
      const dataToSave = { ...formData };
      delete (dataToSave as any).code;
      if (!dataToSave.email) dataToSave.email = null as any;
      if (!dataToSave.phone) dataToSave.phone = null as any;
      delete (dataToSave as any).inChargeStaff;
      delete (dataToSave as any).customerGroup;
      delete (dataToSave as any).customerSource;
      delete (dataToSave as any).totalDebt;

      const payload = {
        ...dataToSave,
        birthDate: formData.birthDate || null,
        status: 'active',
        totalSpend: 0,
        orderCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'customers'), payload);
      
      toast.success('Thêm khách hàng thành công!');
      setCustomerList(prev => [...prev, { id: docRef.id, ...payload } as any]);
      setForm(prev => ({ ...prev, customerId: docRef.id, customerName: payload.name, customerPhone: payload.phone }));
      setCustomerSearch(payload.name);
      
      setShowAddCustomerModal(false);
      setFormData({
        code: '', name: '', phone: '', email: '', address: '', gender: '', birthDate: '', note: '', status: 'active', inChargeStaff: '', totalSpend: 0, orderCount: 0, tier: 'bronze', referredById: '', customerSource: '', customerGroup: ''
      });
      setReferrerSearchTerm('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi thêm khách hàng!');
    } finally {
      setAddingCustomer(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/appointments')} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900">{isEdit ? 'Chỉnh sửa lịch hẹn' : 'Tạo lịch hẹn mới'}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{isEdit ? `#${id}` : 'Điền thông tin để tạo lịch'}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Conflict Alert */}
        <AnimatePresence>
          {conflicts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-amber-50 border border-amber-200 rounded-xl p-4"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-amber-800 text-sm">Phát hiện trùng lịch!</p>
                  {conflicts.map((c, i) => (
                    <div key={i} className="mt-1">
                      <p className="text-sm text-amber-700 font-semibold">
                        {c.type === 'staff' ? '👤 Nhân viên' : '🏠 Phòng'} <strong>{c.name}</strong> đã có lịch:
                      </p>
                      {c.conflicting.map((conf: any, j) => (
                        <p key={j} className="text-xs text-amber-600 ml-4 mt-0.5">
                          · {conf.customerName} · {conf.startTime} – {conf.endTime}
                        </p>
                      ))}
                    </div>
                  ))}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button
                      onClick={() => setForm(prev => ({ ...prev, staffId: '', staffName: '' }))}
                      className="text-xs font-bold px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-all"
                    >
                      Chọn nhân viên khác
                    </button>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, roomId: '', roomName: '' }))}
                      className="text-xs font-bold px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-all"
                    >
                      Chọn phòng khác
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section: Khách hàng */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-black text-slate-900 text-sm mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-teal-600" /> Thông tin khách hàng
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer search */}
            <div className="relative col-span-full">
              <label className="block text-xs font-bold text-slate-500 mb-1">Khách hàng *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setForm(prev => ({ ...prev, customerName: e.target.value, customerId: undefined }));
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Tìm tên hoặc SĐT khách hàng..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {customerSearch && (
                  <button onClick={() => { setCustomerSearch(''); setForm(prev => ({ ...prev, customerName: '', customerId: undefined })); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
              <AnimatePresence>
                {showCustomerDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col"
                  >
                    <div className="max-h-60 overflow-y-auto">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setForm(prev => ({
                                ...prev,
                                customerId: c.id,
                                customerName: c.name,
                                customerPhone: c.phone || prev.customerPhone,
                              }));
                              setCustomerSearch(c.name);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-all text-sm border-b border-slate-50 last:border-0"
                          >
                            <span className="font-bold text-slate-800">{c.name}</span>
                            {c.phone && <span className="text-slate-400 ml-2">{c.phone}</span>}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 text-center border-b border-slate-50">
                          Không tìm thấy "{customerSearch}"
                        </div>
                      )}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowCustomerDropdown(false);
                          setFormData(prev => ({ ...prev, name: customerSearch }));
                          setShowAddCustomerModal(true);
                        }}
                        className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-teal-50 text-teal-700 transition-all text-sm font-bold flex items-center gap-2 border-t border-slate-100 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm khách hàng mới
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Số điện thoại</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={form.customerPhone || ''}
                  onChange={e => setForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="0901234567"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Dịch vụ */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-black text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-teal-600" /> Dịch vụ
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Dịch vụ</label>
              <select
                value={form.serviceId || ''}
                onChange={e => handleServiceChange(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="">-- Chọn dịch vụ --</option>
                {serviceList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.duration ? `(${s.duration}ph)` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ghi chú</label>
              <input
                type="text"
                value={form.note || ''}
                onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Ghi chú thêm..."
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Section: Thời gian */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-black text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" /> Thời gian
            {checkingConflict && <Loader2 className="w-3 h-3 text-slate-400 animate-spin ml-auto" />}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ngày hẹn *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={form.date || ''}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Giờ bắt đầu *</label>
              <input
                type="time"
                value={form.startTime || ''}
                onChange={e => handleStartTimeChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Giờ kết thúc</label>
              <input
                type="time"
                value={form.endTime || ''}
                onChange={e => handleEndTimeChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Duration quick select */}
          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 mb-2">Thời lượng</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDurationChange(d)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-bold rounded-lg border transition-all',
                    form.duration === d
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  {d < 60 ? `${d} phút` : `${d / 60}h${d % 60 ? ` ${d % 60}ph` : ''}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section: Nhân viên & Phòng */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-black text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Home className="w-4 h-4 text-teal-600" /> Nhân viên & Phòng
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nhân viên thực hiện</label>
              <select
                value={form.staffId || ''}
                onChange={e => {
                  const staff = staffList.find(s => s.id === e.target.value);
                  setForm(prev => ({ ...prev, staffId: e.target.value, staffName: staff?.name || '' }));
                }}
                className={cn(
                  'w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white',
                  conflicts.some(c => c.type === 'staff') ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                )}
              >
                <option value="">-- Chọn nhân viên --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.position ? `· ${s.position}` : ''}</option>
                ))}
              </select>
              {conflicts.some(c => c.type === 'staff') && (
                <p className="text-xs text-amber-600 mt-1 font-semibold">⚠ Nhân viên đã có lịch trong khung giờ này</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Phòng thực hiện</label>
              <select
                value={form.roomId || ''}
                onChange={e => {
                  const room = roomList.find(r => r.id === e.target.value);
                  setForm(prev => ({ ...prev, roomId: e.target.value, roomName: room?.name || '' }));
                }}
                className={cn(
                  'w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white',
                  conflicts.some(c => c.type === 'room') ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                )}
              >
                <option value="">-- Chọn phòng --</option>
                {roomList.map(r => (
                  <option key={r.id} value={r.id}>{r.name} {r.floor ? `· Tầng ${r.floor}` : ''}</option>
                ))}
              </select>
              {conflicts.some(c => c.type === 'room') && (
                <p className="text-xs text-amber-600 mt-1 font-semibold">⚠ Phòng đã được đặt trong khung giờ này</p>
              )}
            </div>
          </div>
        </div>

        {/* Section: Trạng thái */}
        {isEdit && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-black text-slate-900 text-sm mb-4">Trạng thái</h2>
            <select
              value={form.status || 'pending'}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value as AppointmentStatus }))}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="pending">Chờ xác nhận</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="completed">Hoàn thành</option>
              <option value="no_show">Khách không đến</option>
              <option value="cancelled">Đã hủy</option>
              <option value="rescheduled">Dời lịch</option>
            </select>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2 pb-6">
          <button
            type="button"
            onClick={() => navigate('/appointments')}
            className="flex-1 sm:flex-none sm:w-32 py-3 font-bold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 font-bold text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Cập nhật lịch hẹn' : 'Tạo lịch hẹn'}
          </button>
        </div>
      </div>

      {/* Add Customer Modal - Exact Match from Customers.tsx */}
      {showAddCustomerModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddCustomerModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Minimal Professional Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 border border-slate-200">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Thêm khách hàng mới</h2>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="flex flex-col flex-1 overflow-hidden bg-slate-50/50">
              <div className="overflow-y-auto custom-scrollbar p-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                   {/* Left Column: Basic Info */}
                   <div className="space-y-5">
                      <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                         Thông tin cơ bản
                      </h3>
                      
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                        <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="Nguyễn Văn A" autoFocus />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                           <input required type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="09xxxxxxxx" />
                         </div>
                         <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1.5">Giới tính</label>
                           <div className="relative">
                             <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none appearance-none pr-10">
                               <option value="">Không xác định</option>
                               <option value="male">Nam</option>
                               <option value="female">Nữ</option>
                             </select>
                             <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                           </div>
                         </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ngày sinh</label>
                        <input type="date" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mã khách hàng</label>
                        <input type="text" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="Để trống để tự tạo (VD: KH0001)" />
                      </div>
                   </div>

                   {/* Right Column: Meta Info */}
                   <div className="space-y-5">
                      <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                         Thông tin liên lạc & Phân loại
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phân hạng</label>
                           <div className="relative">
                             <select value={formData.tier} onChange={e => setFormData({ ...formData, tier: e.target.value as any })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none appearance-none pr-10">
                               <option value="bronze">Thành viên Đồng</option>
                               <option value="silver">Thành viên Bạc</option>
                               <option value="gold">Thành viên Vàng</option>
                               <option value="diamond">Khách VIP</option>
                             </select>
                             <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                           </div>
                         </div>
                         <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                           <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="email@example.com" />
                         </div>
                      </div>

                      <div>
                         <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nguồn khách hàng</label>
                         <div className="relative">
                           <select 
                              value={(!['', 'Giới thiệu', 'Facebook Ads', 'Zalo OA', 'Website', 'Google Ads', 'TikTok Ads'].includes(formData.customerSource || '') && formData.customerSource) ? 'Khác' : (formData.customerSource || '')} 
                              onChange={e => {
                                 if (e.target.value === 'Khác') {
                                    setFormData({ ...formData, customerSource: 'Nguồn khác' });
                                 } else {
                                    setFormData({ ...formData, customerSource: e.target.value });
                                 }
                              }} 
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none appearance-none pr-10"
                           >
                             <option value="">Chưa phân loại</option>
                             <option value="Giới thiệu">Người giới thiệu</option>
                             <option value="Facebook Ads">Facebook Ads</option>
                             <option value="Zalo OA">Zalo OA</option>
                             <option value="Website">Website</option>
                             <option value="Google Ads">Google Ads</option>
                             <option value="TikTok Ads">TikTok Ads</option>
                             <option value="Khác">Khác (Nhập tay)</option>
                           </select>
                           <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                         </div>
                         {(!['', 'Giới thiệu', 'Facebook Ads', 'Zalo OA', 'Website', 'Google Ads', 'TikTok Ads'].includes(formData.customerSource || '') && formData.customerSource) && (
                           <input 
                              type="text" 
                              value={formData.customerSource}
                              onChange={e => setFormData({ ...formData, customerSource: e.target.value })}
                              placeholder="Nhập tên nguồn khách hàng..." 
                              className="w-full mt-2 px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none"
                           />
                         )}
                      </div>

                      <div className="relative" ref={referrerDropdownRef}>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Người giới thiệu</label>
                        <div className="relative">
                           <input 
                              type="text" 
                              placeholder="Tìm theo tên hoặc SĐT..." 
                              value={referrerSearchTerm}
                              onChange={(e) => {
                                 setReferrerSearchTerm(e.target.value);
                                 setIsReferrerDropdownOpen(true);
                                 if (e.target.value === '') setFormData({ ...formData, referredById: '' });
                              }}
                              onClick={() => setIsReferrerDropdownOpen(true)}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none pr-10 placeholder:text-slate-400"
                           />
                           <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>

                        <AnimatePresence>
                           {isReferrerDropdownOpen && (
                              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 max-h-48 overflow-y-auto">
                                 {filteredReferrers.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-500">Không tìm thấy khách hàng.</div>
                                 ) : (
                                    <ul className="py-1">
                                       {filteredReferrers.map(c => (
                                          <li 
                                            key={c.id} 
                                            onClick={() => {
                                               setFormData({ ...formData, referredById: c.id });
                                               setReferrerSearchTerm(`${c.name} - ${c.phone}`);
                                               setIsReferrerDropdownOpen(false);
                                            }}
                                            className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between gap-3 border-b border-slate-50 last:border-0"
                                          >
                                             <span className="font-medium text-slate-900 text-sm truncate">{c.name}</span>
                                             <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">{c.phone}</span>
                                          </li>
                                       ))}
                                    </ul>
                                 )}
                              </motion.div>
                           )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ghi chú & Địa chỉ</label>
                        <textarea rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-t-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none resize-none placeholder:text-slate-400" placeholder="Địa chỉ thường trú..." />
                        <textarea rows={2} value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 border-t-0 rounded-b-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none resize-none placeholder:text-slate-400" placeholder="Ghi chú thêm (dị ứng, sở thích...)" />
                      </div>
                   </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm">
                  Hủy bỏ
                </button>
                <button type="submit" disabled={addingCustomer} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  {addingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Hoàn tất đăng ký
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
