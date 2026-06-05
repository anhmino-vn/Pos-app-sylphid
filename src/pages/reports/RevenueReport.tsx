import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Order } from '../../lib/firebase';

export function RevenueReport({ dateRange }: { dateRange: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{name: string, revenue: number}[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

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
    getDocs(qOrders).then((snap) => {
      const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
        .filter(o => o.status === 'paid') // Assuming completed is paid
        .sort((a,b) => {
           const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
           const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
           return tb - ta;
        });
      
      setOrders(fetchedOrders);
      
      let rev = 0;
      const chartMap = new Map<string, number>();

      fetchedOrders.forEach(order => {
        rev += order.totalAmount || 0;
        let dateStr = 'Unknown';
        if (order.createdAt) {
          const date = order.createdAt.toDate?.() || new Date(order.createdAt);
          if (dateRange === 'year') {
             dateStr = format(date, 'MM/yyyy');
          } else {
             dateStr = format(date, 'dd/MM');
          }
        }
        chartMap.set(dateStr, (chartMap.get(dateStr) || 0) + (order.totalAmount || 0));
      });
      
      setTotalRevenue(rev);
      
      const chartArr = Array.from(chartMap.entries()).map(([k, v]) => ({ name: k, revenue: v })).reverse();
      setData(chartArr.length ? chartArr : [{ name: 'Không có dữ liệu', revenue: 0 }]);
      setLoading(false);
    }).catch(e => {
       console.error(e);
       setLoading(false);
    });

  }, [dateRange]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Biểu đồ doanh thu chi tiết</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">THEO: {dateRange}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Tổng cộng</p>
            <p className="text-xl font-black text-blue-600">{loading ? '...' : formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="h-80">
          {loading ? (
             <div className="w-full h-full flex items-center justify-center text-slate-300">
               <Loader2 className="w-8 h-8 animate-spin" />
             </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data}>
                  <defs>
                     <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => `${v/1000}K`} />
                  <Tooltip 
                     contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                     formatter={(value: number) => [formatCurrency(value), 'Doanh thu']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
               </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4">Chi tiết giao dịch</h3>
         {loading ? (
             <div className="py-12 flex justify-center text-slate-300">
                 <Loader2 className="w-8 h-8 animate-spin" />
             </div>
         ) : orders.length === 0 ? (
             <div className="py-12 text-center text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                Không có giao dịch nào
             </div>
         ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead>
                         <tr className="border-b border-slate-100 uppercase tracking-widest text-[10px] text-slate-400">
                             <th className="py-3 px-4 font-black">Mã ĐH</th>
                             <th className="py-3 px-4 font-black">Thời gian</th>
                             <th className="py-3 px-4 font-black">Khách hàng</th>
                             <th className="py-3 px-4 font-black">Trạng thái</th>
                             <th className="py-3 px-4 font-black text-right">Tổng tiền</th>
                         </tr>
                     </thead>
                     <tbody className="text-xs font-medium text-slate-700">
                         {orders.map(order => {
                            const date = order.createdAt?.toDate?.() || new Date(order.createdAt as any);
                            return (
                             <tr key={order.id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50">
                                 <td className="py-3 px-4 font-bold">{order.id?.slice(-6).toUpperCase()}</td>
                                 <td className="py-3 px-4">{format(date, 'HH:mm - dd/MM/yyyy')}</td>
                                 <td className="py-3 px-4">{order.customerName || 'Khách lẻ'}</td>
                                 <td className="py-3 px-4">
                                     <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase">Thành công</span>
                                 </td>
                                 <td className="py-3 px-4 text-right font-black">{formatCurrency(order.totalAmount || 0)}</td>
                             </tr>
                            );
                         })}
                     </tbody>
                 </table>
             </div>
         )}
      </div>
    </div>
  );
}
