import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Users as UsersIcon, FileText, CheckCircle2, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, HrKpiTarget, HrKpiRecord, UserProfile } from '../../lib/supabase';
import { collection, query, getDocs, setDoc, doc, onSnapshot, serverTimestamp } from '../../lib/firebaseAdapter';
import { format } from 'date-fns';
import { DataTable } from '../../components/DataTable';

export function Kpi() {
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [targets, setTargets] = useState<HrKpiTarget[]>([]);
  const [records, setRecords] = useState<HrKpiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [formData, setFormData] = useState({
     targetRevenue: 0,
     targetCustomers: 0,
     targetOrders: 0,
     targetTreatments: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch users
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    return () => unsubUsers();
  }, []);

  useEffect(() => {
    setLoading(true);
    // Fetch KPI Targets
    const qTargets = query(collection(db, 'hr_kpi_targets'));
    const unsubT = onSnapshot(qTargets, snap => {
      const allTargets = snap.docs.map(d => ({ id: d.id, ...d.data() } as HrKpiTarget));
      setTargets(allTargets.filter(t => t.month === currentMonth));
    });

    // Fetch KPI Records
    const qRecords = query(collection(db, 'hr_kpi_records'));
    const unsubR = onSnapshot(qRecords, snap => {
      const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() } as HrKpiRecord));
      setRecords(allRecords.filter(r => r.month === currentMonth));
      setLoading(false);
    });

    return () => { unsubT(); unsubR(); };
  }, [currentMonth]);

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
       const targetId = `${selectedUser}_${currentMonth}`;
       const user = users.find(u => u.uid === selectedUser);
       await setDoc(doc(db, 'hr_kpi_targets', targetId), {
          userId: selectedUser,
          month: currentMonth,
          roleType: user?.position || 'staff',
          ...formData,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
       });
       setIsModalOpen(false);
    } catch (err) {
       console.error(err);
    } finally {
       setSaving(false);
    }
  };

  const openSetKpi = (userId: string) => {
     setSelectedUser(userId);
     const existing = targets.find(t => t.userId === userId);
     if (existing) {
        setFormData({
           targetRevenue: existing.targetRevenue,
           targetCustomers: existing.targetCustomers,
           targetOrders: existing.targetOrders,
           targetTreatments: existing.targetTreatments
        });
     } else {
        setFormData({ targetRevenue: 0, targetCustomers: 0, targetOrders: 0, targetTreatments: 0 });
     }
     setIsModalOpen(true);
  };

  // Prepare table data
  const tableData = users.filter(u => u.workStatus !== 'resigned').map(user => {
     const t = targets.find(x => x.userId === user.uid);
     const r = records.find(x => x.userId === user.uid);

     const revTarget = t?.targetRevenue || 0;
     const revActual = r?.actualRevenue || 0;
     const revPercent = revTarget > 0 ? Math.round((revActual / revTarget) * 100) : 0;

     return {
        userId: user.uid,
        userName: user.name || user.email,
        position: user.position || 'Nhân viên',
        revTarget,
        revActual,
        revPercent,
        custTarget: t?.targetCustomers || 0,
        custActual: r?.actualCustomers || 0,
        ordTarget: t?.targetOrders || 0,
        ordActual: r?.actualOrders || 0,
        treatTarget: t?.targetTreatments || 0,
        treatActual: r?.actualTreatments || 0,
        bonus: r?.bonusAmount || 0
     }
  });

  const columns = [
     { header: 'Nhân viên', accessorKey: 'userName', cell: ({row}:any) => <div className="font-bold">{row.original.userName}<div className="text-xs text-slate-400 font-medium">{row.original.position}</div></div> },
     { header: 'Mục tiêu Doanh số', accessorKey: 'revTarget', cell: ({row}:any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(row.original.revTarget) },
     { header: 'Thực tế', accessorKey: 'revActual', cell: ({row}:any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(row.original.revActual) },
     { header: '% Hoàn thành', accessorKey: 'revPercent', cell: ({row}:any) => {
         const p = row.original.revPercent;
         return <div className="flex items-center gap-2"><div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden"><div className={`h-full ${p >= 100 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{width: `${Math.min(p, 100)}%`}}></div></div><span className={`text-xs font-bold ${p >= 100 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{p}%</span></div>
     }},
     { header: 'Khách hàng', accessorKey: 'custActual', cell: ({row}:any) => `${row.original.custActual} / ${row.original.custTarget}` },
     { header: 'Đơn hàng', accessorKey: 'ordActual', cell: ({row}:any) => `${row.original.ordActual} / ${row.original.ordTarget}` },
     { header: 'Tác vụ', accessorKey: 'actions', cell: ({row}:any) => <button onClick={() => openSetKpi(row.original.userId)} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-lg">Giao KPI</button> }
  ];

  const totalTargetRev = tableData.reduce((acc, row) => acc + row.revTarget, 0);
  const totalActualRev = tableData.reduce((acc, row) => acc + row.revActual, 0);
  const totalRevPercent = totalTargetRev > 0 ? Math.round((totalActualRev / totalTargetRev) * 100) : 0;

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">KPI & Hiệu suất</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý và theo dõi chỉ tiêu nhân sự</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-sm font-bold text-slate-600">Tháng:</span>
           <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 bg-white shadow-sm outline-none focus:border-blue-500" />
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
            <div className="absolute right-0 bottom-0 opacity-5 scale-150 group-hover:scale-[2] transition-transform -translate-x-4 -translate-y-4"><TrendingUp className="w-32 h-32" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Doanh số Mục tiêu</p>
            <p className="text-2xl font-black text-slate-900 relative z-10">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalTargetRev)}</p>
         </div>
         <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-xl shadow-blue-900/20 relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 opacity-10 scale-150 group-hover:scale-[2] transition-transform -translate-x-4 -translate-y-4 text-white"><CheckCircle2 className="w-32 h-32" /></div>
            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1 relative z-10">Doanh số Thực tế</p>
            <div className="flex items-end gap-3 relative z-10">
               <p className="text-2xl font-black text-white">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalActualRev)}</p>
               <span className="text-xs font-bold text-blue-200 mb-1">{totalRevPercent}%</span>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
            <div className="absolute right-0 bottom-0 opacity-5 scale-150 group-hover:scale-[2] transition-transform -translate-x-4 -translate-y-4 text-emerald-500"><UsersIcon className="w-32 h-32" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Số khách phục vụ</p>
            <p className="text-2xl font-black text-slate-900 relative z-10">{tableData.reduce((a,b) => a + b.custActual, 0)}</p>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-colors">
            <div className="absolute right-0 bottom-0 opacity-5 scale-150 group-hover:scale-[2] transition-transform -translate-x-4 -translate-y-4 text-amber-500"><FileText className="w-32 h-32" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Đơn hàng hoàn thành</p>
            <p className="text-2xl font-black text-slate-900 relative z-10">{tableData.reduce((a,b) => a + b.ordActual, 0)}</p>
         </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 opacity-50" /></div>
        ) : (
          <DataTable columns={columns} data={tableData} searchPlaceholder="Tìm kiếm nhân viên..." />
        )}
      </div>

      <AnimatePresence>
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-slate-100">
                     <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase">Giao KPI Mục Tiêu</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{users.find(u => u.uid === selectedUser)?.name} - {currentMonth}</p>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6">
                     <form id="kpiForm" onSubmit={handleSaveTarget} className="space-y-4">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Doanh số mục tiêu (VNĐ)</label>
                           <input type="number" required min={0} value={formData.targetRevenue} onChange={e => setFormData({...formData, targetRevenue: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Số khách (Mục tiêu)</label>
                              <input type="number" min={0} value={formData.targetCustomers} onChange={e => setFormData({...formData, targetCustomers: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Đơn hàng (Mục tiêu)</label>
                              <input type="number" min={0} value={formData.targetOrders} onChange={e => setFormData({...formData, targetOrders: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                           </div>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Ca liệu trình (KTV)</label>
                           <input type="number" min={0} value={formData.targetTreatments} onChange={e => setFormData({...formData, targetTreatments: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500" />
                        </div>
                     </form>
                  </div>
                  
                  <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200">Hủy</button>
                     <button type="submit" form="kpiForm" disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Lưu KPI
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
