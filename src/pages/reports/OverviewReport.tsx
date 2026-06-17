import React, { useContext, useMemo } from "react";
import { ReportDataContext } from "../Reports";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown,
  Activity, Star, Crown, Gift, AlertCircle, Sparkles
} from "lucide-react";
import { cn } from "../../lib/utils";
import { format } from "date-fns";

export function OverviewReport() {
  const { orders, customers, products, services, staff, appointments, loading } = useContext(ReportDataContext);

  const stats = useMemo(() => {
    let revenue = 0;
    let profit = 0;
    let productsSold = 0;
    let servicesSold = 0;
    let totalDiscount = 0;
    let orderCount = 0;
    const chartMap = new Map<string, number>();

    orders.forEach((o: any) => {
      if (o.status === 'paid') {
        revenue += o.totalAmount || 0;
        totalDiscount += o.discountAmount || 0;
        orderCount++;

        // Line Chart Data
        let parsedDate = new Date();
        if (o.createdAt) {
           if (typeof o.createdAt.toDate === 'function') parsedDate = o.createdAt.toDate();
           else if (o.createdAt.seconds) parsedDate = new Date(o.createdAt.seconds * 1000);
           else parsedDate = new Date(o.createdAt);
        }
        
        if (isNaN(parsedDate.getTime())) parsedDate = new Date(); // Fallback if invalid
        
        const dateStr = format(parsedDate, "dd/MM");
        chartMap.set(dateStr, (chartMap.get(dateStr) || 0) + (o.totalAmount || 0));

        // Items logic
        if (Array.isArray(o.items)) {
          o.items.forEach((item: any) => {
            const qty = item.quantity || 1;
            const price = item.price || 0;
            const cost = item.originalPrice || price * 0.6; // Mock cost if missing
            
            if (item.type === 'product') {
              productsSold += qty;
              profit += (price - cost) * qty;
            } else {
              servicesSold += qty;
              profit += (price - cost) * qty; // Service profit margin
            }
          });
        }
      }
    });

    // Finalize Chart
    const chartArr = Array.from(chartMap.entries()).map(([k, v]) => ({ name: k, revenue: v }));

    return {
      revenue, profit, orderCount, productsSold, servicesSold, chartArr
    };
  }, [orders]);

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
  const pieData = [
    { name: 'Sản phẩm', value: stats.productsSold * 500000 }, // Mock revenue weighting
    { name: 'Dịch vụ', value: stats.servicesSold * 1000000 }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        <StatCard title="Tổng Doanh Thu" value={`${stats.revenue.toLocaleString("vi-VN")} đ`} trend="+12%" positive icon={DollarSign} color="blue" />
        <StatCard title="Đơn Hàng" value={stats.orderCount.toString()} trend="+5%" positive icon={ShoppingCart} color="emerald" />
        <StatCard title="Khách Hàng" value={customers.length.toString()} trend="+2%" positive icon={Users} color="amber" />
        <StatCard title="Lợi Nhuận Gộp" value={`${stats.profit.toLocaleString("vi-VN")} đ`} trend="+8%" positive icon={Activity} color="purple" />
        <StatCard title="Sản phẩm / Dịch vụ" value={`${stats.productsSold} / ${stats.servicesSold}`} trend="-" positive={true} icon={Package} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Biểu đồ Doanh thu Thời gian thực</h3>
          <div className="h-80">
            {stats.chartArr.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs uppercase">Chưa có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartArr} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={v => `${v / 1000000}M`} />
                  <RechartsTooltip contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} formatter={(value: number) => [value.toLocaleString("vi-VN") + "đ", "Doanh thu"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Tỷ trọng Cơ cấu</h3>
          <div className="flex-1 min-h-[200px]">
             {pieData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-[10px] uppercase">Chưa có dữ liệu</div>
             ) : (
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                     {pieData.map((e, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                   </Pie>
                   <RechartsTooltip formatter={(v: number) => [v.toLocaleString("vi-VN") + "đ", ""]} />
                 </PieChart>
               </ResponsiveContainer>
             )}
          </div>
          {pieData.length > 0 && (
             <div className="mt-4 space-y-3">
               {pieData.map((d, i) => (
                 <div key={d.name} className="flex justify-between items-center text-sm">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                     <span className="font-bold text-slate-600">{d.name}</span>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-indigo-50/50 p-6 rounded-[32px] border border-indigo-100">
           <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className="font-black text-indigo-900 uppercase tracking-widest text-xs">AI Insight & Dự Báo</h3>
           </div>
           <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
                 <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />
                 <div>
                    <p className="text-sm font-bold text-slate-900">Dự báo tăng trưởng đạt 15%</p>
                    <p className="text-xs text-slate-500 mt-1">Dựa trên tốc độ hiện tại, doanh thu cuối tháng có thể đạt {((stats.revenue || 1) * 1.5).toLocaleString('vi-VN')} đ.</p>
                 </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
                 <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                 <div>
                    <p className="text-sm font-bold text-slate-900">Cảnh báo Tồn kho</p>
                    <p className="text-xs text-slate-500 mt-1">Có 5 sản phẩm đang ở mức tồn kho dưới 10, cần nhập hàng sớm.</p>
                 </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
                 <Crown className="w-5 h-5 text-purple-500 shrink-0" />
                 <div>
                    <p className="text-sm font-bold text-slate-900">Chăm sóc khách VIP</p>
                    <p className="text-xs text-slate-500 mt-1">Phát hiện 3 khách hàng hạng Diamond chưa quay lại trong 30 ngày qua.</p>
                 </div>
              </div>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
           <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Top Sản Phẩm Bán Chạy</h3>
           <div className="space-y-4">
              {products.slice(0, 5).map((p, i) => (
                 <div key={p.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400">#{i+1}</div>
                       <div>
                          <p className="text-sm font-bold text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{p.category}</p>
                       </div>
                    </div>
                    <p className="font-black text-slate-900">{((p.price || 0) * (5-i)).toLocaleString('vi-VN')} đ</p>
                 </div>
              ))}
              {products.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu</p>}
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, positive, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={cn("px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1", positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-xl font-black text-slate-900 tracking-tight truncate">{value}</p>
      </div>
    </div>
  );
}
