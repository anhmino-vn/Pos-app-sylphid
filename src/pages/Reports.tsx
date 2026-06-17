import React, { useState, useEffect, createContext, useContext, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart2,
  DollarSign,
  ShoppingCart,
  Package,
  Sparkles,
  Warehouse,
  UserCog,
  Users,
  Download,
  Filter,
  Calendar as CalendarIcon,
  Loader2
} from "lucide-react";
import { db } from "../lib/supabase";
import { cn } from "../lib/utils";
import * as XLSX from "xlsx";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfDay,
  subDays
} from "date-fns";
import {
  Timestamp,
  collection,
  query,
  where,
  onSnapshot,
  getDocs
} from "../lib/firebaseAdapter";

import { OverviewReport } from "./reports/OverviewReport";
import { RevenueReport } from "./reports/RevenueReport";
import { OrdersReport } from "./reports/OrdersReport";
import { ProductsReport } from "./reports/ProductsReport";
import { ServicesReport } from "./reports/ServicesReport";
import { InventoryReport } from "./reports/InventoryReport";
import { StaffReport } from "./reports/StaffReport";
import { ReferralReport } from "./reports/ReferralReport";
import { LoyaltyReport } from "./reports/LoyaltyReport";
import { FinanceReport } from "./reports/FinanceReport";

// Context to provide raw data to all report tabs
export const ReportDataContext = createContext<any>({
  loading: true,
  dateRange: "month",
  startDate: new Date(),
  endDate: new Date(),
  orders: [],
  customers: [],
  products: [],
  services: [],
  staff: [],
  appointments: []
});

export function Reports() {
  const { tab = "overview" } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);

  // Raw data state
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate Start Date and End Date based on dateRange
  const { startDate, endDate } = useMemo(() => {
    let sDate: Date;
    let eDate = endOfDay(new Date());
    const now = new Date();

    switch (dateRange) {
      case "today":
        sDate = startOfDay(now);
        break;
      case "yesterday":
        sDate = startOfDay(subDays(now, 1));
        eDate = endOfDay(subDays(now, 1));
        break;
      case "week":
        sDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case "month":
        sDate = startOfMonth(now);
        break;
      case "year":
        sDate = startOfYear(now);
        break;
      case "custom":
        sDate = customStartDate ? startOfDay(new Date(customStartDate)) : startOfMonth(now);
        eDate = customEndDate ? endOfDay(new Date(customEndDate)) : endOfDay(now);
        break;
      default:
        sDate = startOfMonth(now);
    }
    return { startDate: sDate, endDate: eDate };
  }, [dateRange, customStartDate, customEndDate]);

  // Fetch data
  useEffect(() => {
    setLoading(true);

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const unsubs: (() => void)[] = [];

    let isOrdersLoaded = false;
    let isCustomersLoaded = false;
    let isAppointmentsLoaded = false;

    const checkLoading = () => {
      if (isOrdersLoaded && isCustomersLoaded && isAppointmentsLoaded) {
        setLoading(false);
      }
    };

    // 1. Fetch Orders in range
    const qOrders = query(
      collection(db, 'orders'),
      where("createdAt", ">=", startTimestamp),
      where("createdAt", "<=", endTimestamp)
    );
    unsubs.push(onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      isOrdersLoaded = true; checkLoading();
    }));

    // 2. Fetch Customers
    // We fetch all customers because we need total customers, point history, etc.
    unsubs.push(onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      isCustomersLoaded = true; checkLoading();
    }));

    // 3. Fetch Appointments in range
    const qAppts = query(
      collection(db, 'appointments'),
      where("date", ">=", startTimestamp),
      where("date", "<=", endTimestamp)
    );
    unsubs.push(onSnapshot(qAppts, (snap) => {
      setAppointments(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      isAppointmentsLoaded = true; checkLoading();
    }));

    // Reference Data (Products, Services, Staff)
    getDocs(collection(db, 'products')).then(snap => setProducts(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    getDocs(collection(db, 'services')).then(snap => setServices(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    getDocs(collection(db, 'users')).then(snap => setStaff(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [startDate, endDate]);

  const tabs = [
    { id: "overview", name: "Tổng quan", icon: BarChart2 },
    { id: "revenue", name: "Doanh thu", icon: DollarSign },
    { id: "products", name: "Sản phẩm", icon: Package },
    { id: "services", name: "Dịch vụ", icon: Sparkles },
    { id: "staff", name: "Nhân sự", icon: UserCog },
    { id: "referral", name: "Referral", icon: Users },
    { id: "loyalty", name: "Thành viên", icon: Sparkles },
  ];

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    let wsData: any[][] = [
      ["POS SYLPHID - HỆ THỐNG QUẢN LÝ BÁN HÀNG"],
      ["BÁO CÁO: " + (tabs.find((t) => t.id === tab)?.name?.toUpperCase() || "TỔNG QUAN")],
      ["Kỳ báo cáo: " + dateRange],
      ["Ngày xuất: " + new Date().toLocaleString("vi-VN")],
      []
    ];

    if (tab === "revenue" || tab === "overview") {
      wsData.push(["MÃ ĐƠN", "NGÀY TẠO", "KHÁCH HÀNG", "CHIẾT KHẤU", "TỔNG TIỀN", "PHƯƠNG THỨC"]);
      orders.forEach((o: any) => {
        if (o.status === "paid") {
          wsData.push([
            "#" + o.id.slice(-6).toUpperCase(),
            o.createdAt ? new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).toLocaleString("vi-VN") : "",
            o.customerName || "Khách lẻ",
            o.discountAmount || 0,
            o.totalAmount || 0,
            o.paymentMethod || "Tiền mặt"
          ]);
        }
      });
    } else if (tab === "products") {
      wsData.push(["TÊN SẢN PHẨM", "MÃ SKU", "DANH MỤC", "GIÁ BÁN", "TỒN KHO"]);
      products.forEach((p: any) => {
        wsData.push([p.name, p.sku || "", p.category || "", p.price || 0, p.stock || 0]);
      });
    } else if (tab === "services") {
      wsData.push(["TÊN DỊCH VỤ", "DANH MỤC", "GIÁ", "THỜI GIAN"]);
      services.forEach((s: any) => {
        wsData.push([s.name, s.category || "", s.price || 0, s.duration || 0]);
      });
    } else if (tab === "staff") {
      wsData.push(["TÊN NHÂN VIÊN", "VAI TRÒ", "SỐ ĐIỆN THOẠI"]);
      staff.forEach((s: any) => {
        wsData.push([s.name, s.role || "", s.phone || ""]);
      });
    } else if (tab === "loyalty" || tab === "referral") {
      wsData.push(["TÊN KHÁCH HÀNG", "SỐ ĐIỆN THOẠI", "TỔNG CHI TIÊU", "ĐIỂM", "NGƯỜI GIỚI THIỆU"]);
      customers.forEach((c: any) => {
        wsData.push([c.name, c.phone || "", c.totalSpent || 0, c.points || 0, c.referrerId || ""]);
      });
    } else {
      wsData.push(["Chi tiết báo cáo được export từ module " + tab]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, ws, "BaoCao");
    XLSX.writeFile(wb, `BaoCao_${tab}_${dateRange}.xlsx`);
  };

  const contextValue = {
    loading,
    dateRange,
    startDate,
    endDate,
    orders,
    customers,
    products,
    services,
    staff,
    appointments
  };

  return (
    <ReportDataContext.Provider value={contextValue}>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
              Report Center
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">
              Trung tâm Phân tích Dữ liệu BI
            </p>
          </div>

          <div className="flex flex-nowrap items-center gap-2 md:gap-3 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-2 lg:pb-0">
            <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-100 flex-1 md:flex-none">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full md:w-auto px-2 md:px-4 py-2 bg-transparent border-none text-[10px] md:text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="today">Hôm nay</option>
                <option value="yesterday">Hôm qua</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
                <option value="year">Năm nay</option>
                <option value="custom">Tùy chỉnh...</option>
              </select>
            </div>

            {dateRange === "custom" && (
              <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-100 flex-[2] md:flex-none items-center order-3 w-full md:order-none md:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] sm:text-xs font-bold text-slate-700 outline-none w-full px-1 py-1"
                />
                <span className="text-slate-300">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] sm:text-xs font-bold text-slate-700 outline-none w-full px-1 py-1"
                />
              </div>
            )}

            <div className="relative md:hidden shrink-0">
              <button
                onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                className="px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Filter className="w-3.5 h-3.5" /> Lọc
              </button>
              {isCategoryFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsCategoryFilterOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          navigate(`/reports/${t.id}`);
                          setIsCategoryFilterOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-5 py-4 font-bold text-[10px] uppercase tracking-widest text-left border-b border-slate-50 last:border-0",
                          tab === t.id
                            ? "bg-blue-50 text-blue-600"
                            : "text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        <t.icon className="w-4 h-4 shrink-0" />
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-slate-900 border border-slate-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-900/20 transition-all flex items-center gap-2 shrink-0 md:ml-0"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        <div className="hidden md:flex overflow-x-auto gap-2 pb-2 scrollbar-none border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/reports/${t.id}`)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-colors border-b-2",
                tab === t.id
                  ? "text-blue-600 border-blue-600 bg-blue-50/50"
                  : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50",
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.name}
            </button>
          ))}
        </div>

        <div className="pt-4 relative min-h-[500px]">
          {loading && (
             <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-[32px]">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Đang tải dữ liệu báo cáo...</p>
             </div>
          )}
          {tab === "overview" && <OverviewReport />}
          {tab === "revenue" && <RevenueReport />}
          {tab === "products" && <ProductsReport />}
          {tab === "services" && <ServicesReport />}
          {tab === "staff" && <StaffReport />}
          {tab === "referral" && <ReferralReport />}
          {tab === "loyalty" && <LoyaltyReport />}
        </div>
      </div>
    </ReportDataContext.Provider>
  );
}
