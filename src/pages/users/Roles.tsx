import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Role, db, handleFirestoreError, OperationType, UserPermissions } from '../../lib/firebase';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, Plus, Edit2, Trash2, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

const defaultPermissions: UserPermissions = {
  products: { view: false, add: false, edit: false, delete: false },
  orders: { view: false, add: false, edit: false, delete: false },
  stock: { view: false, import: false, export: false },
  customers: { view: false, edit: false },
  reports: { view: false },
  services: { view: false, add: false, edit: false, delete: false },
  documents: { view: false, add: false, edit: false, delete: false, print: false },
  staff: { view: false, add: false, edit: false },
  settings: { view: false, edit: false }
};

export function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: defaultPermissions });

  useEffect(() => {
    const q = query(collection(db, 'roles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
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
         await updateDoc(doc(db, 'roles', editingId), {
            ...formData,
            updatedAt: serverTimestamp()
         });
      } else {
         const newId = doc(collection(db, 'roles')).id;
         await setDoc(doc(db, 'roles', newId), {
            ...formData,
            isSystem: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
         });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', description: '', permissions: defaultPermissions });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'roles');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingId(role.id!);
    setFormData({ name: role.name, description: role.description || '', permissions: role.permissions || defaultPermissions });
    if (role.isSystem) return; // Prevent system edit popup if we want, or allow edit but not delete
    setIsModalOpen(true);
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, role: Role | null}>({ isOpen: false, role: null });

  const handleDelete = (role: Role) => {
    if (role.isSystem) {
       toast.error("Không thể xóa vai trò hệ thống.");
       return;
    }
    setDeleteConfirm({ isOpen: true, role });
  };

  const executeDeleteRole = async () => {
    const role = deleteConfirm.role;
    if (!role) return;

    try {
      await deleteDoc(doc(db, 'roles', role.id!));
      toast.success('Xóa vai trò thành công!');
    } catch (err) {
      toast.error('Lỗi khi xóa!');
    } finally {
      setDeleteConfirm({ isOpen: false, role: null });
    }
  };

  const togglePermission = (module: keyof UserPermissions, action: string) => {
     setFormData(prev => ({
        ...prev,
        permissions: {
           ...prev.permissions,
           [module]: {
              ...(prev.permissions[module] as any),
              [action]: !(prev.permissions[module] as any)?.[action]
           }
        }
     }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-lg font-black text-slate-900 uppercase">Vai trò & Phân quyền</h2>
            <p className="text-sm font-medium text-slate-500">Quản lý các nhóm quyền hạn trên hệ thống</p>
         </div>
         <button onClick={() => { setEditingId(null); setFormData({name: '', description: '', permissions: defaultPermissions}); setIsModalOpen(true); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
            <Plus className="w-4 h-4" /> Thêm vai trò mới
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2 opacity-20" />
            </div>
         ) : roles.map((role) => (
            <div key={role.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
               <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", role.isSystem ? "bg-amber-500" : "bg-blue-600")}>
                        <ShieldCheck className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight">{role.name}</h3>
                        {role.isSystem && <span className="text-[10px] uppercase font-bold text-amber-500 tracking-widest bg-amber-50 px-2 py-0.5 rounded-full inline-block mt-1">Vai trò hệ thống</span>}
                     </div>
                  </div>
                  {!role.isSystem && (
                     <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(role)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(role)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                     </div>
                  )}
               </div>
               <p className="text-xs text-slate-500 font-medium flex-1 mb-4">{role.description}</p>
               
               <div className="pt-4 border-t border-slate-100">
                  <button onClick={() => handleEdit(role)} className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1">
                     Xem chi tiết quyền hạn &rarr;
                  </button>
               </div>
            </div>
         ))}
      </div>

      <AnimatePresence>
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white z-10 shrink-0">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">{editingId ? 'Cập nhật vai trò' : 'Thêm vai trò'}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Phân quyền chi tiết</p>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="overflow-y-auto p-6 bg-slate-50/50 flex-1">
                     <form id="roleForm" onSubmit={handleSave} className="space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Tên vai trò (VD: Nhân viên Sale)</label>
                              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="Nhập tên vai trò" />
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Mô tả chi tiết</label>
                              <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="Mô tả quyền hạn của vai trò này" />
                           </div>
                        </div>

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-4">Cấu hình chức năng</label>
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {Object.entries({
                                 products: 'Kho & Sản phẩm',
                                 orders: 'Quản lý Đơn hàng',
                                 stock: 'Nhập xuất tồn',
                                 customers: 'Khách hàng (CRM)',
                                 services: 'Dịch vụ & Booking',
                                 reports: 'Báo cáo tài chính',
                                 staff: 'Quản lý Nhân sự',
                                 settings: 'Cài đặt hệ thống'
                              }).map(([moduleKey, moduleName]) => (
                                 <div key={moduleKey} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="font-black text-xs text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">{moduleName}</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                       {Object.entries((formData.permissions as any)[moduleKey] || {}).map(([action, val]) => (
                                          <button
                                             key={action}
                                             type="button"
                                             onClick={() => togglePermission(moduleKey as any, action)}
                                             className={cn(
                                                "px-3 py-2 text-left rounded-xl transition-all border flex items-center gap-2",
                                                val ? "bg-blue-50 border-blue-100 text-blue-700 font-bold" : "bg-slate-50 border-slate-100 text-slate-500 font-medium hover:bg-slate-100"
                                             )}
                                          >
                                             {val ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                                             <span className="text-[10px] uppercase tracking-widest truncate">
                                                {action === 'view' ? 'Xem' :
                                                 action === 'add' ? 'Thêm' :
                                                 action === 'edit' ? 'Sửa' :
                                                 action === 'delete' ? 'Xóa' :
                                                 action === 'print' ? 'In ấn' :
                                                 action === 'import' ? 'Nhập kho' :
                                                 action === 'export' ? 'Xuất kho' : action}
                                             </span>
                                          </button>
                                       ))}
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </form>
                  </div>
                  
                  <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors">Hủy</button>
                     <button type="submit" form="roleForm" disabled={saving} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Lưu vai trò
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa vai trò"
        message="Bạn có chắc chắn muốn xóa vai trò này? Thao tác không thể hoàn tác và các nhân viên đang có vai trò này có thể sẽ bị ảnh hưởng quyền hiện tại."
        onConfirm={executeDeleteRole}
        onCancel={() => setDeleteConfirm({ isOpen: false, role: null })}
      />
    </div>
  );
}
