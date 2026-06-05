import React, { useState } from 'react';
import { useReferralData } from '../../lib/useReferralData';
import { Award, Search, Loader2, CheckSquare, Square, Download } from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { DateRange, DateFilter } from '../../components/DateFilter';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export function CommissionHistory() {
  const { allOrders, settings, loading } = useReferralData();
  const [searchTerm, setSearchTerm] = useState('');
  const { dateRange } = useDateFilterStore();
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);

  // Generate commission history based on eligible orders
  const commissionLogs = allOrders.filter(o => {
     if (!o.referredById || o.commissionEligible === false) return false;
     
     const ordDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
     if (dateRange.startDate && dateRange.endDate) {
       if (ordDate < dateRange.startDate || ordDate > dateRange.endDate) return false;
     }
     
     if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const refMatch = (o.referredByName || '').toLowerCase().includes(term);
        const custMatch = (o.customerName || '').toLowerCase().includes(term);
        const orderIdMatch = (o.id || '').toLowerCase().includes(term);
        if (!refMatch && !custMatch && !orderIdMatch) return false;
     }
     
     return true;
  }).map(o => ({
     id: o.id!,
     date: o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0),
     referrerName: o.referredByName || 'Không xác định',
     customerName: o.customerName || 'Không xác định',
     orderId: o.id,
     revenue: o.totalAmount || 0,
     percent: o.commissionPercent || 0,
     commission: o.commissionAmount || 0,
     status: o.commissionStatus || 'unpaid'
  })).sort((a,b) => b.date.getTime() - a.date.getTime());

  const handleUpdateStatus = async (status: 'paid' | 'cancelled') => {
     if (selectedLogs.size === 0) return;
     setUpdating(true);
     try {
        const batch = writeBatch(db);
        selectedLogs.forEach(id => {
           batch.update(doc(db, 'orders', id), {
              commissionStatus: status,
              commissionPaidAt: status === 'paid' ? new Date() : null
           });
        });
        await batch.commit();
        toast.success(status === 'paid' ? 'Đã gạch nợ thành công!' : 'Đã hủy hoa hồng!');
        setSelectedLogs(new Set());
     } catch (error) {
        console.error(error);
        toast.error('Có lỗi xảy ra');
     } finally {
        setUpdating(false);
     }
  };

  const exportExcel = () => {
    const data = commissionLogs.map(log => ({
      'Ngày': formatDate(log.date),
      'Người giới thiệu': log.referrerName,
      'Khách được giới thiệu': log.customerName,
      'Mã đơn': log.orderId,
      'Doanh thu': log.revenue,
      '% Hoa hồng': log.percent,
      'Hoa hồng': log.commission,
      'Trạng thái': log.status === 'paid' ? 'Đã thanh toán' : log.status === 'cancelled' ? 'Đã hủy' : 'Chưa thanh toán'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LichSuHoaHong");
    XLSX.writeFile(wb, "lich_su_hoa_hong.xlsx");
  };

  if (loading) return <div className="flex-1 flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[20px] sm:text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Lịch sử hoa hồng</h1>
          <p className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">Giao dịch hoa hồng phát sinh từ hệ thống</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto pb-2 lg:pb-0">
          <DateFilter />
          <button onClick={exportExcel} className="flex shrink-0 items-center gap-1.5 px-4 py-2.5 sm:px-6 sm:py-4 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-3xl font-black text-[9px] sm:text-xs uppercase tracking-[0.2em] hover:bg-emerald-100 transition-all shadow-sm">
            <Download className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-6 rounded-[20px] sm:rounded-[36px] border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 mb-4 sm:mb-6 items-center justify-between">
           <div className="relative flex-1 w-full max-w-none sm:max-w-md">
             <Search className="w-4 h-4 sm:w-6 sm:h-6 absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
             <input 
               type="text" 
               placeholder="Tìm người GT hoặc KH..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-10 pr-4 py-3 sm:pl-16 sm:pr-6 sm:py-4.5 bg-slate-50 border-none rounded-[16px] sm:rounded-[24px] outline-none font-bold text-xs sm:text-base focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-300"
             />
           </div>
            
           {selectedLogs.size > 0 && (
              <div className="flex gap-2 w-full sm:w-auto">
                 <button onClick={() => handleUpdateStatus('paid')} disabled={updating} className="flex-1 sm:flex-none px-4 py-3 sm:px-6 sm:py-3 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-emerald-100 transition-colors whitespace-nowrap">
                    Thanh toán ({selectedLogs.size})
                 </button>
                 <button onClick={() => handleUpdateStatus('cancelled')} disabled={updating} className="flex-1 sm:flex-none px-4 py-3 sm:px-6 sm:py-3 bg-rose-50 text-rose-600 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-rose-100 transition-colors whitespace-nowrap">
                    Từ chối ({selectedLogs.size})
                 </button>
              </div>
           )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-widest font-black text-slate-400">
                <th className="p-4 w-12 text-center">
                   <div className="cursor-pointer inline-block" onClick={() => {
                      if (selectedLogs.size === commissionLogs.length) {
                         setSelectedLogs(new Set());
                      } else {
                         setSelectedLogs(new Set(commissionLogs.map(l => l.id)));
                      }
                   }}>
                      {selectedLogs.size === commissionLogs.length && commissionLogs.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-500" /> : <Square className="w-5 h-5 text-slate-300 hover:text-indigo-500 transition-colors" />}
                   </div>
                </th>
                <th className="p-4">Ngày phát sinh</th>
                <th className="p-4">Người giới thiệu</th>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Mã đơn hàng</th>
                <th className="p-4 text-right">Doanh số</th>
                <th className="p-4 text-center">% Hoa hồng</th>
                <th className="p-4 text-right">Hoa hồng nhận</th>
                <th className="p-4 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {commissionLogs.map((log, i) => {
                 const isChecked = selectedLogs.has(log.id);
                 return (
                 <tr key={log.id + i} className={cn("border-b border-slate-50 transition-colors", isChecked ? "bg-indigo-50/30" : "hover:bg-slate-50/50")} onClick={() => {
                    const newSet = new Set(selectedLogs);
                    if (isChecked) newSet.delete(log.id);
                    else newSet.add(log.id);
                    setSelectedLogs(newSet);
                 }}>
                  <td className="p-4 text-center">
                     {isChecked ? <CheckSquare className="w-5 h-5 text-indigo-500 inline-block" /> : <Square className="w-5 h-5 text-slate-300 inline-block" />}
                  </td>
                  <td className="p-4 text-xs font-bold text-slate-600">{formatDate(log.date)}</td>
                  <td className="p-4 font-black text-indigo-600 uppercase text-xs">{log.referrerName}</td>
                  <td className="p-4 font-bold text-slate-900">{log.customerName}</td>
                  <td className="p-4 font-bold text-slate-500 text-xs">#{String(log.orderId).slice(-6).toUpperCase()}</td>
                  <td className="p-4 text-right font-black text-slate-700">{formatCurrency(log.revenue)}</td>
                  <td className="p-4 text-center font-black text-amber-500">{log.percent}%</td>
                  <td className="p-4 text-right font-black text-emerald-600">{formatCurrency(log.commission)}</td>
                  <td className="p-4 text-right">
                     <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                        log.status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                        log.status === 'cancelled' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                     )}>
                        {log.status === 'paid' ? 'Đã Thanh Toán' : log.status === 'cancelled' ? 'Đã Hủy' : 'Chưa Thanh Toán'}
                     </span>
                  </td>
                </tr>
              )})}
              {commissionLogs.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">Không có dữ liệu hoa hồng</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
