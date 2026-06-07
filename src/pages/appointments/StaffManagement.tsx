import React, { useEffect, useState } from 'react';
import { supabase, Staff } from '../../lib/supabase';
import { useAuth } from '../../App';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Save, User, Phone, Mail, Loader2, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';

const COLORS = ['#0D9488','#0891B2','#DC2626','#D97706','#059669','#2563EB','#DB2777','#65A30D','#9333EA','#EA580C'];

const DEFAULT_FORM: Partial<Staff> = {
  name: '', code: '', phone: '', email: '', position: '', color: '#0D9488', status: 'active',
};

export function StaffManagement() {
  const { profile } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<Partial<Staff>>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStaff();
    const ch = supabase.channel('staff-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchStaff)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase.from('staff').select('*').order('name');
      if (error) {
        if (error.code === '42P01') {
          toast.error('Bảng dữ liệu chưa được tạo. Vui lòng chạy SQL migration trong Supabase Dashboard!');
        } else {
          toast.error('Lỗi tải dữ liệu: ' + error.message);
        }
        setLoading(false);
        return;
      }
      setStaffList((data || []).map(r => ({
        id: r.id, name: r.name, code: r.code, phone: r.phone, email: r.email,
        position: r.position, color: r.color, status: r.status,
        createdAt: r.created_at,
      })));
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(DEFAULT_FORM); setModalOpen(true); };
  const openEdit = (s: Staff) => { setEditing(s); setForm({ ...s }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Vui lòng nhập tên nhân viên!'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, code: form.code || null, phone: form.phone || null,
        email: form.email || null, position: form.position || null,
        color: form.color || '#0D9488', status: form.status || 'active',
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editing.id!);
        if (error) throw error;
        toast.success('Đã cập nhật nhân viên!');
      } else {
        const { error } = await supabase.from('staff').insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
        toast.success('Đã thêm nhân viên!');
      }
      setModalOpen(false);
      fetchStaff();
    } catch (e: any) {
      if (e.code === '42P01') {
        toast.error('Bảng "staff" chưa tồn tại! Chạy SQL migration trước.');
      } else {
        toast.error(e.message || 'Có lỗi xảy ra!');
      }
    }
    setSaving(false);
  };

  const handleToggleStatus = async (s: Staff) => {
    const next = s.status === 'active' ? 'inactive' : 'active';
    await supabase.from('staff').update({ status: next }).eq('id', s.id!);
    toast.success(next === 'active' ? 'Đã kích hoạt!' : 'Đã vô hiệu hóa!');
    fetchStaff();
  };

  const handleDelete = async (s: Staff) => {
    if (!confirm(`Xóa nhân viên ${s.name}?`)) return;
    await supabase.from('staff').delete().eq('id', s.id!);
    toast.success('Đã xóa!');
    fetchStaff();
  };

  const filtered = staffList.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery) ||
    s.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Nhân viên</h1>
          <p className="text-xs text-slate-500 font-medium">Quản lý danh sách nhân viên thực hiện dịch vụ</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-all">
          <Plus className="w-4 h-4" /> Thêm nhân viên
        </button>
      </div>

      <input
        type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        placeholder="Tìm tên, SĐT, chức vụ..."
        className="w-full max-w-sm text-sm border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 font-bold">Không có nhân viên nào</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(s => (
            <motion.div key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0"
                  style={{ backgroundColor: s.color || '#0D9488' }}
                >
                  {s.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-black text-slate-900 truncate">{s.name}</h3>
                    <span className={cn(
                      'text-[10px] font-black px-1.5 py-0.5 rounded-full',
                      s.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    )}>
                      {s.status === 'active' ? 'Hoạt động' : 'Tạm nghỉ'}
                    </span>
                  </div>
                  {s.position && <p className="text-xs text-slate-500 font-medium truncate">{s.position}</p>}
                  {s.phone && <p className="text-xs text-slate-400 mt-0.5">{s.phone}</p>}
                </div>
              </div>
              <div className="flex gap-1.5 mt-3">
                <button onClick={() => openEdit(s)} className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all flex items-center justify-center gap-1">
                  <Edit2 className="w-3 h-3" /> Sửa
                </button>
                <button onClick={() => handleToggleStatus(s)} className={cn(
                  'flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all',
                  s.status === 'active' ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                )}>
                  {s.status === 'active' ? 'Nghỉ' : 'Kích hoạt'}
                </button>
                <button onClick={() => handleDelete(s)} className="p-1.5 text-rose-500 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-slate-900">{editing ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h2>
                <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Tên nhân viên *</label>
                  <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nguyễn Thị A" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Chức vụ</label>
                    <input value={form.position || ''} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                      placeholder="Kỹ thuật viên" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Mã NV</label>
                    <input value={form.code || ''} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                      placeholder="NV001" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Số điện thoại</label>
                    <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="0901234567" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Email</label>
                    <input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="a@email.com" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-2">Màu hiển thị</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                        className={cn('w-8 h-8 rounded-full border-2 transition-all', form.color === c ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105')}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">Trạng thái</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm nghỉ</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Hủy</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 font-bold text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editing ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
