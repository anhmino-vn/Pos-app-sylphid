import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from '../../lib/firebaseAdapter';
import { db, Supplier, handleFirestoreError, OperationType } from '../../lib/supabase';
import { Plus, Search, Truck, Edit2, Trash2, X, CheckCircle2, Loader2, Phone, Mail, MapPin, Package, History, CreditCard, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../App';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { DataTable } from '../../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

type DrawerTab = 'info' | 'products' | 'orders' | 'debt' | 'notes';

function SupplierDrawer({ supplier, onClose, onEdit }: { supplier: Supplier; onClose: () => void; onEdit: () => void }) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('info');
  const [products, setProducts] = useState<any[]>([]);
  const [imports, setImports] = useState<any[]>([]);

  useEffect(() => {
    if (!supplier.id) return;
    const qProds = query(collection(db, 'products'), where('supplierId', '==', supplier.id));
    onSnapshot(qProds, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qImports = query(collection(db, 'stockImports'), where('supplierId', '==', supplier.id), orderBy('createdAt', 'desc'));
    onSnapshot(qImports, snap => setImports(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [supplier.id]);

  const totalDebt = supplier.debtBalance || 0;
  const tabs = [
    { id: 'info' as DrawerTab, label: 'Thông tin', icon: Truck },
    { id: 'products' as DrawerTab, label: 'Sản phẩm', icon: Package },
    { id: 'orders' as DrawerTab, label: 'Đơn nhập', icon: History },
    { id: 'debt' as DrawerTab, label: 'Công nợ', icon: CreditCard },
    { id: 'notes' as DrawerTab, label: 'Ghi chú', icon: FileText },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 40 }} className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">

          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center"><Truck className="w-6 h-6 text-blue-600" /></div>
              <div>
                <h3 className="font-black text-slate-900">{supplier.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{supplier.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><Edit2 className="w-4 h-4 text-blue-600" /></button>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
          </div>

          <div className="flex px-6 pt-4 gap-1 border-b border-slate-100 shrink-0 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all -mb-px',
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              )}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* INFO */}
            {activeTab === 'info' && (
              <div className="space-y-3">
                {[
                  { label: 'Tên NCC', value: supplier.name, icon: Truck },
                  { label: 'Điện thoại', value: supplier.phone || '—', icon: Phone },
                  { label: 'Email', value: supplier.email || '—', icon: Mail },
                  { label: 'Địa chỉ', value: supplier.address || '—', icon: MapPin },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl">
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <item.icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PRODUCTS */}
            {activeTab === 'products' && (
              <div className="space-y-3">
                {products.length === 0 ? (
                  <div className="py-12 text-center"><Package className="w-10 h-10 mx-auto mb-2 text-slate-200" /><p className="text-sm text-slate-400 font-bold">Chưa có sản phẩm nào liên kết</p></div>
                ) : products.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center"><Package className="w-5 h-5 text-slate-300" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">SKU: {p.sku || '—'} | Tồn: {p.stock || 0}</p>
                    </div>
                    <span className="text-sm font-black text-blue-600">{formatCurrency(p.salePrice || 0)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ORDERS */}
            {activeTab === 'orders' && (
              <div className="space-y-3">
                {imports.length === 0 ? (
                  <div className="py-12 text-center"><History className="w-10 h-10 mx-auto mb-2 text-slate-200" /><p className="text-sm text-slate-400 font-bold">Chưa có đơn nhập nào</p></div>
                ) : imports.map(imp => (
                  <div key={imp.id} className="p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-blue-600">#{imp.code}</span>
                      <span className="text-xs font-black text-slate-900">{formatCurrency(imp.totalAmount || 0)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">{imp.createdAt?.toDate ? formatDate(imp.createdAt.toDate()) : '—'} • {imp.items?.length || 0} sản phẩm</p>
                  </div>
                ))}
              </div>
            )}

            {/* DEBT */}
            {activeTab === 'debt' && (
              <div className="space-y-4">
                <div className={cn('p-6 rounded-2xl', totalDebt > 0 ? 'bg-rose-50' : 'bg-emerald-50')}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: totalDebt > 0 ? '#dc2626' : '#16a34a' }}>Còn nợ</p>
                  <p className={cn('text-3xl font-black', totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600')}>{formatCurrency(totalDebt)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tổng đã mua</p>
                    <p className="text-lg font-black text-slate-900">{formatCurrency(imports.reduce((s, i) => s + (i.totalAmount || 0), 0))}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Số lần nhập</p>
                    <p className="text-lg font-black text-slate-900">{imports.length} đơn</p>
                  </div>
                </div>
              </div>
            )}

            {/* NOTES */}
            {activeTab === 'notes' && (
              <div className="bg-slate-50 rounded-2xl p-5 min-h-[200px]">
                <p className="text-sm text-slate-700 font-medium leading-relaxed">{(supplier as any).notes || 'Chưa có ghi chú nào.'}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function SuppliersPage() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

  const [formData, setFormData] = useState<Partial<Supplier>>({ name: '', phone: '', email: '', address: '' });

  const canManage = profile?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier))));
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return toast.error('Vui lòng nhập tên nhà cung cấp');
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'suppliers', editingId), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Cập nhật nhà cung cấp thành công!');
      } else {
        await addDoc(collection(db, 'suppliers'), { ...formData, debtBalance: 0, status: 'active', createdAt: serverTimestamp() });
        toast.success('Thêm nhà cung cấp thành công!');
      }
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', email: '', address: '' });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'suppliers', deleteConfirm.id));
      toast.success('Xóa nhà cung cấp thành công!');
    } catch {
      toast.error('Lỗi khi xóa!');
    }
    setDeleteConfirm({ isOpen: false, id: '' });
  };

  const filtered = useMemo(() =>
    suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || '').includes(searchTerm)),
    [suppliers, searchTerm]
  );

  const columns = useMemo<ColumnDef<Supplier>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Nhà cung cấp',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0"><Truck className="w-4 h-4 text-blue-500" /></div>
          <span className="font-bold text-slate-900">{row.getValue('name')}</span>
        </div>
      )
    },
    { accessorKey: 'phone', header: 'Điện thoại', cell: ({ row }) => <span className="text-slate-600">{row.getValue('phone') || '—'}</span> },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-slate-600">{row.getValue('email') || '—'}</span> },
    {
      accessorKey: 'debtBalance',
      header: 'Công nợ',
      cell: ({ row }) => {
        const debt = (row.getValue('debtBalance') as number) || 0;
        return <span className={cn('font-bold', debt > 0 ? 'text-rose-600' : 'text-emerald-600')}>{formatCurrency(debt)}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
          row.getValue('status') === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        )}>
          {row.getValue('status') === 'active' ? 'Hoạt động' : 'Khóa'}
        </span>
      )
    },
    {
      id: 'actions', header: 'Thao tác', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {canManage && <>
            <button onClick={e => { e.stopPropagation(); setFormData(row.original); setEditingId(row.original.id!); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
            <button onClick={e => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: row.original.id! }); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
          </>}
        </div>
      )
    }
  ], [canManage]);

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="sticky top-0 z-30 bg-[#F1F5F9] pt-4 md:pt-6 pb-4 -mt-4 md:-mt-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-600" /> Nhà cung cấp
            </h1>
            <p className="text-slate-500 text-xs mt-1">Quản lý thông tin nhà cung cấp và công nợ</p>
          </div>
          {canManage && (
            <button onClick={() => { setFormData({ name: '', phone: '', email: '', address: '' }); setEditingId(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> Thêm NCC
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Tìm tên, số điện thoại..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-slate-700" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden pb-6">
        <DataTable columns={columns} data={filtered} onRowClick={row => setSelectedSupplier(row)} />
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{editingId ? 'Cập nhật NCC' : 'Thêm Nhà Cung Cấp'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                {[
                  { label: 'Tên nhà cung cấp (*)', key: 'name', type: 'text', placeholder: 'Công ty TNHH...', required: true },
                  { label: 'Số điện thoại', key: 'phone', type: 'tel', placeholder: '09...' },
                  { label: 'Email', key: 'email', type: 'email', placeholder: 'email@...' },
                  { label: 'Địa chỉ', key: 'address', type: 'text', placeholder: 'Số nhà, đường, quận...' },
                ].map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.label}</label>
                    <input required={field.required} type={field.type} value={(formData as any)[field.key] || ''} onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" placeholder={field.placeholder} />
                  </div>
                ))}
                <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Lưu thông tin
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Drawer */}
      {selectedSupplier && (
        <SupplierDrawer
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onEdit={() => { setFormData(selectedSupplier); setEditingId(selectedSupplier.id!); setSelectedSupplier(null); setIsModalOpen(true); }}
        />
      )}

      <ConfirmModal isOpen={deleteConfirm.isOpen} title="Xóa nhà cung cấp" message="Bạn có chắc chắn muốn xóa? Thao tác này không thể hoàn tác." onConfirm={handleDelete} onCancel={() => setDeleteConfirm({ isOpen: false, id: '' })} />
    </div>
  );
}
