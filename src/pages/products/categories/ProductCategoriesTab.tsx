import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from '../../../lib/firebaseAdapter';
import { db, ProductCategory, handleFirestoreError, OperationType } from '../../../lib/supabase';
import { Plus, Edit2, Trash2, Folder, ChevronRight, ChevronDown, List, X, Loader2, RefreshCw } from 'lucide-react';
import { ConfirmModal } from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CategoryNode extends ProductCategory {
  children?: CategoryNode[];
}

export function ProductCategoriesTab() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [treeData, setTreeData] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ProductCategory>>({ name: '', description: '', parentId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'productCategories'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data: ProductCategory[] = [];
      snapshot.forEach((doc: any) => {
        data.push({ id: doc.id, ...doc.data() } as ProductCategory);
      });
      setCategories(data);
      setTreeData(buildTree(data));
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'productCategories');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const buildTree = (cats: ProductCategory[], parentId: string | null | undefined = undefined): CategoryNode[] => {
    return cats
      .filter(c => (parentId ? c.parentId === parentId : !c.parentId))
      .map(c => ({
        ...c,
        children: buildTree(cats, c.id)
      }));
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenModal = (cat?: ProductCategory, parentId?: string) => {
    if (cat) {
      setEditingId(cat.id!);
      setFormData({ name: cat.name, description: cat.description || '', parentId: cat.parentId || '' });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', parentId: parentId || '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', description: '', parentId: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        parentId: formData.parentId || null,
      };

      if (editingId) {
        await updateDoc(doc(db, 'productCategories', editingId), {
          ...payload,
          updatedAt: serverTimestamp()
        });
        toast.success('Cập nhật danh mục thành công');
      } else {
        await addDoc(collection(db, 'productCategories'), {
          ...payload,
          status: 'active',
          createdAt: serverTimestamp()
        });
        toast.success('Thêm danh mục thành công');
      }
      handleCloseModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'productCategories');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Check if it has children
    const hasChildren = categories.some(c => c.parentId === id);
    if (hasChildren) {
      toast.error('Không thể xóa danh mục đang có danh mục con.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'productCategories', id));
      toast.success('Xóa danh mục thành công');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'productCategories');
    }
    setDeleteId(null);
  };

  const renderTree = (nodes: CategoryNode[], level: number = 0) => {
    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes[node.id!];

      return (
        <div key={node.id} className="w-full">
          <div className="flex items-center gap-2 py-3 px-4 hover:bg-slate-50 border-b border-slate-50 transition-colors group">
            {/* Indentation */}
            <div style={{ width: level * 24 }} className="shrink-0"></div>
            
            <button 
              onClick={() => hasChildren ? toggleExpand(node.id!) : null}
              className={cn("w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors shrink-0", !hasChildren && "invisible")}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
            
            <Folder className={cn("w-5 h-5 shrink-0", level === 0 ? "text-blue-500" : "text-slate-400")} />
            
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-700 text-sm">{node.name}</div>
              {node.description && <div className="text-xs text-slate-400 truncate">{node.description}</div>}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleOpenModal(undefined, node.id)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Thêm danh mục con"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleOpenModal(node)}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="Sửa"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteId(node.id!)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Xóa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="w-full">
              {renderTree(node.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div>
      {/* Header Area */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-800">Cây danh mục sản phẩm</h2>
          <p className="text-sm text-slate-500">Phân cấp và cấu trúc danh mục</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm danh mục gốc</span>
        </button>
      </div>

      {/* Tree Content */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {treeData.length === 0 ? (
          <div className="p-12 text-center">
            <Folder className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <div className="text-slate-500 font-medium">Chưa có danh mục nào. Hãy tạo danh mục đầu tiên!</div>
          </div>
        ) : (
          <div className="py-2">
            {renderTree(treeData)}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            ></motion.div>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <List className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{editingId ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
                  </div>
                </div>
                <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tên danh mục <span className="text-rose-500">*</span></label>
                  <input 
                    required
                    autoFocus
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold text-slate-700 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Danh mục cha</label>
                  <select
                    value={formData.parentId || ''}
                    onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold text-slate-700 transition-all appearance-none"
                  >
                    <option value="">-- Trống (Danh mục gốc) --</option>
                    {categories.filter(c => c.id !== editingId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Mô tả ngắn</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-slate-700 transition-all resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingId ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Xóa danh mục"
        message="Bạn có chắc chắn muốn xóa danh mục này? Hành động này không thể hoàn tác."
        confirmText="Xóa danh mục"
        type="danger"
      />
    </div>
  );
}
