import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useReferralData, ReferrerData, calculateProgressiveCommission } from '../../lib/useReferralData';
import {
  Users, Search, Award, DollarSign, Loader2, ChevronRight, ChevronLeft,
  Download, Settings as SettingsIcon, CheckSquare, Square, UserPlus, Plus,
  ChevronDown, ArrowUpRight, Wallet, Eye, BarChart2, X, FileSpreadsheet,
  TrendingUp, Phone, Mail, Calendar, Hash, CreditCard, CheckCircle2,
  AlertCircle, Clock, FileText, Filter
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { DateFilter } from '../../components/DateFilter';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/supabase';
import { doc, setDoc, writeBatch } from '../../lib/firebaseAdapter';
import toast from 'react-hot-toast';

// ─── Tier Badge ─────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  'Kim cương': { label: 'Diamond', bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200' },
  'Bạch kim':  { label: 'Platinum', bg: 'bg-slate-100', text: 'text-slate-600',  border: 'border-slate-300' },
  'Vàng':      { label: 'Gold',     bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  'Bạc':       { label: 'Silver',   bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200' },
  'Đồng':      { label: 'Bronze',   bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  'Thành viên':{ label: 'Member',   bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200' },
};

function TierBadge({ tier }: { tier?: string }) {
  const t = tier ? TIER_CONFIG[tier] : null;
  if (!t) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border', t.bg, t.text, t.border)}>
      {t.label}
    </span>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-9 h-9 text-sm', lg: 'w-16 h-16 text-2xl' };
  const colors = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700', 'bg-violet-100 text-violet-700'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={cn('rounded-full flex items-center justify-center font-black shrink-0', sizeClasses[size], color)}>
      {name[0].toUpperCase()}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string; icon: any; color: string; trend?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest truncate">{label}</p>
        <p className="text-xl font-black text-slate-900 mt-0.5 leading-none">{value}</p>
        {(sub || trend !== undefined) && (
          <p className={cn('text-[11px] font-bold mt-1 flex items-center gap-1', trend && trend > 0 ? 'text-emerald-500' : trend && trend < 0 ? 'text-rose-500' : 'text-slate-400')}>
            {trend !== undefined && <ArrowUpRight className="w-3 h-3" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
type MainTab = 'tong_quan' | 'nguoi_gt' | 'khach_duoc_gt' | 'lich_su_hoa_hong' | 'thanh_toan_hh' | 'cau_hinh_hh';
type DrawerTab = 'khach_hang' | 'hoa_hong';

export function Referrers() {
  const [mainTab, setMainTab] = useState<MainTab>('tong_quan');
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('khach_hang');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedReferrer, setSelectedReferrer] = useState<ReferrerData | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<any>(null);
  const [selectedOrdersForCommission, setSelectedOrdersForCommission] = useState<Set<string>>(new Set());
  const [savingSettings, setSavingSettings] = useState(false);
  const [paying, setPaying] = useState(false);

  const { dateRange } = useDateFilterStore();
  const { referrersMap, loading, allCustomers, allOrders, settings } = useReferralData(dateRange);


  // ── Chart Data ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    let isDaily = false;
    if (dateRange.startDate && dateRange.endDate) {
      const diffTime = Math.abs(dateRange.endDate.getTime() - dateRange.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 31) isDaily = true;
    }

    const labels: string[] = [];
    const data1: number[] = [];
    const data2: number[] = [];
    
    if (isDaily && dateRange.startDate && dateRange.endDate) {
       let d = new Date(dateRange.startDate);
       d.setHours(0,0,0,0);
       const end = new Date(dateRange.endDate);
       end.setHours(23,59,59,999);
       while (d <= end) {
          labels.push(`${d.getDate()}/${d.getMonth()+1}`);
          data1.push(0);
          data2.push(0);
          d.setDate(d.getDate() + 1);
       }
       allOrders.forEach((o: any) => {
         if (!o.referredById || o.commissionEligible === false) return;
         const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
         if (od >= dateRange.startDate! && od <= dateRange.endDate!) {
            const diffTime = Math.abs(od.getTime() - dateRange.startDate!.getTime());
            const idx = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (idx >= 0 && idx < data1.length) {
               data1[idx] += (o.totalAmount || 0);
            }
         }
         const prevStart = new Date(dateRange.startDate);
         prevStart.setMonth(prevStart.getMonth() - 1);
         const prevEnd = new Date(dateRange.endDate);
         prevEnd.setMonth(prevEnd.getMonth() - 1);
         if (od >= prevStart && od <= prevEnd) {
            const diffTime = Math.abs(od.getTime() - prevStart.getTime());
            const idx = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (idx >= 0 && idx < data2.length) {
               data2[idx] += (o.totalAmount || 0);
            }
         }
       });
    } else {
       for (let i = 0; i < 12; i++) {
         labels.push(`T${i + 1}`);
         data1.push(0);
         data2.push(0);
       }
       const targetYear = dateRange.startDate ? dateRange.startDate.getFullYear() : new Date().getFullYear();
       allOrders.forEach((o: any) => {
         if (!o.referredById || o.commissionEligible === false) return;
         const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
         const year = od.getFullYear();
         const month = od.getMonth();
         if (year === targetYear) data1[month] += (o.totalAmount || 0);
         if (year === targetYear - 1) data2[month] += (o.totalAmount || 0);
       });
    }

    const maxVal = Math.max(...data1, ...data2, 1);
    return { 
      labels, 
      data1: data1.map(v => (v / maxVal) * 100), 
      data2: data2.map(v => (v / maxVal) * 100),
      raw1: data1,
      raw2: data2,
      maxVal,
      isDaily
    };
  }, [allOrders, dateRange]);

  // ── Derived data ────────────────────────────────────────────────────────
  const referrersList = useMemo(() => {
    return (Array.from(referrersMap.values()) as ReferrerData[])
      .filter((r) => {
        const matchSearch = r.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
          || (r.customer.phone || '').includes(searchTerm);
        const matchStatus = statusFilter === 'all'
          || (statusFilter === 'unpaid' && r.unpaidCommission > 0)
          || (statusFilter === 'paid' && r.unpaidCommission === 0);
        const matchTier = tierFilter === 'all' || r.customer.tier === tierFilter;
        return matchSearch && matchStatus && matchTier;
      })
      .sort((a, b) => b.totalReferralRevenue - a.totalReferralRevenue);
  }, [referrersMap, searchTerm, statusFilter, tierFilter]);

  const totalReferralRev = referrersList.reduce((s, r) => s + r.totalReferralRevenue, 0);
  const totalCommission  = referrersList.reduce((s, r) => s + r.totalCommission, 0);
  const totalPaid        = referrersList.reduce((s, r) => s + r.paidCommission, 0);
  const totalUnpaid      = referrersList.reduce((s, r) => s + r.unpaidCommission, 0);
  const totalKhachDuocGT = referrersList.reduce((s, r) => s + r.referredCustomers.length, 0);

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.ceil(referrersList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated  = referrersList.slice(startIndex, startIndex + itemsPerPage);

  // ── All referred customers (flat) for tab ───────────────────────────────
  const allReferredCustomers = useMemo(() => {
    const arr: { customer: any; referredBy: any; revenue: number; orders: number }[] = [];
    referrersMap.forEach((r) => {
      r.referredCustomers.forEach((c) => {
        const cOrders = allOrders.filter((o: any) => o.customerId === c.id);
        arr.push({
          customer: c,
          referredBy: r.customer,
          revenue: cOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0),
          orders: cOrders.length,
        });
      });
    });
    return arr.filter(item =>
      item.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      || (item.customer.phone || '').includes(searchTerm)
    );
  }, [referrersMap, allOrders, searchTerm]);

  // ── Commission history (all orders with referral) ────────────────────────
  const commissionHistory = useMemo(() => {
    return allOrders
      .filter((o: any) => o.referredById && o.commissionEligible !== false)
      .filter((o: any) => {
        const name = o.referredByName || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase())
          || o.id?.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [allOrders, searchTerm]);

  // ── Payment history ──────────────────────────────────────────────────────
  const paymentHistory = useMemo(() => {
    return allOrders
      .filter((o: any) => o.commissionStatus === 'paid')
      .sort((a: any, b: any) => new Date(b.commissionPaidAt || 0).getTime() - new Date(a.commissionPaidAt || 0).getTime());
  }, [allOrders]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openSettings = () => {
    setEditingSettings({
      commissionMethod: settings.commissionMethod || 'PER_ORDER',
      commissionPercent: settings.commissionPercent || 5,
    });
    const eligibleIds = allOrders.filter((o: any) => o.referredById && o.commissionEligible !== false).map((o: any) => o.id!);
    setSelectedOrdersForCommission(new Set(eligibleIds));
    setSettingsModalOpen(true);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'system_configs', 'global'), {
        referral: {
          ...(settings as any),
          commissionMethod: editingSettings.commissionMethod,
          commissionPercent: Number(editingSettings.commissionPercent) || 0,
        },
      }, { merge: true });
      const batch = writeBatch(db);
      allOrders.filter((o: any) => o.referredById).forEach((o: any) => {
        const isEligible = selectedOrdersForCommission.has(o.id!);
        let pct = Number(editingSettings.commissionPercent) || 0;
        let amt = 0;
        if (editingSettings.commissionMethod === 'PER_ORDER' && settings.tiers && settings.tiers.length > 0) {
          amt = calculateProgressiveCommission(o.totalAmount || 0, settings.tiers);
        } else {
          amt = (o.totalAmount || 0) * (pct / 100);
        }
        batch.update(doc(db, 'orders', o.id!), {
          commissionEligible: isEligible,
          commissionPercent: pct,
          commissionAmount: isEligible ? amt : 0,
          commissionStatus: o.commissionStatus || (isEligible ? 'unpaid' : 'cancelled'),
        });
      });
      await batch.commit();
      toast.success('Lưu cấu hình thành công!');
      setSettingsModalOpen(false);
    } catch (error) {
      toast.error('Lỗi khi lưu cấu hình');
    } finally {
      setSavingSettings(false);
    }
  };

  const payCommission = async (referrerId: string) => {
    setPaying(true);
    try {
      const batch = writeBatch(db);
      const unpaid = allOrders.filter((o: any) => o.referredById === referrerId && o.commissionStatus !== 'paid' && o.commissionEligible !== false);
      if (unpaid.length === 0) { toast.error('Không có hoa hồng nào cần thanh toán'); return; }
      unpaid.forEach((o: any) => {
        batch.update(doc(db, 'orders', o.id!), { commissionStatus: 'paid', commissionPaidAt: new Date().toISOString() });
      });
      await batch.commit();
      toast.success('Đã thanh toán hoa hồng thành công!');
      setSelectedReferrer(null);
    } catch { toast.error('Lỗi khi thanh toán hoa hồng'); }
    finally { setPaying(false); }
  };

  const exportExcel = () => {
    const data = referrersList.map((r) => ({
      'Họ tên': r.customer.name,
      'SĐT': r.customer.phone,
      'Hạng': r.customer.tier,
      'Số khách GT': r.referredCustomers.length,
      'Doanh số': r.totalReferralRevenue,
      'Tổng đơn': r.totalReferralOrders,
      'Hoa hồng': r.totalCommission,
      'Đã TT': r.paidCommission,
      'Còn lại': r.unpaidCommission,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NguoiGioiThieu');
    XLSX.writeFile(wb, 'nguoi_gioi_thieu.xlsx');
  };

  // ── Main tabs config ─────────────────────────────────────────────────────
  const MAIN_TABS: { key: MainTab; label: string }[] = [
    { key: 'tong_quan',       label: 'Tổng quan' },
    { key: 'nguoi_gt',        label: 'Người giới thiệu' },
    { key: 'khach_duoc_gt',   label: 'Khách được giới thiệu' },
    { key: 'lich_su_hoa_hong',label: 'Lịch sử hoa hồng' },
    { key: 'thanh_toan_hh',   label: 'Thanh toán hoa hồng' },
    { key: 'cau_hinh_hh',     label: 'Cấu hình hoa hồng' },
  ];

  if (loading) return (
    <div className="flex-1 flex justify-center items-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f8fafc]">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Referral</h1>
          </div>
          <div className="flex items-center gap-3">
            <DateFilter />
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm">
              <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
            </button>
            <button onClick={() => toast('Xuất PDF đang phát triển', { icon: '🚧' })} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors">
              <FileText className="w-4 h-4" /> Xuất PDF
            </button>
            <button onClick={openSettings} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
              <SettingsIcon className="w-4 h-4" /> Cấu hình
            </button>
          </div>
        </div>

        {/* ── Tab Navigation ───────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-px">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={cn(
                'px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors',
                mainTab === tab.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-5">

        {/* ── TỔNG QUAN Tab ────────────────────────────────────────────── */}
        {mainTab === 'tong_quan' && (
          <>
            {/* Dashboard cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Tổng người giới thiệu" value={referrersList.length.toLocaleString('vi-VN')} sub="+12.5% so với kỳ trước" icon={Users} color="bg-blue-50 text-blue-600" trend={12.5} />
              <StatCard label="Khách được giới thiệu" value={totalKhachDuocGT.toLocaleString('vi-VN')} sub="+11.3% so với kỳ trước" icon={UserPlus} color="bg-emerald-50 text-emerald-600" trend={11.3} />
              <StatCard label="Tổng doanh số (Referral)" value={`${formatCurrency(totalReferralRev)}`} sub="+15.7% so với kỳ trước" icon={TrendingUp} color="bg-amber-50 text-amber-600" trend={15.7} />
              <StatCard label="Hoa hồng đồng ý" value={`${formatCurrency(totalCommission)}`} sub="+15.2% so với kỳ trước" icon={Award} color="bg-violet-50 text-violet-600" trend={15.2} />
              <StatCard label="Đã thanh toán" value={`${formatCurrency(totalPaid)}`} sub={`${totalCommission > 0 ? Math.round(totalPaid / totalCommission * 100) : 0}% tổng hoa hồng`} icon={CheckCircle2} color="bg-teal-50 text-teal-600" />
              <StatCard label="Chưa thanh toán" value={`${formatCurrency(totalUnpaid)}`} sub={`${totalCommission > 0 ? Math.round(totalUnpaid / totalCommission * 100) : 0}% tổng hoa hồng`} icon={AlertCircle} color="bg-rose-50 text-rose-600" />
            </div>

            {/* Charts area */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Bar chart */}
              <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Doanh thu Referral</h3>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {chartData.isDaily ? 'Kỳ này' : 'Năm nay'}</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-slate-200" /> {chartData.isDaily ? 'Kỳ trước' : 'Năm trước'}</span>
                  </div>
                </div>
                <div className="h-[220px] flex items-end gap-2 px-2 pb-6 relative border-b border-l border-slate-100 overflow-x-auto custom-scrollbar">
                  {chartData.labels.map((label, i) => {
                    const h1 = chartData.data2[i];
                    const h2 = chartData.data1[i];
                    return (
                      <div key={i} className="flex-1 flex justify-center items-end gap-0.5 h-full group min-w-[24px]" title={`${label}\n${chartData.isDaily ? 'Kỳ này' : 'Năm nay'}: ${formatCurrency(chartData.raw1[i])}\n${chartData.isDaily ? 'Kỳ trước' : 'Năm trước'}: ${formatCurrency(chartData.raw2[i])}`}>
                        <div className="w-2/5 bg-slate-100 rounded-t-sm group-hover:bg-slate-200 transition-all duration-500" style={{ height: `${h1}%`, minHeight: h1 > 0 ? '4px' : '0' }} />
                        <div className="w-2/5 bg-blue-500 rounded-t-sm group-hover:bg-blue-600 transition-all duration-500" style={{ height: `${h2}%`, minHeight: h2 > 0 ? '4px' : '0' }} />
                        <span className="absolute text-[9px] font-bold text-slate-400 whitespace-nowrap" style={{ bottom: 4, left: `${(i / chartData.labels.length) * 100 + (100 / chartData.labels.length / 2)}%`, transform: 'translateX(-50%)' }}>{label}</span>
                      </div>
                    );
                  })}
                  {chartData.labels.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold">Chưa có dữ liệu biểu đồ</div>
                  )}
                </div>
              </div>

              {/* Side panels */}
              <div className="flex flex-col gap-5">
                {/* Top referrers */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-4">Top người giới thiệu</h3>
                  <div className="space-y-3">
                    {referrersList.slice(0, 5).map((r, idx) => (
                      <div key={r.customer.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors" onClick={() => { setSelectedReferrer(r); setDrawerTab('khach_hang'); }}>
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0',
                          idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-slate-200 text-slate-600' :
                          idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
                        )}>{idx + 1}</div>
                        <Avatar name={r.customer.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{r.customer.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{r.referredCustomers.length} khách</p>
                        </div>
                        <p className="text-sm font-black text-emerald-600 shrink-0">{formatCurrency(r.totalReferralRevenue)}</p>
                      </div>
                    ))}
                    {referrersList.length === 0 && <p className="text-xs text-slate-400 text-center py-4 font-bold">Chưa có dữ liệu</p>}
                  </div>
                </div>

                {/* Commission donut */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col items-center justify-center">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest w-full mb-4">Trạng thái hoa hồng</h3>
                  <div className="relative w-24 h-24 mb-4">
                    <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3.5"
                        strokeDasharray={`${totalCommission > 0 ? (totalPaid / totalCommission) * 100 : 0} 100`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-black text-slate-900">{totalCommission > 0 ? Math.round(totalPaid / totalCommission * 100) : 0}%</span>
                      <span className="text-[9px] font-bold text-slate-400">Đã TT</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đã TT</p><p className="text-sm font-black text-slate-800">{formatCurrency(totalPaid)}</p></div></div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" /><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Còn lại</p><p className="text-sm font-black text-slate-800">{formatCurrency(totalUnpaid)}</p></div></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── NGƯỜI GIỚI THIỆU Tab ─────────────────────────────────────── */}
        {mainTab === 'nguoi_gt' && (
          <div className={cn('flex gap-5', selectedReferrer ? 'xl:flex-row' : '')}>
            {/* Table Panel */}
            <div className={cn('flex-1 min-w-0', selectedReferrer ? 'hidden xl:block' : '')}>
              {/* Toolbar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" placeholder="Tìm theo tên, SĐT người giới thiệu..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="pl-3 pr-1 text-sm font-bold text-slate-400">Trạng thái:</span>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 py-2.5 pr-8 outline-none cursor-pointer appearance-none">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="unpaid">Chưa thanh toán</option>
                    <option value="paid">Đã thanh toán</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="pl-3 pr-1 text-sm font-bold text-slate-400">Tất cả hạng TV:</span>
                  <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 py-2.5 pr-8 outline-none cursor-pointer appearance-none">
                    <option value="all">Tất cả</option>
                    <option value="Kim cương">Kim cương</option>
                    <option value="Bạch kim">Bạch kim</option>
                    <option value="Vàng">Vàng</option>
                    <option value="Bạc">Bạc</option>
                    <option value="Đồng">Đồng</option>
                    <option value="Thành viên">Thành viên</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Xuất Excel
                  </button>
                  <button onClick={() => toast('PDF đang phát triển', { icon: '🚧' })} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
                    <FileText className="w-4 h-4 text-rose-500" /> Xuất PDF
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                    <SettingsIcon className="w-4 h-4" /> Cấu hình
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest font-black text-slate-400 bg-slate-50">
                        <th className="p-4 w-10 text-center">#</th>
                        <th className="p-4">Người giới thiệu</th>
                        <th className="p-4">SĐT</th>
                        <th className="p-4 text-center">Hạng thành viên</th>
                        <th className="p-4 text-center">Số khách GT</th>
                        <th className="p-4 text-right">Doanh số (Referral)</th>
                        <th className="p-4 text-right">Hoa hồng</th>
                        <th className="p-4 text-right">Đã thanh toán</th>
                        <th className="p-4 text-right">Còn lại</th>
                        <th className="p-4 text-center">Trạng thái</th>
                        <th className="p-4 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((item, idx) => (
                        <tr
                          key={item.customer.id}
                          className={cn('border-b border-slate-50 transition-colors hover:bg-blue-50/30', selectedReferrer?.customer.id === item.customer.id && 'bg-blue-50')}
                        >
                          <td className="p-4 text-center text-xs font-bold text-slate-400">{startIndex + idx + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={item.customer.name} />
                              <div>
                                <p className="font-bold text-slate-900 text-sm cursor-pointer hover:text-blue-600 transition-colors" onClick={() => { setSelectedReferrer(item); setDrawerTab('khach_hang'); }}>
                                  {item.customer.name}
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                  {item.customer.id?.slice(-8).toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600 font-medium">{item.customer.phone}</td>
                          <td className="p-4 text-center"><TierBadge tier={item.customer.tier} /></td>
                          <td className="p-4 text-center font-black text-slate-700">{item.referredCustomers.length}</td>
                          <td className="p-4 text-right font-black text-slate-900">{formatCurrency(item.totalReferralRevenue)}</td>
                          <td className="p-4 text-right font-black text-slate-900">{formatCurrency(item.totalCommission)}</td>
                          <td className="p-4 text-right font-black text-emerald-600">{formatCurrency(item.paidCommission)}</td>
                          <td className="p-4 text-right font-black text-rose-500">{formatCurrency(item.unpaidCommission)}</td>
                          <td className="p-4 text-center">
                            {item.unpaidCommission > 0
                              ? <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-wide">Đang hoạt động</span>
                              : <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wide">Đang hoạt động</span>
                            }
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setSelectedReferrer(item); setDrawerTab('khach_hang'); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Xem chi tiết"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => { setSelectedReferrer(item); setDrawerTab('hoa_hong'); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Lịch sử hoa hồng"><BarChart2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginated.length === 0 && (
                        <tr><td colSpan={11} className="p-12 text-center text-slate-400 font-bold text-sm">Không có dữ liệu phù hợp</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <p className="text-[11px] font-bold text-slate-500">
                    Hiển thị {referrersList.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + itemsPerPage, referrersList.length)} trong tổng số {referrersList.length} người giới thiệu
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pg = i + 1;
                      if (totalPages > 5 && currentPage > 3) pg = currentPage - 2 + i;
                      if (pg > totalPages) return null;
                      return (
                        <button key={i} onClick={() => setCurrentPage(pg)} className={cn('w-8 h-8 rounded-lg text-xs font-black transition-colors', currentPage === pg ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200')}>
                          {pg}
                        </button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && <>
                      <span className="text-slate-400 text-xs font-black">...</span>
                      <button onClick={() => setCurrentPage(totalPages)} className="w-8 h-8 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-200 transition-colors">{totalPages}</button>
                    </>}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT DRAWER (Inline) ──────────────────────────────────── */}
            <AnimatePresence>
              {selectedReferrer && (
                <motion.div
                  key="drawer"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 380, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="hidden xl:flex flex-col bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden shrink-0"
                  style={{ height: 'fit-content', maxHeight: '80vh', minHeight: 400 }}
                >
                  {/* Drawer header */}
                  <div className="p-5 border-b border-slate-100 flex items-start justify-between shrink-0">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Thông tin chi tiết người giới thiệu</h3>
                    <button onClick={() => setSelectedReferrer(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>

                  {/* Profile */}
                  <div className="p-5 border-b border-slate-100 flex items-center gap-4 shrink-0">
                    <Avatar name={selectedReferrer.customer.name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h4 className="font-black text-slate-900 text-base">{selectedReferrer.customer.name}</h4>
                        <TierBadge tier={selectedReferrer.customer.tier} />
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1"><Hash className="w-3 h-3" />{selectedReferrer.customer.id?.slice(-8).toUpperCase() || 'KH000000'}</p>
                      <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{selectedReferrer.customer.phone}</p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-px bg-slate-100 shrink-0">
                    {[
                      { label: 'Khách giới thiệu', value: selectedReferrer.referredCustomers.length, className: 'text-slate-900' },
                      { label: 'Doanh số (Referral)', value: `${formatCurrency(selectedReferrer.totalReferralRevenue)}`, className: 'text-slate-900' },
                      { label: 'Đã thanh toán', value: `${formatCurrency(selectedReferrer.paidCommission)}`, className: 'text-emerald-600' },
                      { label: 'Tổng hoa hồng', value: `${formatCurrency(selectedReferrer.totalCommission)}`, className: 'text-blue-600' },
                      { label: 'Còn lại', value: `${formatCurrency(selectedReferrer.unpaidCommission)}`, className: 'text-rose-600', colSpan: true },
                    ].map((stat, i) => (
                      <div key={i} className={cn('bg-white p-3', (stat as any).colSpan ? 'col-span-2' : '')}>
                        <p className="text-[10px] font-bold text-slate-500 mb-1">{stat.label}</p>
                        <p className={cn('font-black text-sm', stat.className)}>{String(stat.value)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Drawer tabs */}
                  <div className="flex border-b border-slate-100 shrink-0">
                    <button onClick={() => setDrawerTab('khach_hang')} className={cn('flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2', drawerTab === 'khach_hang' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600')}>Khách được giới thiệu</button>
                    <button onClick={() => setDrawerTab('hoa_hong')} className={cn('flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2', drawerTab === 'hoa_hong' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600')}>Lịch sử hoa hồng</button>
                  </div>

                  {/* Drawer content */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {drawerTab === 'khach_hang' && (
                      <div className="divide-y divide-slate-50">
                        {selectedReferrer.referredCustomers.map(c => {
                          const cOrders = allOrders.filter((o: any) => o.customerId === c.id);
                          const cRev = cOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
                          const commAmt = cRev * ((settings.commissionPercent || 0) / 100);
                          return (
                            <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                              <Avatar name={c.name} size="sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold">{c.phone}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-black text-emerald-600">{formatCurrency(cRev)}</p>
                                <p className="text-[10px] text-amber-600 font-bold">HH: {formatCurrency(commAmt)}</p>
                              </div>
                            </div>
                          );
                        })}
                        {selectedReferrer.referredCustomers.length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-sm font-bold">Chưa có khách được giới thiệu</div>
                        )}
                        <div className="p-3 border-t border-slate-100 text-center">
                          <button className="text-blue-600 text-xs font-bold hover:underline">Xem tất cả ({selectedReferrer.referredCustomers.length} khách hàng)</button>
                        </div>
                      </div>
                    )}
                    {drawerTab === 'hoa_hong' && (
                      <div className="divide-y divide-slate-50">
                        {allOrders.filter((o: any) => o.referredById === selectedReferrer.customer.id && o.commissionEligible !== false).map((o: any) => (
                          <div key={o.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900">#{o.id?.slice(-6).toUpperCase()}</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-0.5">{o.customerName} • {o.createdAt ? formatDate(o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-amber-600">{formatCurrency(o.commissionAmount || 0)}</p>
                              <span className={cn('text-[10px] font-bold', o.commissionStatus === 'paid' ? 'text-emerald-600' : 'text-rose-500')}>
                                {o.commissionStatus === 'paid' ? '✓ Đã TT' : '○ Chưa TT'}
                              </span>
                            </div>
                          </div>
                        ))}
                        {allOrders.filter((o: any) => o.referredById === selectedReferrer.customer.id && o.commissionEligible !== false).length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-sm font-bold">Chưa có lịch sử hoa hồng</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Drawer actions */}
                  <div className="p-4 border-t border-slate-100 flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => payCommission(selectedReferrer.customer.id!)}
                      disabled={paying || selectedReferrer.unpaidCommission <= 0}
                      className="w-full py-2.5 bg-blue-600 text-white font-black text-sm rounded-lg shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      {paying && <Loader2 className="w-4 h-4 animate-spin" />}
                      Thanh toán hoa hồng ({formatCurrency(selectedReferrer.unpaidCommission)})
                    </button>
                    <button onClick={openSettings} className="w-full py-2.5 bg-slate-100 text-slate-700 font-black text-sm rounded-lg hover:bg-slate-200 transition-colors">
                      Cấu hình hoa hồng
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile drawer as full-screen overlay */}
            <AnimatePresence>
              {selectedReferrer && (
                <div className="xl:hidden fixed inset-0 z-50 flex justify-end">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReferrer(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                  <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-10">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-black text-slate-800">Chi tiết người giới thiệu</h3>
                      <button onClick={() => setSelectedReferrer(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                      <div className="flex items-center gap-4 mb-5">
                        <Avatar name={selectedReferrer.customer.name} size="lg" />
                        <div>
                          <h4 className="font-black text-slate-900 text-base">{selectedReferrer.customer.name}</h4>
                          <TierBadge tier={selectedReferrer.customer.tier} />
                          <p className="text-xs text-slate-500 mt-1">{selectedReferrer.customer.phone}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-slate-50 rounded-xl p-3"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Khách GT</p><p className="font-black text-slate-900">{selectedReferrer.referredCustomers.length}</p></div>
                        <div className="bg-slate-50 rounded-xl p-3"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Doanh số</p><p className="font-black text-slate-900 text-sm">{formatCurrency(selectedReferrer.totalReferralRevenue)}</p></div>
                        <div className="bg-emerald-50 rounded-xl p-3"><p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Đã TT</p><p className="font-black text-emerald-700 text-sm">{formatCurrency(selectedReferrer.paidCommission)}</p></div>
                        <div className="bg-rose-50 rounded-xl p-3"><p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Còn lại</p><p className="font-black text-rose-700 text-sm">{formatCurrency(selectedReferrer.unpaidCommission)}</p></div>
                      </div>
                      <div className="space-y-2">
                        {selectedReferrer.referredCustomers.map(c => {
                          const cOrders = allOrders.filter((o: any) => o.customerId === c.id);
                          const cRev = cOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
                          return (
                            <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                              <Avatar name={c.name} size="sm" />
                              <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{c.name}</p><p className="text-[10px] text-slate-500">{c.phone}</p></div>
                              <p className="text-sm font-black text-emerald-600 shrink-0">{formatCurrency(cRev)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="p-4 border-t border-slate-100">
                      <button onClick={() => payCommission(selectedReferrer.customer.id!)} disabled={paying || selectedReferrer.unpaidCommission <= 0} className="w-full py-3 bg-blue-600 text-white font-black text-sm rounded-xl disabled:opacity-40 hover:bg-blue-700 transition-colors">
                        Thanh toán hoa hồng
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── KHÁCH ĐƯỢC GIỚI THIỆU Tab ─────────────────────────────────── */}
        {mainTab === 'khach_duoc_gt' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Tìm khách hàng..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <p className="text-xs text-slate-500 font-bold ml-auto">{allReferredCustomers.length} khách được giới thiệu</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest font-black text-slate-400 bg-slate-50">
                    <th className="p-4 w-10 text-center">#</th>
                    <th className="p-4">Khách hàng</th>
                    <th className="p-4">SĐT</th>
                    <th className="p-4">Người giới thiệu</th>
                    <th className="p-4 text-center">Hạng</th>
                    <th className="p-4 text-right">Doanh số</th>
                    <th className="p-4 text-center">Số đơn</th>
                  </tr>
                </thead>
                <tbody>
                  {allReferredCustomers.slice(0, 50).map((item, idx) => (
                    <tr key={item.customer.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-center text-xs font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={item.customer.name} />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{item.customer.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold">{item.customer.id?.slice(-8).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 font-medium">{item.customer.phone}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={item.referredBy.name} size="sm" />
                          <span className="text-sm font-bold text-slate-700">{item.referredBy.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center"><TierBadge tier={item.customer.tier} /></td>
                      <td className="p-4 text-right font-black text-emerald-600">{formatCurrency(item.revenue)}</td>
                      <td className="p-4 text-center font-black text-slate-700">{item.orders}</td>
                    </tr>
                  ))}
                  {allReferredCustomers.length === 0 && (
                    <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-bold text-sm">Chưa có khách được giới thiệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LỊCH SỬ HOA HỒNG Tab ─────────────────────────────────────── */}
        {mainTab === 'lich_su_hoa_hong' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Tìm theo mã đơn, người giới thiệu..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <p className="text-xs text-slate-500 font-bold ml-auto">{commissionHistory.length} giao dịch</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest font-black text-slate-400 bg-slate-50">
                    <th className="p-4">Mã đơn</th>
                    <th className="p-4">Ngày</th>
                    <th className="p-4">Người mua (Được GT)</th>
                    <th className="p-4">Người giới thiệu</th>
                    <th className="p-4 text-right">Giá trị đơn</th>
                    <th className="p-4 text-right">% HH</th>
                    <th className="p-4 text-right">Hoa hồng</th>
                    <th className="p-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionHistory.slice(0, 50).map((o: any) => (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-black text-slate-900 text-sm">#{o.id?.slice(-6).toUpperCase()}</td>
                      <td className="p-4 text-sm text-slate-600">{o.createdAt ? formatDate(o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : '—'}</td>
                      <td className="p-4 font-bold text-slate-700 text-sm">{o.customerName}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {o.referredByName && <Avatar name={o.referredByName} size="sm" />}
                          <span className="font-bold text-slate-700 text-sm">{o.referredByName || '—'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-black text-slate-900">{formatCurrency(o.totalAmount)}</td>
                      <td className="p-4 text-right font-bold text-slate-600">{o.commissionPercent || settings.commissionPercent || 0}%</td>
                      <td className="p-4 text-right font-black text-amber-600">{formatCurrency(o.commissionAmount || 0)}</td>
                      <td className="p-4 text-center">
                        {o.commissionStatus === 'paid'
                          ? <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black">Đã TT</span>
                          : <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black">Chưa TT</span>
                        }
                      </td>
                    </tr>
                  ))}
                  {commissionHistory.length === 0 && (
                    <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-bold text-sm">Chưa có lịch sử hoa hồng</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── THANH TOÁN HOA HỒNG Tab ───────────────────────────────────── */}
        {mainTab === 'thanh_toan_hh' && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tổng cần thanh toán</p>
                <p className="text-2xl font-black text-rose-600">{formatCurrency(totalUnpaid)}</p>
                <p className="text-[11px] text-slate-500 font-bold mt-1">{referrersList.filter(r => r.unpaidCommission > 0).length} người giới thiệu</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Đã thanh toán</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalPaid)}</p>
                <p className="text-[11px] text-slate-500 font-bold mt-1">{paymentHistory.length} giao dịch</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tỷ lệ thanh toán</p>
                <p className="text-2xl font-black text-blue-600">{totalCommission > 0 ? Math.round(totalPaid / totalCommission * 100) : 0}%</p>
                <p className="text-[11px] text-slate-500 font-bold mt-1">trong tổng {formatCurrency(totalCommission)} hoa hồng</p>
              </div>
            </div>

            {/* Unpaid list */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-black text-slate-800 text-sm">Danh sách chưa thanh toán</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest font-black text-slate-400 bg-slate-50">
                      <th className="p-4">Người giới thiệu</th>
                      <th className="p-4 text-center">Số đơn</th>
                      <th className="p-4 text-right">Hoa hồng</th>
                      <th className="p-4 text-right">Đã TT</th>
                      <th className="p-4 text-right">Còn lại</th>
                      <th className="p-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrersList.filter(r => r.unpaidCommission > 0).map(item => (
                      <tr key={item.customer.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={item.customer.name} />
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{item.customer.name}</p>
                              <p className="text-[10px] text-slate-500">{item.customer.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center font-black text-slate-700">{item.totalReferralOrders}</td>
                        <td className="p-4 text-right font-black text-slate-900">{formatCurrency(item.totalCommission)}</td>
                        <td className="p-4 text-right font-black text-emerald-600">{formatCurrency(item.paidCommission)}</td>
                        <td className="p-4 text-right font-black text-rose-600">{formatCurrency(item.unpaidCommission)}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => payCommission(item.customer.id!)} disabled={paying} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black hover:bg-blue-700 transition-colors disabled:opacity-50">
                            Thanh toán
                          </button>
                        </td>
                      </tr>
                    ))}
                    {referrersList.filter(r => r.unpaidCommission > 0).length === 0 && (
                      <tr><td colSpan={6} className="p-12 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                        <p className="text-slate-500 font-bold text-sm">Tất cả hoa hồng đã được thanh toán!</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CẤU HÌNH HOA HỒNG Tab ────────────────────────────────────── */}
        {mainTab === 'cau_hinh_hh' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-black text-slate-800 text-base mb-5">Cấu hình hoa hồng hệ thống</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Phương thức tính hoa hồng</label>
                  <div className="flex flex-col gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
                    {[
                      { value: 'PER_ORDER', label: 'Hoa hồng theo từng đơn hàng', desc: 'Tính % hoa hồng trên từng đơn hàng phát sinh' },
                      { value: 'TOTAL_REVENUE', label: 'Hoa hồng theo tổng doanh thu', desc: 'Tính % hoa hồng trên tổng doanh thu tích lũy' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                        <div className={cn('w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors', settings.commissionMethod === opt.value ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white')}>
                          {settings.commissionMethod === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{opt.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Tỷ lệ hoa hồng (%)</label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-48">
                      <input type="number" defaultValue={settings.commissionPercent} readOnly className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-base outline-none" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">%</span>
                    </div>
                    <p className="text-sm text-slate-600 font-bold">= {formatCurrency((totalReferralRev * ((settings.commissionPercent || 0) / 100)))} đ hoa hồng tổng</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button onClick={openSettings} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-black text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                    <SettingsIcon className="w-4 h-4" /> Mở cài đặt chi tiết
                  </button>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
              <h4 className="font-black text-blue-800 text-sm mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Điều kiện áp dụng</h4>
              <ul className="space-y-2 text-sm text-blue-700 font-medium">
                <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" /> Hoa hồng chỉ được tính cho các đơn hàng đã thanh toán thành công.</li>
                <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" /> Khách hàng phải có mã người giới thiệu hợp lệ trong hệ thống.</li>
                <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" /> Hoa hồng được phê duyệt thủ công trước khi thanh toán.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Settings Modal (Portal) ────────────────────────────────────────── */}
      {settingsModalOpen && editingSettings && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSettingsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-black text-slate-900">Cài đặt hoa hồng</h2>
                <button onClick={() => setSettingsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 custom-scrollbar">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Phương thức tính hoa hồng</label>
                  <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" value="TOTAL_REVENUE" checked={editingSettings.commissionMethod === 'TOTAL_REVENUE'} onChange={() => setEditingSettings({ ...editingSettings, commissionMethod: 'TOTAL_REVENUE' })} className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-slate-700 text-sm">Theo tổng doanh thu</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" value="PER_ORDER" checked={editingSettings.commissionMethod === 'PER_ORDER'} onChange={() => setEditingSettings({ ...editingSettings, commissionMethod: 'PER_ORDER' })} className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-slate-700 text-sm">Theo từng đơn hàng</span>
                    </label>
                  </div>
                </div>
                {(settings.tiers && settings.tiers.length > 0) ? (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                    <p className="text-sm text-emerald-700 font-bold">
                      Hệ thống đang sử dụng cấu hình <span className="font-black text-emerald-800">Hoa hồng theo bậc doanh số</span> đã thiết lập trong Cài đặt chung.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">% Hoa hồng</label>
                    <div className="relative w-48">
                      <input type="number" value={editingSettings.commissionPercent} onChange={e => setEditingSettings({ ...editingSettings, commissionPercent: e.target.value })} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" placeholder="5" />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                    </div>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">Chọn đơn hàng tính hoa hồng</h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Chỉ tính hoa hồng cho các đơn được tick chọn bên dưới</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedOrdersForCommission(new Set(allOrders.filter((o: any) => o.referredById).map((o: any) => o.id!)))} className="text-xs font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">Chọn tất cả</button>
                      <button onClick={() => setSelectedOrdersForCommission(new Set())} className="text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">Bỏ chọn</button>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-4 py-3 w-12 text-center">Chọn</th>
                          <th className="px-4 py-3">Mã đơn</th>
                          <th className="px-4 py-3">Người mua</th>
                          <th className="px-4 py-3">Người GT</th>
                          <th className="px-4 py-3 text-right">Giá trị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allOrders.filter((o: any) => o.referredById).map((o: any) => {
                          const isChecked = selectedOrdersForCommission.has(o.id!);
                          return (
                            <tr key={o.id} className={cn('border-b border-slate-100/50 last:border-0 cursor-pointer transition-colors', isChecked ? 'bg-white' : 'hover:bg-slate-100/50')} onClick={() => {
                              const ns = new Set(selectedOrdersForCommission);
                              isChecked ? ns.delete(o.id!) : ns.add(o.id!);
                              setSelectedOrdersForCommission(ns);
                            }}>
                              <td className="px-4 py-3 text-center">{isChecked ? <CheckSquare className="w-4 h-4 text-blue-600 inline" /> : <Square className="w-4 h-4 text-slate-300 inline" />}</td>
                              <td className="px-4 py-3 font-black text-slate-900 text-xs">#{o.id?.slice(-6).toUpperCase()}</td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-600 max-w-[100px] truncate">{o.customerName}</td>
                              <td className="px-4 py-3 text-xs font-black text-blue-600 max-w-[100px] truncate">{o.referredByName}</td>
                              <td className="px-4 py-3 text-right font-black text-emerald-600 text-xs">{formatCurrency(o.totalAmount || 0)}</td>
                            </tr>
                          );
                        })}
                        {allOrders.filter((o: any) => o.referredById).length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-xs font-bold text-slate-400">Không có đơn hàng nào từ referral.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button onClick={() => setSettingsModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-200 transition-colors">Huỷ</button>
                <button onClick={saveSettings} disabled={savingSettings} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
                  {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                  {savingSettings ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
