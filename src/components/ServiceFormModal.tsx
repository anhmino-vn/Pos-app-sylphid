import React, { useState, useEffect } from 'react';
import { Service, ServiceCategory } from '../lib/supabase';
import { db } from '../lib/supabase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from '../lib/firebaseAdapter';
import { X, Save, Sparkles, Loader2, Image as ImageIcon, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId?: string | null;
  initialData?: Partial<Service>;
  categories: ServiceCategory[];
  onSuccess: () => void;
  canEdit: boolean;
  canAdd: boolean;
}

export function ServiceFormModal({ isOpen, onClose, editingId, initialData, categories, onSuccess, canEdit, canAdd }: ServiceFormModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'settings' | 'other'>('basic');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  
  const [formData, setFormData] = useState<Partial<Service>>(initialData || {
    name: '',
    code: '',
    categoryId: '',
    categoryName: '',
    price: 0,
    promoPrice: 0,
    duration: 60,
    description: '',
    status: 'active',
    images: [],
    tags: [],
    internalNotes: '',
  });

  useEffect(() => {
    if (initialData) setFormData(initialData);
  }, [initialData]);

  if (!isOpen) return null;

  const generateCode = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const prefix = formData.categoryId ? categories.find(c => c.id === formData.categoryId)?.name?.slice(0, 3).toUpperCase() : 'SRV';
    setFormData(prev => ({ ...prev, code: `${prefix || 'SRV'}-${random}` }));
  };

  const addImage = () => {
    if (!imageUrl) return;
    setFormData(prev => ({ ...prev, images: [...(prev.images || []), imageUrl] }));
    setImageUrl('');
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== index) }));
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, images: [...(prev.images || []), compressedDataUrl] }));
          setUploading(false);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        toast.error('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd && !editingId) return;
    if (!canEdit && editingId) return;

    setLoading(true);
    try {
      if (!formData.name) throw new Error('Tên dịch vụ là bắt buộc');
      
      const selectedCat = categories.find((c) => c.id === formData.categoryId);
      const payload = {
        ...formData,
        categoryName: selectedCat?.name || '',
      };

      if (editingId) {
        await updateDoc(doc(db, 'services', editingId), {
          ...payload,
          updatedAt: serverTimestamp()
        });
        toast.success('Đã cập nhật dịch vụ');
      } else {
        await addDoc(collection(db, 'services'), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('Đã thêm dịch vụ mới');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Có lỗi xảy ra khi lưu dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      ></motion.div>
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[90vh]"
      >
        <div className="px-6 py-4 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              {editingId ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ mới'}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Hệ thống dịch vụ Spa/Clinic</p>
          </div>
          
          <div className="flex bg-slate-100/50 p-1 rounded-2xl w-full md:w-auto overflow-x-auto scrollbar-none">
            {[
              { id: 'basic', label: 'Thông tin' },
              { id: 'settings', label: 'Cấu hình' },
              { id: 'other', label: 'Khác' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeTab === tab.id 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button onClick={onClose} className="absolute md:relative right-4 top-4 md:right-0 md:top-0 p-2 md:p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <form id="serviceForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
          
          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
              <div className="space-y-6">
                <div className="space-y-1.5 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    Tên dịch vụ <span className="text-rose-500 text-lg">*</span>
                  </label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Massage Body Thụy Điển..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      Mã dịch vụ 
                      <button type="button" onClick={generateCode} className="text-blue-600 hover:underline flex items-center gap-1 font-black">
                        <RefreshCw className="w-3 h-3" /> <span className="hidden sm:inline">Tự động</span>
                      </button>
                    </label>
                    <input 
                      type="text" 
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      placeholder="SRV-XXXX"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh mục</label>
                    <select 
                      value={formData.categoryId || ''}
                      onChange={e => setFormData({ ...formData, categoryId: e.target.value, categoryName: e.target.options[e.target.selectedIndex].text })}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none text-sm"
                    >
                      <option value="">Chọn danh mục...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả dịch vụ</label>
                  <textarea 
                    rows={4}
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition-all resize-none"
                    placeholder="Mô tả chi tiết về dịch vụ..."
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hình ảnh trưng bày ({formData.images?.length || 0}/5)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {formData.images?.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 group">
                        <img src={url} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </div>
                    ))}
                    {(formData.images?.length || 0) < 5 && (
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden">
                        {uploading ? (
                          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                        ) : (
                          <>
                            <ImageIcon className="w-6 h-6 text-slate-300" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tải lên</span>
                          </>
                        )}
                        <input type="file" accept="image/*" onChange={uploadImage} className="hidden" disabled={uploading} />
                      </label>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input 
                      type="text" 
                      placeholder="Dán link ảnh tại đây..."
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none text-xs font-bold"
                    />
                    <button type="button" onClick={addImage} className="px-4 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors">
                      Thêm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
              <div className="space-y-6">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">Cấu hình giá và thời gian</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá niêm yết (VNĐ)</label>
                      <input 
                        type="number" 
                        value={formData.price || 0}
                        onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá khuyến mãi (VNĐ)</label>
                      <input 
                        type="number" 
                        value={formData.promoPrice || ''}
                        onChange={e => setFormData({ ...formData, promoPrice: Number(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-blue-600 transition-all text-sm"
                      />
                    </div>
                 </div>
                 
                 <div className="space-y-1.5 px-1 mt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời lượng (Phút) *</label>
                    <input 
                      required
                      type="number" 
                      value={formData.duration || 60}
                      onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Dùng để sắp xếp lịch hẹn thông minh trên hệ thống</p>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">Kế toán & Thuế</h3>
                 <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái hiển thị</label>
                    <select 
                        value={formData.status || 'active'}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none text-sm"
                    >
                        <option value="active">Đang phục vụ</option>
                        <option value="inactive">Tạm ngưng</option>
                    </select>
                 </div>
              </div>
            </div>
          )}

          {/* TAB 3: OTHER */}
          {activeTab === 'other' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
              <div className="space-y-6">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">Ghi chú nội bộ</h3>
                 <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú (Chỉ nhân viên xem)</label>
                    <textarea 
                      rows={5}
                      value={formData.internalNotes || ''}
                      onChange={e => setFormData({ ...formData, internalNotes: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition-all resize-none"
                      placeholder="Quy trình, cảnh báo chống chỉ định..."
                    />
                 </div>
              </div>
            </div>
          )}

        </form>

        <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit" 
            form="serviceForm"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {editingId ? 'Cập nhật' : 'Hoàn tất'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
