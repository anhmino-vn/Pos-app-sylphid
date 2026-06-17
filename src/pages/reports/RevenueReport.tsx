import React, { useContext, useMemo, useState } from "react";
import { ReportDataContext } from "../Reports";
import { DollarSign, Receipt, CreditCard, Wallet, TrendingUp, TrendingDown, ArrowRight, Download } from "lucide-react";
import { cn, formatCurrency } from "../../lib/utils";
import { format } from "date-fns";

export function RevenueReport() {
  const { orders, loading } = useContext(ReportDataContext);
  const [filterPayment, setFilterPayment] = useState("all");

  const { stats, invoices } = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let net = 0;
    let profit = 0;
    let cash = 0;
    let transfer = 0;
    let card = 0;
    const inv: any[] = [];

    orders.forEach((o: any) => {
      if (o.status === 'paid') {
        const subTotal = o.subTotal || o.totalAmount + (o.discountAmount || 0);
        const d = o.discountAmount || 0;
        const total = o.totalAmount || 0;
        
        // Filter by payment method
        if (filterPayment !== 'all' && o.paymentMethod !== filterPayment) return;

        gross += subTotal;
        discount += d;
        net += total;

        if (o.paymentMethod === 'cash') cash += total;
        if (o.paymentMethod === 'transfer') transfer += total;
        if (o.paymentMethod === 'card') card += total;

        let oCost = 0;
        if (Array.isArray(o.items)) {
          o.items.forEach((item: any) => {
            const cost = item.originalPrice || item.price * 0.6;
            oCost += cost * (item.quantity || 1);
          });
        }
        profit += (total - oCost);

        inv.push({
           ...o,
           profit: total - oCost
        });
      }
    });

    return { 
      stats: { gross, discount, net, profit, cash, transfer, card }, 
      invoices: inv.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds) 
    };
  }, [orders, filterPayment]);

  return (
    <div className="space-y-6">
      {/* Revenue Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
               <DollarSign className="w-32 h-32 text-white" />
            </div>
            <div>
               <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Doanh thu Thuần (Net)</h3>
               <p className="text-3xl font-black text-white">{formatCurrency(stats.net)}</p>
               <div className="mt-4 flex items-center gap-2 text-emerald-400 bg-emerald-400/10 w-fit px-2 py-1 rounded-lg text-[10px] font-bold">
                  <TrendingUp className="w-3 h-3" /> Tăng trưởng tốt
               </div>
            </div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm col-span-3">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">Cấu trúc Lợi nhuận</h3>
            <div className="flex flex-col md:flex-row gap-6 justify-between items-center">
               <div className="flex-1 text-center border-r border-slate-100 last:border-0 px-4">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Doanh thu Gộp (Gross)</p>
                  <p className="text-xl font-black text-slate-900">{formatCurrency(stats.gross)}</p>
               </div>
               <div className="shrink-0"><ArrowRight className="w-5 h-5 text-slate-300" /></div>
               <div className="flex-1 text-center border-r border-slate-100 last:border-0 px-4">
                  <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest mb-1">Chiết khấu (Discount)</p>
                  <p className="text-xl font-black text-rose-600">-{formatCurrency(stats.discount)}</p>
               </div>
               <div className="shrink-0"><ArrowRight className="w-5 h-5 text-slate-300" /></div>
               <div className="flex-1 text-center px-4">
                  <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Lợi Nhuận Gộp (Profit)</p>
                  <p className="text-xl font-black text-emerald-600">{formatCurrency(stats.profit)}</p>
               </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-50 flex gap-6">
               <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl flex-1">
                  <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                     <p className="text-[10px] text-slate-500 font-bold uppercase">Tiền mặt</p>
                     <p className="text-sm font-black text-slate-900">{formatCurrency(stats.cash)}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl flex-1">
                  <Receipt className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                     <p className="text-[10px] text-slate-500 font-bold uppercase">Chuyển khoản</p>
                     <p className="text-sm font-black text-slate-900">{formatCurrency(stats.transfer)}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl flex-1">
                  <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                     <p className="text-[10px] text-slate-500 font-bold uppercase">Quẹt thẻ / Khác</p>
                     <p className="text-sm font-black text-slate-900">{formatCurrency(stats.card)}</p>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 overflow-hidden">
         <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Danh sách hóa đơn đã thanh toán ({invoices.length})</h3>
            <select
               className="bg-slate-50 border-none text-xs font-bold text-slate-700 rounded-xl px-3 py-2 outline-none"
               value={filterPayment}
               onChange={e => setFilterPayment(e.target.value)}
            >
               <option value="all">Tất cả phương thức</option>
               <option value="cash">Tiền mặt</option>
               <option value="transfer">Chuyển khoản</option>
               <option value="card">Quẹt thẻ</option>
            </select>
         </div>

         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     <th className="pb-3 font-medium">Mã Đơn</th>
                     <th className="pb-3 font-medium">Thời Gian</th>
                     <th className="pb-3 font-medium">Khách Hàng</th>
                     <th className="pb-3 font-medium">Chiết khấu</th>
                     <th className="pb-3 font-medium">Doanh Thu</th>
                     <th className="pb-3 font-medium">Phương thức</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                  {invoices.map((inv) => (
                     <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 font-bold text-slate-900">#{inv.id.slice(-6).toUpperCase()}</td>
                        <td className="py-3 text-slate-500">
                           {(() => {
                              if (!inv.createdAt) return '---';
                              let d = new Date();
                              if (typeof inv.createdAt.toDate === 'function') d = inv.createdAt.toDate();
                              else if (inv.createdAt.seconds) d = new Date(inv.createdAt.seconds * 1000);
                              else d = new Date(inv.createdAt);
                              if (isNaN(d.getTime())) d = new Date();
                              return format(d, "HH:mm dd/MM/yyyy");
                           })()}
                        </td>
                        <td className="py-3 font-bold text-slate-700">{inv.customerName || 'Khách lẻ'}</td>
                        <td className="py-3 text-rose-500">{inv.discountAmount ? `-${formatCurrency(inv.discountAmount)}` : '0 đ'}</td>
                        <td className="py-3 font-black text-emerald-600">{formatCurrency(inv.totalAmount)}</td>
                        <td className="py-3">
                           <span className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase", 
                              inv.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-600' : 
                              inv.paymentMethod === 'transfer' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600')}>
                              {inv.paymentMethod === 'cash' ? 'Tiền mặt' : inv.paymentMethod === 'transfer' ? 'Chuyển khoản' : inv.paymentMethod || 'Khác'}
                           </span>
                        </td>
                     </tr>
                  ))}
                  {invoices.length === 0 && (
                     <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-sm font-medium">Không có hóa đơn nào</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
