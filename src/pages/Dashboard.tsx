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
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { useNavigate } from 'react-router-dom';

import { DateFilter } from '../components/DateFilter';
import { useDateFilterStore } from '../store/useDateFilterStore';
import { useDashboardData } from '../hooks/useDashboardData';

export function Dashboard() {
  const navigate = useNavigate();
  const { dateRange } = useDateFilterStore();
  const dashboardData = useDashboardData(dateRange);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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

  const stats = [
    { title: 'Doanh thu hôm nay', value: formatCurrency(dashboardData.todayRevenue), trend: '+15% so với hôm qua', isUp: true, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Đơn hàng hôm nay', value: `${dashboardData.todayOrdersCount} đơn`, trend: '+8% so với hôm qua', isUp: true, icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Khách hàng mới', value: `${dashboardData.todayNewCustomers} khách`, trend: '+7% so với hôm qua', isUp: true, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Lịch hẹn hôm nay', value: `${dashboardData.todayBookings.length} lịch`, trend: '+5% so với hôm qua', isUp: true, icon: CalendarIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Công nợ khách hàng', value: formatCurrency(dashboardData.totalUnpaidDebt), trend: `${dashboardData.unpaidCustomersCount} khách nợ`, isUp: false, icon: Users, color: 'text-rose-600', bg: 'bg-rose-50' },
    { title: 'Referral hôm nay', value: `${dashboardData.todayReferrals} khách`, trend: '+12% so với hôm qua', isUp: true, icon: Gift, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Giá trị tồn kho', value: formatCurrency(dashboardData.inventoryTotal * 150000), trend: '+3% so với hôm qua', isUp: true, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' }, // Mocking inventory value
    { title: 'Lợi nhuận hôm nay', value: formatCurrency(dashboardData.todayProfit), trend: '+10% so với hôm qua', isUp: true, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const recentActivities = [
     { time: '10:05', title: 'Nguyễn Thị Lan đã tạo đơn hàng #DH000125 cho khách Nguyễn Văn A', dot: 'bg-blue-500' },
     { time: '10:10', title: `Trần Văn Minh đã thanh toán đơn hàng #DH000125 - ${formatCurrency(2500000)}`, dot: 'bg-emerald-500' },
     { time: '10:20', title: 'Lê Hoàng Anh đã thêm khách hàng mới Nguyễn Thị Hương', dot: 'bg-purple-500' },
     { time: '10:25', title: 'Phạm Thu Hà đã nhập kho phiếu #NK00045 - 15 sản phẩm', dot: 'bg-orange-500' },
     { time: '10:40', title: 'Hoàng Quốc Bảo đã đặt lịch hẹn cho khách Trần Thị B lúc 10:00', dot: 'bg-blue-500' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tổng quan</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Báo cáo tổng quan tình hình kinh doanh</p>
        </div>
      </div>

      {/* 8 Stats KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-[16px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="flex items-start justify-between mb-2">
               <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">{stat.title}</p>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">{stat.value}</h3>
               </div>
               <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", stat.bg, stat.color)}>
                  <stat.icon className="w-4 h-4" />
               </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
               {stat.isUp ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
               <span className={cn("text-[11px] font-bold", stat.isUp ? 'text-emerald-600' : 'text-rose-600')}>{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Row: Chart + Recent Orders + Debt/Referral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart */}
        <div className="lg:col-span-6 bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex flex-col">
           <div className="flex items-center justify-between mb-6">
              <h4 className="text-base font-bold text-slate-900">Doanh thu & Lợi nhuận</h4>
              <div className="flex gap-2">
                 {['7 ngày', '30 ngày', '90 ngày', '12 tháng'].map((t, idx) => (
                    <button key={t} className={cn("px-3 py-1 text-[11px] font-bold rounded-lg transition-colors", idx === 0 ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50")}>{t}</button>
                 ))}
              </div>
           </div>
           <div className="flex gap-6 mb-4 px-2">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-sm" /><span className="text-xs font-bold text-slate-600">Doanh thu</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm" /><span className="text-xs font-bold text-slate-600">Lợi nhuận</span></div>
           </div>
           <div className="h-[250px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                       <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} tickFormatter={v => `${v/1000000}M`} />
                    <Tooltip cursor={{ stroke: '#cbd5e1' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fill="url(#colorRev)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-3 bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex flex-col">
           <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-slate-900">Đơn hàng gần đây</h4>
              <button onClick={() => navigate('/orders')} className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
           </div>
           <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
              {filteredRecentOrders.displayOrders.slice(0, 5).map(o => (
                 <div key={o.id} onClick={() => setSelectedOrder(o)} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 cursor-pointer group">
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
           </div>
        </div>

        {/* Debt & Referrals */}
        <div className="lg:col-span-3 flex flex-col gap-6">
           <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                 <h4 className="text-base font-bold text-slate-900">Công nợ cần thu</h4>
                 <button onClick={() => navigate('/customers')} className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
              </div>
              <h3 className="text-2xl font-black text-rose-600 tracking-tight">{formatCurrency(dashboardData.totalUnpaidDebt)}</h3>
              <p className="text-xs font-bold text-slate-500 mt-1">Tổng công nợ</p>
              
              <div className="flex items-center justify-between mt-4 p-3 bg-rose-50 rounded-xl">
                 <span className="text-xs font-bold text-rose-600">{dashboardData.unpaidCustomersCount} khách hàng quá hạn</span>
                 <button className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-rose-700">Thu công nợ</button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-4">
                 <h4 className="text-base font-bold text-slate-900">Top người giới thiệu</h4>
                 <button className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
              </div>
              <div className="space-y-3">
                 {dashboardData.topCustomers.slice(0, 5).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                       <div className="flex items-center gap-3 w-1/2 min-w-0">
                          <span className="font-bold text-slate-400 w-3">{i+1}</span>
                          <span className="font-bold text-slate-800 truncate">{c.name}</span>
                       </div>
                       <span className="text-slate-500 w-1/4 text-center">{c.count} khách</span>
                       <span className="font-bold text-slate-900 w-1/4 text-right">{formatCurrency(c.spend)}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Bottom Row: 4 Columns List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* Lịch hẹn */}
         <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <h4 className="text-base font-bold text-slate-900">Lịch hẹn hôm nay</h4>
               <button onClick={() => navigate('/bookings')} className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
            </div>
            <div className="space-y-4">
               {dashboardData.todayBookings.slice(0, 4).map(b => (
                  <div key={b.id} className="flex items-start gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                     <span className="text-xs font-black text-blue-600 w-10 shrink-0">{b.bookingTime || '---'}</span>
                     <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{b.customerName}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{b.serviceName}</p>
                     </div>
                     <div className="text-[10px] font-bold text-slate-600 w-16 text-right truncate">Lan</div>
                  </div>
               ))}
            </div>
            <button onClick={() => navigate('/bookings')} className="text-[11px] font-bold text-blue-600 mt-4 block">Xem thêm {dashboardData.todayBookings.length > 4 ? dashboardData.todayBookings.length - 4 : 0} lịch hẹn khác</button>
         </div>

         {/* Top Sản Phẩm */}
         <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <h4 className="text-base font-bold text-slate-900">Top sản phẩm bán chạy</h4>
               <button className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
            </div>
            <div className="space-y-4">
               {dashboardData.topProducts.filter(p => p.type !== 'service').slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                     <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</span>
                        <div className="min-w-0 pr-2">
                           <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                           <p className="text-[10px] text-slate-500 truncate mt-0.5">Đã bán: {p.sales}</p>
                        </div>
                     </div>
                     <span className="text-xs font-bold text-slate-900 shrink-0">{formatCurrency(p.sales * p.salePrice)}</span>
                  </div>
               ))}
            </div>
         </div>

         {/* Top Dịch Vụ */}
         <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <h4 className="text-base font-bold text-slate-900">Top dịch vụ bán chạy</h4>
               <button className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
            </div>
            <div className="space-y-4">
               {dashboardData.topProducts.filter(p => p.type === 'service').slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                     <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</span>
                        <div className="min-w-0 pr-2">
                           <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                           <p className="text-[10px] text-slate-500 truncate mt-0.5">Đã bán: {p.sales}</p>
                        </div>
                     </div>
                     <span className="text-xs font-bold text-slate-900 shrink-0">{formatCurrency(p.sales * p.salePrice)}</span>
                  </div>
               ))}
               {dashboardData.topProducts.filter(p => p.type === 'service').length === 0 && (
                  <div className="text-center text-xs font-bold text-slate-400 py-4">Chưa có dữ liệu dịch vụ</div>
               )}
            </div>
         </div>

         {/* Top Nhân Viên (Mock) */}
         <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <h4 className="text-base font-bold text-slate-900">Top nhân viên</h4>
               <button className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
            </div>
            <div className="space-y-4">
               {[
                  { name: 'Nguyễn Thị Lan', rev: 85000000 },
                  { name: 'Trần Văn Minh', rev: 62000000 },
                  { name: 'Lê Hoàng Anh', rev: 48000000 },
                  { name: 'Phạm Thu Hà', rev: 36500000 },
                  { name: 'Hoàng Quốc Bảo', rev: 28000000 },
               ].map((emp, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                     <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-bold text-slate-400 text-xs w-3">{i+1}</span>
                        <p className="text-xs font-bold text-slate-900 truncate">{emp.name}</p>
                     </div>
                     <span className="text-xs font-bold text-slate-900 shrink-0">{formatCurrency(emp.rev)}</span>
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* Warnings & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         {/* Warnings */}
         <div className="lg:col-span-6 flex flex-col">
            <h4 className="text-base font-bold text-slate-900 mb-4">Cảnh báo</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-orange-100 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                     <AlertTriangle className="w-4 h-4 text-orange-600" />
                     <span className="text-lg font-black text-orange-600">{dashboardData.lowStockCount} sản phẩm</span>
                  </div>
                  <span className="text-[10px] font-bold text-orange-700">Sắp hết hàng</span>
                  <span className="text-[9px] font-bold text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Xem chi tiết</span>
               </div>
               
               <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-rose-100 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                     <Users className="w-4 h-4 text-rose-600" />
                     <span className="text-lg font-black text-rose-600">{dashboardData.unpaidCustomersCount} khách hàng</span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700">Nợ quá hạn</span>
                  <span className="text-[9px] font-bold text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Xem chi tiết</span>
               </div>

               <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-emerald-100 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                     <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                     <span className="text-lg font-black text-emerald-600">8 khách hàng</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700">Sắp hết liệu trình</span>
                  <span className="text-[9px] font-bold text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Xem chi tiết</span>
               </div>

               <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-blue-100 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                     <CalendarIcon className="w-4 h-4 text-blue-600" />
                     <span className="text-lg font-black text-blue-600">{dashboardData.todayBookings.length} lịch hẹn</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700">Hôm nay</span>
                  <span className="text-[9px] font-bold text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Xem chi tiết</span>
               </div>
            </div>
         </div>

         {/* Activities */}
         <div className="lg:col-span-6 bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
               <h4 className="text-base font-bold text-slate-900">Hoạt động gần đây</h4>
               <button className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
            </div>
            <div className="space-y-4">
               {recentActivities.map((act, i) => (
                  <div key={i} className="flex gap-4">
                     <span className="text-xs font-bold text-slate-400 w-10 shrink-0 pt-0.5">{act.time}</span>
                     <div className="relative flex gap-4 w-full">
                        <div className="absolute left-1.5 top-2 bottom-[-16px] w-px bg-slate-100 last:hidden" />
                        <div className={cn("w-3 h-3 rounded-full shrink-0 relative z-10 mt-0.5 shadow-sm border-2 border-white", act.dot)} />
                        <p className="text-xs font-medium text-slate-700 leading-relaxed pb-2">{act.title}</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}

