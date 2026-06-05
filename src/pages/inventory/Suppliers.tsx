import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from '../../lib/firebaseAdapter';
import { db, Supplier, handleFirestoreError, OperationType } from '../../lib/supabase';
import { Plus, Search, Truck, Edit2, Trash2, X, CheckCircle2, Loader2, Phone, Mail, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../App';
import { cn } from '../../lib/utils';

export function Suppliers() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  const canManage = profile?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, error => handleFirestoreError(error, OperationType.LIST, 'suppliers'));
    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'suppliers', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'suppliers');
    } finally {
      setLoading(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, isBulk?: boolean}>({ isOpen: false, id: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleDelete = (id: string) => {
    if (!canManage) {
       toast.error('Bạn không có quyền thực hiện.');
       return;
    }
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleBulkDelete = () => {
    if (!canManage) return;
    setDeleteConfirm({ isOpen: true, id: '', isBulk: true });
  };

  const executeDeleteSupplier = async () => {
    if (deleteConfirm.isBulk) {
       if (selectedIds.length === 0) return;
       try {
          let deleted = 0;
          for (const id of selectedIds) {
             await deleteDoc(doc(db, 'suppliers', id));
             deleted++;
          }
          toast.success(`Xóa ${deleted} nhà cung cấp thành công!`);
          setSelectedIds([]);
       } catch (error) {
          toast.error('Lỗi thao tác hàng loạt!');
       } finally {
          setDeleteConfirm({ isOpen: false, id: '' });
       }
       return;
    }

    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'suppliers', deleteConfirm.id));
      toast.success('Xóa nhà cung cấp thành công!');
    } catch (error) {
      toast.error('Lỗi khi xóa!');
      handleFirestoreError(error, OperationType.DELETE, 'suppliers');
    } finally {
      setDeleteConfirm({ isOpen: false, id: '' });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', address: '', notes: '' });
    setEditingId(null);
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full min-h-[500px]">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 sticky top-0 z-10 bg-[#F8FAFC] -mt-4 sm:-mt-6 md:-mt-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 md:pb-8 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8">
        <div className="flex gap-3 items-center w-full sm:w-auto">
           <label className="flex items-center gap-2 cursor-pointer shrink-0 bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 h-[44px]">
              <input 
                 type="checkbox"
                 checked={filtered.length > 0 && selectedIds.length === filtered.length}
                 onChange={(e) => {
                    if (e.target.checked) setSelectedIds(filtered.map(s => s.id!));
                    else setSelectedIds([]);
                 }}
                 className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Chọn Lọc</span>
           </label>
           <div className="relative flex-1 sm:w-72 h-[44px]">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
             <input 
               type="text" 
               placeholder="Tìm NCC..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full h-full pl-9 pr-3 sm:pl-10 sm:pr-4 bg-white border-none border border-slate-100 rounded-xl sm:rounded-2xl shadow-sm text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
             />
           </div>
        </div>
        <div className="flex gap-2 h-[44px]">
           {selectedIds.length > 0 && canManage && (
             <button onClick={handleBulkDelete} className="flex-1 sm:flex-none px-4 sm:px-5 hover:bg-rose-100 bg-rose-50 text-rose-600 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 whitespace-nowrap">
                <Trash2 className="w-4 h-4" /> Xóa {selectedIds.length}
             </button>
           )}
           {canManage && (
             <button 
               onClick={() => { resetForm(); setIsModalOpen(true); }}
               className="flex-1 sm:flex-none px-4 sm:px-6 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
             >
               <Plus className="w-4 h-4" /> Thêm NCC
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-20 sm:pb-0">
        {filtered.map(supplier => (
          <div key={supplier.id} className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="absolute top-6 right-6">
               <input
                 type="checkbox"
                 checked={selectedIds.includes(supplier.id!)}
                 onChange={(e) => {
                    if (e.target.checked) setSelectedIds(prev => [...prev, supplier.id!]);
                    else setSelectedIds(prev => prev.filter(id => id !== supplier.id!));
                 }}
                 className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
               />
            </div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              {canManage && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setFormData(supplier); setEditingId(supplier.id!); setIsModalOpen(true); }} className="p-2 hover:bg-slate-50 text-blue-600 rounded-xl"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(supplier.id!)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-4">{supplier.name}</h3>
            
            <div className="space-y-3">
              {supplier.phone && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold">{supplier.phone}</span>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold">{supplier.email}</span>
                </div>
              )}
              {supplier.address && (
                <div className="flex items-start gap-3 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-xs font-bold leading-relaxed">{supplier.address}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[44px] shadow-2xl overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">{editingId ? 'Cập nhật NCC' : 'Thêm Nhà Cung Cấp'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên nhà cung cấp</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" placeholder="VD: Công ty CP Vật tư y tế" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Số điện thoại</label>
                    <input type="tel" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" placeholder="09..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" placeholder="email@..." />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Địa chỉ</label>
                  <input type="text" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" placeholder="Số nhà, đường..." />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú thêm</label>
                  <textarea value={formData.notes || ''} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" placeholder="Ghi chú (nếu có)" rows={3} />
                </div>

                <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-all flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Lưu thông tin
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa nhà cung cấp"
        message="Bạn có chắc chắn muốn xóa dữ liệu nhà cung cấp này? Thao tác không thể hoàn tác."
        onConfirm={executeDeleteSupplier}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '' })}
      />
    </div>
  );
}
