import React, { useMemo, useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfDay,
  subDays,
  subMonths,
  format,
} from "date-fns";

export function OverviewReport({ dateRange }: { dateRange: string }) {
  const [loading, setLoading] = useState(true);

  // Real data state
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [productsSold, setProductsSold] = useState(0);

  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [originData, setOriginData] = useState<any[]>([]);

  useEffect(() => {
    let startDate: Date;
    let endDate = endOfDay(new Date());

    const now = new Date();
    switch (dateRange) {
      case "today":
        startDate = startOfDay(now);
        break;
      case "yesterday":
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case "week":
        startDate = startOfDay(subDays(now, 7));
        break;
      case "month":
        startDate = startOfMonth(now);
        break;
      case "year":
        startDate = startOfYear(now);
        break;
      default:
        startDate = startOfMonth(now);
    }

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    setLoading(true);

    const qOrders = query(
      collection(db, "orders"),
      where("createdAt", ">=", startTimestamp),
      where("createdAt", "<=", endTimestamp),
    );
    const qCustomers = query(
      collection(db, "customers"),
      where("createdAt", ">=", startTimestamp),
      where("createdAt", "<=", endTimestamp),
    );

    Promise.all([
      getDocs(qOrders).catch((e) => {
        console.error(e);
        return { docs: [] };
      }),
      getDocs(qCustomers).catch((e) => {
        console.error(e);
        return { docs: [] };
      }),
    ]).then(([ordersSnap, customersSnap]) => {
      let revenue = 0;
      let orderCount = 0;
      let pSold = 0;
      const chartMap = new Map<string, number>();

      let pRevenue = 0;
      let sRevenue = 0;

      ordersSnap.docs.forEach((docSnap) => {
        const order = docSnap.data();
        if (order.status === "paid") {
          revenue += order.totalAmount || 0;
          orderCount++;

          const dateStr = order.createdAt
            ? format(order.createdAt.toDate(), "dd/MM")
            : "N/A";
          chartMap.set(
            dateStr,
            (chartMap.get(dateStr) || 0) + (order.totalAmount || 0),
          );

          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              if (item.type === "product") {
                pSold += item.quantity || 1;
                pRevenue += item.price * item.quantity;
              } else {
                sRevenue += item.price * item.quantity;
              }
            });
          }
        }
      });

      setTotalRevenue(revenue);
      setTotalOrdersCount(orderCount);
      setProductsSold(pSold);
      const activeCustomersSnap = customersSnap.docs
        .map((d) => d.data())
        .filter(
          (c: any) =>
            c.status === "active" && !c.deletedAt && !c.deleted_at && !c.hidden,
        );
      setNewCustomersCount(activeCustomersSnap.length);

      const chartArr = Array.from(chartMap.entries()).map(([k, v]) => ({
        name: k,
        revenue: v,
      }));
      setRevenueChart(
        chartArr.length ? chartArr : [{ name: "Không có dữ liệu", revenue: 0 }],
      );

      setOriginData(
        [
          { name: "Sản phẩm", value: pRevenue },
          { name: "Dịch vụ", value: sRevenue },
        ].filter((d) => d.value > 0),
      );

      setLoading(false);
    });
  }, [dateRange]);

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="Tổng Doanh Thu"
          value={`${totalRevenue.toLocaleString("vi-VN")}đ`}
          trend="-"
          positive
          icon={DollarSign}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Tổng Đơn Hàng"
          value={totalOrdersCount.toString()}
          trend="-"
          positive
          icon={ShoppingCart}
          color="emerald"
          loading={loading}
        />
        <StatCard
          title="Khách Hàng Mới"
          value={newCustomersCount.toString()}
          trend="-"
          positive={false}
          icon={Users}
          color="amber"
          loading={loading}
        />
        <StatCard
          title="Sản Phẩm Bán Ra"
          value={productsSold.toString()}
          trend="-"
          positive
          icon={Package}
          color="purple"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">
            Biểu đồ doanh thu
          </h3>
          <div className="h-80">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenueChart}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorRevenue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={(v) => `${v / 1000000}M`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number) => [
                      value.toLocaleString("vi-VN") + "đ",
                      "Doanh thu",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">
            Tỷ trọng doanh thu
          </h3>
          <div className="h-64">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : originData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  Chưa có dữ liệu đồ thị
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={originData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {originData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [
                      value.toLocaleString("vi-VN") + "đ",
                      "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {!loading && originData.length > 0 && (
            <div className="mt-4 space-y-3">
              {originData.map((d, i) => (
                <div
                  key={d.name}
                  className="flex justify-between items-center text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i] }}
                    />
                    <span className="font-bold text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900">
                    {d.value.toLocaleString("vi-VN")}đ
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  positive,
  icon: Icon,
  color,
  loading,
}: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3 md:mb-4 gap-2">
        <div
          className={cn(
            "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0",
            colors[color],
          )}
        >
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div
          className={cn(
            "px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-black tracking-widest flex items-center gap-1 shrink-0 whitespace-nowrap",
            positive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-600",
          )}
        >
          {positive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {trend}
        </div>
      </div>
      <div>
        <h4 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 line-clamp-1">
          {title}
        </h4>
        {loading ? (
          <div className="h-6 md:h-8 w-16 md:w-24 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <p
            className="text-lg md:text-2xl font-black text-slate-900 tracking-tight truncate"
            title={value}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
