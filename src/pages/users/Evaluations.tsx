import React, { useState, useEffect } from 'react';
import { Star, AlertTriangle, Gift, Plus, Loader2, Save, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, HrEvaluation, UserProfile } from '../../lib/supabase';
import { collection, query, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp } from '../../lib/firebaseAdapter';
import { DataTable } from '../../components/DataTable';
import { formatCurrency, formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export function Evaluations() {
  const [evaluations, setEvaluations] = useState<HrEvaluation[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
     userId: '',
     type: 'evaluation' as 'reward' | 'penalty' | 'evaluation',
     date: format(new Date(), 'yyyy-MM-dd'),
     amount: 0,
     score: 100,
     notes: ''
  });

  useEffect(() => {
    setLoading(true);
    const unsubU = onSnapshot(query(collection(db, 'users')), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    const unsubE = onSnapshot(query(collection(db, 'hr_evaluations')), snap => {
      setEvaluations(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrEvaluation)));
      setLoading(false);
    });

    return () => { unsubU(); unsubE(); };
  }, []);

  const openAdd = () => {
     setFormData({
        userId: '',
        type: 'evaluation',
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        score: 100,
        notes: ''
     });
     setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
     if (confirm('Xóa bản ghi này?')) {
        await deleteDoc(doc(db, 'hr_evaluations', id));
        toast.success('Đã xóa');
     }
  };

  const handleSave = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!formData.userId) return toast.error('Vui lòng chọn nhân viên');
     setSaving(true);
     try {
        const id = doc(collection(db, 'hr_evaluations')).id;
        await setDoc(doc(db, 'hr_evaluations', id), {
           ...formData,
           createdAt: serverTimestamp(),
           updatedAt: serverTimestamp()
        });
        toast.success('Đã lưu thành công');
        setIsModalOpen(false);
     } catch (err) {
        toast.error('Có lỗi xảy ra');
     } finally {
        setSaving(false);
     }
  };

  const columns = [
    { header: 'Ngày', accessorKey: 'date', cell: ({row}: any) => <span className="font-bold text-slate-700">{formatDate(row.original.date)}</span> },
    { header: 'Nhân viên', accessorKey: 'userId', cell: ({row}: any) => {
       const u = users.find(x => x.uid === row.original.userId);
       return <div className="font-bold">{u?.name || row.original.userId}</div>
    }},
    { header: 'Loại', accessorKey: 'type', cell: ({row}: any) => {
       const t = row.original.type;
       if (t === 'reward') return <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max"><Gift className="w-3 h-3"/> Khen Thưởng</span>;
       if (t === 'penalty') return <span className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3"/> Kỷ Luật</span>;
       return <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max"><Star className="w-3 h-3"/> Đánh Giá</span>;
    }},
    { header: 'Giá trị', accessorKey: 'amount', cell: ({row}: any) => {
       if (row.original.type === 'evaluation') return <span className="font-bold text-blue-600">{row.original.score} / 100 điểm</span>;
       return <span className={`font-bold ${row.original.type === 'reward' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(row.original.amount)}</span>;
    }},
    { header: 'Nội dung', accessorKey: 'notes', cell: ({row}: any) => <span className="text-slate-600">{row.original.notes}</span> },
    { header: 'Tác vụ', accessorKey: 'actions', cell: ({row}: any) => (
       <button onClick={() => handleDelete(row.original.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
    )}
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Kỷ Luật & Đánh Giá</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý hiệu suất, khen thưởng và vi phạm</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 font-bold uppercase tracking-widest text-[10px]">
           <Plus size={16} /> Ghi nhận mới
        </button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0"><Gift className="w-6 h-6" /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tiền Thưởng</p>
               <p className="text-2xl font-black text-emerald-600">{formatCurrency(evaluations.filter(e => e.type === 'reward').reduce((a,b)=>a+b.amount,0))}</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6" /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tiền Phạt</p>
               <p className="text-2xl font-black text-rose-600">{formatCurrency(evaluations.filter(e => e.type === 'penalty').reduce((a,b)=>a+b.amount,0))}</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shrink-0"><Star className="w-6 h-6" /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NV Xuất Sắc (&gt;90đ)</p>
               <p className="text-2xl font-black text-blue-600">{evaluations.filter(e => e.type === 'evaluation' && e.score! >= 90).length}</p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
        ) : (
          <DataTable columns={columns} data={evaluations} searchPlaceholder="Tìm kiếm..." />
        )}
      </div>

      <AnimatePresence>
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-slate-100">
                     <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase">Ghi Nhận Mới</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đánh giá hoặc Kỷ luật/Khen thưởng</p>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6">
                     <form id="evalForm" onSubmit={handleSave} className="space-y-4">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Nhân viên</label>
                           <select required value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500">
                              <option value="">-- Chọn nhân viên --</option>
                              {users.map(u => <option key={u.uid} value={u.uid}>{u.name || u.email} - {u.position}</option>)}
                           </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Ngày ghi nhận</label>
                              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Loại ghi nhận</label>
                              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500">
                                 <option value="evaluation">Đánh giá chung</option>
                                 <option value="reward">Khen thưởng (+Tiền)</option>
                                 <option value="penalty">Kỷ luật (-Tiền)</option>
                              </select>
                           </div>
                        </div>

                        {formData.type === 'evaluation' ? (
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Điểm đánh giá (1-100)</label>
                              <input type="number" min={1} max={100} value={formData.score} onChange={e => setFormData({...formData, score: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                           </div>
                        ) : (
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Số tiền (VNĐ)</label>
                              <input type="number" min={0} value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                           </div>
                        )}

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Ghi chú / Lý do</label>
                           <textarea required value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 min-h-[100px]" placeholder="Nhập lý do chi tiết..." />
                        </div>
                     </form>
                  </div>
                  
                  <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200">Hủy</button>
                     <button type="submit" form="evalForm" disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Lưu Quyết Định
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
