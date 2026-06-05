import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
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
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../App";

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";

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
  const { profile } = useAuth();

  React.useEffect(() => {
    if (profile?.status === "locked") {
      alert("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
      handleLogout();
    }
  }, [profile?.status]);

  React.useEffect(() => {
    // Listen for low stock (from products) and recent activity (from logs/orders)
    const qLogs = query(
      collection(db, "inventoryLogs"),
      orderBy("createdAt", "desc"),
      limit(5),
    );
    const unsubscribeLogs = onSnapshot(
      qLogs,
      (snapshot) => {
        const logs = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: "inventory",
          title: "Biến động kho",
          message: `${doc.data().productName}: ${doc.data().type === "in" ? "+" : ""}${doc.data().quantity}`,
          time: doc.data().createdAt?.toDate(),
        }));
        setNotifications((prev) =>
          [...logs, ...prev.filter((n) => n.type !== "inventory")].slice(0, 10),
        );
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          "inventoryLogs-notifications",
        );
      },
    );

    const qOrders = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(5),
    );
    const unsubscribeOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const orders = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: "order",
          title: "Đơn hàng mới",
          message: `#${doc.id.slice(-6)} - ${doc.data().customerName || "Khách lẻ"}`,
          time: doc.data().createdAt?.toDate(),
        }));
        setNotifications((prev) =>
          [...orders, ...prev.filter((n) => n.type !== "order")].slice(0, 10),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "orders-notifications");
      },
    );

    const qGuides = query(
      collection(db, "guides"),
      orderBy("createdAt", "desc"),
      limit(3),
    );
    const unsubscribeGuides = onSnapshot(
      qGuides,
      (snapshot) => {
        const guides = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: "guide",
          title: "Tài liệu mới",
          message: doc.data().title,
          time: doc.data().createdAt?.toDate(),
        }));
        setNotifications((prev) =>
          [...guides, ...prev.filter((n) => n.type !== "guide")].slice(0, 10),
        );
      },
      (error) =>
        console.log("Guides notifications error, likely missing index", error),
    );

    return () => {
      unsubscribeLogs();
      unsubscribeOrders();
      unsubscribeGuides();
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { logActivity } = await import("../lib/activityUtils");
      await logActivity(
        auth.currentUser as any,
        "Hệ thống",
        "Đăng xuất",
        `Đã đăng xuất`,
      );
    } catch (e) {}
    await signOut(auth);
    navigate("/login");
  };

  const [expandedMenus, setExpandedMenus] = React.useState<
    Record<string, boolean>
  >({
    "Sản phẩm": false,
    "Nhân sự": false,
    "Kho hàng": false,
    "Báo cáo": false,
  });

  const toggleSubmenu = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedMenus((prev) => ({ ...prev, [name]: !prev[name] }));
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
    }
  };

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    ...(profile?.role === "admin" || profile?.permissions?.products?.view
      ? [
          {
            name: "Sản phẩm",
            icon: Package,
            path: "/products",
            subItems: [
              { name: "Danh sách sản phẩm", path: "/products" },
              ...(profile?.role === "admin" ||
              profile?.permissions?.documents?.view !== false
                ? [{ name: "Hướng dẫn sử dụng", path: "/guides" }]
                : []),
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.services?.view
      ? [{ name: "Dịch vụ", icon: Sparkles, path: "/services" }]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.services?.view
      ? [{ name: "Đặt lịch", icon: Calendar, path: "/bookings" }]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.orders?.view
      ? [{ name: "Đơn hàng", icon: ShoppingCart, path: "/orders" }]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.customers?.view
      ? [
          {
            name: "Khách hàng",
            icon: Users,
            path: "/customers",
            subItems: [
              { name: "Tất cả khách hàng", path: "/customers" },
              { name: "Khách hàng giới thiệu", path: "/customers/referrers" },
              { name: "Khách được giới thiệu", path: "/customers/referred" },
              { name: "Lịch sử hoa hồng", path: "/customers/commissions" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.stock?.view
      ? [
          {
            name: "Kho hàng",
            icon: Warehouse,
            path: "/inventory",
            subItems: [
              { name: "Tổng quan kho", path: "/inventory/overview" },
              { name: "Nhập kho", path: "/inventory/imports" },
              { name: "Xuất kho", path: "/inventory/exports" },
              { name: "Kiểm kê kho", path: "/inventory/reconcile" },
              { name: "Lịch sử kho", path: "/inventory/logs" },
              { name: "Nhà cung cấp", path: "/inventory/suppliers" },
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
              { name: "Danh sách nhân sự", path: "/users" },
              { name: "Nhật ký hoạt động", path: "/activity-logs" },
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
              { name: "Báo cáo doanh thu", path: "/reports/revenue" },
              { name: "Báo cáo đơn hàng", path: "/reports/orders" },
              { name: "Báo cáo sản phẩm", path: "/reports/products" },
              { name: "Báo cáo dịch vụ", path: "/reports/services" },
              { name: "Báo cáo kho", path: "/reports/inventory" },
              { name: "Báo cáo nhân viên", path: "/reports/staff" },
              { name: "Báo cáo khách hàng", path: "/reports/customers" },
              { name: "Báo cáo giới thiệu", path: "/reports/referrals" },
            ],
          },
        ]
      : []),
    ...(profile?.role === "admin" || profile?.permissions?.settings?.view
      ? [{ name: "Cài đặt", icon: Settings, path: "/settings" }]
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
          "fixed md:relative z-[70] flex flex-col h-full bg-[#3b5998] transition-all duration-300 shadow-2xl md:shadow-none",
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "-translate-x-full md:translate-x-0 md:w-20",
        )}
      >
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-blue-600 font-bold text-white">
            {/* Note: User must upload icon.png into public/ for this to display */}
            <img
              src="/icon.png"
              alt="POS SYLPHID Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement!.innerText = "P";
              }}
            />
          </div>
          {isSidebarOpen && (
            <span className="font-bold text-xl tracking-tight text-white uppercase">
              POS SYLPHID
            </span>
          )}
        </div>

        <nav
          className="flex-1 overflow-y-auto min-h-0 px-4 space-y-1 py-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style>{`
            nav::-webkit-scrollbar { display: none; }
          `}</style>
          {navItems.map((item) => (
            <div key={item.name}>
              {item.subItems ? (
                <div>
                  <button
                    onClick={(e) => toggleSubmenu(item.name, e)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative text-blue-100 hover:text-white hover:bg-white/10",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 shrink-0 transition-colors" />
                      {isSidebarOpen && (
                        <span className="font-medium">{item.name}</span>
                      )}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isSidebarOpen && expandedMenus[item.name] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col ml-11 mt-1 space-y-1 relative"
                      >
                        {/* Connection line */}
                        <div className="absolute left-[-16px] top-0 bottom-3 w-px bg-white/20" />
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
                                "text-sm px-3 py-2 rounded-lg transition-colors relative block",
                                isActive
                                  ? "text-white font-bold bg-white/20"
                                  : "text-blue-100 hover:text-white hover:bg-white/10",
                              )
                            }
                          >
                            {/* Branch line */}
                            <div className="absolute left-[-16px] top-1/2 w-3 h-px bg-white/20" />
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
                        ? "bg-white/20 text-white shadow-sm font-bold"
                        : "text-blue-100 hover:text-white hover:bg-white/10",
                    )
                  }
                >
                  <item.icon
                    className={cn("w-5 h-5 shrink-0 transition-colors")}
                  />
                  {isSidebarOpen && (
                    <span className="font-medium">{item.name}</span>
                  )}
                  {!isSidebarOpen && (
                    <div className="absolute left-16 bg-[#3b5998] text-white px-3 py-2 rounded-lg text-xs invisible md:group-hover:visible whitespace-nowrap z-50 border border-white/10 shadow-xl">
                      {item.name}
                    </div>
                  )}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-black/10 rounded-2xl p-4 mb-4 border border-white/5">
            <p className="text-blue-100 text-[10px] uppercase tracking-widest font-bold mb-2">
              Gói dịch vụ
            </p>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-300 h-full rounded-full"
                style={{ width: "75%" }}
              ></div>
            </div>
            <p className="text-white text-[10px] mt-2 font-medium">
              3,450 / 5,000 SKUs
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-blue-100 hover:text-white hover:bg-white/10 transition-all font-medium"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8FAFC]">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 relative z-50">
          <div className="flex items-center gap-3 sm:gap-6 w-full max-w-xl">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative group w-full hidden sm:block">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm đơn hàng, sản phẩm..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="relative">
               <button 
                  onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                  className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors border", 
                                isCreateMenuOpen ? "bg-emerald-600 text-white border-emerald-600" : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100")}
               >
                 +
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

            <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">
                  Admin POS SYLPHID
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                  Quản lý kho
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden ring-2 ring-white shadow-sm">
                <img
                  src={`https://ui-avatars.com/api/?name=${auth.currentUser?.email}&background=1e3a8a&color=fff`}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
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
