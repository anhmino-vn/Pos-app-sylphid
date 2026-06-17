import React, { useContext, useMemo } from "react";
import { ReportDataContext } from "../Reports";
import { Package, TrendingUp, AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";

export function ProductsReport() {
  const { orders, products } = useContext(ReportDataContext);

  const { pStats, pList, alerts } = useMemo(() => {
    let totalSold = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    // Aggregate from orders
    const salesMap = new Map<string, { qty: number, rev: number, profit: number }>();
    orders.forEach((o: any) => {
      if (o.status === 'paid' && Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          if (item.type === 'product') {
            const qty = item.quantity || 1;
            const rev = item.price * qty;
            const cost = item.originalPrice || item.price * 0.6;
            const profit = rev - (cost * qty);

            totalSold += qty;
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

    // Join with products catalog
    const list = products.map((p: any) => {
      const sales = salesMap.get(p.id) || { qty: 0, rev: 0, profit: 0 };
      return {
         ...p,
         soldQty: sales.qty,
         revenue: sales.rev,
         profit: sales.profit
      };
    }).sort((a, b) => b.soldQty - a.soldQty); // Sort by sold quantity DESC

    // Alerts for low stock
    const alertsList = list.filter(p => (p.stock || 0) < 10);

    return {
      pStats: { totalSold, totalRevenue, totalProfit, totalInStock: list.reduce((acc, p) => acc + (p.stock || 0), 0) },
      pList: list,
      alerts: alertsList
    };
  }, [orders, products]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard title="Sản phẩm đã bán" value={pStats.totalSold.toLocaleString()} icon={Package} color="blue" />
         <StatCard title="Doanh thu SP" value={formatCurrency(pStats.totalRevenue)} icon={TrendingUp} color="emerald" />
         <StatCard title="Lợi nhuận SP" value={formatCurrency(pStats.totalProfit)} icon={ArrowUpRight} color="purple" />
         <StatCard title="Tổng tồn kho" value={pStats.totalInStock.toLocaleString()} icon={ArrowDownRight} color="amber" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Top Products */}
         <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 overflow-hidden">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Phân tích Sản Phẩm (ABC Analysis)</h3>
            <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="pb-3 font-medium">Sản phẩm</th>
                        <th className="pb-3 font-medium">Đã Bán</th>
                        <th className="pb-3 font-medium">Doanh Thu</th>
                        <th className="pb-3 font-medium">Lợi Nhuận</th>
                        <th className="pb-3 font-medium text-right">Tồn Kho</th>
                     </tr>
                  </thead>
                  <tbody className="text-sm">
                     {pList.slice(0, 50).map((p, index) => (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                           <td className="py-3">
                              <div className="flex items-center gap-3">
                                 <span className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-black", index < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}>
                                    #{index + 1}
                                 </span>
                                 <div>
                                    <p className="font-bold text-slate-900">{p.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">{p.category || 'Chưa phân loại'}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="py-3 font-black text-slate-700">{p.soldQty}</td>
                           <td className="py-3 font-bold text-emerald-600">{formatCurrency(p.revenue)}</td>
                           <td className="py-3 font-bold text-purple-600">{formatCurrency(p.profit)}</td>
                           <td className="py-3 text-right">
                              <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", (p.stock || 0) < 10 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600')}>
                                 {p.stock || 0}
                              </span>
                           </td>
                        </tr>
                     ))}
                     {pList.length === 0 && (
                        <tr>
                           <td colSpan={5} className="py-8 text-center text-slate-400 text-sm font-medium">Không có dữ liệu</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Warnings */}
         <div className="bg-rose-50/30 rounded-[32px] border border-rose-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
               <AlertTriangle className="w-5 h-5 text-rose-500" />
               <h3 className="font-black text-rose-900 uppercase tracking-widest text-xs">Cảnh báo Tồn Kho</h3>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[500px]">
               {alerts.length === 0 ? (
                  <p className="text-sm text-emerald-600 font-bold text-center py-8">Tất cả sản phẩm đều đủ tồn kho.</p>
               ) : (
                  alerts.map(p => (
                     <div key={p.id} className="bg-white p-3 rounded-xl border border-rose-100 flex justify-between items-center shadow-sm">
                        <div className="overflow-hidden">
                           <p className="text-xs font-bold text-slate-900 truncate" title={p.name}>{p.name}</p>
                           <p className="text-[10px] text-slate-500 uppercase mt-0.5">Mã: {p.sku || 'N/A'}</p>
                        </div>
                        <div className="shrink-0 text-right ml-2">
                           <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Tồn</p>
                           <p className="text-lg font-black text-rose-600 leading-none">{p.stock || 0}</p>
                        </div>
                     </div>
                  ))
               )}
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
