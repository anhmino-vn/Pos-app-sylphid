import React, { useState } from "react";
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
} from "lucide-react";
import { cn } from "../lib/utils";
import { OverviewReport } from "./reports/OverviewReport";
import { RevenueReport } from "./reports/RevenueReport";
import { OrdersReport } from "./reports/OrdersReport";
import { ProductsReport } from "./reports/ProductsReport";
import { ServicesReport } from "./reports/ServicesReport";
import { InventoryReport } from "./reports/InventoryReport";
import { StaffReport } from "./reports/StaffReport";
import { CustomersReport } from "./reports/CustomersReport";
import * as XLSX from "xlsx";

export function Reports() {
  const { tab = "overview" } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);

  const tabs = [
    { id: "overview", name: "Tổng quan", icon: BarChart2 },
    { id: "revenue", name: "Doanh thu", icon: DollarSign },
    { id: "orders", name: "Đơn hàng", icon: ShoppingCart },
    { id: "products", name: "Sản phẩm", icon: Package },
    { id: "services", name: "Dịch vụ", icon: Sparkles },
    { id: "inventory", name: "Kho", icon: Warehouse },
    { id: "staff", name: "Nhân sự", icon: UserCog },
    { id: "customers", name: "Khách hàng", icon: Users },
  ];

  const handleExportExcel = () => {
    // Generate basic report structure for the active tab
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["POS SYLPHID - HỆ THỐNG QUẢN LÝ BÁN HÀNG"],
      [
        "BÁO CÁO: " +
          (tabs.find((t) => t.id === tab)?.name?.toUpperCase() || "TỔNG QUAN"),
      ],
      ["Kỳ báo cáo: " + dateRange],
      ["Ngày xuất: " + new Date().toLocaleString("vi-VN")],
      [],
      ["Tính năng xuất chi tiết đang được phát triển. Vui lòng liên hệ Admin."],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Add simple styling to cells if needed
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

    XLSX.utils.book_append_sheet(wb, ws, "BaoCao");
    XLSX.writeFile(wb, `BaoCao_${tab}_${dateRange}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
            Báo Cáo & Thống Kê
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">
            Phân tích dữ liệu & Theo dõi hiệu suất
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
              <option value="week">7 ngày qua</option>
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
            className="px-3 py-2.5 bg-blue-600 border border-blue-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 shrink-0 md:ml-0"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
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

      <div className="pt-4">
        {tab === "overview" && <OverviewReport dateRange={dateRange} />}
        {tab === "revenue" && <RevenueReport dateRange={dateRange} />}
        {tab === "orders" && <OrdersReport dateRange={dateRange} />}
        {tab === "products" && <ProductsReport dateRange={dateRange} />}
        {tab === "services" && <ServicesReport dateRange={dateRange} />}
        {tab === "inventory" && <InventoryReport dateRange={dateRange} />}
        {tab === "staff" && <StaffReport dateRange={dateRange} />}
        {tab === "customers" && <CustomersReport dateRange={dateRange} />}
      </div>
    </div>
  );
}
