import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from '../../../lib/firebaseAdapter';
import { db, ProductCategory, handleFirestoreError, OperationType } from '../../../lib/supabase';
import {
  Plus, Edit2, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown,
  X, Loader2, Search, ToggleLeft, ToggleRight, ChevronsDownUp, ChevronsUpDown,
  Image as ImageIcon, GripVertical
} from 'lucide-react';
import { ConfirmModal } from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRESET_COLORS = [
  '#3B82F6','#0EA5E9','#14B8A6','#10B981','#84CC16',
  '#F59E0B','#F97316','#EF4444','#EC4899','#8B5CF6','#6B7280',
];

interface CategoryNode extends ProductCategory {
  children?: CategoryNode[];
  sortOrder?: number;
}

// Sortable row component
function SortableRow({ node, level, isExpanded, onToggle, onEdit, onAddChild, onDelete, onStatusToggle }: {
  node: CategoryNode;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (n: CategoryNode) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (n: CategoryNode) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id! });
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn('w-full', isDragging && 'z-50')}
    >
      <div className={cn(
        'flex items-center gap-2 py-2.5 px-3 border-b border-slate-50 transition-colors group',
        'hover:bg-slate-50/70',
        isDragging ? 'bg-blue-50' : ''
      )}>
        {/* Indent */}
        <div style={{ width: level * 20 }} className="shrink-0" />

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 rounded"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Expand toggle */}
        <button
          onClick={hasChildren ? onToggle : undefined}
          className={cn('w-6 h-6 flex items-center justify-center rounded-md transition-colors shrink-0', hasChildren ? 'hover:bg-slate-200' : 'invisible')}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Category color dot + icon */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: (node as any).color ? `${(node as any).color}20` : '#EFF6FF' }}
        >
          {(node as any).imageUrl ? (
            <img src={(node as any).imageUrl} alt="" className="w-5 h-5 rounded-md object-cover" />
          ) : (
            <Folder className="w-4 h-4" style={{ color: (node as any).color || '#3B82F6' }} />
          )}
        </div>

        {/* Name + slug */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">{node.name}</span>
            {(node as any).slug && (
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">/{(node as any).slug}</span>
            )}
            {hasChildren && (
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-full">
                {node.children!.length}
              </span>
            )}
          </div>
          {node.description && (
            <div className="text-xs text-slate-400 truncate max-w-xs">{node.description}</div>
          )}
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={() => onStatusToggle(node)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-colors',
              node.status === 'active'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
            )}
          >
            {node.status === 'active' ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
            <span className="hidden sm:inline">{node.status === 'active' ? 'Active' : 'Off'}</span>
          </button>
          <button onClick={() => onAddChild(node.id!)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Thêm danh mục con">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(node)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Sửa">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(node.id!)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Xóa">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ServiceCategoriesTab({ globalSearch = '' }: { globalSearch?: string }) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '', description: '', parentId: '', slug: '',
    color: '#3B82F6', status: 'active', imageUrl: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Drag
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const q = query(collection(db, 'serviceCategories'), orderBy('name'));
    const unsub = onSnapshot(q, (snap: any) => {
      const data: ProductCategory[] = snap.docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
      setCategories(data);
      setLoading(false);
    }, (err: any) => { handleFirestoreError(err, OperationType.LIST, 'serviceCategories'); setLoading(false); });
    return () => unsub();
  }, []);

  const buildTree = (cats: ProductCategory[], parentId?: string): CategoryNode[] => {
    return cats
      .filter(c => parentId ? (c as any).parentId === parentId : !(c as any).parentId)
      .sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0))
      .map(c => ({ ...c, children: buildTree(cats, c.id) }));
  };

  const treeData = useMemo(() => {
    if (!globalSearch) return buildTree(categories);
    const q = globalSearch.toLowerCase();
    return buildTree(categories.filter(c => c.name.toLowerCase().includes(q)));
  }, [categories, globalSearch]);

  const toggleExpand = (id: string) => setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  const expandAll = () => {
    const all: Record<string, boolean> = {};
    categories.forEach(c => { all[c.id!] = true; });
    setExpandedNodes(all);
  };
  const collapseAll = () => setExpandedNodes({});

  const slugify = (text: string) => text.toLowerCase().trim()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/[đ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  const handleOpenModal = (cat?: CategoryNode, parentId?: string) => {
    if (cat) {
      setEditingId(cat.id!);
      setFormData({
        name: cat.name,
        description: cat.description || '',
        parentId: (cat as any).parentId || '',
        slug: (cat as any).slug || '',
        color: (cat as any).color || '#3B82F6',
        status: cat.status || 'active',
        imageUrl: (cat as any).imageUrl || '',
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', parentId: parentId || '', slug: '', color: '#3B82F6', status: 'active', imageUrl: '' });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        let { width, height } = img;
        if (width > height && width > MAX) { height = height * MAX / width; width = MAX; }
        else if (height > MAX) { width = width * MAX / height; height = MAX; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        setFormData((prev: any) => ({ ...prev, imageUrl: canvas.toDataURL('image/png', 0.8) }));
        setUploading(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
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
        slug: formData.slug || slugify(formData.name),
        color: formData.color,
        status: formData.status,
        imageUrl: formData.imageUrl,
      };
      if (editingId) {
        await updateDoc(doc(db, 'serviceCategories', editingId), { ...payload, updatedAt: serverTimestamp() });
        toast.success('Cập nhật danh mục thành công');
      } else {
        await addDoc(collection(db, 'serviceCategories'), { ...payload, sortOrder: categories.length, createdAt: serverTimestamp() });
        toast.success('Thêm danh mục thành công');
      }
      setIsModalOpen(false);
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'serviceCategories'); }
    finally { setIsSubmitting(false); }
  };

  const handleStatusToggle = async (node: CategoryNode) => {
    const newStatus = node.status === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, 'serviceCategories', node.id!), { status: newStatus, updatedAt: serverTimestamp() });
    toast.success(newStatus === 'active' ? 'Đã bật danh mục' : 'Đã tắt danh mục');
  };

  const handleDelete = async (id: string) => {
    if (categories.some(c => (c as any).parentId === id)) {
      toast.error('Không thể xóa danh mục đang có danh mục con.');
      setDeleteId(null);
      return;
    }
    await deleteDoc(doc(db, 'serviceCategories', id));
    toast.success('Xóa danh mục thành công');
    setDeleteId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) { setActiveId(null); return; }

    // Get siblings (same parent)
    const draggedCat = categories.find(c => c.id === active.id);
    if (!draggedCat) { setActiveId(null); return; }
    const parentId = (draggedCat as any).parentId || null;
    const siblings = categories
      .filter(c => ((c as any).parentId || null) === parentId)
      .sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0));
    const ids = siblings.map(s => s.id!);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) { setActiveId(null); return; }
    const reordered = arrayMove(ids, oldIdx, newIdx);
    // Batch update sort orders
    await Promise.all(reordered.map((id, idx) =>
      updateDoc(doc(db, 'serviceCategories', id), { sortOrder: idx, updatedAt: serverTimestamp() })
    ));
    setActiveId(null);
  };

  const renderTree = (nodes: CategoryNode[], level = 0): React.ReactNode => {
    const ids = nodes.map(n => n.id!);
    return (
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {nodes.map(node => (
          <div key={node.id} className="w-full">
            <SortableRow
              node={node}
              level={level}
              isExpanded={!!expandedNodes[node.id!]}
              onToggle={() => toggleExpand(node.id!)}
              onEdit={handleOpenModal}
              onAddChild={(id) => handleOpenModal(undefined, id)}
              onDelete={(id) => setDeleteId(id)}
              onStatusToggle={handleStatusToggle}
            />
            <AnimatePresence>
              {node.children && node.children.length > 0 && expandedNodes[node.id!] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  {renderTree(node.children, level + 1)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </SortableContext>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-black text-slate-800">Cây danh mục dịch vụ</h2>
          <p className="text-sm text-slate-500 mt-0.5">Phân cấp và cấu trúc danh mục · Kéo để sắp xếp</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Sử dụng thanh tìm kiếm phía trên..."
              disabled
              className="pl-8 pr-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl outline-none w-44 opacity-50 cursor-not-allowed"
            />
          </div>
          <button onClick={expandAll} title="Mở rộng tất cả" className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronsUpDown className="w-4 h-4" />
          </button>
          <button onClick={collapseAll} title="Thu gọn tất cả" className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronsDownUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/30 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm gốc</span>
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {treeData.length === 0 ? (
          <div className="p-16 text-center">
            <Folder className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium text-sm">
              {globalSearch ? 'Không tìm thấy danh mục phù hợp' : 'Chưa có danh mục nào. Hãy tạo danh mục đầu tiên!'}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={e => setActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
          >
            <div className="py-1">{renderTree(treeData)}</div>
            <DragOverlay>
              {activeId && (() => {
                const cat = categories.find(c => c.id === activeId);
                return cat ? (
                  <div className="bg-blue-50 border border-blue-300 rounded-xl px-4 py-3 flex items-center gap-2 shadow-xl">
                    <GripVertical className="w-4 h-4 text-blue-400" />
                    <Folder className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-blue-700 text-sm">{cat.name}</span>
                  </div>
                ) : null;
              })()}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${formData.color}20` }}>
                    <Folder className="w-5 h-5" style={{ color: formData.color }} />
                  </div>
                  <h2 className="font-black text-slate-900">{editingId ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Image upload */}
                <div className="flex items-start gap-4">
                  <label className="relative cursor-pointer shrink-0">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 flex items-center justify-center transition-all overflow-hidden bg-slate-50">
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                      ) : formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-0.5">
                      <Plus className="w-3 h-3" />
                    </span>
                  </label>
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Tên danh mục <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required autoFocus type="text" value={formData.name}
                        onChange={e => setFormData((p: any) => ({ ...p, name: e.target.value, slug: slugify(e.target.value) }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold text-slate-700 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Slug</label>
                      <input
                        type="text" value={formData.slug}
                        onChange={e => setFormData((p: any) => ({ ...p, slug: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-slate-600 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Danh mục cha */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Danh mục cha</label>
                  <select
                    value={formData.parentId}
                    onChange={e => setFormData((p: any) => ({ ...p, parentId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold text-slate-700 text-sm appearance-none"
                  >
                    <option value="">-- Trống (Danh mục gốc) --</option>
                    {categories.filter(c => c.id !== editingId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mô tả ngắn</label>
                  <textarea
                    rows={2} value={formData.description}
                    onChange={e => setFormData((p: any) => ({ ...p, description: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-sm resize-none"
                  />
                </div>

                {/* Color + Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Màu đại diện</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c} type="button"
                          onClick={() => setFormData((p: any) => ({ ...p, color: c }))}
                          className={cn('w-6 h-6 rounded-full transition-all', formData.color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-110')}
                          style={{ backgroundColor: c, ringColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái</label>
                    <div className="flex gap-2">
                      {['active', 'inactive'].map(s => (
                        <button
                          key={s} type="button"
                          onClick={() => setFormData((p: any) => ({ ...p, status: s }))}
                          className={cn(
                            'flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                            formData.status === s
                              ? s === 'active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          )}
                        >
                          {s === 'active' ? 'Hoạt động' : 'Tạm tắt'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {editingId ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Xóa danh mục"
        message="Bạn có chắc chắn muốn xóa danh mục này? Hành động này không thể hoàn tác."
        confirmText="Xóa danh mục" type="danger"
      />
    </div>
  );
}
