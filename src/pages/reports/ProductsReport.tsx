import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, format } from 'date-fns';
import { Loader2, Package, Users, Eye, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Order } from '../../lib/firebase';

interface ProductStats {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
  buyers: { customerId: string, customerName: string, quantity: number, orderId: string, date: Date }[];
  uniqueCustomers: number;
}

export function ProductsReport({ dateRange }: { dateRange: string }) {
  const [loading, setLoading] = useState(true);
  const [productsStats, setProductsStats] = useState<ProductStats[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductStats | null>(null);

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
        const statsMap = new Map<string, ProductStats>();

        snap.docs.forEach(doc => {
          const order = { id: doc.id, ...doc.data() } as Order;
          if (order.status !== 'paid') return;
          const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt as any);

          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              if (item.type === 'product') { // Assuming type is product
                const pId = item.id;
                if (!statsMap.has(pId)) {
                  statsMap.set(pId, {
                    id: pId,
                    name: item.name,
                    quantitySold: 0,
                    revenue: 0,
                    buyers: [],
                    uniqueCustomers: 0
                  });
                }
                const pStat = statsMap.get(pId)!;
                pStat.quantitySold += item.quantity || 1;
                pStat.revenue += item.price * (item.quantity || 1);
                pStat.buyers.push({
                   customerId: order.customerId || 'retail',
                   customerName: order.customerName || 'Khách lẻ',
                   quantity: item.quantity || 1,
                   orderId: order.id || '',
                   date: orderDate
                });
              }
            });
          }
        });

        // Compute unique customers
        const finalStats = Array.from(statsMap.values()).map(p => {
           const uniqueIds = new Set(p.buyers.map(b => b.customerId));
           p.buyers.sort((a,b) => b.date.getTime() - a.date.getTime());
           return {
              ...p,
              uniqueCustomers: uniqueIds.size
           };
        });

        finalStats.sort((a, b) => b.quantitySold - a.quantitySold);
        setProductsStats(finalStats);
        setLoading(false);
      }).catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, [dateRange]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
         <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4">Báo cáo sản phẩm bán ra</h3>
         {loading ? (
             <div className="py-12 flex justify-center text-slate-300">
                 <Loader2 className="w-8 h-8 animate-spin" />
             </div>
         ) : productsStats.length === 0 ? (
             <div className="py-12 text-center text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                 Không có sản phẩm nào được bán trong kỳ
             </div>
         ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead>
                         <tr className="border-b border-slate-100 uppercase tracking-widest text-[10px] text-slate-400">
                             <th className="py-3 px-4 font-black">Tên sản phẩm</th>
                             <th className="py-3 px-4 font-black text-right">Tổng số lượng</th>
                             <th className="py-3 px-4 font-black text-right">Tổng khách Hàng (Unique)</th>
                             <th className="py-3 px-4 font-black text-right">Tổng doanh thu</th>
                             <th className="py-3 px-4 font-black text-right">Chi tiết</th>
                         </tr>
                     </thead>
                     <tbody className="text-sm font-medium text-slate-700">
                         {productsStats.map(stat => (
                             <tr key={stat.id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50">
                                 <td className="py-4 px-4 font-bold max-w-[200px] truncate" title={stat.name}>{stat.name}</td>
                                 <td className="py-4 px-4 text-right">
                                     <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-xs font-black">{stat.quantitySold}</span>
                                 </td>
                                 <td className="py-4 px-4 text-right">
                                     <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-xs font-black"><Users className="w-3 h-3 inline mr-1" />{stat.uniqueCustomers}</span>
                                 </td>
                                 <td className="py-4 px-4 text-right font-black">{formatCurrency(stat.revenue)}</td>
                                 <td className="py-4 px-4 text-right">
                                     <button 
                                       onClick={() => setSelectedProduct(stat)}
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

      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 tracking-tight text-lg">{selectedProduct.name}</h3>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Lịch sử khách mua hàng</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-colors shadow-sm">
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
                          <th className="py-3 px-4 font-black text-right">SL Mua</th>
                      </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-slate-700">
                      {selectedProduct.buyers.map((buyer, idx) => (
                          <tr key={idx} className="border-b last:border-0 border-slate-50">
                              <td className="py-3 px-4">{format(buyer.date, 'HH:mm - dd/MM')}</td>
                              <td className="py-3 px-4 font-bold">{buyer.orderId.slice(-6).toUpperCase()}</td>
                              <td className="py-3 px-4">{buyer.customerName}</td>
                              <td className="py-3 px-4 text-right font-black">{buyer.quantity}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
