import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, Brand, ProductCategory } from '../lib/supabase';
import { db } from '../lib/supabase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from '../lib/firebaseAdapter';
import { X, Plus, Trash2, Loader2, RefreshCw, Image as ImageIcon, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId?: string | null;
  initialData?: Partial<Product>;
  categories: ProductCategory[];
  brands: Brand[];
  onSuccess: () => void;
  canEdit: boolean;
  canAdd: boolean;
}

export function ProductFormModal({ isOpen, onClose, editingId, initialData, categories, brands, onSuccess, canEdit, canAdd }: ProductFormModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'inventory' | 'settings'>('basic');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Product>>(initialData || {
    name: '',
    categoryId: '',
    brandId: '',
    baseUnit: 'Cái',
    description: '',
    seoDescription: '',
    tags: [],
    status: 'active',
    images: [],
    taxRate: 0,
    isCombo: false,
    
    sku: '',
    barcode: '',
    listPrice: 0,
    salePrice: 0,
    stock: 0,
  });

  const [variants, setVariants] = useState<Partial<ProductVariant>[]>([]);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (editingId && isOpen) {
      const fetchVariants = async () => {
        try {
          const q = query(collection(db, 'productVariants'), where('productId', '==', editingId));
          const snapshot = await getDocs(q);
          const v = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as ProductVariant));
          setVariants(v);
        } catch (e) {
          console.error('Lỗi khi lấy biến thể:', e);
        }
      };
      fetchVariants();
    } else {
      setVariants([]);
    }
  }, [editingId, isOpen]);

  useEffect(() => {
    if (initialData) setFormData(initialData);
  }, [initialData]);

  if (!isOpen) return null;

  const generateSKU = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const prefix = formData.categoryId ? categories.find(c => c.id === formData.categoryId)?.name?.slice(0, 3).toUpperCase() : 'PRO';
    setFormData(prev => ({ ...prev, sku: `${prefix || 'PRO'}-${random}` }));
  };

  const generateBarcode = () => {
    const random = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
    setFormData(prev => ({ ...prev, barcode: random }));
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

  const handleAddVariant = () => {
    setVariants([...variants, {
      sku: '',
      name: '',
      salePrice: formData.salePrice || 0,
      listPrice: formData.listPrice || 0,
      stock: 0,
      status: 'active'
    }]);
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...variants];
    (newVariants[index] as any)[field] = value;
    setVariants(newVariants);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd && !editingId) return;
    if (!canEdit && editingId) return;

    setLoading(true);
    try {
      if (!formData.name) throw new Error('Tên sản phẩm là bắt buộc');
      
      let productId = editingId;

      const productPayload = {
        ...formData,
        category: categories.find(c => c.id === formData.categoryId)?.name || formData.category,
      };

      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), {
          ...productPayload,
          updatedAt: serverTimestamp()
        });
        toast.success('Đã cập nhật sản phẩm');
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...productPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        productId = docRef.id;
        toast.success('Đã thêm sản phẩm mới');
      }

      if (productId && variants.length > 0) {
         for (const v of variants) {
            if (v.id) {
               await updateDoc(doc(db, 'productVariants', v.id), {
                  ...v,
                  updatedAt: serverTimestamp()
               });
            } else {
               await addDoc(collection(db, 'productVariants'), {
                  ...v,
                  productId: productId,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
               });
            }
         }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Có lỗi xảy ra khi lưu sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">
              {editingId ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Dữ liệu kho hàng cao cấp</p>
          </div>
          
          <div className="flex bg-slate-100/50 p-1 rounded-2xl w-full md:w-auto overflow-x-auto scrollbar-none">
            {[
              { id: 'basic', label: 'Thông tin' },
              { id: 'pricing', label: 'Giá bán & Biến thể' },
              { id: 'inventory', label: 'Kho hàng' },
              { id: 'settings', label: 'Khác' }
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

        <form id="productForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
          
          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
              <div className="space-y-6">
                <div className="space-y-1.5 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    Tên sản phẩm <span className="text-rose-500 text-lg">*</span>
                  </label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nhập tên sản phẩm..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      Mã SKU 
                      <button type="button" onClick={generateSKU} className="text-blue-600 hover:underline flex items-center gap-1 font-black">
                        <RefreshCw className="w-3 h-3" /> <span className="hidden sm:inline">Tự động</span>
                      </button>
                    </label>
                    <input 
                      required
                      type="text" 
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="SKU-XXXX"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      Barcode
                      <button type="button" onClick={generateBarcode} className="text-blue-600 hover:underline flex items-center gap-1 font-black">
                        <RefreshCw className="w-3 h-3" /> <span className="hidden sm:inline">Tự động</span>
                      </button>
                    </label>
                    <input 
                      type="text" 
                      value={formData.barcode || ''}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="000000000000"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh mục</label>
                    <select 
                      value={formData.categoryId || formData.category || ''}
                      onChange={e => setFormData({ ...formData, categoryId: e.target.value, category: e.target.options[e.target.selectedIndex].text })}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none text-sm"
                    >
                      <option value="">Chọn danh mục...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thương hiệu</label>
                    <select 
                      value={formData.brandId || ''}
                      onChange={e => setFormData({ ...formData, brandId: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none text-sm"
                    >
                      <option value="">Chọn thương hiệu...</option>
                      {brands?.map(brand => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
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
                  <div className="flex gap-2">
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

                <div className="space-y-1.5 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả sản phẩm</label>
                  <textarea 
                    rows={4}
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none text-sm transition-all resize-none"
                    placeholder="Mô tả chi tiết về sản phẩm..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & VARIANTS */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                <div className="space-y-1.5 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá niêm yết (VNĐ)</label>
                  <input 
                    type="number" 
                    value={formData.listPrice || ''}
                    onChange={e => setFormData({ ...formData, listPrice: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá bán *</label>
                  <input 
                    required
                    type="number" 
                    value={formData.salePrice || ''}
                    onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-blue-600 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-8 border-t border-slate-100 pt-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Danh sách biến thể</h3>
                  <p className="text-xs text-slate-500 mt-1">Cấu hình các phân loại hàng (Ví dụ: Màu sắc, Dung tích, Size)</p>
                </div>
                <button 
                  type="button"
                  onClick={handleAddVariant}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-100 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Thêm biến thể
                </button>
              </div>

              {variants.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Sản phẩm này chưa có biến thể nào</p>
                    <button 
                      type="button"
                      onClick={handleAddVariant}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:scale-105 transition-all"
                    >
                      Tạo biến thể đầu tiên
                    </button>
                </div>
              ) : (
                <div className="space-y-4">
                    {variants.map((v, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-3 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên biến thể</label>
                            <input 
                              type="text" 
                              value={v.name || ''}
                              onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                              placeholder="VD: Đỏ - 50ml"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-sm"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã SKU</label>
                            <input 
                              type="text" 
                              value={v.sku || ''}
                              onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                              placeholder="SKU"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-sm"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá bán</label>
                            <input 
                              type="number" 
                              value={v.salePrice || ''}
                              onChange={(e) => updateVariant(idx, 'salePrice', Number(e.target.value))}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-sm text-blue-600"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn kho</label>
                            <input 
                              type="number" 
                              value={v.stock || ''}
                              onChange={(e) => updateVariant(idx, 'stock', Number(e.target.value))}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-sm"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</label>
                            <select 
                              value={v.status || 'active'}
                              onChange={(e) => updateVariant(idx, 'status', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-sm"
                            >
                              <option value="active">Đang bán</option>
                              <option value="inactive">Ngừng bán</option>
                            </select>
                          </div>
                          <div className="md:col-span-1 flex justify-end">
                            <button 
                                type="button"
                                onClick={() => removeVariant(idx)}
                                className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
              <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">Cấu hình tồn kho</h3>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn kho hiện tại (Sản phẩm độc lập)</label>
                    <input 
                        type="number" 
                        value={formData.stock || 0}
                        onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                        disabled={variants.length > 0}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm disabled:opacity-50"
                    />
                    {variants.length > 0 && <p className="text-[10px] text-amber-600 font-bold mt-1">Sản phẩm có biến thể, số tồn kho tính theo từng biến thể.</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn vị tính</label>
                        <input 
                          type="text" 
                          value={formData.baseUnit || 'Cái'}
                          onChange={e => setFormData({ ...formData, baseUnit: e.target.value })}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all text-sm"
                        />
                    </div>
                    <div className="space-y-1.5 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trọng lượng (gram)</label>
                        <input 
                          type="number" 
                          value={formData.weight || ''}
                          onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all text-sm"
                        />
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
              <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">Cài đặt khác</h3>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái kinh doanh</label>
                    <select 
                        value={formData.status || 'active'}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none text-sm"
                    >
                        <option value="active">Đang mở bán</option>
                        <option value="inactive">Tạm ngưng bán</option>
                        <option value="discontinued">Ngừng kinh doanh</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thuế suất (%)</label>
                    <input 
                        type="number" 
                        value={formData.taxRate || 0}
                        onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all text-sm"
                    />
                  </div>
              </div>
            </div>
          )}

        </form>

        <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit" 
            form="productForm"
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
