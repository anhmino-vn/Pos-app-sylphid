import React, { useContext, useMemo } from "react";
import { ReportDataContext } from "../Reports";
import { UserCog, DollarSign, Star, Target, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";

export function StaffReport() {
  const { orders, staff, appointments } = useContext(ReportDataContext);

  const { staffStats, sList } = useMemo(() => {
    let totalCommission = 0;
    
    // Map staff stats
    const staffMap = new Map<string, { revenue: number, orders: number, comm: number, appts: number }>();
    
    orders.forEach((o: any) => {
      if (o.status === 'paid' && o.staffId) {
        const rev = o.totalAmount || 0;
        const comm = rev * 0.05; // Giả sử 5% hoa hồng mặc định nếu chưa tính
        totalCommission += comm;

        const existing = staffMap.get(o.staffId) || { revenue: 0, orders: 0, comm: 0, appts: 0 };
        staffMap.set(o.staffId, {
           revenue: existing.revenue + rev,
           orders: existing.orders + 1,
           comm: existing.comm + comm,
           appts: existing.appts
        });
      }
    });

    appointments.forEach((a: any) => {
       if (a.status === 'completed' && a.staffId) {
          const existing = staffMap.get(a.staffId) || { revenue: 0, orders: 0, comm: 0, appts: 0 };
          staffMap.set(a.staffId, {
             ...existing,
             appts: existing.appts + 1
          });
       }
    });

    // Join with staff catalog
    const list = staff.map((s: any) => {
      const metrics = staffMap.get(s.id) || { revenue: 0, orders: 0, comm: 0, appts: 0 };
      return {
         ...s,
         ...metrics
      };
    }).sort((a, b) => b.revenue - a.revenue); // Sort by Revenue DESC

    return {
      staffStats: { 
         totalStaff: staff.length, 
         activeStaff: staff.filter((s: any) => s.status === 'active').length,
         totalCommission 
      },
      sList: list
    };
  }, [orders, staff, appointments]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard title="Tổng Nhân Viên" value={staffStats.totalStaff.toString()} icon={UsersPlaceholder} color="blue" />
         <StatCard title="Đang làm việc" value={staffStats.activeStaff.toString()} icon={UserCog} color="emerald" />
         <StatCard title="Hoa hồng dự kiến" value={formatCurrency(staffStats.totalCommission)} icon={DollarSign} color="amber" />
         <StatCard title="Hiệu suất (Top)" value={sList[0]?.name || 'N/A'} icon={Star} color="purple" />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 overflow-hidden">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Hiệu suất Nhân viên</h3>
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     <th className="pb-3 font-medium">Nhân viên</th>
                     <th className="pb-3 font-medium text-center">Đơn tạo</th>
                     <th className="pb-3 font-medium text-center">Lượt Phục vụ</th>
                     <th className="pb-3 font-medium text-right">Doanh Thu Tạo Ra</th>
                     <th className="pb-3 font-medium text-right">Hoa hồng dự kiến</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                  {sList.map((s, index) => (
                     <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3">
                           <div className="flex items-center gap-3">
                              <span className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-black", index < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}>
                                 #{index + 1}
                              </span>
                              <div>
                                 <p className="font-bold text-slate-900">{s.name}</p>
                                 <p className="text-[10px] text-slate-500 uppercase">{s.role || s.position || 'Nhân viên'}</p>
                              </div>
                           </div>
                        </td>
                        <td className="py-3 font-bold text-slate-700 text-center">{s.orders}</td>
                        <td className="py-3 font-bold text-indigo-600 text-center">{s.appts}</td>
                        <td className="py-3 font-black text-emerald-600 text-right">{formatCurrency(s.revenue)}</td>
                        <td className="py-3 font-black text-purple-600 text-right">{formatCurrency(s.comm)}</td>
                     </tr>
                  ))}
                  {sList.length === 0 && (
                     <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-sm font-medium">Không có dữ liệu nhân sự</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

const UsersPlaceholder = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
)

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
