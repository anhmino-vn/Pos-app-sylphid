import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, getDoc } from '../../lib/firebaseAdapter';
import { db, Customer, Order } from '../../lib/supabase';
import {
  Trophy, Star, Users, ArrowUpRight, Award, Loader2, Search,
  ChevronLeft, ChevronRight, ChevronDown, X, Plus, Eye, Edit2,
  Gift, TrendingUp, FileSpreadsheet, FileText, Filter, Save,
  Phone, Hash, Wallet, Info, ArrowRight
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DateFilter } from '../../components/DateFilter';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, differenceInDays } from 'date-fns';

// ─── Tier config ─────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string; order: number }> = {
  'Diamond': { bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200',  dot: 'bg-cyan-400',   order: 5 },
  'Platinum':{ bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-300', dot: 'bg-slate-400',  order: 4 },
  'Gold':    { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-400',  order: 3 },
  'Silver':  { bg: 'bg-gray-50',    text: 'text-gray-500',   border: 'border-gray-200',  dot: 'bg-gray-400',   order: 2 },
  'Bronze':  { bg: 'bg-orange-50',  text: 'text-orange-600', border: 'border-orange-200',dot: 'bg-orange-400', order: 1 },
  'Member':  { bg: 'bg-blue-50',    text: 'text-blue-600',   border: 'border-blue-200',  dot: 'bg-blue-400',   order: 0 },
};

const normalizeTier = (t: string) =>
  t === 'diamond' ? 'Diamond' : t === 'gold' ? 'Gold' : t === 'silver' ? 'Silver' : t === 'bronze' ? 'Bronze' : t || 'Member';

function TierBadge({ tier }: { tier?: string }) {
  const t = normalizeTier(tier || 'Member');
  const cfg = TIER_CONFIG[t] || TIER_CONFIG['Member'];
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-black border', cfg.bg, cfg.text, cfg.border)}>
      {t}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'w-8 h-8 text-sm', md: 'w-9 h-9 text-sm', lg: 'w-14 h-14 text-xl' };
  const colors = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700'];
  const color = colors[(name || '?').charCodeAt(0) % colors.length];
  return (
    <div className={cn('rounded-full flex items-center justify-center font-black shrink-0', sz[size], color)}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type MainTab = 'tong_quan' | 'danh_sach' | 'lich_su' | 'cau_hinh' | 'hang_tv';

const TABS: { key: MainTab; label: string }[] = [
  { key: 'tong_quan', label: 'Tổng quan' },
  { key: 'danh_sach', label: 'Danh sách thành viên' },
  { key: 'lich_su',   label: 'Lịch sử điểm' },
  { key: 'cau_hinh',  label: 'Cấu hình điểm' },
  { key: 'hang_tv',   label: 'Hạng thành viên' },
];

// Mock point history log type
interface PointLog {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  time: string;
  desc: string;
  type: 'earn' | 'redeem' | 'expire';
  points: number;
  balance: number;
}

// ─── Utility: compute previous period dates ───────────────────────────────────
function getPreviousPeriod(start: Date | null, end: Date | null): { prevStart: Date; prevEnd: Date } {
  const s = start || subDays(new Date(), 30);
  const e = end || new Date();
  const diff = differenceInDays(e, s) + 1;
  return { prevStart: subDays(s, diff), prevEnd: subDays(e, diff) };
}

function calcTrend(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function LoyaltyDashboard() {
  const navigate = useNavigate();
  const { dateRange } = useDateFilterStore();

  const [tab, setTab] = useState<MainTab>('tong_quan');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [selectedMember, setSelectedMember] = useState<Customer | null>(null);
  const [memberDetailTab, setMemberDetailTab] = useState<'info' | 'history' | 'redeem' | 'benefit'>('history');

  // Loyalty Settings state
  const [settings, setSettings] = useState({
    earnRate: 100000,
    earnPoints: 1,
    redemptionRate: 1000,
    expirationMonths: null as number | null,
    earnOnProducts: true,
    earnOnServices: true,
    referralPointsEnabled: true,
    referralPointsReward: 100,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [tiers, setTiers] = useState([
    { name: 'Member',   minSpend: 0,         discountPercent: 0,  earnMultiplier: 1,   color: 'blue' },
    { name: 'Bronze',   minSpend: 5000000,    discountPercent: 2,  earnMultiplier: 1.2, color: 'orange' },
    { name: 'Silver',   minSpend: 10000000,   discountPercent: 3,  earnMultiplier: 1.5, color: 'gray' },
    { name: 'Gold',     minSpend: 50000000,   discountPercent: 5,  earnMultiplier: 2,   color: 'amber' },
    { name: 'Platinum', minSpend: 100000000,  discountPercent: 7,  earnMultiplier: 2.5, color: 'slate' },
    { name: 'Diamond',  minSpend: 300000000,  discountPercent: 10, earnMultiplier: 3,   color: 'cyan' },
  ]);
  const [savingTiers, setSavingTiers] = useState(false);

  useEffect(() => {
    let customersDone = false, ordersDone = false;
    const checkDone = () => { if (customersDone && ordersDone) setLoading(false); };

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))
          .filter(c => !(c as any).deletedAt && c.status !== 'inactive')
      );
      customersDone = true;
      checkDone();
    }, () => { customersDone = true; checkDone(); });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))
          .filter((o: any) => !o.deletedAt && o.status === 'paid')
      );
      ordersDone = true;
      checkDone();
    }, () => { ordersDone = true; checkDone(); });

    // Load loyalty settings
    getDoc(doc(db, 'settings', 'loyalty')).then(d => {
      if (d.exists()) {
        const data = d.data() as any;
        if (data.tiers) setTiers(data.tiers);
        setSettings(prev => ({ ...prev, ...data }));
      }
    }).catch(() => {});

    return () => { unsubCustomers(); unsubOrders(); };
  }, []);

  // ── Filter orders by date range ──────────────────────────────────────────────
  const filterOrdersByRange = useCallback((os: Order[], start: Date | null, end: Date | null) => {
    if (!start || !end) return os;
    return os.filter(o => {
      const d: Date = (o as any).createdAt?.toDate ? (o as any).createdAt.toDate() : new Date((o as any).createdAt || 0);
      return d >= startOfDay(start) && d <= endOfDay(end);
    });
  }, []);

  // ── Stats with real trend vs previous period ────────────────────────────────
  const stats = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);

    // All customers (no date filter for members — cumulative)
    const totalMembers   = customers.length;
    const totalPointsRemaining = customers.reduce((s, c) => s + (c.points || 0), 0);
    const totalPointsUsed      = customers.reduce((s, c) => s + (c.usedPoints || 0), 0);
    const totalPointsIssued    = customers.reduce((s, c) => s + ((c.totalPoints) || ((c.points || 0) + (c.usedPoints || 0))), 0);
    const redemptionRate       = settings.redemptionRate || 1000;
    const totalRedemptionValue = totalPointsRemaining * redemptionRate;

    // Members joined this period vs previous
    const currentOrders  = filterOrdersByRange(orders, startDate, endDate);
    const previousOrders = filterOrdersByRange(orders, prevStart, prevEnd);

    // Estimate earned points this period from orders (earnRate)
    const rate = settings.earnRate || 100000;
    const earnPts = settings.earnPoints || 1;
    const currentEarned  = currentOrders.reduce((s, o) => s + Math.floor((o.totalAmount || 0) / rate) * earnPts, 0);
    const previousEarned = previousOrders.reduce((s, o) => s + Math.floor((o.totalAmount || 0) / rate) * earnPts, 0);

    // New members this period
    const newThisPeriod = customers.filter(c => {
      if (!c.createdAt) return false;
      const d: Date = (c as any).createdAt?.toDate ? (c as any).createdAt.toDate() : new Date(c.createdAt);
      const s = startDate || subDays(new Date(), 30);
      const e = endDate || new Date();
      return d >= startOfDay(s) && d <= endOfDay(e);
    }).length;
    const newPrevPeriod = customers.filter(c => {
      if (!c.createdAt) return false;
      const d: Date = (c as any).createdAt?.toDate ? (c as any).createdAt.toDate() : new Date(c.createdAt);
      return d >= startOfDay(prevStart) && d <= endOfDay(prevEnd);
    }).length;

    // Trends
    const trendMembers    = calcTrend(newThisPeriod, newPrevPeriod);
    const trendEarned     = calcTrend(currentEarned, previousEarned);
    const trendRevCurrent = currentOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const trendRevPrev    = previousOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const trendRevenue    = calcTrend(trendRevCurrent, trendRevPrev);

    return {
      totalMembers, totalPointsIssued, totalPointsUsed, totalPointsRemaining, totalRedemptionValue,
      trendMembers, trendEarned, trendRevenue, newThisPeriod,
    };
  }, [customers, orders, dateRange, settings, filterOrdersByRange]);

  // ── Chart data: points earned per day (last 7 or date range) ────────────────
  const chartData = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const s = startDate || subDays(new Date(), 6);
    const e = endDate || new Date();
    const days = eachDayOfInterval({ start: s, end: e }).slice(-14); // max 14 days
    const rate = settings.earnRate || 100000;
    const earnPts = settings.earnPoints || 1;

    return days.map(day => {
      const dayOrders = orders.filter(o => {
        const d: Date = (o as any).createdAt?.toDate ? (o as any).createdAt.toDate() : new Date((o as any).createdAt || 0);
        return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      const earned  = dayOrders.reduce((sum, o) => sum + Math.floor((o.totalAmount || 0) / rate) * earnPts, 0);
      // estimate used = customers' usedPoints distributed proportionally (rough)
      const used = Math.round(earned * 0.35); // heuristic: ~35% used
      return { label: format(day, 'dd/MM'), earned, used };
    });
  }, [orders, dateRange, settings]);

  // ── Tier distribution ───────────────────────────────────────────────────────
  const tierDist = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach(c => {
      const t = normalizeTier(c.tier || 'Member');
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => (TIER_CONFIG[b[0]]?.order || 0) - (TIER_CONFIG[a[0]]?.order || 0));
  }, [customers]);

  // ── Top earners ─────────────────────────────────────────────────────────────
  const topEarners = useMemo(() =>
    [...customers].sort((a, b) => ((b.totalPoints || (b.points || 0)) - (a.totalPoints || (a.points || 0)))).slice(0, 5)
  , [customers]);

  // ── Navigate helpers ─────────────────────────────────────────────────────────
  const goToMemberTab = useCallback((tier?: string) => {
    if (tier) setTierFilter(tier);
    setTab('danh_sach');
    setCurrentPage(1);
  }, []);

  const openMemberDrawer = useCallback((customer: Customer) => {
    setSelectedMember(customer);
    setMemberDetailTab('history');
    setTab('danh_sach');
  }, []);

  // ── Filtered member list ────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    return customers.filter(c => {
      const q = searchTerm.toLowerCase();
      const matchSearch = c.name.toLowerCase().includes(q)
        || (c.phone || '').includes(q)
        || (c.code || '').toLowerCase().includes(q);
      const normT = normalizeTier(c.tier || 'Member');
      const matchTier   = tierFilter === 'all' || normT === tierFilter;
      const matchStatus = statusFilter === 'all'
        || (statusFilter === 'active' && (c.status || 'active') === 'active')
        || (statusFilter === 'inactive' && c.status === 'inactive');
      return matchSearch && matchTier && matchStatus;
    }).sort((a, b) => (b.totalPoints || b.points || 0) - (a.totalPoints || a.points || 0));
  }, [customers, searchTerm, tierFilter, statusFilter]);

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIdx   = (currentPage - 1) * itemsPerPage;
  const paginated  = filteredMembers.slice(startIdx, startIdx + itemsPerPage);

  // ── Mock point history for selected member ──────────────────────────────────
  const memberPointLogs: PointLog[] = useMemo(() => {
    if (!selectedMember) return [];
    return [
      { id: '1', customerId: selectedMember.id!, customerName: selectedMember.name, date: '05/06/2026', time: '15:30', desc: 'Tích điểm từ đơn hàng #DH000456', type: 'earn', points: 120, balance: (selectedMember.points || 0) },
      { id: '2', customerId: selectedMember.id!, customerName: selectedMember.name, date: '03/06/2026', time: '10:22', desc: 'Đổi điểm lấy ưu đãi - Voucher 100.000đ', type: 'redeem', points: -100, balance: (selectedMember.points || 0) - 120 },
      { id: '3', customerId: selectedMember.id!, customerName: selectedMember.name, date: '02/06/2026', time: '14:14', desc: 'Tích điểm từ đơn hàng #DH000445', type: 'earn', points: 80, balance: (selectedMember.points || 0) - 20 },
      { id: '4', customerId: selectedMember.id!, customerName: selectedMember.name, date: '30/05/2026', time: '09:45', desc: 'Đổi điểm lấy ưu đãi - Voucher 50.000đ', type: 'redeem', points: -50, balance: (selectedMember.points || 0) - 100 },
      { id: '5', customerId: selectedMember.id!, customerName: selectedMember.name, date: '28/05/2026', time: '16:40', desc: 'Tích điểm từ đơn hàng #DH000432', type: 'earn', points: 200, balance: (selectedMember.points || 0) - 150 },
      { id: '6', customerId: selectedMember.id!, customerName: selectedMember.name, date: '25/05/2026', time: '11:10', desc: 'Điểm chào mừng sinh nhật', type: 'earn', points: 100, balance: (selectedMember.points || 0) - 350 },
    ];
  }, [selectedMember]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'loyalty'), { ...settings, tiers, updatedAt: new Date() });
      toast.success('Lưu cấu hình thành công!');
    } catch { toast.error('Lỗi lưu cấu hình'); }
    finally { setSavingSettings(false); }
  };

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    try {
      await setDoc(doc(db, 'settings', 'loyalty'), { tiers, updatedAt: new Date() }, { merge: true } as any);
      toast.success('Lưu hạng thành viên thành công!');
    } catch { toast.error('Lỗi lưu hạng thành viên'); }
    finally { setSavingTiers(false); }
  };

  const exportExcel = () => {
    const data = filteredMembers.map(c => ({
      'Mã TV': c.code || c.id?.slice(-8).toUpperCase(),
      'Họ tên': c.name,
      'SĐT': c.phone,
      'Hạng': normalizeTier(c.tier || 'Member'),
      'Điểm hiện có': c.points || 0,
      'Điểm đã dùng': c.usedPoints || 0,
      'Tổng chi tiêu': c.totalSpend || 0,
      'Trạng thái': c.status || 'active',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ThanhVien');
    XLSX.writeFile(wb, 'danh_sach_thanh_vien.xlsx');
  };

  if (loading) return (
    <div className="flex-1 flex justify-center items-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  const pointsRemaining = selectedMember?.points || 0;
  const pointsUsed      = selectedMember?.usedPoints || 0;
  const pointsTotal     = selectedMember?.totalPoints || (pointsRemaining + pointsUsed);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f8fafc]">
      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Thành viên & Điểm thưởng</h1>
          <div className="flex items-center gap-3">
            <DateFilter />
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-px custom-scrollbar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors',
                tab === t.key ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-5">

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: TỔNG QUAN                                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === 'tong_quan' && (
          <>
            {/* KPI Cards – real data with real trends */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {([
                {
                  label: 'Tổng thành viên',
                  value: stats.totalMembers.toLocaleString('vi-VN'),
                  sub: stats.trendMembers !== null ? `${stats.trendMembers >= 0 ? '+' : ''}${stats.trendMembers}% so với kỳ trước` : `+${stats.newThisPeriod} thành viên mới`,
                  icon: Users, bg: 'bg-blue-50 text-blue-600',
                  trend: (stats.trendMembers ?? 0) >= 0,
                  onClick: () => goToMemberTab(),
                },
                {
                  label: 'Tổng điểm hiện có',
                  value: stats.totalPointsIssued.toLocaleString('vi-VN'),
                  sub: stats.trendEarned !== null ? `${stats.trendEarned >= 0 ? '+' : ''}${stats.trendEarned}% so với kỳ trước` : 'Tổng điểm đã tích lũy',
                  icon: Gift, bg: 'bg-emerald-50 text-emerald-600',
                  trend: (stats.trendEarned ?? 0) >= 0,
                  onClick: () => setTab('lich_su'),
                },
                {
                  label: 'Tổng điểm đã sử dụng',
                  value: stats.totalPointsUsed.toLocaleString('vi-VN'),
                  sub: 'Đã đổi lấy ưu đãi',
                  icon: Award, bg: 'bg-amber-50 text-amber-600',
                  trend: false,
                  onClick: () => setTab('lich_su'),
                },
                {
                  label: 'Tổng điểm còn lại',
                  value: stats.totalPointsRemaining.toLocaleString('vi-VN'),
                  sub: undefined,
                  icon: Star, bg: 'bg-indigo-50 text-indigo-600',
                  trend: false,
                  onClick: () => setTab('danh_sach'),
                },
                {
                  label: 'Tổng giá trị quy đổi',
                  value: `${formatCurrency(stats.totalRedemptionValue)} đ`,
                  sub: `Quy đổi: 1 điểm = ${(settings.redemptionRate || 1000).toLocaleString('vi-VN')} đ`,
                  icon: Wallet, bg: 'bg-rose-50 text-rose-600',
                  trend: false,
                  onClick: () => setTab('cau_hinh'),
                },
              ] as const).map((card, i) => (
                <div key={i}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                  onClick={card.onClick}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', card.bg)}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-tight mb-2">{card.label}</p>
                  <p className="text-2xl font-black text-slate-900 leading-none">{card.value}</p>
                  {card.sub && (
                    <p className={cn('text-[11px] font-bold mt-2 flex items-center gap-1', card.trend ? 'text-emerald-500' : 'text-slate-400')}>
                      {card.trend && <ArrowUpRight className="w-3 h-3" />}
                      {card.sub}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Donut – Tier distribution */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-5">Phân bố thành viên theo hạng</h3>
                <div className="flex items-center gap-6">
                  {/* Simple donut SVG */}
                  <div className="relative w-28 h-28 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                      {(() => {
                        const total = customers.length || 1;
                        const tierColors: Record<string, string> = {
                          Diamond: '#06b6d4', Platinum: '#94a3b8', Gold: '#f59e0b', Silver: '#9ca3af', Bronze: '#f97316', Member: '#3b82f6'
                        };
                        let offset = 0;
                        return tierDist.map(([tier, count]) => {
                          const pct = (count / total) * 100;
                          const stroke = tierColors[tier] || '#3b82f6';
                          const el = (
                            <circle key={tier} cx="18" cy="18" r="15.9" fill="none"
                              stroke={stroke} strokeWidth="3.5"
                              strokeDasharray={`${pct} ${100 - pct}`}
                              strokeDashoffset={`${-offset}`}
                              strokeLinecap="butt"
                            />
                          );
                          offset += pct;
                          return el;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-slate-900">{stats.totalMembers.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 font-bold">Tổng</span>
                    </div>
                  </div>
                  {/* Legend – clickable to filter */}
                  <div className="space-y-2 flex-1 min-w-0">
                    {tierDist.map(([tier, count]) => {
                      const cfg = TIER_CONFIG[tier] || TIER_CONFIG['Member'];
                      const pct = ((count / (stats.totalMembers || 1)) * 100).toFixed(1);
                      return (
                        <div key={tier}
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 -mx-1 px-1 rounded-lg py-0.5 transition-colors group"
                          onClick={() => goToMemberTab(tier)}
                          title={`Xem danh sách hạng ${tier}`}
                        >
                          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)} />
                          <span className={cn('text-xs font-bold flex-1 truncate group-hover:font-black transition-all', cfg.text)}>{tier}</span>
                          <span className="text-xs font-black text-slate-800">{count}</span>
                          <span className="text-[11px] text-slate-400 font-bold w-14 text-right">({pct}%)</span>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => goToMemberTab()}
                      className="text-[11px] text-blue-600 font-bold hover:underline mt-1 flex items-center gap-1"
                    >
                      Xem tất cả thành viên <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Line chart – real data from orders grouped by day */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Điểm thưởng theo thời gian</h3>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Điểm tích lũy</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />Đã sử dụng</span>
                  </div>
                </div>
                {(() => {
                  const maxVal = Math.max(...chartData.map(d => d.earned), 1);
                  const n = chartData.length;
                  if (n === 0) return <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm font-bold">Không có dữ liệu trong khoảng thời gian này</div>;
                  // Build SVG polyline points
                  const pts = (arr: number[]) =>
                    arr.map((v, i) => `${(i / (n - 1 || 1)) * 200},${100 - (v / maxVal) * 85}`).join(' ');
                  const earnedPts = chartData.map(d => d.earned);
                  const usedPts   = chartData.map(d => d.used);
                  const earned0 = `${pts(earnedPts)} 200,100 0,100`;
                  const used0   = `${pts(usedPts)} 200,100 0,100`;
                  return (
                    <div className="h-[180px] relative border-b border-l border-slate-100 pb-6 overflow-hidden">
                      <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="blueGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="greenGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <polygon points={earned0} fill="url(#blueGrad2)" />
                        <polyline points={pts(earnedPts)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
                        <polygon points={used0} fill="url(#greenGrad2)" />
                        <polyline points={pts(usedPts)} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" />
                        {/* Dots on earned */}
                        {earnedPts.map((v, i) => (
                          <circle key={i}
                            cx={(i / (n - 1 || 1)) * 200}
                            cy={100 - (v / maxVal) * 85}
                            r="2" fill="#3b82f6" stroke="white" strokeWidth="1"
                          />
                        ))}
                      </svg>
                      {/* X-axis labels — show max 7 */}
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
                        {chartData.filter((_, i) => n <= 7 || i % Math.ceil(n / 7) === 0).map(d => (
                          <span key={d.label} className="text-[9px] text-slate-400 font-bold">{d.label}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Top earners – click navigates to member list with drawer */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Top thành viên tích điểm nhiều nhất</h3>
                  <button onClick={() => goToMemberTab()} className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                    Xem tất cả <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {topEarners.map((c, i) => (
                    <div key={c.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-blue-50/50 -mx-2 px-2 py-2 rounded-lg transition-colors group"
                      onClick={() => openMemberDrawer(c)}
                    >
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0',
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
                      )}>{i + 1}</div>
                      <Avatar name={c.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-700">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{normalizeTier(c.tier || 'Member')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-blue-600">{(c.totalPoints || c.points || 0).toLocaleString('vi-VN')} điểm</p>
                        <p className="text-[10px] text-slate-400 font-bold">{formatCurrency((c.totalPoints || c.points || 0) * (settings.redemptionRate || 1000))} đ</p>
                      </div>
                    </div>
                  ))}
                  {topEarners.length === 0 && (
                    <div className="py-8 text-center">
                      <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-bold">Chưa có dữ liệu điểm thành viên</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: DANH SÁCH THÀNH VIÊN                                           */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === 'danh_sach' && (
          <div className={cn('flex gap-5', selectedMember ? 'xl:flex-row' : '')}>
            {/* Table panel */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Toolbar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Tìm theo mã, tên, SĐT..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                </div>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="pl-3 pr-1 text-sm font-bold text-slate-400 whitespace-nowrap">Tất cả hạng:</span>
                  <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-sm font-bold text-slate-700 py-2.5 pr-8 outline-none cursor-pointer appearance-none">
                    <option value="all">Tất cả</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Bronze">Bronze</option>
                    <option value="Member">Member</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="pl-3 pr-1 text-sm font-bold text-slate-400 whitespace-nowrap">Tất cả trạng thái:</span>
                  <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-sm font-bold text-slate-700 py-2.5 pr-8 outline-none cursor-pointer appearance-none">
                    <option value="all">Tất cả</option>
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Không HĐ</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
                <button className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">
                  <Filter className="w-4 h-4" /> Bộ lọc
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Xuất Excel
                  </button>
                  <button onClick={() => toast('Chức năng đang phát triển', { icon: '🚧' })} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                    <Plus className="w-4 h-4" /> Thêm thành viên
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest font-black text-slate-400 bg-slate-50">
                        <th className="p-3 w-8"><input type="checkbox" className="rounded" /></th>
                        <th className="p-3">Mã thành viên</th>
                        <th className="p-3">Khách hàng</th>
                        <th className="p-3 text-center">Hạng</th>
                        <th className="p-3 text-right">Điểm hiện có</th>
                        <th className="p-3 text-right">Đã sử dụng</th>
                        <th className="p-3 text-right">Điểm còn lại</th>
                        <th className="p-3 text-right">Giá trị quy đổi</th>
                        <th className="p-3 text-right">Tổng chi tiêu</th>
                        <th className="p-3 text-center">Trạng thái</th>
                        <th className="p-3 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map(c => {
                        const earned  = c.totalPoints || ((c.points || 0) + (c.usedPoints || 0));
                        const used    = c.usedPoints || 0;
                        const remain  = c.points || 0;
                        const value   = remain * (settings.redemptionRate || 1000);
                        const tier    = normalizeTier(c.tier || 'Member');
                        const isActive = (c.status || 'active') === 'active';
                        return (
                          <tr key={c.id} className={cn('border-b border-slate-50 hover:bg-blue-50/20 transition-colors', selectedMember?.id === c.id && 'bg-blue-50')}>
                            <td className="p-3"><input type="checkbox" className="rounded" /></td>
                            <td className="p-3 font-black text-slate-600 text-xs">{c.code || c.id?.slice(-8).toUpperCase()}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={c.name} />
                                <div>
                                  <p className="font-bold text-slate-900 text-sm cursor-pointer hover:text-blue-600" onClick={() => { setSelectedMember(c); setMemberDetailTab('history'); }}>{c.name}</p>
                                  <p className="text-[10px] text-slate-500 font-bold">{c.phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center"><TierBadge tier={tier} /></td>
                            <td className="p-3 text-right font-black text-slate-900">{earned.toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-bold text-slate-600">{used.toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-black text-blue-600">{remain.toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-bold text-slate-700">{formatCurrency(value)} đ</td>
                            <td className="p-3 text-right font-bold text-emerald-600">{formatCurrency(c.totalSpend || 0)} đ</td>
                            <td className="p-3 text-center">
                              {isActive
                                ? <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black">Hoạt động</span>
                                : <span className="px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-[10px] font-black">Không HĐ</span>
                              }
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => { setSelectedMember(c); setMemberDetailTab('history'); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Xem lịch sử điểm"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => { setSelectedMember(c); setMemberDetailTab('redeem'); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Điều chỉnh điểm"><Gift className="w-4 h-4" /></button>
                                <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Chỉnh sửa"><Edit2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {paginated.length === 0 && (
                        <tr><td colSpan={11} className="p-12 text-center text-slate-400 font-bold text-sm">Không có thành viên phù hợp</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <p className="text-[11px] font-bold text-slate-500">
                    Hiển thị {filteredMembers.length === 0 ? 0 : startIdx + 1} - {Math.min(startIdx + itemsPerPage, filteredMembers.length)} trong tổng số {filteredMembers.length} thành viên
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pg = i + 1;
                      if (totalPages > 5 && currentPage > 3) pg = currentPage - 2 + i;
                      if (pg > totalPages) return null;
                      return (
                        <button key={i} onClick={() => setCurrentPage(pg)}
                          className={cn('w-8 h-8 rounded-lg text-xs font-black transition-colors', currentPage === pg ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200')}>
                          {pg}
                        </button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <><span className="text-slate-400 text-xs font-black">...</span>
                        <button onClick={() => setCurrentPage(totalPages)} className="w-8 h-8 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-200 transition-colors">{totalPages}</button></>
                    )}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT DRAWER ─────────────────────────────────────────────── */}
            <AnimatePresence>
              {selectedMember && (
                <motion.div key="member-drawer"
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="hidden xl:flex flex-col bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden shrink-0"
                  style={{ maxHeight: '82vh' }}>
                  {/* Drawer Header */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-black text-slate-700">Chi tiết thành viên</h3>
                    <button onClick={() => setSelectedMember(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>

                  {/* Profile */}
                  <div className="p-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar name={selectedMember.name} size="lg" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-black text-slate-900 text-base">{selectedMember.name}</h4>
                          <TierBadge tier={normalizeTier(selectedMember.tier || 'Member')} />
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3" />{selectedMember.code || selectedMember.id?.slice(-8).toUpperCase()}</p>
                        <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{selectedMember.phone}</p>
                      </div>
                    </div>
                    {/* Points summary */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-bold text-blue-500 mb-1">Hiện có</p>
                        <p className="font-black text-blue-700">{pointsTotal.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-bold text-slate-500 mb-1">Đã dùng</p>
                        <p className="font-black text-slate-700">{pointsUsed.toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-bold text-emerald-500 mb-1">Còn lại</p>
                        <p className="font-black text-emerald-700">{pointsRemaining.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Drawer tabs */}
                  <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto custom-scrollbar">
                    {[
                      { key: 'info', label: 'Thông tin' },
                      { key: 'history', label: 'Lịch sử điểm' },
                      { key: 'redeem', label: 'Lịch sử sử dụng' },
                      { key: 'benefit', label: 'Ưu đãi' },
                    ].map(t => (
                      <button key={t.key} onClick={() => setMemberDetailTab(t.key as any)}
                        className={cn('flex-shrink-0 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors border-b-2',
                          memberDetailTab === t.key ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600')}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Drawer content */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {memberDetailTab === 'info' && (
                      <div className="p-4 space-y-3">
                        {[
                          { label: 'Hạng thành viên', value: normalizeTier(selectedMember.tier || 'Member') },
                          { label: 'Tổng chi tiêu', value: `${formatCurrency(selectedMember.totalSpend || 0)} đ` },
                          { label: 'Số đơn hàng', value: `${selectedMember.orderCount || 0} đơn` },
                          { label: 'Email', value: selectedMember.email || '—' },
                          { label: 'Địa chỉ', value: selectedMember.address || '—' },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-xs text-slate-500 font-bold">{item.label}</span>
                            <span className="text-xs font-black text-slate-800">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {memberDetailTab === 'history' && (
                      <div className="divide-y divide-slate-50">
                        {memberPointLogs.map(log => (
                          <div key={log.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-slate-500 font-bold">{log.date} {log.time}</p>
                              <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-snug">{log.desc}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn('text-sm font-black', log.type === 'earn' ? 'text-emerald-600' : 'text-rose-500')}>
                                {log.type === 'earn' ? '+' : ''}{log.points.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold">Số dư: {log.balance.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                        <div className="p-3 border-t border-slate-100 text-center">
                          <button className="text-blue-600 text-xs font-bold hover:underline">Xem tất cả lịch sử điểm</button>
                        </div>
                      </div>
                    )}

                    {memberDetailTab === 'redeem' && (
                      <div className="p-4">
                        <div className="bg-slate-50 rounded-xl p-8 text-center">
                          <Gift className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm font-bold text-slate-500">Lịch sử đổi điểm lấy ưu đãi sẽ hiển thị tại đây</p>
                        </div>
                      </div>
                    )}

                    {memberDetailTab === 'benefit' && (
                      <div className="p-4 space-y-3">
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                          <p className="text-xs font-black text-amber-700 mb-1">{normalizeTier(selectedMember.tier || 'Member')} Benefits</p>
                          <p className="text-sm font-bold text-amber-900">
                            {tiers.find(t => t.name === normalizeTier(selectedMember.tier || 'Member'))?.discountPercent || 0}% giảm giá trên mỗi đơn hàng
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <p className="text-xs font-black text-blue-700 mb-1">Hệ số tích điểm</p>
                          <p className="text-sm font-bold text-blue-900">
                            x{tiers.find(t => t.name === normalizeTier(selectedMember.tier || 'Member'))?.earnMultiplier || 1} điểm mỗi giao dịch
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Drawer */}
            <AnimatePresence>
              {selectedMember && (
                <div className="xl:hidden fixed inset-0 z-50 flex justify-end">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedMember(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                  <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-10">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-black text-slate-800">Chi tiết thành viên</h3>
                      <button onClick={() => setSelectedMember(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar name={selectedMember.name} size="lg" />
                        <div>
                          <h4 className="font-black text-slate-900">{selectedMember.name}</h4>
                          <TierBadge tier={normalizeTier(selectedMember.tier || 'Member')} />
                          <p className="text-xs text-slate-500 mt-1">{selectedMember.phone}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-[10px] font-bold text-blue-500 mb-1">Tổng điểm</p><p className="font-black text-blue-700 text-sm">{pointsTotal}</p></div>
                        <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-[10px] font-bold text-slate-500 mb-1">Đã dùng</p><p className="font-black text-slate-700 text-sm">{pointsUsed}</p></div>
                        <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-[10px] font-bold text-emerald-500 mb-1">Còn lại</p><p className="font-black text-emerald-700 text-sm">{pointsRemaining}</p></div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: LỊCH SỬ ĐIỂM                                                   */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === 'lich_su' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, mã KH..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Tự động đồng bộ
                </span>
                <p className="text-xs text-slate-500 font-bold">Lịch sử điểm theo thành viên</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest font-black text-slate-400 bg-slate-50">
                    <th className="p-4">Thời gian</th>
                    <th className="p-4">Thành viên</th>
                    <th className="p-4">Nội dung</th>
                    <th className="p-4 text-center">Loại</th>
                    <th className="p-4 text-right">Điểm</th>
                    <th className="p-4 text-right">Số dư</th>
                    <th className="p-4 text-center">Đơn hàng</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Build real point logs from customers + orders (both already filtered for deletedAt)
                    const rate = settings.earnRate || 100000;
                    const earnPts = settings.earnPoints || 1;
                    const searchQ = searchTerm.toLowerCase();

                    // For each paid order, create an earn log; for usedPoints, create redeem logs
                    const logs: Array<{
                      id: string;
                      customerId: string;
                      customerName: string;
                      customerCode: string;
                      date: string;
                      time: string;
                      desc: string;
                      type: 'earn' | 'redeem';
                      points: number;
                      balance: number;
                      orderId?: string;
                    }> = [];

                    // Earn logs from real orders
                    orders
                      .filter(o => {
                        const cust = customers.find(c => c.id === (o as any).customerId || c.id === (o as any).customer_id);
                        return !!cust;
                      })
                      .forEach(o => {
                        const earnedPts = Math.floor(((o as any).totalAmount || (o as any).total_amount || 0) / rate) * earnPts;
                        if (earnedPts <= 0) return;
                        const cust = customers.find(c => c.id === (o as any).customerId || c.id === (o as any).customer_id);
                        if (!cust) return;
                        const d: Date = (o as any).createdAt?.toDate ? (o as any).createdAt.toDate() : new Date((o as any).createdAt || 0);
                        logs.push({
                          id: `earn_${o.id}`,
                          customerId: cust.id!,
                          customerName: cust.name,
                          customerCode: cust.code || cust.id?.slice(-8).toUpperCase() || '',
                          date: format(d, 'dd/MM/yyyy'),
                          time: format(d, 'HH:mm'),
                          desc: `Tích điểm từ đơn hàng #${(o as any).code || (o as any).orderCode || o.id?.slice(-8).toUpperCase()}`,
                          type: 'earn',
                          points: earnedPts,
                          balance: cust.points || 0,
                          orderId: o.id,
                        });
                      });

                    // Redeem logs from customer usedPoints (synthetic per customer)
                    customers.forEach(c => {
                      if (!c.usedPoints || c.usedPoints <= 0) return;
                      logs.push({
                        id: `redeem_${c.id}`,
                        customerId: c.id!,
                        customerName: c.name,
                        customerCode: c.code || c.id?.slice(-8).toUpperCase() || '',
                        date: format(new Date(), 'dd/MM/yyyy'),
                        time: '—',
                        desc: `Đã sử dụng ${c.usedPoints} điểm đổi ưu đãi`,
                        type: 'redeem',
                        points: c.usedPoints,
                        balance: c.points || 0,
                        orderId: undefined,
                      });
                    });

                    // Sort by date desc, then filter
                    const filtered = logs
                      .filter(l => !searchQ || l.customerName.toLowerCase().includes(searchQ) || l.customerCode.toLowerCase().includes(searchQ))
                      .sort((a, b) => b.id.localeCompare(a.id))
                      .slice(0, 50);

                    if (filtered.length === 0) return (
                      <tr>
                        <td colSpan={7} className="p-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Info className="w-8 h-8 text-slate-200" />
                            <p className="text-sm font-bold text-slate-400">Không có lịch sử điểm</p>
                            <p className="text-xs text-slate-300">Lịch sử sẽ hiển thị khi khách hàng tích điểm từ đơn hàng</p>
                          </div>
                        </td>
                      </tr>
                    );

                    return filtered.map(log => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-xs text-slate-500 font-bold whitespace-nowrap">{log.date} {log.time}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar name={log.customerName} size="sm" />
                            <div>
                              <p className="text-sm font-bold text-slate-900">{log.customerName}</p>
                              <p className="text-[10px] text-slate-500">{log.customerCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-medium text-slate-700 max-w-[220px] truncate">{log.desc}</td>
                        <td className="p-4 text-center">
                          {log.type === 'earn'
                            ? <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black">Cộng</span>
                            : <span className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-full text-[10px] font-black">Trừ</span>
                          }
                        </td>
                        <td className={cn('p-4 text-right font-black whitespace-nowrap', log.type === 'earn' ? 'text-emerald-600' : 'text-rose-500')}>
                          {log.type === 'earn' ? '+' : '-'}{log.points.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-4 text-right font-black text-slate-700 whitespace-nowrap">{log.balance.toLocaleString('vi-VN')}</td>
                        <td className="p-4 text-center">
                          {log.orderId ? (
                            <button
                              onClick={() => navigate(`/orders?search=${log.orderId}`)}
                              className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Xem đơn hàng"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: CẤU HÌNH ĐIỂM                                                  */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === 'cau_hinh' && (
          <div className="max-w-3xl space-y-5">
            {/* Save button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-800 text-lg">Cấu hình điểm thưởng</h2>
                <p className="text-sm text-slate-500 mt-1">Quản lý quy tắc tích lũy và sử dụng điểm thành viên</p>
              </div>
              <button onClick={handleSaveSettings} disabled={savingSettings} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-black text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-600/20">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingSettings ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Tích điểm */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-black text-slate-800 text-sm mb-5 flex items-center gap-2"><Star className="w-4 h-4 text-blue-500" /> Quy tắc tích điểm</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Tỷ lệ quy đổi</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={settings.earnRate} onChange={e => setSettings(s => ({ ...s, earnRate: Number(e.target.value) }))}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                      <span className="text-sm font-bold text-slate-500">VNĐ</span>
                      <span className="font-black text-slate-300">=</span>
                      <input type="number" value={settings.earnPoints} onChange={e => setSettings(s => ({ ...s, earnPoints: Number(e.target.value) }))}
                        className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none text-center focus:ring-2 focus:ring-blue-500/20" />
                      <span className="text-sm font-bold text-slate-500">Điểm</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Áp dụng cho</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer">
                        <input type="checkbox" checked={settings.earnOnProducts} onChange={e => setSettings(s => ({ ...s, earnOnProducts: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm font-medium text-slate-700">Sản phẩm vật lý</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer">
                        <input type="checkbox" checked={settings.earnOnServices} onChange={e => setSettings(s => ({ ...s, earnOnServices: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm font-medium text-slate-700">Dịch vụ liệu trình</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sử dụng điểm */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-black text-slate-800 text-sm mb-5 flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-500" /> Sử dụng điểm & Thời hạn</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Giá trị quy đổi</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-500 whitespace-nowrap">1 Điểm =</span>
                      <input type="number" value={settings.redemptionRate} onChange={e => setSettings(s => ({ ...s, redemptionRate: Number(e.target.value) }))}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                      <span className="text-sm font-bold text-slate-500">VNĐ</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Thời hạn điểm</label>
                    <select value={settings.expirationMonths === null ? 'none' : String(settings.expirationMonths)}
                      onChange={e => setSettings(s => ({ ...s, expirationMonths: e.target.value === 'none' ? null : Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                      <option value="none">Không giới hạn (Vĩnh viễn)</option>
                      <option value="6">Hết hạn sau 6 tháng</option>
                      <option value="12">Hết hạn sau 12 tháng</option>
                      <option value="24">Hết hạn sau 24 tháng</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Referral points */}
              <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-black text-slate-800 text-sm mb-5 flex items-center gap-2"><Gift className="w-4 h-4 text-emerald-500" /> Điểm thưởng giới thiệu (Referral)</h3>
                <div className="flex flex-wrap items-start gap-5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={cn('w-10 h-6 rounded-full transition-colors relative cursor-pointer', settings.referralPointsEnabled ? 'bg-blue-600' : 'bg-slate-200')}
                      onClick={() => setSettings(s => ({ ...s, referralPointsEnabled: !s.referralPointsEnabled }))}>
                      <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform', settings.referralPointsEnabled ? 'translate-x-5' : 'translate-x-1')} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">Bật thưởng điểm người giới thiệu</span>
                  </label>
                  {settings.referralPointsEnabled && (
                    <div className="flex gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Điểm thưởng cố định</label>
                        <div className="relative">
                          <input type="number" value={settings.referralPointsReward} onChange={e => setSettings(s => ({ ...s, referralPointsReward: Number(e.target.value) }))}
                            className="w-36 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">Điểm</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100 flex gap-3">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 font-medium leading-relaxed">Điểm giới thiệu sẽ được cộng tự động khi khách hàng do người đó giới thiệu hoàn thành đơn hàng đầu tiên.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: HẠNG THÀNH VIÊN                                                */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === 'hang_tv' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-800 text-lg">Phân hạng thành viên</h2>
                <p className="text-sm text-slate-500 mt-1">Cấu hình ngưỡng chi tiêu và quyền lợi cho từng hạng</p>
              </div>
              <button onClick={handleSaveTiers} disabled={savingTiers} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-black text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-600/20">
                {savingTiers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingTiers ? 'Đang lưu...' : 'Lưu hạng thành viên'}
              </button>
            </div>

            {/* Tier cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tiers.map((tier, idx) => {
                const cfg = TIER_CONFIG[tier.name] || TIER_CONFIG['Member'];
                const memberCount = customers.filter(c => normalizeTier(c.tier || 'Member') === tier.name).length;
                return (
                  <div key={tier.name} className={cn('bg-white rounded-xl border p-5 shadow-sm transition-all', cfg.border)}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cfg.bg)}>
                          <Trophy className={cn('w-5 h-5', cfg.text)} />
                        </div>
                        <div>
                          <h4 className={cn('font-black text-base', cfg.text)}>{tier.name}</h4>
                          <p className="text-[11px] text-slate-500 font-bold">{memberCount} thành viên</p>
                        </div>
                      </div>
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-black border', cfg.bg, cfg.text, cfg.border)}>{tier.name}</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Ngưỡng chi tiêu tối thiểu</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={tier.minSpend}
                            onChange={e => setTiers(ts => ts.map((t, i) => i === idx ? { ...t, minSpend: Number(e.target.value) } : t))}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                            disabled={idx === 0} />
                          <span className="text-xs font-bold text-slate-400">VNĐ</span>
                        </div>
                        {tier.minSpend > 0 && <p className="text-[10px] text-slate-400 mt-1">{formatCurrency(tier.minSpend)} đ</p>}
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">% Giảm giá</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={tier.discountPercent}
                            onChange={e => setTiers(ts => ts.map((t, i) => i === idx ? { ...t, discountPercent: Number(e.target.value) } : t))}
                            className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none text-center focus:ring-2 focus:ring-blue-500/20" />
                          <span className="text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Hệ số tích điểm</label>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-300">x</span>
                          <input type="number" value={tier.earnMultiplier} step="0.5"
                            onChange={e => setTiers(ts => ts.map((t, i) => i === idx ? { ...t, earnMultiplier: Number(e.target.value) } : t))}
                            className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none text-center focus:ring-2 focus:ring-blue-500/20" />
                          <span className="text-xs font-bold text-slate-400">điểm / giao dịch</span>
                        </div>
                      </div>
                    </div>

                    <div className={cn('mt-4 pt-3 border-t flex items-center justify-between', cfg.border)}>
                      <p className={cn('text-xs font-black', cfg.text)}>{memberCount} thành viên hiện tại</p>
                      <div className={cn('text-xs font-bold px-2 py-1 rounded-lg', cfg.bg, cfg.text)}>
                        {tier.discountPercent > 0 ? `${tier.discountPercent}% off` : 'Không giảm'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-black text-slate-800 text-sm">Bảng tổng hợp hạng thành viên</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest font-black text-slate-400 bg-slate-50">
                      <th className="p-4">Hạng</th>
                      <th className="p-4 text-right">Ngưỡng chi tiêu</th>
                      <th className="p-4 text-right">Giảm giá</th>
                      <th className="p-4 text-right">Hệ số điểm</th>
                      <th className="p-4 text-center">Số thành viên</th>
                      <th className="p-4 text-right">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map(tier => {
                      const cfg = TIER_CONFIG[tier.name] || TIER_CONFIG['Member'];
                      const count = customers.filter(c => normalizeTier(c.tier || 'Member') === tier.name).length;
                      const pct   = ((count / (stats.totalMembers || 1)) * 100).toFixed(1);
                      return (
                        <tr key={tier.name} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4"><TierBadge tier={tier.name} /></td>
                          <td className="p-4 text-right font-bold text-slate-700 text-sm">{formatCurrency(tier.minSpend)} đ</td>
                          <td className="p-4 text-right font-black text-slate-900">{tier.discountPercent}%</td>
                          <td className="p-4 text-right font-black text-blue-600">x{tier.earnMultiplier}</td>
                          <td className="p-4 text-center font-black text-slate-900">{count.toLocaleString('vi-VN')}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className={cn('h-full rounded-full', cfg.dot)} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-black text-slate-600">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
