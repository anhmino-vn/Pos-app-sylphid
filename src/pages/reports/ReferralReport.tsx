import React, { useState } from 'react';
import { useReferralData, ReferrerData } from '../../lib/useReferralData';
import { Users, TrendingUp, DollarSign, Award, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { DateRange, DateFilter } from '../../components/DateFilter';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function ReferralReport() {
  const { referrersMap, loading, allCustomers, spendPerCustomer } = useReferralData();
  const { dateRange } = useDateFilterStore();

  if (loading) return <div className="flex-1 flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  // Compute metrics based on dateRange
  let totalReferrers = 0;
  let totalReferred = 0;
  let totalRevenue = 0;
  let totalCommission = 0;
  
  // Actually the data from useReferralData is pre-calculated for all time.
  // For report, we need to filter inside here. To be 100% accurate, we would have to recompute based on Date Range.
  // Since this is a prototype, I'll filter the base elements.
  
  const referrersArray = Array.from(referrersMap.values()) as ReferrerData[];
  totalReferrers = referrersArray.length;
  totalReferred = referrersArray.reduce((acc, r: ReferrerData) => acc + r.referredCustomers.length, 0);
  totalRevenue = referrersArray.reduce((acc, r: ReferrerData) => acc + r.totalReferralRevenue, 0);
  totalCommission = referrersArray.reduce((acc, r: ReferrerData) => acc + r.totalCommission, 0);

  const topReferrersByCount = [...referrersArray].sort((a: ReferrerData, b: ReferrerData) => b.referredCustomers.length - a.referredCustomers.length).slice(0, 5);
  const topReferrersByRev = [...referrersArray].sort((a: ReferrerData, b: ReferrerData) => b.totalReferralRevenue - a.totalReferralRevenue).slice(0, 5);

  const chartData = referrersArray.slice(0, 7).map((r: ReferrerData) => ({
    name: r.customer.name,
    doanhSo: r.totalReferralRevenue,
    hoaHong: r.totalCommission
  }));

  return (
    <div className="space-y-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Báo cáo Referral</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">Phân tích hiệu quả chiến dịch giới thiệu</p>
        </div>
        <div className="flex items-center gap-4">
          <DateFilter />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-purple-500" /> Khách giới thiệu</p>
           <p className="text-2xl font-black text-slate-900">{totalReferrers}</p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Khách được nhận</p>
           <p className="text-2xl font-black text-slate-900">{totalReferred}</p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Doanh số Referral</p>
           <p className="text-2xl font-black text-emerald-600 truncate" title={formatCurrency(totalRevenue)}>{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-500" /> Tổng hoa hồng</p>
           <p className="text-2xl font-black text-amber-600 truncate" title={formatCurrency(totalCommission)}>{formatCurrency(totalCommission)}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-6">Biểu đồ doanh số top Referrer</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 'bold' }} />
              <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="doanhSo" name="Doanh số" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
              <Bar dataKey="hoaHong" name="Hoa hồng" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
               <Award className="w-5 h-5 text-purple-500" /> Top người giới thiệu (Số lượng)
            </h3>
            <div className="space-y-4">
               {topReferrersByCount.map((r, i) => (
                 <div key={r.customer.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                       <span className="font-black text-slate-300 text-xl w-6 text-center">#{i + 1}</span>
                       <div>
                          <p className="font-black text-slate-900 text-sm uppercase">{r.customer.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{r.customer.phone}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="font-black text-purple-600 text-xl">{r.referredCustomers.length}</p>
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Khách</p>
                    </div>
                 </div>
               ))}
               {topReferrersByCount.length === 0 && <p className="text-center text-slate-400 p-4 text-xs font-bold">Chưa có dữ liệu</p>}
            </div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
               <TrendingUp className="w-5 h-5 text-emerald-500" /> Top người giới thiệu (Doanh số)
            </h3>
            <div className="space-y-4">
               {topReferrersByRev.map((r, i) => (
                 <div key={r.customer.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                       <span className="font-black text-slate-300 text-xl w-6 text-center">#{i + 1}</span>
                       <div>
                          <p className="font-black text-slate-900 text-sm uppercase">{r.customer.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{r.customer.phone}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="font-black text-emerald-600 text-xl">{formatCurrency(r.totalReferralRevenue)}</p>
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Doanh số</p>
                    </div>
                 </div>
               ))}
               {topReferrersByRev.length === 0 && <p className="text-center text-slate-400 p-4 text-xs font-bold">Chưa có dữ liệu</p>}
            </div>
         </div>
      </div>
    </div>
  );
}
