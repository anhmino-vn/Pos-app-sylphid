import React, { useEffect, useState, useMemo, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
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
  Warehouse,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Plus,
  Activity,
  DollarSign,
  CreditCard,
  HeartPulse,
  Tags,
  ChevronLeft,
  Moon,
  Sun,
  Monitor,
  Star,
  Clock
} from "lucide-react";
import { supabase, handleSupabaseError } from '../lib/supabase';
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../App";
import { Toaster } from "react-hot-toast";

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  // Settings & States
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarOpen");
      if (saved !== null) return JSON.parse(saved);
      return window.innerWidth >= 1400;
    }
    return true;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  
  // Realtime Badges
  const [badges, setBadges] = useState<{ orders: number; customers: number }>({ orders: 0, customers: 0 });

  // Notifications
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Expanded Submenus
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("expandedMenus");
    return saved ? JSON.parse(saved) : {};
  });

  // Favorites & Recents
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem("favorites");
    return saved ? JSON.parse(saved) : ['/orders/create', '/customers'];
  });
  const [recents, setRecents] = useState<{path: string, name: string}[]>([]);

  // Recent path tracking moved below allNavItems declaration

  // Save Settings
  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("expandedMenus", JSON.stringify(expandedMenus));
  }, [expandedMenus]);

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Fetch Badges
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { count: ordersCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: customersCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
        setBadges({ orders: ordersCount || 0, customers: customersCount || 0 });
      } catch (e) {}
    };
    fetchCounts();

    const channelId = crypto.randomUUID();
    const channel = supabase.channel(`badges-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchCounts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleSubmenu = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }));
    if (!isSidebarOpen) setIsSidebarOpen(true);
  };

  const toggleFavorite = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // RBAC Filtering Logic
  const role = profile?.role || 'admin';
  const hasPermission = (module: string) => {
    if (role === 'admin') return true;
    if (role === 'manager') return !['Hệ thống', 'Nhân sự'].includes(module);
    if (role === 'sale') return ['POS BÁN HÀNG', 'CRM KHÁCH HÀNG', 'LỊCH HẸN'].includes(module);
    if (role === 'kho') return ['KHO', 'SẢN PHẨM & DỊCH VỤ'].includes(module);
    return true; // Default fallback
  };

  const allNavItems = [
    { name: "TỔNG QUAN", icon: LayoutDashboard, path: "/", module: "Dashboard" },
    {
      name: "POS BÁN HÀNG",
      icon: ShoppingCart,
      path: "/orders",
      module: "POS BÁN HÀNG",
      badge: badges.orders,
      subItems: [
        { name: "Tạo đơn hàng", path: "/orders/create" },
        { name: "Hóa đơn", path: "/orders" },
        { name: "Thanh toán", path: "/orders/payments" },
        { name: "Công nợ", path: "/finances/debts" },
      ],
    },
    {
      name: "CRM KHÁCH HÀNG",
      icon: Users,
      path: "/customers",
      module: "CRM KHÁCH HÀNG",
      badge: badges.customers,
      subItems: [
        { name: "Khách hàng", path: "/customers" },
        { name: "Referral", path: "/customers/referrers" },
        { name: "Thành viên", path: "/customers/loyalty" },
      ],
    },
    {
      name: "LỊCH HẸN",
      icon: Calendar,
      path: "/appointments",
      module: "LỊCH HẸN",
      subItems: [
        { name: "Danh sách lịch hẹn", path: "/appointments" },
        { name: "Lịch hôm nay", path: "/appointments/calendar" },
        { name: "Lịch nhân viên", path: "/appointments/staff" },
        { name: "Nhân viên", path: "/appointments/staff-config" },
        { name: "Phòng dịch vụ", path: "/appointments/rooms" },
      ],
    },
    {
      name: "SỨC KHỎE & LIỆU TRÌNH",
      icon: HeartPulse,
      path: "/health",
      module: "SỨC KHỎE",
      subItems: [
        { name: "Hồ sơ sức khỏe", path: "/health/records" },
        { name: "Liệu trình", path: "/health/treatments" },
        { name: "Nhật ký trị liệu", path: "/health/logs" },
        { name: "Kết quả đánh giá", path: "/health/evaluations" },
      ],
    },
    {
      name: "SẢN PHẨM & DỊCH VỤ",
      icon: Sparkles,
      path: "/products",
      module: "SẢN PHẨM & DỊCH VỤ",
      subItems: [
        { name: "Sản phẩm", path: "/products" },
        { name: "Dịch vụ", path: "/services" },
        { name: "Danh mục", path: "/products/categories" },
        { name: "Cấu hình", path: "/products/settings" },
      ],
    },
    {
      name: "KHO",
      icon: Warehouse,
      path: "/inventory",
      module: "KHO",
      subItems: [
        { name: "Kho hàng", path: "/inventory/stock" },
        { name: "Giao dịch kho", path: "/inventory/transactions" },
        { name: "Nhà cung cấp", path: "/inventory/suppliers" },
      ],
    },
    {
      name: "NHÂN SỰ",
      icon: UserCog,
      path: "/users",
      module: "Nhân sự",
      subItems: [
        { name: "Nhân viên", path: "/users" },
        { name: "Phân quyền", path: "/users/roles" },
        { name: "Chấm công", path: "/users/timesheets" },
        { name: "Lương thưởng", path: "/users/payroll" },
      ],
    },
    {
      name: "MARKETING",
      icon: Tags,
      path: "/marketing",
      module: "MARKETING",
      subItems: [
        { name: "Voucher", path: "/customers/vouchers" },
        { name: "Coupon", path: "/marketing/coupons" },
        { name: "Membership", path: "/customers/loyalty-settings" },
        { name: "Affiliate", path: "/customers/commissions" },
      ],
    },
    {
      name: "TÀI CHÍNH",
      icon: DollarSign,
      path: "/finances",
      module: "TÀI CHÍNH",
      subItems: [
        { name: "Thu", path: "/finances/incomes" },
        { name: "Chi", path: "/finances/expenses" },
        { name: "Công nợ", path: "/finances/debts" },
        { name: "Sổ quỹ", path: "/finances/cashbook" },
      ],
    },
    {
      name: "BÁO CÁO",
      icon: BarChart2,
      path: "/reports",
      module: "BÁO CÁO",
      subItems: [
        { name: "Dashboard", path: "/reports" },
        { name: "Doanh thu", path: "/reports/revenue" },
        { name: "Sản phẩm", path: "/reports/products" },
        { name: "Dịch vụ", path: "/reports/services" },
        { name: "Nhân viên", path: "/reports/staff" },
        { name: "Referral", path: "/reports/referral" },
        { name: "Thành viên", path: "/reports/loyalty" },
      ],
    },
    {
      name: "HỆ THỐNG",
      icon: Settings,
      path: "/settings",
      module: "Hệ thống",
      subItems: [
        { name: "Cài đặt chung", path: "/settings/store" },
        { name: "Cấu hình thanh toán", path: "/settings/payment" },
        { name: "Cấu hình hóa đơn", path: "/settings/invoice" },
        { name: "Thùng rác", path: "/settings/trash" },
        { name: "Nhật ký", path: "/settings/logs" },
        { name: "Sao lưu", path: "/settings/backup" },
        { name: "Khôi phục", path: "/settings/restore" },
      ],
    },
  ];

  useEffect(() => {
    // Record recent path
    setRecents(prev => {
      const currentPath = location.pathname;
      const currentName = allNavItems.flatMap(i => i.subItems || [i]).find(i => i.path === currentPath)?.name || currentPath;
      const filtered = prev.filter(p => p.path !== currentPath);
      const updated = [{ path: currentPath, name: currentName }, ...filtered].slice(0, 5);
      return updated;
    });
  }, [location.pathname]);

  const filteredNavItems = allNavItems.filter(item => hasPermission(item.module));

  // Menu Search Filter
  const displayedNavItems = useMemo(() => {
    if (!menuSearchQuery) return filteredNavItems;
    const term = menuSearchQuery.toLowerCase();
    return filteredNavItems.map(item => {
      const matchName = item.name.toLowerCase().includes(term);
      const matchSub = item.subItems?.filter(s => s.name.toLowerCase().includes(term));
      if (matchName || (matchSub && matchSub.length > 0)) {
        return { ...item, subItems: matchSub?.length ? matchSub : item.subItems };
      }
      return null;
    }).filter(Boolean) as typeof allNavItems;
  }, [filteredNavItems, menuSearchQuery]);

  return (
    <div className={cn("flex h-screen overflow-hidden font-sans", theme === 'dark' ? "dark bg-slate-900 text-slate-100" : "bg-[#F8FAFC] text-slate-900")}>
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-slate-900/60 z-[60] backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Layout */}
      <aside
        className={cn(
          "fixed md:relative z-[70] flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out shadow-2xl md:shadow-none",
          // Mobile Drawer
          isMobileMenuOpen ? "translate-x-0 w-[85%] max-w-[320px]" : "-translate-x-full md:translate-x-0",
          // Desktop & Tablet
          "md:translate-x-0",
          isSidebarOpen ? "md:w-[240px] xl:w-[280px]" : "md:w-[72px]"
        )}
      >
        {/* Header / Logo */}
        <div className="h-[72px] flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-blue-600 text-white font-black shadow-lg shadow-blue-500/30">
               <span className="text-xl">S</span>
            </div>
            {(isSidebarOpen || isMobileMenuOpen) && (
              <div className="flex flex-col whitespace-nowrap min-w-0">
                 <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
                   Sylphid
                 </span>
                 <span className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">Enterprise</span>
              </div>
            )}
          </div>
          {/* Collapse Button (Desktop) */}
          <button 
            className="hidden md:flex p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
          {/* Close Button (Mobile) */}
          <button 
            className="md:hidden p-2 text-slate-400"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* User Info & Theme Toggle */}
        {(isSidebarOpen || isMobileMenuOpen) && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                   <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white dark:ring-slate-800 shrink-0">
                     <img src={`https://ui-avatars.com/api/?name=${profile?.name || user?.email}&background=0D8ABC&color=fff&bold=true`} alt="Avatar" className="w-full h-full object-cover" />
                   </div>
                   <div className="flex flex-col min-w-0">
                     <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{profile?.name || 'Admin User'}</span>
                     <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{profile?.role || 'Admin'}</span>
                   </div>
                </div>
                <div className="flex flex-col gap-1">
                   {['light', 'dark', 'auto'].map((t) => (
                      <button 
                         key={t}
                         onClick={() => setTheme(t as any)}
                         className={cn("p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors", theme === t && "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30")}
                         title={`Theme: ${t}`}
                      >
                         {t === 'light' ? <Sun size={12}/> : t === 'dark' ? <Moon size={12}/> : <Monitor size={12}/>}
                      </button>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* Menu Search */}
        {(isSidebarOpen || isMobileMenuOpen) && (
          <div className="p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm chức năng..." 
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all dark:text-white"
                value={menuSearchQuery}
                onChange={e => {
                   setMenuSearchQuery(e.target.value);
                   // Auto expand all when searching
                   if (e.target.value) {
                      const allKeys = displayedNavItems.reduce((acc, item) => ({...acc, [item.name]: true}), {});
                      setExpandedMenus(allKeys);
                   }
                }}
              />
            </div>
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2 px-3 space-y-1">
          
          {/* Favorites & Recents Section (Only visible when expanded) */}
          {(isSidebarOpen || isMobileMenuOpen) && !menuSearchQuery && (
            <>
              {favorites.length > 0 && (
                <div className="mb-4 mt-2">
                   <div className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-2">
                      <Star size={10} className="text-amber-400"/> Đã ghim
                   </div>
                   {favorites.map(path => {
                      const item = allNavItems.flatMap(i => i.subItems || [i]).find(i => i.path === path);
                      if(!item) return null;
                      return (
                        <NavLink key={path} to={path} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 group">
                           <span>{item.name}</span>
                           <button onClick={(e) => toggleFavorite(e, path)} className="opacity-0 group-hover:opacity-100 text-amber-400"><X size={12}/></button>
                        </NavLink>
                      );
                   })}
                </div>
              )}
              {recents.length > 0 && (
                <div className="mb-4">
                   <div className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-2">
                      <Clock size={10} /> Gần đây
                   </div>
                   {recents.map(r => (
                      <NavLink key={r.path} to={r.path} className="flex items-center px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800">
                         {r.name}
                      </NavLink>
                   ))}
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-slate-800 my-2 mx-2"></div>
            </>
          )}

          {displayedNavItems.map((item) => {
            const hasSub = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedMenus[item.name];

            return (
              <div key={item.name} className="relative group">
                {/* Tooltip for collapsed mode */}
                {!isSidebarOpen && !isMobileMenuOpen && (
                  <div className="absolute left-[70px] top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold opacity-0 invisible group-hover:opacity-100 group-hover:visible whitespace-nowrap z-[100] shadow-xl pointer-events-none transition-all duration-200">
                    {item.name}
                    {item.badge ? <span className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white rounded text-[9px]">{item.badge}</span> : null}
                  </div>
                )}

                {hasSub ? (
                  <div>
                    <button
                      onClick={(e) => toggleSubmenu(item.name, e)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02]",
                        isExpanded ? "bg-slate-50 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isExpanded ? "text-blue-600" : "text-slate-500")} />
                        {(isSidebarOpen || isMobileMenuOpen) && (
                          <span className={cn("font-bold text-sm tracking-tight truncate", isExpanded ? "text-blue-600" : "text-slate-700 dark:text-slate-300")}>{item.name}</span>
                        )}
                      </div>
                      {(isSidebarOpen || isMobileMenuOpen) && (
                        <div className="flex items-center gap-2">
                           {item.badge ? <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-md text-[10px] font-black">{item.badge}</span> : null}
                           <ChevronRight size={14} className={cn("text-slate-400 transition-transform duration-200", isExpanded && "rotate-90 text-blue-600")} />
                        </div>
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {(isSidebarOpen || isMobileMenuOpen) && isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden flex flex-col ml-[22px] pl-4 mt-1 space-y-0.5 border-l-2 border-slate-100 dark:border-slate-800"
                        >
                          {item.subItems?.map((subItem) => (
                            <NavLink
                              key={subItem.path}
                              to={subItem.path}
                              className={({ isActive }) =>
                                cn(
                                  "group flex items-center justify-between text-xs font-bold px-4 py-2.5 rounded-xl transition-all relative overflow-hidden",
                                  isActive
                                    ? "text-blue-700 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/20"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800",
                                )
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" />}
                                  <span className="relative z-10">{subItem.name}</span>
                                  <button 
                                     onClick={(e) => toggleFavorite(e, subItem.path)}
                                     className={cn("opacity-0 group-hover:opacity-100 transition-opacity z-10", favorites.includes(subItem.path) ? "text-amber-400 opacity-100" : "text-slate-300 hover:text-amber-400")}
                                  >
                                     <Star size={12} fill={favorites.includes(subItem.path) ? "currentColor" : "none"}/>
                                  </button>
                                </>
                              )}
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
                        "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] relative overflow-hidden group",
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                          : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 shrink-0" />
                          {(isSidebarOpen || isMobileMenuOpen) && (
                            <span className="text-sm font-bold tracking-tight truncate">{item.name}</span>
                          )}
                        </div>
                        {(isSidebarOpen || isMobileMenuOpen) && (
                          <div className="flex items-center gap-2">
                            {item.badge ? <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-black", isActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-600")}>{item.badge}</span> : null}
                            <button 
                               onClick={(e) => toggleFavorite(e, item.path)}
                               className={cn("opacity-0 group-hover:opacity-100 transition-opacity", favorites.includes(item.path) ? "text-amber-400 opacity-100" : isActive ? "text-white/50 hover:text-amber-400" : "text-slate-300 hover:text-amber-400")}
                            >
                               <Star size={12} fill={favorites.includes(item.path) ? "currentColor" : "none"}/>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer: Logout */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 p-3 rounded-xl text-rose-500 font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          >
            <LogOut size={18} />
            {(isSidebarOpen || isMobileMenuOpen) && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content wrapper */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9] dark:bg-slate-900 relative">
        {/* Mobile Header */}
        <header className="md:hidden h-[60px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0">
           <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-500">
                 <Menu size={24} />
              </button>
              <div className="font-black text-lg text-slate-800 dark:text-white">Sylphid</div>
           </div>
           {/* Add global search or notifications for mobile here if needed */}
        </header>

        {/* Desktop Header Top bar (optional, can be kept minimal) */}
        <div className="hidden md:flex h-[72px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 items-center justify-between px-6 shrink-0 z-10 shadow-sm">
           <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest">{allNavItems.flatMap(i => i.subItems || [i]).find(i => i.path === location.pathname)?.name || 'Dashboard'}</div>
           <div className="flex items-center gap-4">
              <button className="relative p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                 <Bell size={20} />
                 {badges.orders > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
           <Outlet />
        </div>
      </main>
      
      <Toaster position="top-right" toastOptions={{ className: 'text-sm font-medium' }} />
    </div>
  );
}
