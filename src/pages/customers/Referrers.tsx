import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useReferralData, ReferrerData } from '../../lib/useReferralData';
import { Users, Search, Award, TrendingUp, DollarSign, Loader2, ChevronRight, Download, Settings as SettingsIcon, CheckSquare, Square, UserPlus } from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { DateRange, DateFilter } from '../../components/DateFilter';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/supabase';
import { doc, setDoc, writeBatch } from '../../lib/firebaseAdapter';
import toast from 'react-hot-toast';

export function Referrers() {
  const [searchTerm, setSearchTerm] = useState('');
  const { dateRange } = useDateFilterStore();
  const { referrersMap, loading, allCustomers, allOrders, settings } = useReferralData(dateRange);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<any>(null);
  const [selectedOrdersForCommission, setSelectedOrdersForCommission] = useState<Set<string>>(new Set());

  const openSettings = () => {
    setEditingSettings({
      commissionMethod: settings.commissionMethod || 'PER_ORDER',
      commissionPercent: settings.commissionPercent || 5
    });
    const eligibleIds = allOrders.filter(o => o.referredById && o.commissionEligible !== false).map(o => o.id!);
    setSelectedOrdersForCommission(new Set(eligibleIds));
    setSettingsModalOpen(true);
  };

  const [selectedReferrer, setSelectedReferrer] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      // Save global config
      await setDoc(doc(db, 'system_configs', 'global'), {
        referral: {
          commissionMethod: editingSettings.commissionMethod,
          commissionPercent: Number(editingSettings.commissionPercent) || 0
        }
      }, { merge: true });

      // Update orders
      const batch = writeBatch(db);
      const referredOrders = allOrders.filter(o => o.referredById);
      referredOrders.forEach(o => {
        const isEligible = selectedOrdersForCommission.has(o.id!);
        const pct = Number(editingSettings.commissionPercent) || 0;
        const amt = (o.totalAmount || 0) * (pct / 100);
        
        // Preserve status if already paid, usually we don't retroactively modify paid/cancelled commissions
        // but for this prototype let's just make sure we recalculate
        batch.update(doc(db, 'orders', o.id!), {
          commissionEligible: isEligible,
          commissionPercent: pct,
          commissionAmount: isEligible ? amt : 0,
          commissionStatus: o.commissionStatus || (isEligible ? 'unpaid' : 'cancelled')
        });
      });

      await batch.commit();
      toast.success('Lưu cấu hình thành công!');
      setSettingsModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi lưu cấu hình');
    } finally {
      setSavingSettings(false);
    }
  };

  const referrersList = (Array.from(referrersMap.values()) as ReferrerData[]).filter((r: ReferrerData) => {
    let matchesSearch = r.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       (r.customer.phone && r.customer.phone.includes(searchTerm));

    return matchesSearch;
  }).sort((a: ReferrerData, b: ReferrerData) => b.totalReferralRevenue - a.totalReferralRevenue);

  const totalReferralRev = referrersList.reduce((sum, r: ReferrerData) => sum + r.totalReferralRevenue, 0);
  const totalCommission = referrersList.reduce((sum, r: ReferrerData) => sum + r.totalCommission, 0);

  const exportExcel = () => {
    const data = referrersList.map((r: ReferrerData) => ({
      'Họ tên': r.customer.name,
      'SĐT': r.customer.phone,
      'Số khách giới thiệu': r.referredCustomers.length,
      'Tổng doanh số': r.totalReferralRevenue,
      'Tổng đơn hàng': r.totalReferralOrders,
      'Hoa hồng nhận được': r.totalCommission,
      'Hạng': r.customer.tier
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KhachHangGioiThieu");
    XLSX.writeFile(wb, "khach_hang_gioi_thieu.xlsx");
  };

  if (loading) return <div className="flex-1 flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[20px] sm:text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Khách hàng giới thiệu</h1>
          <p className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">Quản lý đối tác và hoa hồng Referral</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto pb-2 lg:pb-0">
          <DateFilter />
          <button onClick={openSettings} className="flex items-center gap-1.5 px-4 py-2.5 sm:px-6 sm:py-4 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-3xl font-black text-[9px] sm:text-xs uppercase tracking-[0.2em] hover:bg-indigo-100 transition-all shadow-sm shrink-0">
            <SettingsIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Cài đặt</span>
            <span className="sm:hidden">Cài đặt</span>
          </button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-4 py-2.5 sm:px-6 sm:py-4 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-3xl font-black text-[9px] sm:text-xs uppercase tracking-[0.2em] hover:bg-emerald-100 transition-all shadow-sm shrink-0">
            <Download className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[16px] sm:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2"><Users className="w-3 sm:w-4 h-3 sm:h-4 text-purple-500" /> Tổng người giới thiệu</p>
           <p className="text-lg sm:text-xl md:text-3xl font-black text-slate-900">{referrersList.length}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[16px] sm:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2"><UserPlus className="w-3 sm:w-4 h-3 sm:h-4 text-blue-500" /> Tổng khách được GT</p>
           <p className="text-lg sm:text-xl md:text-3xl font-black text-blue-600">{
              referrersList.reduce((sum, r: ReferrerData) => sum + r.referredCustomers.length, 0)
           }</p>
        </div>
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[16px] sm:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2"><TrendingUp className="w-3 sm:w-4 h-3 sm:h-4 text-emerald-500" /> <span className="truncate">Tổng doanh thu Referral</span></p>
           <p className="text-base sm:text-xl md:text-3xl font-black text-emerald-600 truncate" title={formatCurrency(totalReferralRev)}>{formatCurrency(totalReferralRev)}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[16px] sm:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2"><DollarSign className="w-3 sm:w-4 h-3 sm:h-4 text-amber-500" /> <span className="truncate">Tổng hoa hồng phải trả</span></p>
           <p className="text-base sm:text-xl md:text-3xl font-black text-amber-600 truncate">{formatCurrency(
              allOrders.filter(o => o.commissionEligible !== false).reduce((sum, o) => sum + (o.commissionAmount || 0), 0)
           )}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[16px] sm:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2"><CheckSquare className="w-3 sm:w-4 h-3 sm:h-4 text-emerald-500" /> <span className="truncate">Hoa hồng đã thanh toán</span></p>
           <p className="text-base sm:text-xl md:text-3xl font-black text-emerald-600 truncate">{formatCurrency(
              allOrders.filter(o => o.commissionStatus === 'paid').reduce((sum, o) => sum + (o.commissionAmount || 0), 0)
           )}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-[16px] sm:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2"><Square className="w-3 sm:w-4 h-3 sm:h-4 text-rose-500" /> <span className="truncate">Hoa hồng chưa thanh toán</span></p>
           <p className="text-base sm:text-xl md:text-3xl font-black text-rose-600 truncate">{formatCurrency(
              allOrders.filter(o => o.commissionStatus === 'unpaid' && o.commissionEligible !== false).reduce((sum, o) => sum + (o.commissionAmount || 0), 0)
           )}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[36px] border border-slate-100 shadow-sm">
        <div className="relative mb-6">
          <Search className="w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc SĐT..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4.5 bg-slate-50 border-none rounded-[24px] outline-none font-bold focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-300"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-widest font-black text-slate-400">
                <th className="p-4">Khách hàng</th>
                <th className="p-4 text-center">Đã giới thiệu</th>
                <th className="p-4 text-right">Tổng đơn Referral</th>
                <th className="p-4 text-right">Doanh số Referral</th>
                <th className="p-4 text-right transform">Hoa hồng ước tính</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {referrersList.map(item => (
                <tr key={item.customer.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setSelectedReferrer(item)}>
                  <td className="p-4">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-900 rounded-xl text-white font-black flex items-center justify-center italic text-xl">
                         {item.customer.name[0].toUpperCase()}
                       </div>
                       <div>
                         <p className="font-black text-slate-900 uppercase italic text-sm">{item.customer.name}</p>
                         <p className="font-bold text-[10px] text-slate-400">{item.customer.phone}</p>
                       </div>
                     </div>
                  </td>
                  <td className="p-4 text-center font-black text-purple-600">{item.referredCustomers.length}</td>
                  <td className="p-4 text-right font-black text-slate-600">{item.totalReferralOrders}</td>
                  <td className="p-4 text-right font-black text-emerald-600">{formatCurrency(item.totalReferralRevenue)}</td>
                  <td className="p-4 text-right font-black text-amber-600">{formatCurrency(item.totalCommission)}</td>
                  <td className="p-4 text-right">
                     <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                  </td>
                </tr>
              ))}
              {referrersList.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedReferrer && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReferrer(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="p-8 border-b border-slate-100 shrink-0 bg-slate-900 flex justify-between items-start">
                    <div className="flex items-center gap-6">
                       <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center font-black text-3xl text-white italic">
                          {selectedReferrer.customer.name[0].toUpperCase()}
                       </div>
                       <div>
                          <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">{selectedReferrer.customer.name}</h2>
                          <div className="flex gap-4 mt-2">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedReferrer.customer.phone}</span>
                             <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Hoa hồng: {formatCurrency(selectedReferrer.totalCommission)}</span>
                          </div>
                       </div>
                    </div>
                    <button onClick={() => setSelectedReferrer(null)} className="text-white/50 hover:text-white font-black text-xs uppercase tracking-widest">Đóng</button>
                 </div>
                 
                 <div className="p-8 flex-1 overflow-y-auto">
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
                       <Users className="w-5 h-5 text-indigo-500" /> Danh sách khách hàng đã giới thiệu ({selectedReferrer.referredCustomers.length})
                    </h3>
                    <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b border-slate-100 text-[10px] uppercase tracking-widest font-black text-slate-400">
                           <th className="p-3">Khách hàng</th>
                           <th className="p-3">Ngày tạo</th>
                           <th className="p-3 text-right">Doanh số (Đã TT)</th>
                         </tr>
                       </thead>
                       <tbody>
                         {selectedReferrer.referredCustomers.map((c: any) => {
                            const cDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || 0);
                            const customerOrders = allCustomers.length > 0 ? [] : []; // We shouldn't use useReferralData inside
                            return (
                               <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                 <td className="p-3">
                                    <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{c.phone}</p>
                                 </td>
                                 <td className="p-3 text-xs text-slate-600 font-bold">{formatDate(cDate)}</td>
                                 <td className="p-3 text-right font-black text-emerald-600">
                                   Chi tiết ở module báo cáo
                                 </td>
                               </tr>
                            )
                         })}
                       </tbody>
                    </table>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>

      {createPortal(
      <AnimatePresence>
        {settingsModalOpen && editingSettings && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setSettingsModalOpen(false)} />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full h-[100dvh] md:h-auto max-w-[800px] bg-white md:rounded-[32px] lg:rounded-[44px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] flex flex-col md:max-h-[90vh]">
                 <div className="p-5 sm:p-8 border-b border-slate-100 flex justify-between items-center shrink-0 mt-2 sm:mt-0">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Cài đặt hoa hồng</h2>
                    <button onClick={() => setSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-900 font-black text-[10px] sm:text-xs uppercase tracking-widest p-2 hover:bg-slate-50 rounded-xl transition-colors">Đóng</button>
                 </div>
                 <div className="p-5 sm:p-8 overflow-y-auto flex-1 flex flex-col gap-6 sm:gap-8 custom-scrollbar">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 block px-1">Phương thức tính hoa hồng</label>
                       <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-4 sm:p-5">
                          <label className="flex items-center gap-3 cursor-pointer">
                             <input type="radio" value="TOTAL_REVENUE" checked={editingSettings.commissionMethod === 'TOTAL_REVENUE'} onChange={() => setEditingSettings({ ...editingSettings, commissionMethod: 'TOTAL_REVENUE' })} className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                             <span className="font-bold text-slate-700 text-xs sm:text-sm">Hoa hồng theo tổng doanh thu</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer sm:ml-4">
                             <input type="radio" value="PER_ORDER" checked={editingSettings.commissionMethod === 'PER_ORDER'} onChange={() => setEditingSettings({ ...editingSettings, commissionMethod: 'PER_ORDER' })} className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                             <span className="font-bold text-slate-700 text-xs sm:text-sm">Hoa hồng theo đơn hàng</span>
                          </label>
                       </div>
                    </div>

                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 block px-1">% Hoa hồng</label>
                       <div className="relative w-full sm:w-48">
                          <input 
                             type="number" 
                             value={editingSettings.commissionPercent} 
                             onChange={e => setEditingSettings({ ...editingSettings, commissionPercent: e.target.value })} 
                             className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm sm:text-base outline-none"
                             placeholder="5"
                          />
                          <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                       </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6 sm:pt-8">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 px-1">
                          <div>
                             <h3 className="font-black text-sm sm:text-base text-slate-900 uppercase tracking-tighter">Tính hoa hồng theo các đơn được chọn</h3>
                             <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1 lg:max-w-md break-words whitespace-normal">Hệ thống chỉ tính hoa hồng cho các đơn được tick chọn dưới đây</p>
                          </div>
                          <div className="flex gap-2 sm:gap-4 shrink-0">
                             <button onClick={() => {
                                const allRefIds = allOrders.filter(o => o.referredById).map(o => o.id!);
                                setSelectedOrdersForCommission(new Set(allRefIds));
                             }} className="text-[10px] sm:text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Chọn tất cả</button>
                             <button onClick={() => setSelectedOrdersForCommission(new Set())} className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Bỏ chọn tất cả</button>
                          </div>
                       </div>

                       <div className="bg-slate-50/50 rounded-2xl sm:rounded-3xl border border-slate-100 max-h-64 overflow-hidden flex flex-col">
                          <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                             <table className="w-full text-left min-w-[500px]">
                                <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm shadow-slate-100/50">
                                   <tr className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                      <th className="px-3 sm:px-4 py-3 sm:py-4 w-12 sm:w-16 text-center">Chọn</th>
                                      <th className="px-3 sm:px-4 py-3 sm:py-4">Mã đơn</th>
                                      <th className="px-3 sm:px-4 py-3 sm:py-4">Người mua (Được GT)</th>
                                      <th className="px-3 sm:px-4 py-3 sm:py-4">Người giới thiệu</th>
                                      <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">Giá trị đơn</th>
                                   </tr>
                                </thead>
                                <tbody>
                                   {allOrders.filter(o => o.referredById).map(o => {
                                      const isChecked = selectedOrdersForCommission.has(o.id!);
                                      return (
                                         <tr key={o.id} className={cn("border-b border-slate-100/50 last:border-0 transition-colors cursor-pointer", isChecked ? "bg-white" : "hover:bg-slate-100/50")} onClick={() => {
                                            const newSet = new Set(selectedOrdersForCommission);
                                            if (isChecked) newSet.delete(o.id!);
                                            else newSet.add(o.id!);
                                            setSelectedOrdersForCommission(newSet);
                                         }}>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-center">
                                               {isChecked ? <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 inline-block" /> : <Square className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 inline-block border-slate-300" />}
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 font-black text-slate-900 text-[10px] sm:text-xs">#{o.id?.slice(-6).toUpperCase()}</td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-600 truncate max-w-[120px] sm:max-w-none" title={o.customerName}>{o.customerName}</td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs font-black text-indigo-600 truncate max-w-[120px] sm:max-w-none" title={o.referredByName}>{o.referredByName}</td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-right font-black text-emerald-600 text-[10px] sm:text-xs whitespace-nowrap">{formatCurrency(o.totalAmount || 0)}</td>
                                         </tr>
                                      );
                                   })}
                                   {allOrders.filter(o => o.referredById).length === 0 && (
                                      <tr>
                                         <td colSpan={5} className="p-6 sm:p-8 text-center text-[10px] sm:text-xs font-bold text-slate-400 bg-white">Không có đơn hàng nào từ người được giới thiệu.</td>
                                      </tr>
                                   )}
                                </tbody>
                             </table>
                          </div>
                       </div>
                    </div>

                 </div>
                 <div className="p-4 sm:p-6 border-t border-slate-100 shrink-0 bg-slate-50 flex sm:justify-end md:rounded-b-[32px] lg:rounded-b-[44px]">
                    <button onClick={saveSettings} disabled={savingSettings} className="w-full sm:w-auto px-6 sm:px-8 py-4 sm:py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                       {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                       {savingSettings ? 'Đang lưu...' : 'Lưu cấu hình hoa hồng'}
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>,
      document.body)}
    </div>
  );
}
