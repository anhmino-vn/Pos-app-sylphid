import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Calendar as CalendarIcon,
  Package, 
  ArrowRight, 
  ShieldCheck, 
  ChevronRight, 
  Activity, 
  Zap, 
  Search, 
  Sparkles,
  PlusCircle,
  UserPlus,
  Box,
  Ticket,
  Gem,
  Crown,
  Award,
  Medal,
  Shield,
  TrendingDown,
  Users,
  Gift,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Order } from '../lib/supabase';
import { formatCurrency, cn, formatDate, parseSafeDate } from '../lib/utils';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { useNavigate } from 'react-router-dom';

import { DateFilter } from '../components/DateFilter';
import { useDateFilterStore } from '../store/useDateFilterStore';
import { useDashboardData } from '../hooks/useDashboardData';

export function Dashboard() {
  const navigate = useNavigate();
  const { dateRange, filterType } = useDateFilterStore();
  const dashboardData = useDashboardData(dateRange);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'7D' | '30D' | '90D' | '12M'>('7D');

  const chartData = useMemo(() => {
    const now = new Date();
    const periodData = new Map<string, { revenue: number, profit: number }>();
    
    let daysDiff = 7;
    let isMonthMode = false;
    
    if (chartPeriod === '7D') daysDiff = 7;
    else if (chartPeriod === '30D') daysDiff = 30;
    else if (chartPeriod === '90D') daysDiff = 90;
    else if (chartPeriod === '12M') {
      daysDiff = 365;
      isMonthMode = true;
    }
    
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysDiff + 1);
    startDate.setHours(0, 0, 0, 0);

    const filteredOrders = dashboardData.allOrders.filter(o => {
      if (o.status !== 'paid' || !o.createdAt) return false;
      const orderDate = formatDate ? (o.createdAt as any).toDate ? (o.createdAt as any).toDate() : new Date((o.createdAt as any).seconds * 1000) : new Date(); // use basic fallback if parseSafeDate is not imported properly here. Wait, parseSafeDate is not imported in Dashboard.tsx. I can just use o.createdAt.toDate() assuming it's a Timestamp. Wait, `o.createdAt` might be missing.
      return orderDate >= startDate && orderDate <= now;
    });

    if (isMonthMode) {
      for (let i = 11; i >= 0; i--) {
         const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
         const label = d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
         periodData.set(label, { revenue: 0, profit: 0 });
      }
    } else {
      for (let i = daysDiff - 1; i >= 0; i--) {
         const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
         const label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
         periodData.set(label, { revenue: 0, profit: 0 });
      }
    }

    filteredOrders.forEach(o => {
       const orderDate = (o.createdAt as any).toDate ? (o.createdAt as any).toDate() : new Date((o.createdAt as any).seconds * 1000);
       const label = isMonthMode 
           ? orderDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })
           : orderDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
       
       if (periodData.has(label)) {
          const existing = periodData.get(label)!;
          const orderRev = o.totalAmount || 0;
          const orderProfit = orderRev * 0.6;
          periodData.set(label, { revenue: existing.revenue + orderRev, profit: existing.profit + orderProfit });
       }
    });

    return Array.from(periodData.entries()).map(e => ({ name: e[0], revenue: e[1].revenue, profit: e[1].profit }));
  }, [dashboardData.allOrders, chartPeriod]);


  const filteredRecentOrders = useMemo(() => {
    let list = dashboardData.allOrders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const qNoWs = q.replace(/\s+/g, '');
      list = list.filter(order => {
        const displayId = `tx-${(order.id || '').slice(-6).toLowerCase()}`;
        const idMatch = order.id?.toLowerCase().includes(q) || displayId.includes(qNoWs);
        const nameMatch = order.customerName?.toLowerCase().includes(q);
        const phoneMatch = order.customerPhone?.toLowerCase().includes(q);
        const itemsMatch = order.items?.some(i => i.name.toLowerCase().includes(q));
        return idMatch || nameMatch || phoneMatch || itemsMatch;
      });
    }
    
    // Yêu cầu: Giao Dịch Gần Đây hiển thị các giao dịch mới vừa phát sinh khoảng 24h
    const now = new Date().getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    const recent24hOrders = list.filter(order => {
      if (!order.createdAt) return false;
      const orderTime = order.createdAt.toDate().getTime();
      return (now - orderTime) <= twentyFourHours;
    });

    const hasOlderOrders = list.length > recent24hOrders.length;
    
    return {
       displayOrders: recent24hOrders.slice(0, 5),
       hasMore: hasOlderOrders || recent24hOrders.length > 5
    };
  }, [dashboardData.allOrders, searchQuery]);

  let periodLabel = 'hôm nay';
  let prevPeriodLabel = 'hôm qua';

  switch (filterType) {
    case 'today':
      periodLabel = 'hôm nay';
      prevPeriodLabel = 'hôm qua';
      break;
    case 'yesterday':
      periodLabel = 'hôm qua';
      prevPeriodLabel = 'hôm kia';
      break;
    case '7_days':
      periodLabel = '7 ngày qua';
      prevPeriodLabel = '7 ngày trước';
      break;
    case '30_days':
      periodLabel = '30 ngày qua';
      prevPeriodLabel = '30 ngày trước';
      break;
    case 'this_week':
      periodLabel = 'tuần này';
      prevPeriodLabel = 'tuần trước';
      break;
    case 'this_month':
      periodLabel = 'tháng này';
      prevPeriodLabel = 'tháng trước';
      break;
    case 'last_month':
      periodLabel = 'tháng trước';
      prevPeriodLabel = 'tháng kia';
      break;
    case 'all':
      periodLabel = 'toàn bộ';
      prevPeriodLabel = 'kỳ trước';
      break;
    case 'custom':
      periodLabel = 'kỳ này';
      prevPeriodLabel = 'kỳ trước';
      break;
  }

  const calcTrend = (current: number, prev: number) => {
    if (prev === 0 && current === 0) return { text: '0% so với ' + prevPeriodLabel, isUp: true };
    if (prev === 0) return { text: '+100% so với ' + prevPeriodLabel, isUp: true };
    const diff = current - prev;
    const percent = Math.round((Math.abs(diff) / prev) * 100);
    return {
      text: `${diff >= 0 ? '+' : '-'}${percent}% so với ${prevPeriodLabel}`,
      isUp: diff >= 0
    };
  };

  const revenueTrend = calcTrend(dashboardData.todayRevenue, dashboardData.prevRevenue);
  const ordersTrend = calcTrend(dashboardData.todayOrdersCount, dashboardData.prevOrdersCount);
  const profitTrend = calcTrend(dashboardData.todayProfit, dashboardData.prevProfit);
  const customersTrend = calcTrend(dashboardData.todayNewCustomers, dashboardData.prevNewCustomers);
  const bookingsTrend = calcTrend(dashboardData.todayBookings.length, dashboardData.prevBookingsCount);
  const referralsTrend = calcTrend(dashboardData.todayReferrals, dashboardData.prevReferrals);

  const stats = [
    { title: `Doanh thu ${periodLabel}`, value: formatCurrency(dashboardData.todayRevenue), trend: revenueTrend.text, isUp: revenueTrend.isUp, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: `Đơn hàng ${periodLabel}`, value: `${dashboardData.todayOrdersCount} đơn`, trend: ordersTrend.text, isUp: ordersTrend.isUp, icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: `Khách hàng mới`, value: `${dashboardData.todayNewCustomers} khách`, trend: customersTrend.text, isUp: customersTrend.isUp, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: `Lịch hẹn ${periodLabel}`, value: `${dashboardData.todayBookings.length} lịch`, trend: bookingsTrend.text, isUp: bookingsTrend.isUp, icon: CalendarIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Công nợ khách hàng', value: formatCurrency(dashboardData.totalUnpaidDebt), trend: `${dashboardData.unpaidCustomersCount} khách nợ`, isUp: false, icon: Users, color: 'text-rose-600', bg: 'bg-rose-50' },
    { title: `Referral ${periodLabel}`, value: `${dashboardData.todayReferrals} khách`, trend: referralsTrend.text, isUp: referralsTrend.isUp, icon: Gift, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Giá trị tồn kho', value: formatCurrency(dashboardData.inventoryTotal * 150000), trend: `+3% so với ${prevPeriodLabel}`, isUp: true, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: `Lợi nhuận ${periodLabel}`, value: formatCurrency(dashboardData.todayProfit), trend: profitTrend.text, isUp: profitTrend.isUp, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];



  return (
    <div className="flex flex-col h-auto xl:h-[calc(100vh-90px)] gap-4 pb-20 xl:pb-2">
      <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

      {/* Header: Row 1 */}
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Tổng quan</h1>
        </div>
        <div className="flex items-center gap-3">
          <DateFilter className="scale-90 origin-right" />
        </div>
      </div>

      {/* 8 Stats KPI Grid: Row 2 */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between mb-1">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">{stat.title}</p>
               <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0", stat.bg, stat.color)}>
                  <stat.icon className="w-3.5 h-3.5" />
               </div>
            </div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">{stat.value}</h3>
            <div className="flex items-center gap-1 mt-1">
               {stat.isUp ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
               <span className={cn("text-[9px] font-bold truncate", stat.isUp ? 'text-emerald-600' : 'text-rose-600')}>{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area: Flex-1 grid for Desktop */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 xl:grid-rows-2 gap-4 min-h-0">
        
        {/* Row 1: Chart + Recent Orders + Debt/Warnings */}
        {/* Chart */}
        <div className="xl:col-span-6 xl:row-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[250px] xl:min-h-0">
           <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900">Doanh thu & Lợi nhuận</h4>
              <div className="flex gap-1 bg-slate-50/80 p-1 rounded-lg border border-slate-100/50">
                {(['7D', '30D', '90D', '12M'] as const).map(period => (
                   <button
                     key={period}
                     onClick={() => setChartPeriod(period)}
                     className={cn(
                       "px-3 py-1.5 text-[11px] font-bold rounded-md transition-all duration-200",
                       chartPeriod === period
                         ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/50"
                         : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                     )}
                   >
                     {period === '7D' ? '7 ngày' : period === '30D' ? '30 ngày' : period === '90D' ? '90 ngày' : '12 tháng'}
                   </button>
                ))}
              </div>
           </div>
           <div className="flex gap-4 mb-3 px-1">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-600 rounded-full" /><span className="text-[11px] font-bold text-slate-600">Doanh thu</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /><span className="text-[11px] font-bold text-slate-600">Lợi nhuận</span></div>
           </div>
           <div className="flex-1 w-full min-h-0 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                       <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} tickFormatter={v => v >= 1000000 ? `${v/1000000}M` : v >= 1000 ? `${v/1000}k` : v} width={40} />
                    <Tooltip 
                       cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} 
                       content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                             return (
                                <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
                                   <p className="text-xs font-bold text-slate-800 mb-2">{label}</p>
                                   <div className="space-y-1.5">
                                      {payload.map((entry: any, index: number) => (
                                         <div key={index} className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                            <span>{entry.name === 'revenue' ? 'Doanh thu' : 'Lợi nhuận'}: {formatCurrency(entry.value)}</span>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             );
                          }
                          return null;
                       }} 
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#colorRev)" activeDot={{ r: 4, strokeWidth: 2, stroke: '#2563eb', fill: '#fff' }} dot={{ r: 3, strokeWidth: 2, stroke: '#2563eb', fill: '#fff' }} />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#colorProfit)" activeDot={{ r: 4, strokeWidth: 2, stroke: '#10b981', fill: '#fff' }} dot={{ r: 3, strokeWidth: 2, stroke: '#10b981', fill: '#fff' }} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Recent Orders */}
        <div className="xl:col-span-3 xl:row-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[250px] xl:min-h-0">
           <div className="flex items-center justify-between mb-3 shrink-0">
              <h4 className="text-sm font-bold text-slate-900">Đơn hàng gần đây</h4>
              <button onClick={() => navigate('/orders')} className="text-[10px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
              {filteredRecentOrders.displayOrders.map(o => (
                 <div key={o.id} onClick={() => setSelectedOrder(o)} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer group border border-transparent hover:border-slate-100 transition-colors">
                    <div className="min-w-0 flex-1">
                       <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">#DH{o.id?.slice(-6).toUpperCase()}</p>
                       <p className="text-[10px] text-slate-500 truncate mt-0.5">{o.customerName || 'Khách vãng lai'}</p>
                    </div>
                    <div className="text-right shrink-0">
                       <p className={cn("text-xs font-bold", o.status === 'paid' ? 'text-emerald-600' : o.status === 'cancelled' ? 'text-rose-500' : 'text-slate-900')}>{formatCurrency(o.totalAmount)}</p>
                       <p className="text-[9px] text-slate-400 mt-0.5">{o.createdAt ? formatDate(o.createdAt.toDate()) : ''}</p>
                    </div>
                 </div>
              ))}
              {filteredRecentOrders.displayOrders.length === 0 && <div className="text-center text-xs text-slate-400 py-4 font-bold">Không có đơn hàng</div>}
           </div>
        </div>

        {/* Debt & Referrals */}
        <div className="xl:col-span-3 xl:row-span-1 flex flex-col gap-4 min-h-[250px] xl:min-h-0">
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                 <Shield className="w-16 h-16 text-rose-600" />
              </div>
              <div className="flex items-center justify-between mb-1 relative z-10">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Công nợ cần thu</h4>
              </div>
              <h3 className="text-xl font-black text-rose-600 tracking-tight relative z-10">{formatCurrency(dashboardData.totalUnpaidDebt)}</h3>
              <div className="flex items-center justify-between mt-3 p-2 bg-rose-50 rounded-lg relative z-10">
                 <span className="text-[10px] font-bold text-rose-600">{dashboardData.unpaidCustomersCount} khách hàng</span>
                 <button onClick={() => navigate('/customers')} className="px-2 py-1 bg-rose-600 text-white text-[9px] font-bold rounded shadow-sm hover:bg-rose-700">Thu hồi</button>
              </div>
           </div>

           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                 <h4 className="text-sm font-bold text-slate-900">Top giới thiệu</h4>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                 {dashboardData.topCustomers.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                       <div className="flex items-center gap-2 w-1/2 min-w-0">
                          <span className="font-bold text-slate-400 text-[10px] w-2">{i+1}</span>
                          <span className="font-bold text-slate-800 truncate text-[11px]">{c.name}</span>
                       </div>
                       <span className="text-slate-500 w-1/4 text-center text-[10px]">{c.count} khách</span>
                       <span className="font-bold text-emerald-600 w-1/4 text-right text-[11px]">{formatCurrency(c.spend)}</span>
                    </div>
                 ))}
                 {dashboardData.topCustomers.length === 0 && <div className="text-center text-xs text-slate-400 py-2 font-bold">Chưa có dữ liệu</div>}
              </div>
           </div>
        </div>

        {/* Row 2: 4 Columns + Warnings/Activities */}
        {/* 4 Columns */}
        <div className="xl:col-span-8 xl:row-span-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[300px] xl:min-h-0">
           {/* Lịch hẹn */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                 <h4 className="text-sm font-bold text-slate-900">Lịch hẹn h.nay</h4>
                 <button onClick={() => navigate('/bookings')} className="text-[10px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                 {dashboardData.todayBookings.map(b => (
                    <div key={b.id} className="flex items-start gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                       <span className="text-[11px] font-black text-blue-600 w-9 shrink-0 pt-0.5">{b.bookingTime || '--:--'}</span>
                       <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{b.customerName}</p>
                          <p className="text-[9px] font-medium text-slate-500 truncate mt-0.5">{b.serviceName}</p>
                       </div>
                    </div>
                 ))}
                 {dashboardData.todayBookings.length === 0 && <div className="text-center text-xs text-slate-400 py-4 font-bold">Không có lịch hẹn</div>}
              </div>
           </div>

           {/* Top Sản phẩm */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                 <h4 className="text-sm font-bold text-slate-900">Sản phẩm bán chạy</h4>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                 {dashboardData.topProducts.filter(p => p.type !== 'service').slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-start gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                       <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[9px] font-black shrink-0">{i+1}</span>
                       <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">SL: <span className="font-bold text-slate-700">{p.sales}</span></p>
                       </div>
                    </div>
                 ))}
                 {dashboardData.topProducts.filter(p => p.type !== 'service').length === 0 && <div className="text-center text-xs text-slate-400 py-4 font-bold">Chưa có dữ liệu</div>}
              </div>
           </div>

           {/* Top Dịch vụ */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                 <h4 className="text-sm font-bold text-slate-900">Dịch vụ phổ biến</h4>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                 {dashboardData.topProducts.filter(p => p.type === 'service').slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-start gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                       <span className="w-4 h-4 rounded bg-purple-50 text-purple-600 flex items-center justify-center text-[9px] font-black shrink-0">{i+1}</span>
                       <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Lượt làm: <span className="font-bold text-slate-700">{p.sales}</span></p>
                       </div>
                    </div>
                 ))}
                 {dashboardData.topProducts.filter(p => p.type === 'service').length === 0 && <div className="text-center text-xs text-slate-400 py-4 font-bold">Chưa có dữ liệu</div>}
              </div>
           </div>

           {/* Top Nhân viên */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                 <h4 className="text-sm font-bold text-slate-900">Top nhân viên</h4>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                 {dashboardData.topStaff.map((emp, i) => (
                    <div key={i} className="flex items-start gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                       <span className="w-4 h-4 rounded bg-amber-50 text-amber-600 flex items-center justify-center text-[9px] font-black shrink-0">{i+1}</span>
                       <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{emp.name}</p>
                          <p className="text-[9px] font-bold text-emerald-600 mt-0.5">{formatCurrency(emp.rev)}</p>
                       </div>
                    </div>
                 ))}
                 {dashboardData.topStaff.length === 0 && <div className="text-center text-xs text-slate-400 py-4 font-bold">Chưa có dữ liệu</div>}
              </div>
           </div>
        </div>

        {/* Warnings & Activities */}
        <div className="xl:col-span-4 xl:row-span-1 flex flex-col gap-4 min-h-[300px] xl:min-h-0">
           {/* Warnings - Horizontal Scroll or Grid */}
           <div className="grid grid-cols-3 gap-2 shrink-0">
              <div className="bg-orange-50 p-2 rounded-xl border border-orange-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-orange-100 transition-colors">
                 <span className="text-sm font-black text-orange-600 leading-none">{dashboardData.lowStockCount}</span>
                 <span className="text-[9px] font-bold text-orange-700 mt-1 leading-tight">Sắp hết hàng</span>
              </div>
              
              <div className="bg-rose-50 p-2 rounded-xl border border-rose-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-rose-100 transition-colors">
                 <span className="text-sm font-black text-rose-600 leading-none">{dashboardData.unpaidCustomersCount}</span>
                 <span className="text-[9px] font-bold text-rose-700 mt-1 leading-tight">Khách nợ</span>
              </div>

              <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-100 transition-colors">
                 <span className="text-sm font-black text-emerald-600 leading-none">{dashboardData.treatmentWarningsCount}</span>
                 <span className="text-[9px] font-bold text-emerald-700 mt-1 leading-tight">Gần hết liệu trình</span>
              </div>
           </div>

           {/* Activities */}
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-5 shrink-0">
                 <h4 className="text-[15px] font-bold text-slate-800 tracking-tight">Hoạt động gần đây</h4>
                 <button onClick={() => navigate('/settings?tab=system')} className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">Xem tất cả</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-0 relative pl-1">
                 {dashboardData.recentActivities.map((act, i) => {
                    const parsedDate = parseSafeDate(act.createdAt);
                    const timeStr = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '--:--';
                    
                    let detailsStr = act.details || '';
                    let parsedDetails: any = null;
                    try { if (typeof detailsStr === 'string' && detailsStr.trim().startsWith('{')) parsedDetails = JSON.parse(detailsStr); } catch (e) {}
                    
                    let actionText = detailsStr;
                    if (parsedDetails && act.action === 'delete_order') {
                       const shortId = parsedDetails.orderId ? parsedDetails.orderId.substring(parsedDetails.orderId.length - 6).toUpperCase() : '';
                       actionText = `đã xóa đơn hàng #${shortId}`;
                    } else if (actionText.toLowerCase() === 'đăng nhập thành công') {
                       actionText = 'đã đăng nhập thành công';
                    } else if (!actionText.toLowerCase().startsWith('đã')) {
                       if (actionText.toLowerCase().startsWith('tạo')) actionText = 'đã tạo ' + actionText.slice(3).trim();
                       else if (actionText.toLowerCase().startsWith('thanh toán')) actionText = 'đã thanh toán ' + actionText.slice(10).trim();
                       else actionText = `đã ${actionText.charAt(0).toLowerCase() + actionText.slice(1)}`;
                    }

                    const isLast = i === dashboardData.recentActivities.length - 1;
                    return (
                    <div key={i} className="flex gap-5 relative group">
                       <span className="text-[12px] font-semibold text-slate-400 w-11 shrink-0 pt-[1px]">{timeStr}</span>
                       <div className="relative flex-1 pb-5">
                          {!isLast && <div className="absolute left-[-23.5px] top-4 bottom-[-4px] w-[2px] bg-indigo-50 group-hover:bg-indigo-100 transition-colors" />}
                          <div className="absolute left-[-27px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white bg-indigo-400" />
                          <p className="text-[13px] font-medium text-slate-600 leading-snug"><span className="font-bold text-slate-800">{act.userName || act.userEmail}</span> {actionText}</p>
                       </div>
                    </div>
                 )})}
                 {dashboardData.recentActivities.length === 0 && <div className="text-center text-xs text-slate-400 py-6 font-bold flex flex-col items-center justify-center h-full"><span className="opacity-50">Chưa có hoạt động nào</span></div>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

