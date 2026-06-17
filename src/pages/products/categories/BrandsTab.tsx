import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from '../../../lib/firebaseAdapter';
import { db, Brand, handleFirestoreError, OperationType } from '../../../lib/supabase';
import { Plus, Edit2, Trash2, Tag, X, Loader2, Search, Globe, Image as ImageIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import { ConfirmModal } from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function BrandsTab({ globalSearch = '' }: { globalSearch?: string }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ name: '', description: '', logoUrl: '', website: '', status: 'active' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'brands'), orderBy('name'));
    const unsub = onSnapshot(q, (snap: any) => {
      setBrands(snap.docs?.map((d: any) => {
        const dataObj = d.data();
        return { 
          id: d.id, 
          ...dataObj,
          logoUrl: dataObj.logoUrl || dataObj.data?.logoUrl || '',
          website: dataObj.website || dataObj.data?.website || ''
        };
      }) || []);
      setLoading(false);
    }, (err: any) => { handleFirestoreError(err, OperationType.LIST, 'brands'); setLoading(false); });
    return () => unsub();
  }, []);

  const filtered = useMemo(() =>
    brands.filter(b => !globalSearch || b.name.toLowerCase().includes(globalSearch.toLowerCase())),
    [brands, globalSearch]
  );

  const handleOpenModal = (brand?: Brand) => {
    if (brand) {
      setEditingId(brand.id!);
      setFormData({ name: brand.name, description: brand.description || '', logoUrl: brand.logoUrl || '', website: brand.website || '', status: brand.status || 'active' });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', logoUrl: '', website: '', status: 'active' });
    }
    setIsModalOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        // Center-crop
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        setFormData((p: any) => ({ ...p, logoUrl: canvas.toDataURL('image/png', 0.85) }));
        setUploading(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    if (formData.website) {
      let websiteStr = formData.website.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const urlPattern = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;
      if (!urlPattern.test(websiteStr)) {
        toast.error('Website không hợp lệ. VD: sylphidvietnam.com');
        return;
      }
      formData.website = websiteStr;
    }

    setIsSubmitting(true);
    try {
      const payload = { 
        name: formData.name, 
        description: formData.description, 
        status: formData.status,
        data: {
          logoUrl: formData.logoUrl,
          website: formData.website
        }
      };
      if (editingId) {
        await updateDoc(doc(db, 'brands', editingId), { ...payload, updatedAt: serverTimestamp() });
        toast.success('Cập nhật thương hiệu thành công');
      } else {
        await addDoc(collection(db, 'brands'), { ...payload, createdAt: serverTimestamp() });
        toast.success('Thêm thương hiệu thành công');
      }
      setIsModalOpen(false);
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'brands'); }
    finally { setIsSubmitting(false); }
  };

  const handleStatusToggle = async (brand: Brand) => {
    const newStatus = brand.status === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, 'brands', brand.id!), { status: newStatus, updatedAt: serverTimestamp() });
    toast.success(newStatus === 'active' ? 'Đã bật thương hiệu' : 'Đã tắt thương hiệu');
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'brands', id));
    toast.success('Đã xóa thương hiệu');
    setDeleteId(null);
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-black text-slate-800">Thương hiệu</h2>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý các thương hiệu sản phẩm</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Sử dụng thanh tìm kiếm phía trên..."
              disabled
              className="pl-8 pr-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl outline-none w-44 opacity-50 cursor-not-allowed"
            />
          </div>
          <button onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm thương hiệu</span>
          </button>
        </div>
      </div>

      {/* Card Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Tag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">{globalSearch ? 'Không tìm thấy thương hiệu' : 'Chưa có thương hiệu nào'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filtered.map((brand, i) => (
              <motion.div
                key={brand.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  'bg-white border rounded-2xl p-4 flex flex-col gap-3 group relative overflow-hidden transition-shadow hover:shadow-md',
                  brand.status === 'inactive' ? 'border-slate-200 opacity-60' : 'border-slate-200'
                )}
              >
                {/* Status bar */}
                <div className={cn('absolute top-0 left-0 right-0 h-0.5', brand.status === 'active' ? 'bg-amber-400' : 'bg-slate-200')} />

                {/* Logo + Name */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="w-6 h-6 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900 text-sm truncate">{brand.name}</p>
                    {brand.website ? (
                      <a href={brand.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate block max-w-full">
                        {brand.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa có website</span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {brand.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{brand.description}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-50">
                  <button
                    onClick={() => handleStatusToggle(brand)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border transition-colors flex-1 justify-center',
                      brand.status === 'active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                    )}
                  >
                    {brand.status === 'active' ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                    {brand.status === 'active' ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => handleOpenModal(brand)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(brand.id!)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-amber-500" />
                  </div>
                  <h2 className="font-black text-slate-900">{editingId ? 'Sửa thương hiệu' : 'Thêm thương hiệu'}</h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Logo Upload */}
                <div className="flex items-center gap-4">
                  <label className="relative cursor-pointer">
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50 flex items-center justify-center overflow-hidden transition-all">
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                      ) : formData.logoUrl ? (
                        <img src={formData.logoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="w-6 h-6 text-slate-300 mx-auto" />
                          <span className="text-[9px] text-slate-400 font-bold block mt-1">Upload Logo</span>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm">
                      <Plus className="w-3 h-3" />
                    </span>
                  </label>
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tên thương hiệu <span className="text-rose-500">*</span></label>
                      <input required autoFocus type="text" value={formData.name}
                        onChange={e => setFormData((p: any) => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 outline-none font-semibold text-slate-700 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Website</label>
                      <div className="relative">
                        <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={formData.website}
                          onChange={e => setFormData((p: any) => ({ ...p, website: e.target.value }))}
                          placeholder="sylphidvietnam.com"
                          className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mô tả ngắn</label>
                  <textarea rows={2} value={formData.description}
                    onChange={e => setFormData((p: any) => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-700 text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái</label>
                  <div className="flex gap-2">
                    {[{ v: 'active', l: 'Hoạt động' }, { v: 'inactive', l: 'Tạm tắt' }].map(s => (
                      <button key={s.v} type="button" onClick={() => setFormData((p: any) => ({ ...p, status: s.v }))}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                          formData.status === s.v
                            ? s.v === 'active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        )}
                      >{s.l}</button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {editingId ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Xóa thương hiệu" message="Bạn có chắc chắn muốn xóa thương hiệu này?" confirmText="Xóa thương hiệu" type="danger"
      />
    </div>
  );
}
