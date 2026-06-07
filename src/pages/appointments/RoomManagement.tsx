import React, { useEffect, useState } from 'react';
import { supabase, Room } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Save, Home, Loader2, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';

const COLORS = ['#0891B2','#0D9488','#7C3AED','#DC2626','#D97706','#059669','#DB2777','#65A30D','#2563EB','#EA580C'];
const DEFAULT_FORM: Partial<Room> = { name: '', code: '', description: '', color: '#0891B2', capacity: 1, floor: '', status: 'active' };

export function RoomManagement() {
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<Partial<Room>>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRooms();
    const ch = supabase.channel('rooms-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchRooms)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('name');
      if (error) {
        if (error.code === '42P01') {
          toast.error('Bảng dữ liệu chưa được tạo. Vui lòng chạy SQL migration!');
        } else {
          toast.error('Lỗi tải dữ liệu: ' + error.message);
        }
        setLoading(false);
        return;
      }
      setRoomList((data || []).map(r => ({
        id: r.id, name: r.name, code: r.code, description: r.description,
        color: r.color, capacity: r.capacity, floor: r.floor, status: r.status,
      })));
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(DEFAULT_FORM); setModalOpen(true); };
  const openEdit = (r: Room) => { setEditing(r); setForm({ ...r }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Vui lòng nhập tên phòng!'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, code: form.code || null, description: form.description || null,
        color: form.color || '#0891B2', capacity: form.capacity || 1,
        floor: form.floor || null, status: form.status || 'active',
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', editing.id!);
        if (error) throw error;
        toast.success('Đã cập nhật phòng!');
      } else {
        const { error } = await supabase.from('rooms').insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
        toast.success('Đã thêm phòng!');
      }
      setModalOpen(false);
      fetchRooms();
    } catch (e: any) {
      if (e.code === '42P01') {
        toast.error('Bảng "rooms" chưa tồn tại! Chạy SQL migration trước.');
      } else {
        toast.error(e.message || 'Có lỗi xảy ra!');
      }
    }
    setSaving(false);
  };

  const handleSetStatus = async (r: Room, status: Room['status']) => {
    await supabase.from('rooms').update({ status }).eq('id', r.id!);
    toast.success('Đã cập nhật trạng thái!');
    fetchRooms();
  };

  const handleDelete = async (r: Room) => {
    if (!confirm(`Xóa phòng ${r.name}?`)) return;
    await supabase.from('rooms').delete().eq('id', r.id!);
    toast.success('Đã xóa!');
    fetchRooms();
  };

  const statusConfig = {
    active:      { label: 'Hoạt động',    bg: 'bg-emerald-50',   text: 'text-emerald-600' },
    inactive:    { label: 'Không dùng',   bg: 'bg-slate-100',    text: 'text-slate-500' },
    maintenance: { label: 'Bảo trì',      bg: 'bg-amber-50',     text: 'text-amber-600' },
  };

  const filtered = roomList.filter(r =>
    r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.floor?.includes(searchQuery) ||
    r.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Phòng dịch vụ</h1>
          <p className="text-xs text-slate-500 font-medium">Quản lý danh sách phòng thực hiện dịch vụ</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-all">
          <Plus className="w-4 h-4" /> Thêm phòng
        </button>
      </div>

      <input
        type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        placeholder="Tìm tên phòng, tầng, mã..."
        className="w-full max-w-sm text-sm border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 font-bold">Không có phòng nào</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(r => {
            const sc = statusConfig[r.status] || statusConfig.active;
            return (
              <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-sm transition-all"
              >
                {/* Color band */}
                <div className="h-2 w-full" style={{ backgroundColor: r.color || '#0891B2' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-900 truncate">{r.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.floor && <span className="text-xs text-slate-400">Tầng {r.floor}</span>}
                        {r.capacity && <span className="text-xs text-slate-400">· {r.capacity} người</span>}
                      </div>
                    </div>
                    <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full shrink-0', sc.bg, sc.text)}>{sc.label}</span>
                  </div>
                  {r.description && <p className="text-xs text-slate-400 line-clamp-2 mb-3">{r.description}</p>}

                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(r)} className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all flex items-center justify-center gap-1">
                      <Edit2 className="w-3 h-3" /> Sửa
                    </button>
                    {r.status !== 'maintenance' && (
                      <button onClick={() => handleSetStatus(r, 'maintenance')} className="p-1.5 text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-all" title="Bảo trì">
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {r.status === 'maintenance' && (
                      <button onClick={() => handleSetStatus(r, 'active')} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-all" title="Kích hoạt">
                        <Home className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(r)} className="p-1.5 text-rose-500 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
                <h2 className="font-black text-slate-900">{editing ? 'Chỉnh sửa phòng' : 'Thêm phòng mới'}</h2>
                <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Tên phòng *</label>
                  <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Phòng VIP 01" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Mã phòng</label>
                    <input value={form.code || ''} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                      placeholder="P01" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Tầng</label>
                    <input value={form.floor || ''} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
                      placeholder="1" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Sức chứa</label>
                    <input type="number" min={1} value={form.capacity || 1} onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Mô tả</label>
                  <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Mô tả ngắn về phòng..." rows={2}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
                </div>
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
                    <option value="inactive">Không dùng</option>
                    <option value="maintenance">Bảo trì</option>
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
