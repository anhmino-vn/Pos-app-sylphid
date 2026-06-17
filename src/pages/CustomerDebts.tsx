import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, writeBatch } from '../lib/firebaseAdapter';
import { db, Customer, Order, DebtPayment } from '../lib/supabase';
import { useAuth } from '../App';
import { useDateFilterStore } from '../store/useDateFilterStore';
import {
  Wallet, Users, Search, ChevronRight,
  Loader2, Receipt, CheckCircle2, X,
  ArrowRight
} from 'lucide-react';
import { formatCurrency, cn, generateDocCode } from '../lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { DateFilter } from '../components/DateFilter';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

type TabType = 'tong_quan' | 'khach_no' | 'lich_su';

export function CustomerDebts() {
  const { user, profile } = useAuth();
  const { dateRange } = useDateFilterStore();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabType>('tong_quan');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);

  // States for Khach no
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // States for Payment
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // States for Lịch sử
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    let cDone = false, oDone = false, pDone = false;
    const checkDone = () => { if (cDone && oDone && pDone) setLoading(false); };

    const unsubC = onSnapshot(collection(db, 'customers'), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)).filter(c => !(c as any).deletedAt));
      cDone = true; checkDone();
    }, () => { cDone = true; checkDone(); });

    const unsubO = onSnapshot(collection(db, 'orders'), snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).filter((o: any) => !o.deletedAt));
      oDone = true; checkDone();
    }, () => { oDone = true; checkDone(); });

    const unsubP = onSnapshot(collection(db, 'debt_payments'), snap => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as DebtPayment)).sort((a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.()));
      pDone = true; checkDone();
    }, () => { pDone = true; checkDone(); });

    return () => { unsubC(); unsubO(); unsubP(); };
  }, []);

  // ─── Data processing ────────────────────────────────────────────────────────
  
  // Calculate current unpaid orders
  const unpaidOrders = useMemo(() => {
    return orders.filter(o => ['unpaid', 'pending', 'debt'].includes(o.status));
  }, [orders]);

  const debtByCustomer = useMemo(() => {
    const map = new Map<string, { total: number; count: number; orders: Order[] }>();
    unpaidOrders.forEach(o => {
      if (!o.customerId) return;
      const exist = map.get(o.customerId) || { total: 0, count: 0, orders: [] };
      exist.total += (o.totalAmount || 0);
      exist.count += 1;
      exist.orders.push(o);
      map.set(o.customerId, exist);
    });
    return map;
  }, [unpaidOrders]);

  // Khách nợ filtered
  const debtorsList = useMemo(() => {
    const list = Array.from(debtByCustomer.entries()).map(([cId, debt]) => {
      const c = customers.find(x => x.id === cId);
      return { customerId: cId, customerName: c?.name || 'Khách lẻ', customerPhone: c?.phone || '', totalDebt: debt.total, orderCount: debt.count, customer: c };
    });
    
    return list.filter(d => {
      const q = searchTerm.toLowerCase();
      return d.customerName.toLowerCase().includes(q) || d.customerPhone.includes(q) || (d.customer?.code || '').toLowerCase().includes(q);
    }).sort((a, b) => b.totalDebt - a.totalDebt);
  }, [debtByCustomer, customers, searchTerm]);

  const paginatedDebtors = debtorsList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Stats calculation
  const stats = useMemo(() => {
    const totalDebt = unpaidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalDebtors = debtByCustomer.size;

    const { startDate, endDate } = dateRange;
    const s = startDate || startOfDay(new Date());
    const e = endDate || endOfDay(new Date());

    const collectedInPeriod = payments.filter(p => {
      const d: Date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      return d >= startOfDay(s) && d <= endOfDay(e);
    }).reduce((sum, p) => sum + p.amount, 0);

    return { totalDebt, totalDebtors, collectedInPeriod };
  }, [unpaidOrders, debtByCustomer.size, payments, dateRange]);

  // Selected customer's unpaid orders
  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomer?.id) return [];
    return debtByCustomer.get(selectedCustomer.id)?.orders.sort((a, b) => {
      const ta = (a.createdAt?.toMillis?.()) || 0;
      const tb = (b.createdAt?.toMillis?.()) || 0;
      return tb - ta;
    }) || [];
  }, [selectedCustomer, debtByCustomer]);

  const amountToPay = useMemo(() => {
    return selectedCustomerOrders.filter(o => selectedOrderIds.includes(o.id!)).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [selectedCustomerOrders, selectedOrderIds]);

  // Lịch sử filtered
  const filteredHistory = useMemo(() => {
    const { startDate, endDate } = dateRange;
    return payments.filter(p => {
      let passDate = true;
      if (startDate && endDate) {
        const d: Date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
        passDate = d >= startOfDay(startDate) && d <= endOfDay(endDate);
      }
      const q = historySearchTerm.toLowerCase();
      const passSearch = q ? (p.code.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q) || (p.notes || '').toLowerCase().includes(q)) : true;
      return passDate && passSearch;
    });
  }, [payments, dateRange, historySearchTerm]);

  const paginatedHistory = filteredHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);


  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedOrderIds(selectedCustomerOrders.map(o => o.id!));
    else setSelectedOrderIds([]);
  };

  const handleSelectOrder = (id: string, checked: boolean) => {
    if (checked) setSelectedOrderIds(prev => [...prev, id]);
    else setSelectedOrderIds(prev => prev.filter(x => x !== id));
  };

  const handleGoToPayment = () => {
    if (!selectedCustomer || selectedOrderIds.length === 0) return;
    
    navigate('/orders/payments', {
      state: {
        debtData: {
          customerId: selectedCustomer.id!,
          customerName: selectedCustomer.name,
          customerPhone: selectedCustomer.phone,
          orderIds: selectedOrderIds,
          totalAmount: amountToPay,
          orderCount: selectedOrderIds.length
        }
      }
    });
  };


  if (loading) return (
    <div className="flex-1 flex justify-center items-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f8fafc]">
      <div className="bg-white border-b border-slate-200 px-6 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quản lý Công nợ</h1>
          <div className="flex items-center gap-3">
            <DateFilter />
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-px custom-scrollbar">
          {[
            { key: 'tong_quan', label: 'Tổng quan' },
            { key: 'khach_no', label: 'Danh sách khách nợ' },
            { key: 'lich_su', label: 'Lịch sử thu nợ' }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as TabType)}
              className={cn('px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors',
                tab === t.key ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-5">
        {tab === 'tong_quan' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setTab('khach_no')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Tổng công nợ hiện tại</p>
                <p className="text-3xl font-black text-slate-900">{formatCurrency(stats.totalDebt)} đ</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setTab('khach_no')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Số khách đang nợ</p>
                <p className="text-3xl font-black text-slate-900">{stats.totalDebtors.toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setTab('lich_su')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Đã thu trong kỳ</p>
                <p className="text-3xl font-black text-slate-900">{formatCurrency(stats.collectedInPeriod)} đ</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Top khách nợ nhiều nhất</h3>
                <button onClick={() => setTab('khach_no')} className="text-sm font-bold text-blue-600 hover:underline">Xem tất cả</button>
              </div>
              <div className="divide-y divide-slate-100">
                {debtorsList.slice(0, 5).map((d, i) => (
                  <div key={d.customerId} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setSelectedCustomer(d.customer!); setTab('khach_no'); }}>
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                      i === 0 ? 'bg-rose-100 text-rose-700' : i === 1 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                    )}>{i + 1}</div>
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0">
                      {d.customerName[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{d.customerName}</p>
                      <p className="text-xs text-slate-500 font-medium">{d.customerPhone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-rose-600 text-lg">{formatCurrency(d.totalDebt)} đ</p>
                      <p className="text-xs text-slate-500 font-medium">{d.orderCount} đơn nợ</p>
                    </div>
                  </div>
                ))}
                {debtorsList.length === 0 && (
                  <div className="p-10 text-center text-slate-500 font-medium">Không có khách hàng nào đang nợ</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'khach_no' && (
          <div className="flex gap-5 relative items-start">
            <div className={cn("flex-1 min-w-0 space-y-4 transition-all duration-300", selectedCustomer ? 'xl:w-2/3' : 'w-full')}>
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Tìm theo mã, tên, SĐT..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Khách hàng</th>
                        <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">SĐT</th>
                        <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Số đơn nợ</th>
                        <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Tổng nợ</th>
                        <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider text-center w-[120px]">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedDebtors.length > 0 ? paginatedDebtors.map(d => (
                        <tr key={d.customerId} className={cn("hover:bg-slate-50 transition-colors cursor-pointer group", selectedCustomer?.id === d.customerId && 'bg-blue-50/50')} onClick={() => setSelectedCustomer(d.customer!)}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black">{d.customerName[0].toUpperCase()}</div>
                              <div>
                                <p className="font-bold text-slate-900">{d.customerName}</p>
                                <p className="text-xs text-slate-500 font-medium">{d.customer?.code || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700 font-medium">{d.customerPhone}</td>
                          <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">{d.orderCount}</td>
                          <td className="px-5 py-4 text-right font-black text-rose-600">{formatCurrency(d.totalDebt)} đ</td>
                          <td className="px-5 py-4 text-center">
                            <button className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 w-full" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(d.customer!); }}>
                              Thu nợ <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="py-12 text-center text-slate-500 font-medium">Không tìm thấy khách hàng nào.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {selectedCustomer && (
                <motion.div
                  initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} transition={{ duration: 0.2 }}
                  className="w-[420px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col sticky top-6 max-h-[calc(100vh-140px)] shrink-0 z-10"
                >
                  <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-blue-600" /> Chi tiết công nợ
                    </h3>
                    <button onClick={() => { setSelectedCustomer(null); setSelectedOrderIds([]); }} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded shadow-sm"><X className="w-4 h-4" /></button>
                  </div>
                  
                  <div className="p-5 border-b border-slate-100 bg-white flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-black shrink-0">{selectedCustomer.name[0].toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-lg truncate">{selectedCustomer.name}</p>
                      <p className="text-xs text-slate-500 font-bold">{selectedCustomer.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Tổng nợ</p>
                      <p className="font-black text-rose-600 text-lg">{formatCurrency(debtByCustomer.get(selectedCustomer.id!)?.total || 0)} đ</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-sm text-slate-700">Danh sách đơn chờ thanh toán ({selectedCustomerOrders.length})</h4>
                      <label className="flex items-center gap-2 text-xs font-bold text-blue-600 cursor-pointer hover:underline">
                        <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                          checked={selectedCustomerOrders.length > 0 && selectedOrderIds.length === selectedCustomerOrders.length}
                          onChange={e => handleSelectAll(e.target.checked)} />
                        Chọn tất cả
                      </label>
                    </div>

                    <div className="space-y-3">
                      {selectedCustomerOrders.length > 0 ? selectedCustomerOrders.map(o => (
                        <label key={o.id} className={cn("flex gap-3 p-3 rounded-lg border cursor-pointer transition-all bg-white hover:border-blue-300", selectedOrderIds.includes(o.id!) ? "border-blue-500 ring-1 ring-blue-500 shadow-sm" : "border-slate-200")}>
                          <div className="pt-1">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                              checked={selectedOrderIds.includes(o.id!)} onChange={e => handleSelectOrder(o.id!, e.target.checked)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-bold text-sm text-slate-900">Đơn #TX-{o.id?.slice(-6).toUpperCase()}</p>
                              <p className="font-black text-rose-600">{formatCurrency(o.totalAmount || 0)} đ</p>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mb-2">{o.createdAt?.toDate ? format(o.createdAt.toDate(), 'HH:mm dd/MM/yyyy') : '—'}</p>
                            <div className="text-[11px] text-slate-400 font-medium truncate max-w-full">
                              {o.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                            </div>
                          </div>
                        </label>
                      )) : (
                        <p className="text-center text-sm font-bold text-slate-400 py-6">Đã thanh toán hết công nợ</p>
                      )}
                    </div>
                  </div>

                  {selectedOrderIds.length > 0 && (
                    <div className="p-5 border-t border-slate-200 bg-white">
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1">Đã chọn {selectedOrderIds.length} đơn</p>
                          <p className="text-sm font-bold text-slate-800">Cần thanh toán</p>
                        </div>
                        <p className="text-2xl font-black text-blue-600">{formatCurrency(amountToPay)} đ</p>
                      </div>
                      <button onClick={handleGoToPayment} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2">
                        Tiến hành thu tiền <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {tab === 'lich_su' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Tìm theo mã phiếu, tên KH..." value={historySearchTerm} onChange={e => { setHistorySearchTerm(e.target.value); setHistoryPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Mã phiếu</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Thời gian</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Khách hàng</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Thanh toán cho</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Phương thức</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedHistory.length > 0 ? paginatedHistory.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 text-sm font-bold text-slate-900">{p.code}</td>
                        <td className="px-5 py-4 text-sm text-slate-500 font-medium">{p.createdAt?.toDate ? format(p.createdAt.toDate(), 'HH:mm dd/MM/yyyy') : '—'}</td>
                        <td className="px-5 py-4 text-sm font-bold text-slate-700">{p.customerName}</td>
                        <td className="px-5 py-4 text-xs font-bold text-slate-500">{p.orderIds.length} đơn hàng</td>
                        <td className="px-5 py-4">
                          <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold border", 
                            p.paymentMethod === 'cash' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            p.paymentMethod === 'transfer' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {p.paymentMethod === 'cash' ? 'Tiền mặt' : p.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-emerald-600">{formatCurrency(p.amount)} đ</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-medium">Không tìm thấy phiếu thu nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Payment Modal removed - using module Thanh toán instead */}

    </div>
  );
}
