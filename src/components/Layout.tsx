import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  UserCog,
  Box,
  Sparkles,
  Calendar,
  BookOpen,
  Warehouse,
  BarChart2,
  ChevronDown,
  Plus,
  Activity,
  Gift
} from "lucide-react";
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../App";
import { Toaster } from "react-hot-toast";

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(
    () => window.innerWidth >= 768,
  );
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = React.useState(false);
  const [notificationLimit, setNotificationLimit] = React.useState(5);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  React.useEffect(() => {
    if (profile?.status === "locked") {
      alert("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
      handleLogout();
    }
  }, [profile?.status]);

  React.useEffect(() => {
    // Fetch initial notifications
    const fetchNotifications = async () => {
      try {
        const [logsRes, ordersRes, guidesRes] = await Promise.all([
          supabase.from("inventory_logs").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("guides").select("*").order("created_at", { ascending: false }).limit(3),
        ]);

        let initialNotifs: any[] = [];
        
        if (logsRes.data) {
           initialNotifs.push(...logsRes.data.map(doc => ({
             id: doc.id, type: "inventory", title: "Biến động kho", message: `${doc.product_name}: ${doc.type === "in" ? "+" : ""}${doc.quantity}`, time: new Date(doc.created_at)
           })));
        }
        if (ordersRes.data) {
           initialNotifs.push(...ordersRes.data.map(doc => ({
             id: doc.id, type: "order", title: "Đơn hàng mới", message: `#${doc.id.slice(-6)} - ${doc.customer_name || "Khách lẻ"}`, time: new Date(doc.created_at)
           })));
        }
        if (guidesRes.data) {
           initialNotifs.push(...guidesRes.data.map(doc => ({
             id: doc.id, type: "guide", title: "Tài liệu mới", message: doc.title, time: new Date(doc.created_at)
           })));
        }

        initialNotifs.sort((a, b) => b.time.getTime() - a.time.getTime());
        setNotifications(initialNotifs.slice(0, 10));
      } catch (e) {
        console.error("Error fetching notifications", e);
      }
    };

    fetchNotifications();

    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_logs' }, payload => {
        setNotifications(prev => [{
           id: payload.new.id, type: "inventory", title: "Biến động kho", message: `${payload.new.product_name}: ${payload.new.type === "in" ? "+" : ""}${payload.new.quantity}`, time: new Date(payload.new.created_at)
        }, ...prev].slice(0, 10));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        setNotifications(prev => [{
           id: payload.new.id, type: "order", title: "Đơn hàng mới", message: `#${payload.new.id.slice(-6)} - ${payload.new.customer_name || "Khách lẻ"}`, time: new Date(payload.new.created_at)
        }, ...prev].slice(0, 10));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guides' }, payload => {
        setNotifications(prev => [{
           id: payload.new.id, type: "guide", title: "Tài liệu mới", message: payload.new.title, time: new Date(payload.new.created_at)
        }, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { logActivity } = await import("../lib/activityUtils");
      await logActivity(
        user as any,
        "Hệ thống",
        "Đăng xuất",
        `Đã đăng xuất`,
      );
    } catch (e) {}
    await supabase.auth.signOut();
    navigate("/login");
  };

  const [expandedMenus, setExpandedMenus] = React.useState<
    Record<string, boolean>
  >({
    "POS Bán hàng": false,
    "CRM Khách hàng": false,
    "Lịch hẹn": false,
    "Sức khỏe & Liệu trình": false,
    "Sản phẩm & Dịch vụ": false,
    "Kho": false,
    "Giới thiệu (Referral)": false,
    "Nhân sự": false,
    "Báo cáo": false,
    "Cài đặt": false,
  });

  const toggleSubmenu = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedMenus((prev) => ({ ...prev, [name]: !prev[name] }));
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
    }
  };

  const navItems = [
    { name: "Tổng quan", icon: LayoutDashboard, path: "/" },
    ...(profile?.role === "admin" || profile?.permissions?.orders?.view
      ? [
          {
            name: "POS Bán hàng",
            icon: ShoppingCart,
            path: "/orders",
            subItems: [
              { name: "Tạo đơn hàng", path: "/orders/create" },
              { name: "Hóa đơn", path: "/orders" },
              { name: "Thanh toán", path: "/orders/payments" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.customers?.view
      ? [
          {
            name: "CRM Khách hàng",
            icon: Users,
            path: "/customers",
            subItems: [
              { name: "Tất cả khách hàng", path: "/customers" },
              { name: "Khách hàng giới thiệu", path: "/customers/referrers" },
              { name: "Khách được giới thiệu", path: "/customers/referred" },
              { name: "Thành viên", path: "/customers/members" },
              { name: "Công nợ", path: "/customers/debts" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.services?.view
      ? [
          {
            name: "Lịch hẹn",
            icon: Calendar,
            path: "/bookings",
            subItems: [
              { name: "Lịch hẹn", path: "/bookings" },
              { name: "Lịch nhân viên", path: "/bookings/staff" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.services?.view
      ? [
          {
            name: "Sức khỏe & Liệu trình",
            icon: Activity,
            path: "/health",
            subItems: [
              { name: "Hồ sơ sức khỏe", path: "/health/records" },
              { name: "Liệu trình", path: "/health/treatments" },
              { name: "Nhật ký trị liệu", path: "/health/logs" },
              { name: "Kết quả tầm soát", path: "/health/screening" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.products?.view
      ? [
          {
            name: "Sản phẩm & Dịch vụ",
            icon: Package,
            path: "/products",
            subItems: [
              { name: "Danh mục", path: "/products/categories" },
              { name: "Sản phẩm", path: "/products" },
              { name: "Dịch vụ", path: "/services" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.stock?.view
      ? [
          {
            name: "Kho",
            icon: Warehouse,
            path: "/inventory",
            subItems: [
              { name: "Tổng quan kho", path: "/inventory/overview" },
              { name: "Nhập kho", path: "/inventory/imports" },
              { name: "Xuất kho", path: "/inventory/exports" },
              { name: "Kiểm kho", path: "/inventory/reconcile" },
              { name: "Điều chỉnh kho", path: "/inventory/adjustments" },
              { name: "Lịch sử kho", path: "/inventory/logs" },
              { name: "Nhà cung cấp", path: "/inventory/suppliers" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.customers?.view
      ? [
          {
            name: "Giới thiệu (Referral)",
            icon: Gift,
            path: "/referrals",
            subItems: [
              { name: "Hoa hồng", path: "/referrals/commissions" },
              { name: "Bảng xếp hạng", path: "/referrals/leaderboard" },
              { name: "Báo cáo", path: "/referrals/reports" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.staff?.view
      ? [
          {
            name: "Nhân sự",
            icon: UserCog,
            path: "/users",
            subItems: [
              { name: "Nhân viên", path: "/users" },
              { name: "Phân quyền", path: "/users/roles" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.reports?.view
      ? [
          {
            name: "Báo cáo",
            icon: BarChart2,
            path: "/reports",
            subItems: [
              { name: "Tổng quan", path: "/reports/overview" },
              { name: "Doanh thu", path: "/reports/revenue" },
              { name: "Đơn hàng", path: "/reports/orders" },
              { name: "Sản phẩm", path: "/reports/products" },
              { name: "Dịch vụ", path: "/reports/services" },
              { name: "Nhân viên", path: "/reports/staff" },
              { name: "Khách hàng", path: "/reports/customers" },
              { name: "Giới thiệu", path: "/reports/referrals" },
              { name: "Kho", path: "/reports/inventory" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.settings?.view
      ? [
          {
            name: "Cài đặt",
            icon: Settings,
            path: "/settings",
            subItems: [
              { name: "Hệ thống", path: "/settings/system" },
              { name: "Audit Log", path: "/activity-logs" },
              { name: "Backup", path: "/settings/backup" },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-slate-900/40 z-[60] backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative z-[70] flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 shadow-2xl md:shadow-none",
          isSidebarOpen
            ? "w-[260px] translate-x-0"
            : "-translate-x-full md:translate-x-0 md:w-[84px]",
        )}
      >
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-blue-600 font-bold text-white shadow-md">
            {/* Note: User must upload icon.png into public/ for this to display */}
            <img
              src="/icon.png"
              alt="POS SYLPHID Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement!.innerText = "S";
              }}
            />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
               <span className="font-black text-lg tracking-tight text-slate-900 leading-tight">
                 Sylphid
               </span>
               <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Health & Wellness</span>
            </div>
          )}
        </div>

        <nav
          className="flex-1 overflow-y-auto min-h-0 px-4 space-y-1 py-6 custom-scrollbar"
        >
          {navItems.map((item) => (
            <div key={item.name}>
              {item.subItems ? (
                <div>
                  <button
                    onClick={(e) => toggleSubmenu(item.name, e)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 shrink-0 transition-colors" />
                      {isSidebarOpen && (
                        <span className="font-bold text-sm tracking-tight">{item.name}</span>
                      )}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isSidebarOpen && expandedMenus[item.name] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col ml-[22px] pl-6 mt-1 space-y-1 border-l border-slate-100 relative"
                      >
                        {item.subItems.map((subItem) => (
                          <NavLink
                            key={subItem.path}
                            to={subItem.path}
                            end={
                              subItem.path === "/products" ||
                              subItem.path === "/services"
                            }
                            className={({ isActive }) =>
                              cn(
                                "text-xs font-bold px-4 py-2.5 rounded-lg transition-colors relative block",
                                isActive
                                  ? "text-blue-600 bg-blue-50/50"
                                  : "text-slate-400 hover:text-slate-900 hover:bg-slate-50",
                              )
                            }
                          >
                            {/* Branch line indicator */}
                            <div className="absolute left-[-24px] top-1/2 w-4 h-px bg-slate-100" />
                            {subItem.name}
                          </NavLink>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-bold",
                    )
                  }
                >
                  <item.icon
                    className={cn("w-5 h-5 shrink-0 transition-colors")}
                  />
                  {isSidebarOpen && (
                    <span className="text-sm tracking-tight">{item.name}</span>
                  )}
                  {!isSidebarOpen && (
                    <div className="absolute left-[70px] bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold invisible md:group-hover:visible whitespace-nowrap z-50 shadow-xl">
                      {item.name}
                    </div>
                  )}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
            <p className="text-slate-400 text-[9px] uppercase tracking-[0.2em] font-black mb-2">
              Gói dịch vụ
            </p>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full"
                style={{ width: "75%" }}
              ></div>
            </div>
            <p className="text-slate-700 text-[10px] mt-2 font-black tracking-tight">
              3,450 / 5,000 SKUs
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-rose-500 hover:bg-rose-50 transition-all font-bold"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8FAFC]">
        {/* Header */}
        <header className="h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 relative z-50">
          <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative group w-full max-w-2xl hidden md:block">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm khách hàng, đơn hàng, lịch hẹn, sản phẩm..."
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-100 rounded-[16px] text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                 <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded-lg">Ctrl + K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="relative hidden sm:block">
               <button 
                  onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                  className={cn("px-4 py-2.5 rounded-[14px] flex items-center gap-2 font-bold text-sm transition-all border shadow-sm", 
                                isCreateMenuOpen ? "bg-blue-700 text-white border-blue-700" : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700")}
               >
                 <Plus className="w-4 h-4" />
                 Tạo nhanh
               </button>
               <AnimatePresence>
                 {isCreateMenuOpen && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setIsCreateMenuOpen(false)} />
                     <motion.div
                       initial={{ opacity: 0, y: 10, scale: 0.95 }}
                       animate={{ opacity: 1, y: 0, scale: 1 }}
                       exit={{ opacity: 0, y: 10, scale: 0.95 }}
                       className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden origin-top-right py-2"
                     >
                        <div className="px-4 py-2 border-b border-slate-50">
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tạo nhanh</p>
                        </div>
                        <div className="flex flex-col">
                           <button onClick={() => { setIsCreateMenuOpen(false); navigate('/orders', { state: { action: 'create' } }); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left w-full">
                              <ShoppingCart className="w-4 h-4 text-emerald-500" />
                              Tạo đơn hàng mới
                           </button>
                           <button onClick={() => { setIsCreateMenuOpen(false); navigate('/bookings', { state: { action: 'create' } }); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left w-full">
                              <Calendar className="w-4 h-4 text-blue-500" />
                              Tạo lịch hẹn
                           </button>
                           <button onClick={() => { setIsCreateMenuOpen(false); navigate('/customers', { state: { action: 'create' } }); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left w-full">
                              <Users className="w-4 h-4 text-purple-500" />
                              Tạo khách hàng
                           </button>
                           <button onClick={() => { setIsCreateMenuOpen(false); navigate('/inventory/imports', { state: { action: 'create' } }); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left w-full">
                              <Box className="w-4 h-4 text-orange-500" />
                              Tạo phiếu nhập kho
                           </button>
                           <button onClick={() => { setIsCreateMenuOpen(false); navigate('/inventory/exports', { state: { action: 'create' } }); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left w-full">
                              <Warehouse className="w-4 h-4 text-rose-500" />
                              Tạo phiếu xuất kho
                           </button>
                           <button onClick={() => { setIsCreateMenuOpen(false); navigate('/reports'); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left w-full">
                              <BarChart2 className="w-4 h-4 text-indigo-500" />
                              Tạo báo cáo
                           </button>
                        </div>
                     </motion.div>
                   </>
                 )}
               </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsNotificationsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="fixed left-4 right-4 top-16 sm:left-auto sm:top-auto sm:absolute sm:right-0 mt-2 sm:w-[380px] bg-white rounded-[24px] shadow-2xl border border-slate-100 z-50 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px] origin-top-right"
                    >
                      <div className="p-5 border-b border-slate-50 flex items-center justify-between shrink-0">
                        <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400">
                          Thông báo mới
                        </h4>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-black">
                          {notifications.length}
                        </span>
                      </div>
                      <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-10 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest">
                            Không có thông báo
                          </div>
                        ) : (
                          notifications
                            .slice(0, notificationLimit)
                            .map((n, i) => (
                              <div
                                key={i}
                                className="p-5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group cursor-pointer"
                              >
                                <div className="flex gap-4">
                                  <div
                                    className={cn(
                                      "w-10 h-10 rounded-xl shrink-0 flex items-center justify-center",
                                      n.type === "order"
                                        ? "bg-emerald-50 text-emerald-600"
                                        : n.type === "guide"
                                          ? "bg-purple-50 text-purple-600"
                                          : "bg-amber-50 text-amber-600",
                                    )}
                                  >
                                    {n.type === "order" ? (
                                      <ShoppingCart className="w-5 h-5" />
                                    ) : n.type === "guide" ? (
                                      <BookOpen className="w-5 h-5" />
                                    ) : (
                                      <Box className="w-5 h-5" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-black text-xs text-slate-900 uppercase tracking-tight line-clamp-1 italic">
                                      {n.title}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-bold mt-0.5 line-clamp-2">
                                      {n.message}
                                    </p>
                                    <p className="text-[9px] text-slate-300 font-bold uppercase mt-2">
                                      {n.time?.toLocaleTimeString("vi-VN")}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                      <div className="flex flex-col shrink-0">
                        {notifications.length > notificationLimit && (
                          <button
                            onClick={() =>
                              setNotificationLimit((prev) => prev + 5)
                            }
                            className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-colors border-b border-slate-50"
                          >
                            Xem thêm ({notifications.length - notificationLimit}
                            )
                          </button>
                        )}
                        <button className="w-full py-4 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-colors">
                          Đánh dấu đã xem tất cả
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-4 pl-4 sm:pl-6 border-l border-slate-200 ml-2">
              <div className="w-[42px] h-[42px] rounded-full bg-slate-200 overflow-hidden shadow-sm border-2 border-white ring-1 ring-slate-100">
                <img
                  src={`https://ui-avatars.com/api/?name=${user?.email}&background=e2e8f0&color=475569&bold=true`}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left hidden sm:block pr-2">
                <p className="text-[13px] font-black text-slate-900 truncate max-w-[120px]">
                  {profile?.name || 'Nguyễn An'}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">
                  Admin
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
      <Toaster position="top-right" toastOptions={{ className: 'text-sm font-medium' }} />
    </div>
  );
}
