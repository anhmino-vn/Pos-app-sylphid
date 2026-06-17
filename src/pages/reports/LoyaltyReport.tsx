import React, { useContext, useMemo } from "react";
import { ReportDataContext } from "../Reports";
import { Star, Award, Gift, TrendingUp, Search } from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";

export function LoyaltyReport() {
  const { customers, orders } = useContext(ReportDataContext);

  const { loyStats, memberTiers } = useMemo(() => {
    let totalPoints = 0;
    let totalUsedPoints = 0;
    let totalMembers = 0;

    const tiers = {
       "Mới": 0,
       "Đồng": 0,
       "Bạc": 0,
       "Vàng": 0,
       "Kim Cương": 0
    };

    customers.forEach((c: any) => {
       if (c.status === 'active' && !c.hidden) {
          totalMembers++;
          totalPoints += c.points || 0;
          
          // Categorize tier based on totalSpent
          const spent = c.totalSpent || 0;
          if (spent >= 100000000) tiers["Kim Cương"]++;
          else if (spent >= 50000000) tiers["Vàng"]++;
          else if (spent >= 20000000) tiers["Bạc"]++;
          else if (spent >= 5000000) tiers["Đồng"]++;
          else tiers["Mới"]++;
       }
    });

    // Calculate used points from orders (Assuming orders have pointsUsed field)
    orders.forEach((o: any) => {
       if (o.status === 'paid') {
          totalUsedPoints += o.pointsUsed || 0;
       }
    });

    return {
       loyStats: { totalPoints, totalUsedPoints, totalMembers },
       memberTiers: [
          { name: "Kim Cương", count: tiers["Kim Cương"], color: "bg-purple-100 text-purple-700 border-purple-200" },
          { name: "Vàng", count: tiers["Vàng"], color: "bg-amber-100 text-amber-700 border-amber-200" },
          { name: "Bạc", count: tiers["Bạc"], color: "bg-slate-200 text-slate-700 border-slate-300" },
          { name: "Đồng", count: tiers["Đồng"], color: "bg-orange-100 text-orange-800 border-orange-200" },
          { name: "Mới", count: tiers["Mới"], color: "bg-blue-50 text-blue-600 border-blue-100" },
       ]
    };
  }, [customers, orders]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <StatCard title="Tổng Thành Viên" value={loyStats.totalMembers.toString()} icon={Award} color="blue" />
         <StatCard title="Điểm Tích Lũy Khách Hàng Đang Có" value={loyStats.totalPoints.toLocaleString()} icon={Star} color="amber" />
         <StatCard title="Điểm Đã Tiêu Quy Ra Tiền" value={formatCurrency(loyStats.totalUsedPoints * 1000)} icon={Gift} color="emerald" /> {/* Giả sử 1 điểm = 1000đ */}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 overflow-hidden">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Cơ Cấu Hạng Thẻ</h3>
         
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {memberTiers.map(t => (
               <div key={t.name} className={cn("p-4 rounded-2xl border text-center", t.color)}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Hạng {t.name}</p>
                  <p className="text-3xl font-black">{t.count}</p>
                  <p className="text-[10px] font-bold mt-1 opacity-70">Thành viên</p>
               </div>
            ))}
         </div>

         <div className="mt-8 pt-8 border-t border-slate-100">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Top Khách Hàng Chi Tiêu Nhiều Nhất</h3>
            <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="pb-3 font-medium">Khách Hàng</th>
                        <th className="pb-3 font-medium text-center">Số Điện Thoại</th>
                        <th className="pb-3 font-medium text-right">Tổng Chi Tiêu</th>
                        <th className="pb-3 font-medium text-right">Điểm Đang Có</th>
                     </tr>
                  </thead>
                  <tbody className="text-sm">
                     {customers.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 10).map((c: any, index: number) => (
                        <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                           <td className="py-3">
                              <div className="flex items-center gap-3">
                                 <span className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-black", index < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}>
                                    #{index + 1}
                                 </span>
                                 <div>
                                    <p className="font-bold text-slate-900">{c.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">{c.customerGroup || 'Cơ bản'}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="py-3 font-bold text-slate-600 text-center">{c.phone}</td>
                           <td className="py-3 font-black text-emerald-600 text-right">{formatCurrency(c.totalSpent || 0)}</td>
                           <td className="py-3 font-black text-amber-500 text-right">{c.points || 0}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
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
  };

  return (
    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
      <div className={cn("absolute -right-4 -bottom-4 opacity-10", colors[color].split(' ')[1])}>
        <Icon className="w-32 h-32" />
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-3xl font-black text-slate-900 tracking-tight truncate relative z-10">{value}</p>
      </div>
    </div>
  );
}
