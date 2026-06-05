import React, { useState } from 'react';
import { useReferralData } from '../../lib/useReferralData';
import { Users, Search, Loader2, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { DateRange, DateFilter } from '../../components/DateFilter';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import * as XLSX from 'xlsx';

export function ReferredList() {
  const [searchTerm, setSearchTerm] = useState('');
  const { dateRange } = useDateFilterStore();
  const { allCustomers, customerMap, spendPerCustomer, ordersPerCustomer, loading } = useReferralData(dateRange);

  const referredList = allCustomers.filter(c => {
    // Must have a referrer
    if (!c.referredById) return false;
    
    let matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       (c.phone && c.phone.includes(searchTerm));

    // Removed matchesDate so referred customers still show up even if not created in period
    // The total values will reflect the period.

    return matchesSearch;
  }).sort((a, b) => {
    const dA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const dB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return dB - dA;
  });

  const exportExcel = () => {
    const data = referredList.map(c => ({
      'Họ tên': c.name,
      'SĐT': c.phone,
      'Người giới thiệu': customerMap.get(c.referredById!)?.name || 'Không xác định',
      'Ngày tạo': formatDate(c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || 0)),
      'Tổng đơn hàng': ordersPerCustomer.get(c.id!) || 0,
      'Tổng chi tiêu': spendPerCustomer.get(c.id!) || 0
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KhachHangDuocGioiThieu");
    XLSX.writeFile(wb, "khach_hang_duoc_gioi_thieu.xlsx");
  };

  if (loading) return <div className="flex-1 flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[20px] sm:text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Khách hàng được giới thiệu</h1>
          <p className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">Danh sách khách hàng từ hệ thống Referral</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto pb-2 lg:pb-0">
          <DateFilter />
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-4 py-2.5 sm:px-6 sm:py-4 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-3xl font-black text-[9px] sm:text-xs uppercase tracking-[0.2em] hover:bg-emerald-100 transition-all shadow-sm shrink-0">
            <Download className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-6 rounded-[20px] sm:rounded-[36px] border border-slate-100 shadow-sm">
        <div className="relative mb-4 sm:mb-6">
          <Search className="w-4 h-4 sm:w-6 sm:h-6 absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc SĐT..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 sm:pl-16 sm:pr-6 sm:py-4.5 bg-slate-50 border-none rounded-[16px] sm:rounded-[24px] outline-none font-bold text-xs sm:text-base focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-300"
          />
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[500px] sm:min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[8px] sm:text-[10px] uppercase tracking-widest font-black text-slate-400">
                <th className="p-2 sm:p-4">Khách hàng</th>
                <th className="p-2 sm:p-4">Người giới thiệu</th>
                <th className="p-2 sm:p-4">Ngày tạo</th>
                <th className="p-2 sm:p-4 text-center sm:text-right w-16 sm:w-auto">Đơn</th>
                <th className="p-2 sm:p-4 text-right">Chi tiêu</th>
              </tr>
            </thead>
            <tbody>
              {referredList.map(c => {
                const joinDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || 0);
                const referrer = customerMap.get(c.referredById!);
                return (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-2 sm:p-4">
                       <p className="font-bold text-slate-900 text-[10px] sm:text-sm uppercase truncate max-w-[100px] sm:max-w-none">{c.name}</p>
                       <p className="text-[8px] sm:text-[10px] text-slate-400 font-bold">{c.phone}</p>
                    </td>
                    <td className="p-2 sm:p-4">
                       {referrer ? (
                         <>
                           <p className="font-bold text-indigo-600 text-[10px] sm:text-xs uppercase truncate max-w-[100px] sm:max-w-none">{referrer.name}</p>
                           <p className="text-[8px] sm:text-[10px] text-slate-400 font-bold">{referrer.phone}</p>
                         </>
                       ) : (
                         <span className="text-slate-400 text-[10px] sm:text-xs italic font-bold">Không xác định</span>
                       )}
                    </td>
                    <td className="p-2 sm:p-4 text-[9px] sm:text-xs font-bold text-slate-600">
                       <span className="hidden sm:inline">{formatDate(joinDate)}</span>
                       <span className="sm:hidden">{formatDate(joinDate).split(' ')[0]}</span>
                    </td>
                    <td className="p-2 sm:p-4 text-center sm:text-right font-black text-slate-600 text-[10px] sm:text-base">{ordersPerCustomer.get(c.id!) || 0}</td>
                    <td className="p-2 sm:p-4 text-right font-black text-emerald-600 text-[10px] sm:text-base truncate max-w-[80px] sm:max-w-[none]">
                       {formatCurrency(spendPerCustomer.get(c.id!) || 0)}
                    </td>
                  </tr>
                );
              })}
              {referredList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
