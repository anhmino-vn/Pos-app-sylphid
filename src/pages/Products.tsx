import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  where
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, Product, Category, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Package,
  X,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Barcode,
  RefreshCw,
  Hash,
  ShoppingBag,
  List
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';

export function Products() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  // Category Form State
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string, type: 'product' | 'category' | null, isBulk?: boolean }>({ isOpen: false, id: '', type: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    barcode: '',
    listPrice: 0,
    salePrice: 0,
    stock: 0,
    category: '',
    description: '',
    status: 'active',
    images: []
  });
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const canAdd = profile?.role === 'admin' || profile?.permissions?.products?.add;
  const canEdit = profile?.role === 'admin' || profile?.permissions?.products?.edit;
  const canDelete = profile?.role === 'admin' || profile?.permissions?.products?.delete;

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
        alert('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setUploading(false);
    }
  };

  useEffect(() => {
    const qProds = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProds = onSnapshot(qProds, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const qCats = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => {
      unsubscribeProds();
      unsubscribeCats();
    };
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) return;
    setCategoryLoading(true);
    try {
      if (editingCategoryId) {
        await updateDoc(doc(db, 'categories', editingCategoryId), {
          name: categoryName,
          description: categoryDesc,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'categories'), {
          name: categoryName,
          description: categoryDesc,
          createdAt: serverTimestamp()
        });
      }
      setCategoryName('');
      setCategoryDesc('');
      setEditingCategoryId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setCategoryName(cat.name);
    setCategoryDesc(cat.description || '');
    setEditingCategoryId(cat.id!);
  };

  const handleDeleteCategory = async (id: string) => {
    setDeleteConfirm({ isOpen: true, id, type: 'category' });
  };

  const executeDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
      toast.success('Đã xóa danh mục thành công!');
    } catch (error) {
      toast.error('Lỗi khi xóa danh mục!');
    }
  };

  const generateSKU = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const prefix = formData.category ? formData.category.slice(0, 3).toUpperCase() : 'PRO';
    setFormData(prev => ({ ...prev, sku: `${prefix}-${random}` }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd && !editingId) return;
    if (!canEdit && editingId) return;

    setLoading(true);
    try {
      // Validate Duplicate SKU
      if (formData.sku) {
          const q = query(collection(db, 'products'), where('sku', '==', formData.sku));
          const snapshot = await getDocs(q);
          const duplicate = snapshot.docs.find(d => d.id !== editingId);
          if (duplicate) {
              alert('SKU này đã tồn tại trên một sản phẩm khác!');
              setLoading(false);
              return;
          }
      }

      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra. Hãy kiểm tra lại quyền hạn của bạn.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      listPrice: 0,
      salePrice: 0,
      stock: 0,
      category: '',
      description: '',
      status: 'active',
      images: []
    });
    setEditingId(null);
  };

  const handleEdit = (prod: Product) => {
    if (!canEdit) return;
    setFormData({ ...prod });
    setEditingId(prod.id!);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) return;
    setDeleteConfirm({ isOpen: true, id, type: 'product' });
  };

  const handleBulkDelete = () => {
    if (!canDelete) return;
    setDeleteConfirm({ isOpen: true, id: '', type: 'product', isBulk: true });
  };

  const executeDeleteProduct = async (id: string) => {
    if (deleteConfirm.isBulk) {
       if (selectedIds.length === 0) return;
       try {
         for (const selectedId of selectedIds) {
             await deleteDoc(doc(db, 'products', selectedId));
         }
         toast.success(`Đã xóa thành công ${selectedIds.length} sản phẩm`);
         setSelectedIds([]);
       } catch (error) {
         toast.error('Lỗi khi xóa nhiều!');
       }
       return;
    }

    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Đã xóa thành công!');
    } catch (error) {
      toast.error('Lỗi khi xóa! Có thể hạn chế quyền hoặc lỗi mạng.');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.barcode?.includes(searchTerm);
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    
    if (filterType === 'low_stock') return matchesSearch && matchesCategory && p.stock > 0 && p.stock <= 10;
    if (filterType === 'out_of_stock') return matchesSearch && matchesCategory && p.stock === 0;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC] pt-4 md:pt-6 pb-4 md:pb-6 -mt-4 md:-mt-6 space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">Danh mục sản phẩm</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">Quản lý kho hàng, giá bán và thông tin sản phẩm cao cấp.</p>
          </div>
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0">
            {selectedIds.length > 0 && canDelete && (
               <button 
                 onClick={handleBulkDelete}
                 className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-rose-50 text-rose-600 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-100 transition-all shadow-sm active:scale-95"
               >
                 <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                 <span className="whitespace-nowrap text-center">Xóa {selectedIds.length} <br className="md:hidden" />mục</span>
               </button>
            )}
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-white text-slate-900 border border-slate-200 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <List className="w-4 h-4 md:w-5 md:h-5" />
              <span className="whitespace-nowrap text-center">Quản lý <br className="md:hidden" />danh mục</span>
            </button>
            {canAdd && (
              <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="whitespace-nowrap text-center">Thêm sản <br className="md:hidden" />phẩm mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 bg-white p-3 md:p-4 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm relative z-20">
          <div className="flex gap-2 w-full md:w-auto items-center">
              <input 
                type="checkbox"
                className="w-5 h-5 md:w-6 md:h-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ml-1.5 shrink-0 cursor-pointer"
                checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                onChange={(e) => {
                   if (e.target.checked) setSelectedIds(filteredProducts.map(p => p.id!));
                   else setSelectedIds([]);
                }}
              />
              <div className="relative flex-1">
              <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                  type="text" 
                  placeholder="Tìm sản phẩm..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 md:pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-medium text-xs md:text-sm"
              />
              </div>
            
            {/* Category Filter Dropdown */}
            <div className="relative">
               <button 
                  onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                  className="flex items-center justify-center w-[44px] h-[44px] md:h-[44px] md:w-auto md:px-4 bg-white text-slate-600 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors shrink-0 gap-2 shadow-sm"
               >
                  <Filter className="w-5 h-5 text-slate-500" />
                  <span className="hidden md:block text-[10px] font-black uppercase tracking-widest text-slate-500">
                     {filterCategory === 'all' ? 'Danh mục' : categories.find(c => c.name === filterCategory)?.name || 'Danh mục'}
                  </span>
               </button>
               {isCategoryFilterOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setIsCategoryFilterOpen(false)} />
                   <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                      <button
                        onClick={() => { setFilterCategory('all'); setIsCategoryFilterOpen(false); }}
                        className={cn("w-full px-4 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-left transition-colors mb-1", filterCategory === 'all' ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50")}
                      >
                        Tất cả danh mục
                      </button>
                      {categories.map(c => (
                         <button
                           key={c.id}
                           onClick={() => { setFilterCategory(c.name); setIsCategoryFilterOpen(false); }}
                           className={cn("w-full px-4 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-left transition-colors mb-1 truncate", filterCategory === c.name ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50")}
                         >
                           {c.name}
                         </button>
                      ))}
                   </div>
                 </>
               )}
            </div>
        </div>
        <div className="flex overflow-x-auto gap-2 pb-1 md:pb-0 scrollbar-none md:flex-1 md:justify-end">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'low_stock', label: 'Sắp hết' },
            { id: 'out_of_stock', label: 'Hết hàng' }
          ].map(btn => (
            <button 
              key={btn.id}
              onClick={() => setFilterType(btn.id as any)}
              className={cn(
                "whitespace-nowrap px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                filterType === btn.id 
                  ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10" 
                  : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full">
            <thead className="hidden lg:table-header-group">
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-3 md:px-6 py-4 md:py-6 w-8 md:w-12">
                   <input 
                     type="checkbox"
                     checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                     onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredProducts.map(p => p.id!));
                        else setSelectedIds([]);
                     }}
                     className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                   />
                </th>
                <th className="px-2 md:px-4 py-4 md:py-6">Sản phẩm</th>
                <th className="px-2 md:px-8 py-4 md:py-6 text-right">Thương mại</th>
                <th className="px-2 md:px-8 py-4 md:py-6 text-center whitespace-nowrap hidden lg:table-cell">Tồn kho</th>
                <th className="px-2 md:px-8 py-4 md:py-6 hidden lg:table-cell">Trạng thái</th>
                <th className="px-2 md:px-8 py-4 md:py-6 hidden lg:table-cell"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 table-row-group">
              {loading ? (
                <tr className="table-row">
                  <td colSpan={6} className="py-24 text-center table-cell">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 opacity-20" />
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr className="table-row">
                  <td colSpan={6} className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest text-xs table-cell">Không tìm thấy sản phẩm yêu cầu</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-all group table-row cursor-pointer" onClick={() => {}}>
                    <td className="px-3 md:px-6 py-3 md:py-5 w-8 md:w-12 align-middle table-cell" onClick={(e) => e.stopPropagation()}>
                       <input 
                         type="checkbox"
                         checked={selectedIds.includes(product.id!)}
                         onChange={(e) => {
                            if (e.target.checked) setSelectedIds(prev => [...prev, product.id!]);
                            else setSelectedIds(prev => prev.filter(id => id !== product.id!));
                         }}
                         className="w-3 h-3 md:w-4 md:h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm md:shadow-none"
                       />
                    </td>
                    <td className="px-2 md:px-4 py-3 md:py-5 align-middle table-cell">
                      <div className="flex items-center gap-2 md:gap-5">
                        <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-[10px] md:rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 overflow-hidden shrink-0 shadow-sm">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <Package className="w-5 h-5 md:w-7 md:h-7" />
                          )}
                          {product.stock <= 5 && product.stock > 0 && (
                            <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 border-2 border-white rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <div className="min-w-0 max-w-[150px] md:max-w-[300px]">
                          <p className="font-black text-slate-900 truncate uppercase tracking-tight text-[10px] md:text-sm leading-tight">{product.name}</p>
                          
                          {/* Mobile Stock Badge inside Name col */}
                          <div className="lg:hidden mt-0.5">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-1 whitespace-nowrap",
                              product.stock > 10 ? "bg-emerald-50 text-emerald-600" : 
                              product.stock > 0 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {product.stock} {product.unit || 'Tồn'}
                            </span>
                          </div>

                          <div className="hidden lg:flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 flex items-center gap-1 rounded text-nowrap mt-1 md:py-0.5">
                              <Hash className="w-2.5 h-2.5" />
                              {product.sku}
                            </span>
                            {product.barcode && (
                              <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 flex items-center gap-1 rounded text-nowrap mt-1 md:py-0.5">
                                <Barcode className="w-2.5 h-2.5" />
                                {product.barcode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-3 md:py-5 text-right align-middle table-cell">
                      <div className="flex flex-col items-end">
                          <p className="font-black text-blue-600 text-[10px] md:text-base whitespace-nowrap">{formatCurrency(product.salePrice)}</p>
                          <p className="text-[7px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 whitespace-nowrap line-through">{formatCurrency(product.listPrice)}</p>
                          
                          {/* Mobile Actions inside Price col */}
                          <div className="flex items-center justify-end gap-1.5 mt-2 lg:hidden">
                            {canEdit && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                                className="p-1.5 bg-white border border-slate-100 rounded text-slate-400 hover:text-blue-600 active:bg-slate-50 transition-colors shadow-sm"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(product.id!); }}
                                className="p-1.5 bg-white border border-slate-100 rounded text-slate-400 hover:text-rose-600 active:bg-slate-50 transition-colors shadow-sm"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-3 md:py-5 text-center align-middle hidden lg:table-cell">
                      <div className="block mt-0">
                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 whitespace-nowrap",
                        product.stock > 10 ? "bg-emerald-50 text-emerald-600" : 
                        product.stock > 0 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full hidden lg:block", product.stock > 10 ? "bg-emerald-500" : product.stock > 0 ? "bg-amber-500" : "bg-rose-500")}></div>
                          {product.stock} <span className="hidden lg:inline">{product.unit || 'Tồn'}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-3 md:py-5 align-middle hidden lg:table-cell">
                      <div className="block mt-0 mb-0">
                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                          product.status === 'active' ? "bg-emerald-50 text-emerald-600" :
                          product.status === 'out_of_stock' ? "bg-amber-50 text-amber-600" :
                          "bg-slate-100 text-slate-500"
                        )}>
                          {product.status === 'active' ? 'Đang mở bán' :
                           product.status === 'out_of_stock' ? 'Tạm hết hàng' :
                           'Ngừng kinh doanh'}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-3 md:py-5 text-right align-middle hidden lg:table-cell">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        {canEdit && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                            className="p-1.5 md:p-2.5 bg-white md:bg-white shadow-sm md:shadow-sm border border-slate-100 rounded-lg md:rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(product.id!); }}
                            className="p-1.5 md:p-2.5 bg-white md:bg-white shadow-sm md:shadow-sm border border-slate-100 rounded-lg md:rounded-xl text-slate-500 hover:text-rose-600 hover:border-rose-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            ></motion.div>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    {editingId ? <Edit2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {editingId ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Dữ liệu kho hàng cao cấp</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
                  {/* Left Column - General Info */}
                  <div className="space-y-5 sm:space-y-6">
                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        Tên sản phẩm công khai <span className="text-rose-500 text-lg">*</span>
                      </label>
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nhập tên sản phẩm..."
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 placeholder:text-slate-300 transition-all text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
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
                          value={formData.barcode}
                          onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                          placeholder="000000000000"
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1.5 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá niêm yết (VNĐ)</label>
                        <input 
                          type="number" 
                          value={formData.listPrice}
                          onChange={e => setFormData({ ...formData, listPrice: Number(e.target.value) })}
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá ưu đãi *</label>
                        <input 
                          required
                          type="number" 
                          value={formData.salePrice}
                          onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-blue-600 transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1.5 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh mục</label>
                        <select 
                          value={formData.category}
                          onChange={e => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none text-sm"
                        >
                          <option value="">Chọn loại hàng...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số lượng nhập kho *</label>
                        <input 
                          required
                          type="number" 
                          value={formData.stock}
                          onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Media & Description */}
                  <div className="space-y-5 sm:space-y-6">
                    <div className="space-y-3 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hình ảnh trưng bày ({formData.images?.length || 0}/5)</label>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {formData.images?.map((url, idx) => (
                          <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 group">
                            <img src={url} className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            </button>
                          </div>
                        ))}
                        {(formData.images?.length || 0) < 5 && (
                          <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 sm:gap-2 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden">
                            {uploading ? (
                              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 animate-spin" />
                            ) : (
                              <>
                                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
                                <span className="text-[8px] font-black text-slate-400 uppercase">Tải lên</span>
                              </>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={uploadImage} 
                              className="hidden" 
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Dán link ảnh tại đây..."
                          value={imageUrl}
                          onChange={e => setImageUrl(e.target.value)}
                          className="flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none text-xs font-bold"
                        />
                        <button 
                          type="button"
                          onClick={addImage}
                          className="px-3 py-2 sm:px-4 sm:py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái kinh doanh</label>
                      <div className="p-1 bg-slate-50 rounded-xl sm:rounded-[20px] flex gap-1">
                        {[
                          { id: 'active', label: 'Đang mở bán', icon: ShoppingBag },
                          { id: 'out_of_stock', label: 'Tạm hết hàng', icon: AlertCircle },
                          { id: 'discontinued', label: 'Ngừng kinh doanh', icon: Trash2 }
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, status: s.id as any })}
                            className={cn(
                              "flex-1 py-2 sm:py-3 px-1 sm:px-3 rounded-lg sm:rounded-[17px] text-[8px] sm:text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2",
                              formData.status === s.id 
                                ? "bg-white text-slate-900 shadow-sm" 
                                : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            <s.icon className="w-3 h-3 hidden sm:block" />
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả sản phẩm nâng cao</label>
                      <textarea 
                        rows={3}
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Mô tả chi tiết về sản phẩm, công dụng, thành phần..."
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-none rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-xs sm:text-sm text-slate-900 resize-none min-h-[100px] sm:min-h-[140px]"
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6 pt-6 sm:pt-10 border-t border-slate-50">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    Hủy <span className="hidden sm:inline">thao tác</span>
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-3 sm:py-5 bg-blue-600 text-white rounded-2xl sm:rounded-3xl font-black text-[10px] sm:text-xs uppercase tracking-[0.1em] sm:tracking-[0.2em] shadow-2xl shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-3"
                  >
                    {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : editingId ? <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" /> : <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {editingId ? 'Cập nhật hệ thống' : 'Lưu vào danh mục'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            ></motion.div>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900">
                    <List className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Danh mục kinh doanh</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Phân loại sản phẩm hệ thống</p>
                  </div>
                </div>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 pt-6 space-y-10 custom-scrollbar">
                {/* Category Form */}
                <form onSubmit={handleAddCategory} className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 space-y-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {editingCategoryId ? 'Chỉnh sửa loại hàng' : 'Tạo danh mục mới'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      required
                      type="text"
                      placeholder="Tên danh mục..."
                      value={categoryName}
                      onChange={e => setCategoryName(e.target.value)}
                      className="w-full px-5 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                    />
                    <input 
                      type="text"
                      placeholder="Mô tả ngắn (không bắt buộc)..."
                      value={categoryDesc}
                      onChange={e => setCategoryDesc(e.target.value)}
                      className="w-full px-5 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      disabled={categoryLoading}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      {categoryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingCategoryId ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingCategoryId ? 'Cập nhật' : 'Thêm mới'}
                    </button>
                    {editingCategoryId && (
                      <button 
                        type="button"
                        onClick={() => { setEditingCategoryId(null); setCategoryName(''); setCategoryDesc(''); }}
                        className="px-6 py-4 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-100 hover:text-slate-900"
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </form>

                {/* List Categories */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Danh sách hiện tại ({categories.length})</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl group hover:border-blue-100 transition-all">
                        <div>
                          <p className="font-black text-slate-900 uppercase tracking-tight text-sm italic">{cat.name}</p>
                          {cat.description && <p className="text-[10px] text-slate-400 font-bold mt-1 line-clamp-1">{cat.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEditCategory(cat)}
                            className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(cat.id!)}
                            className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {categories.length === 0 && (
                      <div className="py-20 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-[10px]">Chưa có danh mục nào</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.type === 'product' ? 'Xác nhận xóa sản phẩm' : 'Xác nhận xóa danh mục'}
        message={deleteConfirm.type === 'product' 
          ? 'Bạn có chắc chắn muốn xóa vĩnh viễn sản phẩm này? Thao tác này không thể hoàn tác.'
          : 'Xóa danh mục này sẽ không ảnh hưởng đến sản phẩm hiện tại, nhưng bạn không thể tiếp tục dùng nó để lọc đồ.'}
        confirmText="Đồng ý"
        onConfirm={async () => {
          if (deleteConfirm.type === 'product') {
            await executeDeleteProduct(deleteConfirm.id);
          } else if (deleteConfirm.type === 'category') {
            await executeDeleteCategory(deleteConfirm.id);
          }
          setDeleteConfirm({ isOpen: false, id: '', type: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', type: null })}
      />
    </div>
  );
}
