import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from '../../../lib/firebaseAdapter';
import { db, Supplier, handleFirestoreError, OperationType } from '../../../lib/supabase';
import { Plus, Edit2, Trash2, Truck, X, Loader2, Search, Phone, Mail, MapPin, CreditCard, Hash, Building2, ExternalLink } from 'lucide-react';
import { ConfirmModal } from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { cn, formatCurrency } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_OPTS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Tạm dừng' },
];

import { Link } from 'react-router-dom';

export function SuppliersTab({ globalSearch = '' }: { globalSearch?: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '', phone: '', email: '', address: '', contactPerson: '',
    taxCode: '', bankAccount: '', bankName: '', status: 'active', note: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name'));
    const unsub = onSnapshot(q, (snap: any) => {
      setSuppliers(snap.docs?.map((d: any) => ({ id: d.id, ...d.data() })) || []);
      setLoading(false);
    }, (err: any) => { handleFirestoreError(err, OperationType.LIST, 'suppliers'); setLoading(false); });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = !globalSearch || s.name.toLowerCase().includes(globalSearch.toLowerCase())
        || s.phone?.includes(globalSearch) || s.email?.toLowerCase().includes(globalSearch.toLowerCase());
      const matchStatus = filterStatus === 'all' || (s as any).status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [suppliers, globalSearch, filterStatus]);

  const totalDebt = useMemo(() => filtered.reduce((sum, s) => sum + (s.debtBalance || 0), 0), [filtered]);

  const handleOpen = (supplier?: Supplier) => {
    if (supplier) {
      setEditingId(supplier.id!);
      setFormData({
        name: supplier.name, phone: supplier.phone || '', email: supplier.email || '',
        address: supplier.address || '', contactPerson: supplier.contactPerson || '',
        taxCode: (supplier as any).taxCode || '', bankAccount: (supplier as any).bankAccount || '',
        bankName: (supplier as any).bankName || '', status: (supplier as any).status || 'active',
        note: (supplier as any).note || '',
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', phone: '', email: '', address: '', contactPerson: '', taxCode: '', bankAccount: '', bankName: '', status: 'active', note: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name, phone: formData.phone, email: formData.email,
        address: formData.address, contactPerson: formData.contactPerson,
        taxCode: formData.taxCode, bankAccount: formData.bankAccount, bankName: formData.bankName,
        status: formData.status, note: formData.note,
      };
      if (editingId) {
        await updateDoc(doc(db, 'suppliers', editingId), { ...payload, updatedAt: serverTimestamp() });
        toast.success('Cập nhật nhà cung cấp thành công');
      } else {
        await addDoc(collection(db, 'suppliers'), { ...payload, debtBalance: 0, createdAt: serverTimestamp() });
        toast.success('Thêm nhà cung cấp thành công');
      }
      setIsModalOpen(false);
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'suppliers'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'suppliers', id));
    toast.success('Xóa nhà cung cấp thành công');
    setDeleteId(null);
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>;

  return (
    <div>
      {/* Header + Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-black text-slate-800">Nhà cung cấp</h2>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} nhà cung cấp · Tổng công nợ: <span className={cn('font-bold', totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600')}>{formatCurrency(totalDebt)}đ</span></p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
            {STATUS_OPTS.map(o => (
              <button key={o.value} onClick={() => setFilterStatus(o.value)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', filterStatus === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Sử dụng thanh tìm kiếm phía trên..." disabled
              className="pl-8 pr-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl outline-none w-44 opacity-50 cursor-not-allowed"
            />
          </div>
          <button onClick={() => handleOpen()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm NCC</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Truck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium text-sm">{globalSearch ? 'Không tìm thấy nhà cung cấp' : 'Chưa có nhà cung cấp nào'}</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] text-slate-400 bg-slate-50 uppercase font-black tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Nhà cung cấp</th>
                <th className="px-5 py-3.5 hidden md:table-cell">Liên hệ</th>
                <th className="px-5 py-3.5 hidden lg:table-cell">Ngân hàng</th>
                <th className="px-5 py-3.5 text-right">Công nợ</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(supplier => (
                <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{supplier.name}</p>
                        {(supplier as any).taxCode && (
                          <p className="text-[10px] text-slate-400 font-mono">MST: {(supplier as any).taxCode}</p>
                        )}
                        <span className={cn(
                          'inline-block text-[10px] font-black px-1.5 py-0.5 rounded-full mt-0.5',
                          (supplier as any).status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        )}>
                          {(supplier as any).status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {supplier.contactPerson && <p className="text-xs font-bold text-slate-700">{supplier.contactPerson}</p>}
                      {supplier.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{supplier.phone}</p>
                      )}
                      {supplier.email && (
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{supplier.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {(supplier as any).bankAccount ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700 flex items-center gap-1"><Building2 className="w-3 h-3 text-slate-400" />{(supplier as any).bankName || 'N/A'}</p>
                        <p className="text-xs font-mono text-slate-500 flex items-center gap-1"><CreditCard className="w-3 h-3" />{(supplier as any).bankAccount}</p>
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={cn('font-black text-sm', (supplier.debtBalance || 0) > 0 ? 'text-rose-600' : 'text-slate-400')}>
                      {formatCurrency(supplier.debtBalance || 0)}đ
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/inventory/receipts?supplierId=${supplier.id}`} title="Xem lịch sử nhập" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ExternalLink className="w-4 h-4" /></Link>
                      <button onClick={() => handleOpen(supplier)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(supplier.id!)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><Truck className="w-5 h-5 text-slate-600" /></div>
                  <h2 className="font-black text-slate-900">{editingId ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Basic Info */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông tin cơ bản</p>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tên nhà cung cấp <span className="text-rose-500">*</span></label>
                    <input required autoFocus type="text" value={formData.name} onChange={e => setFormData((p: any) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-700 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Người liên hệ</label>
                      <input type="text" value={formData.contactPerson} onChange={e => setFormData((p: any) => ({ ...p, contactPerson: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Điện thoại</label>
                      <div className="relative"><Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="tel" value={formData.phone} onChange={e => setFormData((p: any) => ({ ...p, phone: e.target.value }))}
                          className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                      <div className="relative"><Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="email" value={formData.email} onChange={e => setFormData((p: any) => ({ ...p, email: e.target.value }))}
                          className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Địa chỉ</label>
                      <div className="relative"><MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                        <textarea rows={2} value={formData.address} onChange={e => setFormData((p: any) => ({ ...p, address: e.target.value }))}
                          className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 text-sm resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax + Bank */}
                <div className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Thuế & Ngân hàng</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Mã số thuế (MST)</label>
                      <div className="relative"><Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={formData.taxCode} onChange={e => setFormData((p: any) => ({ ...p, taxCode: e.target.value }))}
                          placeholder="0123456789"
                          className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tên ngân hàng</label>
                      <div className="relative"><Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={formData.bankName} onChange={e => setFormData((p: any) => ({ ...p, bankName: e.target.value }))}
                          placeholder="Vietcombank, Techcombank..."
                          className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Số tài khoản</label>
                      <div className="relative"><CreditCard className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={formData.bankAccount} onChange={e => setFormData((p: any) => ({ ...p, bankAccount: e.target.value }))}
                          placeholder="0123456789"
                          className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status + Note */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Trạng thái</label>
                    <div className="flex gap-2">
                      {[{ v: 'active', l: 'Hoạt động' }, { v: 'inactive', l: 'Tạm dừng' }].map(s => (
                        <button key={s.v} type="button" onClick={() => setFormData((p: any) => ({ ...p, status: s.v }))}
                          className={cn('flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all',
                            formData.status === s.v
                              ? s.v === 'active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          )}>{s.l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Ghi chú</label>
                    <input type="text" value={formData.note} onChange={e => setFormData((p: any) => ({ ...p, note: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
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
        title="Xóa nhà cung cấp" message="Bạn có chắc chắn muốn xóa nhà cung cấp này? Nếu họ đang có công nợ, bạn không nên xóa."
        confirmText="Xóa nhà cung cấp" type="danger"
      />
    </div>
  );
}
