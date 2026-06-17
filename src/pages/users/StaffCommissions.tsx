import React, { useState, useEffect } from 'react';
import { Percent, Plus, Loader2, DollarSign, Gift, Briefcase, HeartHandshake, Save, X, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, HrCommissionRule, UserProfile } from '../../lib/supabase';
import { collection, query, getDocs, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp } from '../../lib/firebaseAdapter';
import { DataTable } from '../../components/DataTable';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

export function StaffCommissions() {
  const [activeTab, setActiveTab] = useState<'rules' | 'report'>('rules');
  const [rules, setRules] = useState<HrCommissionRule[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
     roleType: 'staff',
     commissionType: 'product' as 'product' | 'service' | 'treatment' | 'referral',
     percent: 0,
     fixedAmount: 0
  });

  useEffect(() => {
    setLoading(true);
    // Fetch users for reporting
    const unsubU = onSnapshot(query(collection(db, 'users')), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    // Fetch commission rules
    const unsubR = onSnapshot(query(collection(db, 'hr_commission_rules')), snap => {
      setRules(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrCommissionRule)));
      setLoading(false);
    });

    return () => { unsubU(); unsubR(); };
  }, []);

  const openAdd = () => {
     setEditingId('');
     setFormData({ roleType: 'staff', commissionType: 'product', percent: 0, fixedAmount: 0 });
     setIsModalOpen(true);
  };

  const openEdit = (rule: HrCommissionRule) => {
     setEditingId(rule.id || '');
     setFormData({
        roleType: rule.roleType,
        commissionType: rule.commissionType,
        percent: rule.percent,
        fixedAmount: rule.fixedAmount || 0
     });
     setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
     if (confirm('Bạn có chắc muốn xóa luật này?')) {
        await deleteDoc(doc(db, 'hr_commission_rules', id));
        toast.success('Xóa thành công');
     }
  };

  const handleSave = async (e: React.FormEvent) => {
     e.preventDefault();
     setSaving(true);
     try {
        const id = editingId || doc(collection(db, 'hr_commission_rules')).id;
        await setDoc(doc(db, 'hr_commission_rules', id), {
           ...formData,
           isActive: true,
           updatedAt: serverTimestamp(),
           ...(editingId ? {} : { createdAt: serverTimestamp() })
        });
        toast.success('Lưu thành công');
        setIsModalOpen(false);
     } catch (err) {
        toast.error('Lỗi khi lưu');
     } finally {
        setSaving(false);
     }
  };

  const typeLabels: Record<string, string> = {
     'product': 'Bán Sản phẩm',
     'service': 'Dịch vụ lẻ',
     'treatment': 'Trừ liệu trình',
     'referral': 'Khách giới thiệu (Referral)'
  };

  const roleLabels: Record<string, string> = {
     'staff': 'Nhân viên chung',
     'sale': 'Nhân viên Sale',
     'technician': 'Kỹ thuật viên',
     'doctor': 'Bác sĩ/Chuyên gia',
     'manager': 'Quản lý'
  };

  const ruleColumns = [
    { header: 'Vai trò áp dụng', accessorKey: 'roleType', cell: ({row}: any) => <span className="font-bold text-slate-700">{roleLabels[row.original.roleType] || row.original.roleType}</span> },
    { header: 'Loại Hoa hồng', accessorKey: 'commissionType', cell: ({row}: any) => {
       const t = row.original.commissionType;
       return (
          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
             t === 'product' ? 'bg-blue-100 text-blue-700' :
             t === 'service' ? 'bg-emerald-100 text-emerald-700' :
             t === 'treatment' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
          }`}>{typeLabels[t]}</span>
       )
    }},
    { header: 'Tỷ lệ %', accessorKey: 'percent', cell: ({row}: any) => <span className="font-bold text-blue-600">{row.original.percent}%</span> },
    { header: 'Mức Cố định', accessorKey: 'fixedAmount', cell: ({row}: any) => row.original.fixedAmount ? formatCurrency(row.original.fixedAmount) : '-' },
    { header: 'Tác vụ', accessorKey: 'actions', cell: ({row}: any) => (
       <div className="flex gap-2">
          <button onClick={() => openEdit(row.original)} className="p-1 text-slate-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => handleDelete(row.original.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
       </div>
    )}
  ];

  // Mock Report Data (In production, calculate from orders)
  const reportData = users.map(u => ({
     userId: u.uid,
     userName: u.name || u.email,
     role: u.position || 'Nhân viên',
     revenue: Math.floor(Math.random() * 50000000) + 10000000,
     commission: Math.floor(Math.random() * 5000000) + 500000
  }));

  const reportColumns = [
     { header: 'Nhân viên', accessorKey: 'userName', cell: ({row}:any) => <div className="font-bold">{row.original.userName}<div className="text-xs text-slate-400 font-medium">{row.original.role}</div></div> },
     { header: 'Tổng Doanh thu (Ghi nhận)', accessorKey: 'revenue', cell: ({row}:any) => formatCurrency(row.original.revenue) },
     { header: 'Hoa hồng ước tính', accessorKey: 'commission', cell: ({row}:any) => <span className="font-bold text-emerald-600">{formatCurrency(row.original.commission)}</span> }
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Hoa hồng Đa tầng</h1>
          <p className="text-slate-500 font-medium mt-1">Cấu hình tỷ lệ hoa hồng chuyên sâu cho nhân sự</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setActiveTab('rules')} className={`px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'rules' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Cấu hình Luật</button>
           <button onClick={() => setActiveTab('report')} className={`px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'report' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Báo cáo Thực tế</button>
        </div>
      </div>

      {activeTab === 'report' && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
               <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shrink-0"><DollarSign className="w-6 h-6" /></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Doanh thu NV</p>
                  <p className="text-2xl font-black text-slate-900">{formatCurrency(reportData.reduce((a,b)=>a+b.revenue,0))}</p>
               </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
               <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0"><Gift className="w-6 h-6" /></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Hoa hồng Trích</p>
                  <p className="text-2xl font-black text-emerald-600">{formatCurrency(reportData.reduce((a,b)=>a+b.commission,0))}</p>
               </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
               <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center shrink-0"><HeartHandshake className="w-6 h-6" /></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trung bình / NV</p>
                  <p className="text-2xl font-black text-purple-600">{formatCurrency(reportData.reduce((a,b)=>a+b.commission,0) / Math.max(1, reportData.length))}</p>
               </div>
            </div>
         </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
         {activeTab === 'rules' && (
            <div className="p-4 border-b border-slate-100 flex justify-end bg-slate-50/50">
               <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 font-bold uppercase tracking-widest text-[10px]">
                  <Plus size={16} /> Thêm Luật Mới
               </button>
            </div>
         )}
        
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
        ) : (
          activeTab === 'rules' ? (
             <DataTable columns={ruleColumns} data={rules} searchPlaceholder="Tìm kiếm..." />
          ) : (
             <DataTable columns={reportColumns} data={reportData} searchPlaceholder="Tìm kiếm nhân viên..." />
          )
        )}
      </div>

      <AnimatePresence>
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-slate-100">
                     <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase">{editingId ? 'Sửa Luật Hoa Hồng' : 'Thêm Luật Mới'}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cấu hình tỷ lệ chia sẻ</p>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6">
                     <form id="ruleForm" onSubmit={handleSave} className="space-y-4">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Vai trò áp dụng</label>
                           <select value={formData.roleType} onChange={e => setFormData({...formData, roleType: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500">
                              {Object.entries(roleLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Loại Hoa hồng</label>
                           <select value={formData.commissionType} onChange={e => setFormData({...formData, commissionType: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500">
                              {Object.entries(typeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                           </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Tỷ lệ chia (%)</label>
                              <input type="number" min={0} max={100} value={formData.percent} onChange={e => setFormData({...formData, percent: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Thưởng cố định (VNĐ)</label>
                              <input type="number" min={0} value={formData.fixedAmount} onChange={e => setFormData({...formData, fixedAmount: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                           </div>
                        </div>
                        <p className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-100 mt-4">
                           <AlertCircle className="w-4 h-4 inline-block mr-1 text-blue-500" />
                           Hệ thống sẽ ưu tiên tính Tỷ lệ % trên doanh thu trước, sau đó cộng thêm Mức cố định (nếu có).
                        </p>
                     </form>
                  </div>
                  
                  <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200">Hủy</button>
                     <button type="submit" form="ruleForm" disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {editingId ? 'Cập nhật' : 'Tạo Luật Mới'}
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
