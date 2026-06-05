import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, format } from 'date-fns';
import { Loader2, ShoppingCart, UserCheck, UserPlus, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Order, Customer } from '../../lib/firebase';

export function OrdersReport({ dateRange }: { dateRange: string }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customersMap, setCustomersMap] = useState<Map<string, Date>>(new Map());

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
    const qCustomers = query(collection(db, 'customers'));

    setLoading(true);
    Promise.all([getDocs(qOrders), getDocs(qCustomers)])
      .then(([ordersSnap, customersSnap]) => {
        const cMap = new Map<string, Date>();
        customersSnap.docs.forEach(d => {
           const c = d.data();
           if (c.createdAt) {
               cMap.set(d.id, c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt));
           }
        });
        setCustomersMap(cMap);

        const fetchedOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
          .filter(o => o.status === 'paid')
          .sort((a,b) => {
             const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt as any).getTime();
             const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt as any).getTime();
             return tb - ta;
          });
        
        setOrders(fetchedOrders);
        setLoading(false);
      }).catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, [dateRange]);

  const oldCustomerOrders = [];
  const newCustomerOrders = [];
  const retailOrders = [];

  orders.forEach(order => {
     if (!order.customerId || order.customerId === 'retail' || order.customerId === 'Khách lẻ') {
         retailOrders.push(order);
         return;
     }
     const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt as any);
     const customerDate = customersMap.get(order.customerId);
     if (customerDate) {
         const diff = Math.abs(orderDate.getTime() - customerDate.getTime());
         // Consider "new" if customer created within 5 minutes of order
         if (diff < 5 * 60 * 1000) {
             newCustomerOrders.push(order);
         } else {
             oldCustomerOrders.push(order);
         }
     } else {
         oldCustomerOrders.push(order);
     }
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
         <div className="bg-white p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-center">
             <div className="w-10 sm:w-12 h-10 sm:h-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl sm:rounded-2xl mb-2 sm:mb-4">
                 <ShoppingCart className="w-5 sm:w-6 h-5 sm:h-6" />
             </div>
             <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wide sm:tracking-widest mb-1 line-clamp-1">Tổng đơn</p>
             <p className="text-xl sm:text-3xl font-black text-slate-900">{loading ? '...' : orders.length}</p>
         </div>
         <div className="bg-white p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-center">
             <div className="w-10 sm:w-12 h-10 sm:h-12 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-xl sm:rounded-2xl mb-2 sm:mb-4">
                 <UserCheck className="w-5 sm:w-6 h-5 sm:h-6" />
             </div>
             <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wide sm:tracking-widest mb-1 line-clamp-1">Khách cũ</p>
             <p className="text-xl sm:text-3xl font-black text-slate-900">{loading ? '...' : oldCustomerOrders.length}</p>
         </div>
         <div className="bg-white p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-center">
             <div className="w-10 sm:w-12 h-10 sm:h-12 bg-amber-50 text-amber-600 flex items-center justify-center rounded-xl sm:rounded-2xl mb-2 sm:mb-4">
                 <UserPlus className="w-5 sm:w-6 h-5 sm:h-6" />
             </div>
             <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wide sm:tracking-widest mb-1 line-clamp-1">Khách mới</p>
             <p className="text-xl sm:text-3xl font-black text-slate-900">{loading ? '...' : newCustomerOrders.length}</p>
         </div>
         <div className="bg-white p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-center">
             <div className="w-10 sm:w-12 h-10 sm:h-12 bg-slate-100 text-slate-600 flex items-center justify-center rounded-xl sm:rounded-2xl mb-2 sm:mb-4">
                 <HelpCircle className="w-5 sm:w-6 h-5 sm:h-6" />
             </div>
             <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wide sm:tracking-widest mb-1 line-clamp-1">Khách lẻ / Khác</p>
             <p className="text-xl sm:text-3xl font-black text-slate-900">{loading ? '...' : retailOrders.length}</p>
         </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4">Danh sách đơn hàng</h3>
         {loading ? (
             <div className="py-12 flex justify-center text-slate-300">
                 <Loader2 className="w-8 h-8 animate-spin" />
             </div>
         ) : orders.length === 0 ? (
             <div className="py-12 text-center text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                 Không có đơn hàng nào
             </div>
         ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead>
                         <tr className="border-b border-slate-100 uppercase tracking-widest text-[10px] text-slate-400">
                             <th className="py-3 px-4 font-black">Mã ĐH</th>
                             <th className="py-3 px-4 font-black">Thời gian</th>
                             <th className="py-3 px-4 font-black">Khách hàng</th>
                             <th className="py-3 px-4 font-black">Phân loại khách</th>
                             <th className="py-3 px-4 font-black text-right">Tổng tiền</th>
                         </tr>
                     </thead>
                     <tbody className="text-xs font-medium text-slate-700">
                         {orders.map(order => {
                            const date = order.createdAt?.toDate?.() || new Date(order.createdAt as any);
                            let type = "Khách hàng cũ";
                            let typeClass = "bg-emerald-50 text-emerald-600";
                            if (!order.customerId || order.customerId === 'retail' || order.customerId === 'Khách lẻ') {
                                type = "Khách lẻ / Khác";
                                typeClass = "bg-slate-100 text-slate-500";
                            } else if (newCustomerOrders.includes(order)) {
                                type = "Khách hàng mới";
                                typeClass = "bg-amber-50 text-amber-600";
                            }

                            return (
                             <tr key={order.id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50">
                                 <td className="py-3 px-4 font-bold">{order.id?.slice(-6).toUpperCase()}</td>
                                 <td className="py-3 px-4">{format(date, 'HH:mm - dd/MM/yyyy')}</td>
                                 <td className="py-3 px-4">{order.customerName || 'Khách lẻ'}</td>
                                 <td className="py-3 px-4">
                                     <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${typeClass}`}>{type}</span>
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
