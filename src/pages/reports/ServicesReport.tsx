import React, { useContext, useMemo } from "react";
import { ReportDataContext } from "../Reports";
import { Sparkles, Activity, Clock, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";

export function ServicesReport() {
  const { orders, services, appointments } = useContext(ReportDataContext);

  const { sStats, sList } = useMemo(() => {
    let totalUses = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    // Aggregate from orders (Revenue & Profit)
    const salesMap = new Map<string, { qty: number, rev: number, profit: number }>();
    orders.forEach((o: any) => {
      if (o.status === 'paid' && Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          if (item.type === 'service') {
            const qty = item.quantity || 1;
            const rev = item.price * qty;
            const cost = item.originalPrice || item.price * 0.2; // Services usually have high margin (80%)
            const profit = rev - (cost * qty);

            totalUses += qty;
            totalRevenue += rev;
            totalProfit += profit;

            const existing = salesMap.get(item.id) || { qty: 0, rev: 0, profit: 0 };
            salesMap.set(item.id, {
               qty: existing.qty + qty,
               rev: existing.rev + rev,
               profit: existing.profit + profit
            });
          }
        });
      }
    });

    // Aggregate from appointments (Actual executions)
    const execMap = new Map<string, number>();
    appointments.forEach((a: any) => {
      if (['completed'].includes(a.status) && a.serviceId) {
        execMap.set(a.serviceId, (execMap.get(a.serviceId) || 0) + 1);
      }
    });

    // Join with services catalog
    const list = services.map((s: any) => {
      const sales = salesMap.get(s.id) || { qty: 0, rev: 0, profit: 0 };
      const execs = execMap.get(s.id) || 0;
      return {
         ...s,
         soldQty: sales.qty,
         execQty: execs,
         revenue: sales.rev,
         profit: sales.profit
      };
    }).sort((a, b) => b.revenue - a.revenue); // Sort by Revenue DESC

    return {
      sStats: { totalUses, totalRevenue, totalProfit, totalExecs: appointments.filter((a: any) => a.status === 'completed').length },
      sList: list
    };
  }, [orders, services, appointments]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard title="Dịch vụ Đã Bán" value={sStats.totalUses.toLocaleString()} icon={Sparkles} color="blue" />
         <StatCard title="Doanh thu DV" value={formatCurrency(sStats.totalRevenue)} icon={TrendingUp} color="emerald" />
         <StatCard title="Lợi nhuận DV" value={formatCurrency(sStats.totalProfit)} icon={Activity} color="purple" />
         <StatCard title="Số lượt thực hiện (Appt)" value={sStats.totalExecs.toLocaleString()} icon={Clock} color="amber" />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 overflow-hidden">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Hiệu suất Dịch vụ</h3>
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     <th className="pb-3 font-medium">Dịch vụ</th>
                     <th className="pb-3 font-medium text-center">Lượt Bán</th>
                     <th className="pb-3 font-medium text-center">Lượt Thực Hiện</th>
                     <th className="pb-3 font-medium text-right">Doanh Thu</th>
                     <th className="pb-3 font-medium text-right">Lợi Nhuận</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                  {sList.slice(0, 50).map((s, index) => (
                     <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3">
                           <div className="flex items-center gap-3">
                              <span className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-black", index < 3 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500')}>
                                 #{index + 1}
                              </span>
                              <div>
                                 <p className="font-bold text-slate-900">{s.name}</p>
                                 <p className="text-[10px] text-slate-500 uppercase">{s.category || 'Chưa phân loại'}</p>
                              </div>
                           </div>
                        </td>
                        <td className="py-3 font-black text-slate-700 text-center">{s.soldQty}</td>
                        <td className="py-3 font-bold text-indigo-600 text-center">{s.execQty}</td>
                        <td className="py-3 font-black text-emerald-600 text-right">{formatCurrency(s.revenue)}</td>
                        <td className="py-3 font-black text-purple-600 text-right">{formatCurrency(s.profit)}</td>
                     </tr>
                  ))}
                  {sList.length === 0 && (
                     <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-sm font-medium">Không có dữ liệu</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <div className="bg-white p-4 lg:p-6 rounded-[24px] border border-slate-100 shadow-sm">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">{value}</p>
      </div>
    </div>
  );
}
