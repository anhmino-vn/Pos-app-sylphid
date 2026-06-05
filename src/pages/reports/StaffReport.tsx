import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, format } from 'date-fns';
import { Loader2, UserCog, Users, Receipt, Eye, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Order } from '../../lib/firebase';

interface StaffStats {
  email: string;
  name: string;
  invoicesCount: number;
  revenue: number;
  uniqueCustomers: number;
  orders: Order[];
}

export function StaffReport({ dateRange }: { dateRange: string }) {
  const [loading, setLoading] = useState(true);
  const [staffStats, setStaffStats] = useState<StaffStats[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffStats | null>(null);

  useEffect(() => {
    let startDate: Date;
    let endDate = endOfDay(new Date());
    const now = new Date();

    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case 'week':
        startDate = startOfDay(subDays(now, 7));
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default:
        startDate = startOfMonth(now);
    }

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const qOrders = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp)
    );

    setLoading(true);
    getDocs(qOrders)
      .then(snap => {
        const statsMap = new Map<string, StaffStats>();

        snap.docs.forEach(doc => {
          const order = { id: doc.id, ...doc.data() } as Order;
          if (order.status !== 'paid') return;
          
          let creatorEmail = order.createdBy || 'unknown';
          let creatorName = (order as any).creatorName || creatorEmail;
          
          if (!statsMap.has(creatorEmail)) {
             statsMap.set(creatorEmail, {
                email: creatorEmail,
                name: creatorName === 'unknown' ? 'Không xác định' : creatorName,
                invoicesCount: 0,
                revenue: 0,
                uniqueCustomers: 0,
                orders: []
             });
          }
          
          const sStat = statsMap.get(creatorEmail)!;
          sStat.invoicesCount++;
          sStat.revenue += order.totalAmount || 0;
          sStat.orders.push(order);
        });

        // Compute unique customers
        const finalStats = Array.from(statsMap.values()).map(s => {
           const uniqueIds = new Set(s.orders.map(o => o.customerId || 'retail'));
           s.orders.sort((a,b) => {
               const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt as any).getTime();
               const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt as any).getTime();
               return tb - ta;
           });
           return {
              ...s,
              uniqueCustomers: uniqueIds.size
           };
        });

        finalStats.sort((a, b) => b.revenue - a.revenue);
        setStaffStats(finalStats);
        setLoading(false);
      }).catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, [dateRange]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4">Hiệu suất nhân viên</h3>
         {loading ? (
             <div className="py-12 flex justify-center text-slate-300">
                 <Loader2 className="w-8 h-8 animate-spin" />
             </div>
         ) : staffStats.length === 0 ? (
             <div className="py-12 text-center text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                 Không có dữ liệu nhân viên nào trong kỳ
             </div>
         ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead>
                         <tr className="border-b border-slate-100 uppercase tracking-widest text-[10px] text-slate-400">
                             <th className="py-3 px-4 font-black">Nhân viên</th>
                             <th className="py-3 px-4 font-black text-right">Email</th>
                             <th className="py-3 px-4 font-black text-right">Số hóa đơn</th>
                             <th className="py-3 px-4 font-black text-right">Khách hàng phục vụ</th>
                             <th className="py-3 px-4 font-black text-right">Doanh thu mang lại</th>
                             <th className="py-3 px-4 font-black text-right">Hóa đơn</th>
                         </tr>
                     </thead>
                     <tbody className="text-sm font-medium text-slate-700">
                         {staffStats.map(stat => (
                             <tr key={stat.email} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50">
                                 <td className="py-4 px-4 font-bold">{stat.name}</td>
                                 <td className="py-4 px-4 text-right text-xs text-slate-500">{stat.email}</td>
                                 <td className="py-4 px-4 text-right">
                                     <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-xs font-black"><Receipt className="w-3 h-3 inline mr-1" />{stat.invoicesCount}</span>
                                 </td>
                                 <td className="py-4 px-4 text-right">
                                     <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-xs font-black"><Users className="w-3 h-3 inline mr-1" />{stat.uniqueCustomers}</span>
                                 </td>
                                 <td className="py-4 px-4 text-right font-black text-slate-900">{formatCurrency(stat.revenue)}</td>
                                 <td className="py-4 px-4 text-right">
                                     <button 
                                       onClick={() => setSelectedStaff(stat)}
                                       className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors ml-auto"
                                     >
                                         <Eye className="w-4 h-4" />
                                     </button>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
         )}
      </div>

      {selectedStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 tracking-tight text-lg">{selectedStaff.name}</h3>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Lịch sử hóa đơn ({selectedStaff.orders.length})</p>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-colors shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left">
                  <thead>
                      <tr className="border-b border-slate-100 uppercase tracking-widest text-[10px] text-slate-400">
                          <th className="py-3 px-4 font-black">Thời gian</th>
                          <th className="py-3 px-4 font-black">Mã ĐH</th>
                          <th className="py-3 px-4 font-black">Tên Khách</th>
                          <th className="py-3 px-4 font-black text-right">Tổng tiền</th>
                      </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-slate-700">
                      {selectedStaff.orders.map((order, idx) => {
                          const date = order.createdAt?.toDate?.() || new Date(order.createdAt as any);
                          return (
                          <tr key={idx} className="border-b last:border-0 border-slate-50">
                              <td className="py-3 px-4">{format(date, 'HH:mm - dd/MM')}</td>
                              <td className="py-3 px-4 font-bold">{order.id?.slice(-6).toUpperCase()}</td>
                              <td className="py-3 px-4">{order.customerName || 'Khách lẻ'}</td>
                              <td className="py-3 px-4 text-right font-black">{formatCurrency(order.totalAmount || 0)}</td>
                          </tr>
                      )})}
                  </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
