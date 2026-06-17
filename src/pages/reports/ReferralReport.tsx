import React, { useContext, useMemo } from "react";
import { ReportDataContext } from "../Reports";
import { Users, UserPlus, Coins, Network } from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";

export function ReferralReport() {
  const { customers, orders } = useContext(ReportDataContext);

  const { refStats, refList } = useMemo(() => {
    let totalReferred = 0;
    let totalCommission = 0;

    // Build the referral mapping
    const networkMap = new Map<string, { referredCount: number, revenueGenerated: number, commissionEarned: number }>();

    customers.forEach((c: any) => {
       if (c.referrerId) {
          totalReferred++;
          const existing = networkMap.get(c.referrerId) || { referredCount: 0, revenueGenerated: 0, commissionEarned: 0 };
          networkMap.set(c.referrerId, {
             ...existing,
             referredCount: existing.referredCount + 1
          });
       }
    });

    // Map revenue back to referrer
    orders.forEach((o: any) => {
       if (o.status === 'paid' && o.customerId) {
          const customer = customers.find((c: any) => c.id === o.customerId);
          if (customer && customer.referrerId) {
             const rev = o.totalAmount || 0;
             const comm = rev * 0.1; // Giả sử 10% hoa hồng giới thiệu
             totalCommission += comm;

             const existing = networkMap.get(customer.referrerId) || { referredCount: 0, revenueGenerated: 0, commissionEarned: 0 };
             networkMap.set(customer.referrerId, {
                referredCount: existing.referredCount,
                revenueGenerated: existing.revenueGenerated + rev,
                commissionEarned: existing.commissionEarned + comm
             });
          }
       }
    });

    // Join with customers list to get Referrer info
    const list = Array.from(networkMap.entries()).map(([referrerId, stats]) => {
       const user = customers.find((c: any) => c.id === referrerId) || { name: 'Người dùng không xác định', phone: '---' };
       return {
          id: referrerId,
          name: user.name,
          phone: user.phone,
          ...stats
       };
    }).sort((a, b) => b.revenueGenerated - a.revenueGenerated);

    return {
       refStats: { totalReferred, totalCommission, topReferrer: list[0]?.name || '---' },
       refList: list
    };
  }, [customers, orders]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <StatCard title="Tổng số khách được giới thiệu" value={refStats.totalReferred.toString()} icon={UserPlus} color="blue" />
         <StatCard title="Tổng hoa hồng đã trả" value={formatCurrency(refStats.totalCommission)} icon={Coins} color="emerald" />
         <StatCard title="Người giới thiệu xuất sắc nhất" value={refStats.topReferrer} icon={Network} color="purple" />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 overflow-hidden">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Mạng lưới giới thiệu (Referral Network)</h3>
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     <th className="pb-3 font-medium">Người giới thiệu</th>
                     <th className="pb-3 font-medium text-center">Số khách giới thiệu</th>
                     <th className="pb-3 font-medium text-right">Doanh thu tạo ra</th>
                     <th className="pb-3 font-medium text-right">Hoa hồng nhận được</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                  {refList.map((r, index) => (
                     <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                 <Users className="w-4 h-4 text-slate-500" />
                              </div>
                              <div>
                                 <p className="font-bold text-slate-900">{r.name}</p>
                                 <p className="text-[10px] text-slate-500">{r.phone}</p>
                              </div>
                           </div>
                        </td>
                        <td className="py-3 font-bold text-indigo-600 text-center">{r.referredCount}</td>
                        <td className="py-3 font-black text-emerald-600 text-right">{formatCurrency(r.revenueGenerated)}</td>
                        <td className="py-3 font-black text-purple-600 text-right">{formatCurrency(r.commissionEarned)}</td>
                     </tr>
                  ))}
                  {refList.length === 0 && (
                     <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-sm font-medium">Chưa có dữ liệu người giới thiệu</td>
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
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden">
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
