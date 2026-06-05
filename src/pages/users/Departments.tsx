import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Department, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, Plus, Edit2, Trash2, X, Users, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', status: 'active' as const });

  useEffect(() => {
    const q = query(collection(db, 'departments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setSaving(true);
    
    try {
      if (editingId) {
         await updateDoc(doc(db, 'departments', editingId), {
            ...formData,
            updatedAt: serverTimestamp()
         });
      } else {
         const newId = doc(collection(db, 'departments')).id;
         await setDoc(doc(db, 'departments', newId), {
            ...formData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
         });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', description: '', status: 'active' });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'departments');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingId(dept.id!);
    setFormData({ name: dept.name, description: dept.description || '', status: dept.status || 'active' });
    setIsModalOpen(true);
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, dept: Department | null}>({ isOpen: false, dept: null });

  const handleDelete = (dept: Department) => {
    setDeleteConfirm({ isOpen: true, dept });
  };

  const executeDeleteDepartment = async () => {
    const dept = deleteConfirm.dept;
    if (!dept) return;

    try {
      await deleteDoc(doc(db, 'departments', dept.id!));
      toast.success('Xóa phòng ban thành công');
    } catch (err) {
      toast.error('Lỗi khi xóa!');
    } finally {
      setDeleteConfirm({ isOpen: false, dept: null });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-lg font-black text-slate-900 uppercase">Quản lý phòng ban</h2>
            <p className="text-sm font-medium text-slate-500">Thiết lập cơ cấu tổ chức doanh nghiệp</p>
         </div>
         <button onClick={() => { setEditingId(null); setFormData({name: '', description: '', status: 'active'}); setIsModalOpen(true); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
            <Plus className="w-4 h-4" /> Thêm phòng ban
         </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         {loading ? (
            <div className="py-20 text-center flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2 opacity-20" />
            </div>
         ) : departments.length === 0 ? (
            <div className="py-20 text-center">
               <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
               <p className="text-slate-500 font-medium">Chưa có phòng ban nào được thiết lập.</p>
            </div>
         ) : (
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                     <th className="px-6 py-4 font-black">Phòng ban</th>
                     <th className="px-6 py-4 font-black">Mô tả</th>
                     <th className="px-6 py-4 font-black">Trạng thái</th>
                     <th className="px-6 py-4 font-black text-right">Thao tác</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {departments.map((dept) => (
                     <tr key={dept.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                 <Building2 className="w-5 h-5" />
                              </div>
                              {dept.name}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">{dept.description}</td>
                        <td className="px-6 py-4">
                           <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase inline-flex", dept.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                              {dept.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(dept)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(dept)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         )}
      </div>

      <AnimatePresence>
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 overflow-hidden z-10">
                  <div className="flex items-center justify-between mb-8">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">{editingId ? 'Cập nhật phòng ban' : 'Thêm phòng ban'}</h3>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleSave} className="space-y-5">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Tên phòng ban</label>
                        <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="VD: Marketing, Kế toán..." />
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Mô tả (Không bắt buộc)</label>
                        <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" placeholder="Mô tả chức năng bộ phận..." />
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Trạng thái</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                           <option value="active">Hoạt động</option>
                           <option value="inactive">Tạm ngưng</option>
                        </select>
                     </div>
                     <button type="submit" disabled={saving} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 mt-4 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                        Xác nhận lưu
                     </button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa phòng ban"
        message="Bạn có chắc chắn muốn xóa phòng ban này? Thao tác không thể hoàn tác."
        onConfirm={executeDeleteDepartment}
        onCancel={() => setDeleteConfirm({ isOpen: false, dept: null })}
      />
    </div>
  );
}
