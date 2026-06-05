import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from '../lib/firebaseAdapter';
import { ref, uploadBytesResumable, getDownloadURL } from '../lib/firebaseAdapter';
import { db, storage, Guide, GuideCategory, handleFirestoreError, OperationType } from '../lib/supabase';
import { useAuth } from '../App';
import { 
  BookOpen, 
  Plus, 
  Search, 
  FileText, 
  Video, 
  Image as ImageIcon, 
  Download, 
  Eye, 
  Trash2, 
  Edit2, 
  X, 
  UploadCloud, 
  Folder,
  Loader2,
  FileBox,
  LayoutGrid,
  List as ListIcon,
  Printer
} from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { printElement } from '../lib/printUtils';
import { DocumentActions } from '../components/guides/DocumentActions';
import { DocumentPreviewDialog } from '../components/guides/DocumentPreviewDialog';

export function Guides() {
  const { profile } = useAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [categories, setCategories] = useState<GuideCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Modals
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [previewGuide, setPreviewGuide] = useState<Guide | null>(null);
  const [startPrint, setStartPrint] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, type: 'guide' | 'category' | null, isBulk?: boolean}>({ isOpen: false, id: '', type: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Forms
  const [formData, setFormData] = useState<Partial<Guide>>({
    status: 'active',
    categoryName: '',
    tags: []
  });
  const [catName, setCatName] = useState('');
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const qGuides = query(collection(db, 'guides'), orderBy('createdAt', 'desc'));
    const unGuides = onSnapshot(qGuides, (snapshot) => {
      setGuides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guide)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'guides'));

    const qCats = query(collection(db, 'guideCategories'), orderBy('createdAt', 'desc'));
    const unCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuideCategory)));
    });

    return () => {
      unGuides();
      unCats();
    };
  }, []);

  const canEdit = profile?.role === 'admin';

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      let finalFileUrl = formData.fileUrl || '';
      let fileType = formData.fileType || '';
      let fileName = formData.fileName || '';

      if (uploadFile) {
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            finalFileUrl = reader.result as string;
            fileType = uploadFile.type;
            fileName = uploadFile.name;
            setUploadProgress(100);
            resolve(null);
          };
          reader.onerror = reject;
          reader.readAsDataURL(uploadFile);
        });
      }

      const cat = categories.find(c => c.id === formData.categoryId);

      const payload = {
        ...formData,
        categoryId: formData.categoryId || '',
        categoryName: cat?.name || '',
        fileUrl: finalFileUrl,
        fileType,
        fileName,
        tags: formData.tags || [],
        updatedAt: serverTimestamp()
      };

      if (formData.id) {
        await updateDoc(doc(db, 'guides', formData.id), payload);
      } else {
        await addDoc(collection(db, 'guides'), {
          ...payload,
          views: 0,
          downloads: 0,
          createdBy: profile.uid,
          creatorName: profile.email,
          createdAt: serverTimestamp()
        });
      }
      
      setIsGuideModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Lỗi lưu tài liệu');
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;
    try {
      await addDoc(collection(db, 'guideCategories'), {
        name: catName,
        createdAt: serverTimestamp()
      });
      setCatName('');
      setIsCatModalOpen(false);
      toast.success('Thêm danh mục thành công');
    } catch (err) {
      toast.error('Lỗi thêm danh mục');
    }
  };

  const handleBulkDelete = () => {
    if (!canEdit) return;
    setDeleteConfirm({ isOpen: true, id: '', type: 'guide', isBulk: true });
  };

  const executeDeleteGuide = async (id: string) => {
    if (deleteConfirm.isBulk) {
       if (selectedIds.length === 0) return;
       try {
          let deleted = 0;
          for (const sId of selectedIds) {
             await deleteDoc(doc(db, 'guides', sId));
             deleted++;
          }
          toast.success(`Đã xóa ${deleted} tài liệu/hướng dẫn!`);
          setSelectedIds([]);
       } catch (error) {
          toast.error('Lỗi khi xóa nhiều mục!');
       } finally {
          setDeleteConfirm({ isOpen: false, id: '', type: null });
       }
       return;
    }
    try {
      await deleteDoc(doc(db, 'guides', id));
      toast.success('Đã xóa hướng dẫn');
    } catch {
      toast.error('Lỗi xóa hướng dẫn');
    }
  };

  const executeDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'guideCategories', id));
      toast.success('Đã xóa danh mục');
    } catch {
      toast.error('Lỗi xóa danh mục');
    }
  };

  const resetForm = () => {
    setFormData({ status: 'active', tags: [] });
    setUploadFile(null);
  };

  const getFileIcon = (type: string | undefined) => {
    if (!type) return <FileText className="w-5 h-5" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (type.includes('image')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    if (type.includes('video')) return <Video className="w-5 h-5 text-blue-500" />;
    return <FileText className="w-5 h-5 text-slate-500" />;
  };

  const filteredGuides = guides.filter(g => {
    if (selectedCategory !== 'all' && g.categoryId !== selectedCategory) return false;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      return g.title.toLowerCase().includes(lower) || g.description?.toLowerCase().includes(lower);
    }
    return true;
  });

  return (
    <div className="space-y-8 relative min-h-[80vh]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Hướng dẫn sử dụng</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý và tra cứu tài liệu, quy trình SOP nội bộ.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
            {selectedIds.length > 0 && (
               <button 
                 onClick={handleBulkDelete}
                 className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all shadow-sm"
               >
                 <Trash2 className="w-4 h-4" />
                 <span className="whitespace-nowrap text-center">Xóa {selectedIds.length} mục</span>
               </button>
            )}
            <button onClick={() => setIsCatModalOpen(true)} className="flex-1 md:flex-none px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
               <span className="whitespace-nowrap text-center">+ Danh mục</span>
            </button>
            <button onClick={() => { resetForm(); setIsGuideModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md">
              <Plus className="w-4 h-4" />
              <span className="whitespace-nowrap text-center">Thêm tài liệu</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar categories */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Danh mục</h3>
            <div className="space-y-1">
              <button 
                onClick={() => setSelectedCategory('all')}
                className={cn("w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all", selectedCategory === 'all' ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50")}
              >
                <span>Tất cả</span>
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-slate-100">{guides.length}</span>
              </button>
              {categories.map(c => (
                <button 
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id!)}
                  className={cn("w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all", selectedCategory === c.id ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50")}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-slate-100">{guides.filter(g => g.categoryId === c.id).length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
               <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl shrink-0">
                  <input 
                     type="checkbox"
                     checked={filteredGuides.length > 0 && selectedIds.length === filteredGuides.length}
                     onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredGuides.map(g => g.id!));
                        else setSelectedIds([]);
                     }}
                     className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Chọn Lọc</span>
               </label>
               <div className="relative flex-1 min-w-0">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input type="text" placeholder="Tìm tài liệu..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-2 md:pr-4 py-2 bg-slate-50 rounded-xl text-xs md:text-sm border-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium outline-none text-slate-900" />
               </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 p-1 bg-slate-50 rounded-xl shrink-0">
              <button onClick={() => setViewMode('grid')} className={cn("p-1.5 md:p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600")}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={cn("p-1.5 md:p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600")}><ListIcon className="w-4 h-4" /></button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /><p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Đang tải...</p></div>
          ) : filteredGuides.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 flex flex-col items-center justify-center text-center border border-slate-100 border-dashed">
               <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6"><FileBox className="w-10 h-10" /></div>
               <p className="text-lg font-black text-slate-900 mb-2">Chưa có tài liệu</p>
               <p className="text-sm text-slate-500 max-w-sm mb-6">Thư mục hiện tại chưa có tài liệu nào hoặc không tìm thấy kết quả phù hợp với từ khóa.</p>
            </div>
          ) : (
            <div className={cn("grid gap-6", viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
              {filteredGuides.map(g => (
                <div key={g.id} className={cn("bg-white rounded-2xl border border-slate-100 hover:border-blue-200 transition-all hover:shadow-lg hover:shadow-blue-500/5 group flex relative", viewMode === 'grid' ? "flex-col" : "flex-row items-center p-4 gap-6")}>
                  {canEdit && (
                     <div className={cn("absolute z-10", viewMode === 'list' ? "top-1/2 left-3 -translate-y-1/2" : "top-3 left-3")}>
                        <input
                           type="checkbox"
                           checked={selectedIds.includes(g.id!)}
                           onChange={(e) => {
                              if (e.target.checked) setSelectedIds(prev => [...prev, g.id!]);
                              else setSelectedIds(prev => prev.filter(id => id !== g.id!));
                           }}
                           className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                        />
                     </div>
                  )}
                  {viewMode === 'grid' && (
                    <div className="h-24 md:h-auto md:aspect-video bg-slate-50 rounded-t-2xl flex items-center justify-center border-b border-slate-100 overflow-hidden relative">
                      {g.fileType?.includes('image') && g.fileUrl ? (
                         <img src={g.fileUrl} alt={g.title} className="w-full h-full object-cover" />
                      ) : (
                         <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">{getFileIcon(g.fileType)}</div>
                      )}
                      {canEdit && (
                         <div className="absolute top-3 right-3 flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                           <DocumentActions
                              guide={g}
                              canEdit={canEdit}
                              onView={() => { setStartPrint(false); setPreviewGuide(g); }}
                              onEdit={() => { setFormData(g); setIsGuideModalOpen(true); }}
                              onDelete={() => setDeleteConfirm({ isOpen: true, id: g.id!, type: 'guide' })}
                              onPrint={() => { setStartPrint(true); setPreviewGuide(g); }}
                           />
                         </div>
                      )}
                    </div>
                  )}
                  {viewMode === 'list' && (
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                       {getFileIcon(g.fileType)}
                    </div>
                  )}
                  <div className={cn("flex flex-col flex-1", viewMode === 'grid' ? "p-5" : "")}>
                     <div className="flex items-start gap-2 justify-between mb-2">
                        <h3 className="font-black text-slate-900 leading-tight">{g.title}</h3>
                     </div>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 line-clamp-1">{g.categoryName}</p>
                     <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4">{g.description}</p>
                     
                     <div className={cn("mt-auto flex items-center justify-between", viewMode === 'grid' ? "pt-4 border-t border-slate-50" : "")}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(g.createdAt)}</span>
                        {viewMode === 'list' && (
                           <DocumentActions
                              guide={g}
                              canEdit={canEdit}
                              onView={() => { setStartPrint(false); setPreviewGuide(g); }}
                              onEdit={() => { setFormData(g); setIsGuideModalOpen(true); }}
                              onDelete={() => setDeleteConfirm({ isOpen: true, id: g.id!, type: 'guide' })}
                              onPrint={() => { setStartPrint(true); setPreviewGuide(g); }}
                           />
                        )}
                        {viewMode === 'grid' && !canEdit && (
                           <DocumentActions
                              guide={g}
                              canEdit={canEdit}
                              onView={() => { setStartPrint(false); setPreviewGuide(g); }}
                              onEdit={() => { setFormData(g); setIsGuideModalOpen(true); }}
                              onDelete={() => setDeleteConfirm({ isOpen: true, id: g.id!, type: 'guide' })}
                              onPrint={() => { setStartPrint(true); setPreviewGuide(g); }}
                           />
                        )}
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Guide Modal */}
      <AnimatePresence>
        {isGuideModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGuideModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
               <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-50 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600"><BookOpen className="w-6 h-6" /></div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{formData.id ? 'Sửa tài liệu' : 'Thêm tài liệu'}</h2>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">SOP & Hướng dẫn</p>
                    </div>
                  </div>
                  <button onClick={() => setIsGuideModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                  <form onSubmit={handleSaveGuide} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề tài liệu</label>
                        <input required type="text" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh mục</label>
                        <select required value={formData.categoryId || ''} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none">
                          <option value="">Chọn danh mục...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả ngắn</label>
                      <textarea rows={2} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-900" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung chi tiết (nếu có)</label>
                      <textarea rows={4} value={formData.content || ''} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-900" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">File đính kèm (Tải lên)</label>
                      <div className="relative border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-colors">
                          <input type="file" onChange={e => {
                           const file = e.target.files?.[0];
                           if (file && file.size > 800 * 1024) {
                             alert("Kích thước file vượt quá 800KB. Vui lòng tải file nhỏ hơn (hoặc dùng link Google Drive / YouTube).");
                             e.target.value = '';
                             return;
                           }
                           setUploadFile(file || null);
                         }} className="absolute inset-0 opacity-0 cursor-pointer" />
                         <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><UploadCloud className="w-8 h-8" /></div>
                         <div className="text-center">
                            <p className="font-black text-slate-900 text-sm">Kéo thả file hoặc Click để tải lên</p>
                            <p className="text-xs text-slate-400 font-medium mt-1">{uploadFile ? uploadFile.name : formData.fileName ? `Đang có: ${formData.fileName}` : 'Hỗ trợ tối đa 800KB (Doc, PDF, Ảnh)'}</p>
                         </div>
                      </div>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 py-1 px-3 rounded-lg w-max">
                           Đang tải lên: {Math.round(uploadProgress)}%
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hoặc Link đính kèm (YouTube, Google Drive, v.v.)</label>
                      <input type="url" placeholder="https://..." value={formData.fileUrl || ''} onChange={e => setFormData({...formData, fileUrl: e.target.value, fileType: e.target.value.includes('youtube.com') || e.target.value.includes('youtu.be') ? 'video/youtube' : 'link'})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-900" />
                      <p className="text-[9px] text-slate-400 mt-1 pl-1">Nếu có file tải lên, hệ thống sẽ ưu tiên file tải lên.</p>
                    </div>

                    <button type="submit" disabled={saving} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 mt-4">
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lưu tài liệu'}
                    </button>
                  </form>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCatModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCatModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden p-8">
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Thêm danh mục</h2>
                 <form onSubmit={handleSaveCategory}>
                    <input required type="text" placeholder="Tên danh mục..." value={catName} onChange={e => setCatName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 mb-6" />
                    <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20">Lưu</button>
                 </form>
              </motion.div>
           </div>
        )}
      </AnimatePresence>

      <DocumentPreviewDialog
        guide={previewGuide}
        isOpen={!!previewGuide}
        canEdit={canEdit}
        initialPrint={startPrint}
        onClose={() => { setStartPrint(false); setPreviewGuide(null); }}
        onEdit={(g) => { setStartPrint(false); setPreviewGuide(null); setFormData(g); setIsGuideModalOpen(true); }}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa tài liệu"
        message="Bạn có chắc chắn muốn xóa tài liệu này? Thao tác không thể hoàn tác."
        onConfirm={() => {
           if (deleteConfirm.type === 'guide') {
             executeDeleteGuide(deleteConfirm.id);
           } else if (deleteConfirm.type === 'category') {
             executeDeleteCategory(deleteConfirm.id);
           }
           setDeleteConfirm({ isOpen: false, id: '', type: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', type: null })}
      />
    </div>
  );
}
