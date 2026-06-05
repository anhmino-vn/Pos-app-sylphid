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
  TrendingDown
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
import { Order } from '../lib/firebase';
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
    { title: 'Tổng doanh thu', value: formatCurrency(dashboardData.totalRevenue), trend: 'TRONG KỲ', isUp: true, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', description: 'Từ tất cả đơn đã thanh toán' },
    { title: 'Đơn hàng mới', value: dashboardData.newOrdersCount.toLocaleString(), trend: `${dashboardData.todayOrdersCount} ĐƠN HÔM NAY`, isUp: true, icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50', description: 'Trong khoảng thời gian' },
    { title: 'Lịch hẹn mới', value: dashboardData.newAppointmentsCount.toLocaleString(), trend: `${dashboardData.todayBookings.length} LỊCH HÔM NAY`, isUp: true, icon: CalendarIcon, color: 'text-amber-600', bg: 'bg-amber-50', description: 'Trong khoảng thời gian' },
    { title: 'Sản phẩm tồn', value: dashboardData.inventoryTotal.toLocaleString(), trend: dashboardData.lowStockCount > 0 ? `${dashboardData.lowStockCount} SP SẮP HẾT` : 'KHO ỔN ĐỊNH', isUp: dashboardData.lowStockCount === 0, icon: Package, color: 'text-orange-600', bg: 'bg-orange-50', description: 'Số lượng lưu kho thực tế' },
  ];

  return (
    <div className="space-y-10 pb-20">
      <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

      {/* Header Aesthetic */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-8 min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2 md:mb-3">
             <div className="px-2 md:px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[8px] md:text-[9px] font-black tracking-widest uppercase flex items-center gap-1 md:gap-1.5 border border-emerald-100">
                <ShieldCheck className="w-2.5 h-2.5 md:w-3 md:h-3" />
                Hệ thống trực tuyến
             </div>
             <div className="px-2 md:px-3 py-1 bg-slate-900 text-slate-400 rounded-full text-[8px] md:text-[9px] font-black tracking-widest uppercase flex items-center gap-1 md:gap-1.5">
                <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-400" />
                Realtime Data
             </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-slate-900 uppercase italic truncate">Trung tâm vận hành</h1>
          <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mt-1 truncate">POS SYLPHID Enterprise</p>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
           <div className="flex bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100">
             <DateFilter />
           </div>
        </div>
      </div>

      {/* Quick Actions Array */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <button onClick={() => navigate('/orders')} className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-blue-600">
            <PlusCircle className="w-6 h-6 md:w-8 md:h-8" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center">Tạo Đơn Hàng</span>
         </button>
         <button onClick={() => navigate('/customers')} className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-emerald-600">
            <UserPlus className="w-6 h-6 md:w-8 md:h-8" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center">Thêm Khách Hàng</span>
         </button>
         <button onClick={() => navigate('/bookings')} className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-amber-600">
            <Ticket className="w-6 h-6 md:w-8 md:h-8" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center">Đặt Lịch Hẹn</span>
         </button>
         <button onClick={() => navigate('/inventory')} className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-purple-600">
            <Box className="w-6 h-6 md:w-8 md:h-8" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center">Nhập Kho</span>
         </button>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="group bg-white p-4 md:p-8 rounded-[24px] md:rounded-[40px] border border-slate-100 shadow-sm transition-all hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 md:mb-8 gap-3 md:gap-0">
              <div className={cn("w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                <stat.icon className="w-5 h-5 md:w-7 md:h-7" />
              </div>
              <div className={cn(
                "px-2 py-1 md:px-3 rounded-full text-[8px] md:text-[9px] font-black tracking-widest uppercase relative overflow-hidden whitespace-nowrap",
                stat.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              )}>
                {dashboardData.loading ? <div className="absolute inset-0 bg-slate-200 animate-pulse" /> : <span className="relative z-10">{stat.trend}</span>}
              </div>
            </div>
            <p className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-1">{stat.title}</p>
            {dashboardData.loading ? (
               <div className="h-6 md:h-9 mb-1 w-2/3 bg-slate-100 animate-pulse rounded-lg mt-2"></div>
            ) : (
               <h3 className="text-lg md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter italic uppercase">{stat.value}</h3>
            )}
            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold mt-2 md:mt-4 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">{stat.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm mb-4 flex flex-col justify-between">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-4">
              <div>
                <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Phân tích doanh thu</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Biểu đồ doanh thu thực tế</p>
              </div>
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Doanh thu chốt trong kỳ</span>
                 </div>
              </div>
           </div>
           
           <div className="h-[250px] md:h-[320px] w-full">
            {dashboardData.loading ? (
                <div className="w-full h-full bg-slate-100/50 animate-pulse rounded-3xl"></div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                      tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip 
                      cursor={{ stroke: '#2563eb', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-800 text-white">
                              <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">{payload[0].payload.name}</p>
                              <p className="text-lg font-black italic">{formatCurrency(payload[0].value as number)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#2563eb" 
                      strokeWidth={5}
                      fillOpacity={1} 
                      fill="url(#revenueGradient)"
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Real-time Activity / Lịch hẹn */}
        <div className="space-y-8">
           <div className="bg-slate-50 p-10 rounded-[48px] border border-slate-100 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Widget Nổi Bật</h4>
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            
              <div className="space-y-4 mb-8">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lịch hẹn hôm nay</h5>
                  <div className="space-y-3">
                     {dashboardData.loading ? (
                         Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl"></div>)
                     ) : dashboardData.todayBookings.length === 0 ? (
                      <p className="text-[10px] text-slate-300 font-bold uppercase py-2 bg-white rounded-xl text-center border border-slate-50 italic">Không có lịch hẹn</p>
                    ) : dashboardData.todayBookings.slice(0, 3).map(booking => (
                      <div key={booking.id} onClick={() => navigate('/bookings')} className="p-4 bg-white rounded-[20px] border border-slate-100 flex items-center gap-4 hover:shadow-sm transition-all cursor-pointer">
                         <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black leading-none">{booking.bookingTime || (booking.bookingDate?.toDate ? booking.bookingDate.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}</span>
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-900 uppercase truncate">{booking.customerName}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{booking.serviceName}</p>
                         </div>
                         <div className={cn("w-2 h-2 rounded-full", 
                            booking.status === 'completed' ? 'bg-emerald-500' :
                            booking.status === 'confirmed' ? 'bg-blue-500' :
                            booking.status === 'cancelled' ? 'bg-rose-500' : 'bg-amber-500'
                         )} />
                      </div>
                    ))}
                  </div>
              </div>

              <div className="space-y-4 mb-8">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Top Khách Hàng Nổi Bật</h5>
                  <div className="space-y-4">
                     {dashboardData.loading ? (
                         Array(5).fill(0).map((_, i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-2xl"></div>)
                     ) : dashboardData.topCustomers.slice(0, 5).map((cust, i) => {
                        const rankInfo = [
                          { icon: Gem, color: 'text-cyan-500', bg: 'bg-cyan-50' },     // Kim cương
                          { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-50' }, // Vàng
                          { icon: Award, color: 'text-slate-400', bg: 'bg-slate-100' },   // Bạc
                          { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-50' },    // Đồng
                          { icon: Shield, color: 'text-orange-800', bg: 'bg-orange-50' }  // Gỗ
                        ][i] || { icon: Sparkles, color: 'text-slate-400', bg: 'bg-slate-50' };
                        const RankIcon = rankInfo.icon;
                        return (
                        <div key={i} className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/customers')}>
                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100", rankInfo.bg, rankInfo.color)}>
                              <RankIcon className="w-5 h-5" />
                           </div>
                           <div className="flex-1 min-w-0">
                             <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate mb-0.5">{cust.name}</h4>
                             <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-widest">{cust.count} ĐƠN</span>
                                <span className={cn("text-[9px] font-black uppercase", rankInfo.color)}>
                                   {formatCurrency(cust.spend)}
                                </span>
                             </div>
                           </div>
                        </div>
                     )})}
                  </div>
              </div>
              
              <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Top Mặt Hàng Bán Chạy</h5>
                  <div className="space-y-4">
                     {dashboardData.loading ? (
                         Array(5).fill(0).map((_, i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-2xl"></div>)
                     ) : dashboardData.topProducts.slice(0, 5).map((item, i) => (
                        <div key={i} className="flex items-center gap-4 group cursor-pointer">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100 font-black text-slate-300 text-sm italic uppercase">
                              {item.type === 'service' ? <Sparkles className="w-4 h-4 text-purple-200" /> : i + 1}
                           </div>
                           <div className="flex-1 min-w-0">
                           <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate mb-0.5">{item.name}</h4>
                           <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-widest">{item.sales} ĐƠN</span>
                              <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-lg", item.type === 'product' ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500")}>
                                 {item.type === 'product' ? 'Sản Phẩm' : 'Dịch Vụ'}
                              </span>
                           </div>
                           </div>
                        </div>
                     ))}
                  </div>
              </div>

              <div className="mt-auto pt-8">
                 <button onClick={() => navigate('/reports/overview')} className="w-full py-5 bg-white text-slate-900 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200 flex items-center justify-center gap-3">
                    Báo cáo chi tiết
                    <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-[24px] md:rounded-[48px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 md:p-10 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
           <div>
             <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Giao dịch gần đây</h4>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Click vào giao dịch để xem chi tiết</p>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="relative w-full sm:w-auto">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="Tìm kiếm mã HĐ hoặc khách..." 
                   className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-[10px] font-bold outline-none sm:w-64"
                 />
              </div>
           </div>
        </div>
        <div className="flex flex-col">
          {dashboardData.loading ? (
             <div className="p-6 md:p-10 space-y-4">
                 {Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-2xl w-full"></div>)}
             </div>
          ) : (
            <>
              {/* Desktop Header */}
              <div className="hidden lg:grid grid-cols-12 gap-4 px-10 py-6 bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                 <div className="col-span-3">Mã Giao Dịch</div>
                 <div className="col-span-3">Khách Hàng</div>
                 <div className="col-span-2">Tổng Thanh Toán</div>
                 <div className="col-span-2">Trạng Thái</div>
                 <div className="col-span-2 text-right">Thời Gian</div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {filteredRecentOrders.displayOrders.map(order => {
                  const isPaid = order.status === 'paid';
                  const isCancelled = order.status === 'cancelled';
                  const isDebt = order.paymentMethod === 'debt';
                  return (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className="group hover:bg-slate-50/50 transition-all cursor-pointer px-4 py-4 md:px-10 md:py-6 flex items-center justify-between lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center"
                    >
                       <div className="flex items-center gap-2 md:gap-3 lg:col-span-3 shrink-0">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg md:rounded-xl flex items-center justify-center text-white text-[8px] md:text-[10px] font-black italic shrink-0">#TX</div>
                          <div className="min-w-0 flex flex-col justify-center">
                             <span className="font-black text-slate-900 tracking-tight uppercase text-[10px] md:text-sm truncate">#ORD-{order.id?.slice(-6).toUpperCase()}</span>
                             {isDebt && <span className="hidden lg:inline-block mt-1 text-[8px] md:text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-1.5 py-0.5 rounded w-fit">CÔNG NỢ</span>}
                          </div>
                       </div>
                       
                       <div className="flex flex-col justify-center px-2 min-w-0 lg:col-span-3">
                         <p className="font-black text-slate-800 text-[10px] md:text-sm italic uppercase truncate">{order.customerName || 'Khách vãng lai'}</p>
                         <p className="text-[7px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate">{order.customerPhone || '---'}</p>
                       </div>
                       
                       <div className="font-black text-blue-600 text-[11px] md:text-base italic whitespace-nowrap lg:col-span-2 shrink-0 text-right lg:text-left">
                          {formatCurrency(order.totalAmount)}
                       </div>
                       
                       <div className="hidden lg:flex lg:col-span-2 items-center">
                          <span className={cn(
                             "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border whitespace-nowrap",
                             isPaid ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                             order.status === 'unpaid' ? "bg-orange-50 text-orange-600 border-orange-100" :
                             isCancelled ? "bg-rose-50 text-rose-600 border-rose-100" :
                             "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                             {isPaid ? 'Đã thanh toán' : isCancelled ? 'Đã hủy' : order.status === 'unpaid' ? 'Chưa thanh toán' : 'Chờ xử lý'}
                          </span>
                       </div>
                       
                       <div className="hidden lg:flex lg:col-span-2 items-center justify-end">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{order.createdAt ? formatDate(order.createdAt.toDate()) : '...'}</span>
                         <ChevronRight className="w-6 h-6 ml-4 text-slate-200 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                       </div>
                    </div>
                  )
                })}
                {filteredRecentOrders.displayOrders.length === 0 && (
                   <div className="px-10 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 italic">
                      Không có giao dịch nào gần đây
                   </div>
                )}
              </div>
              
              {filteredRecentOrders.hasMore && (
                 <div className="p-4 border-t border-slate-50 flex justify-center bg-slate-50 relative z-10 w-full mt-auto">
                    <button onClick={() => navigate('/orders')} className="py-2.5 px-6 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors shadow-sm w-full md:w-auto">
                       Xem thêm giao dịch
                    </button>
                 </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

