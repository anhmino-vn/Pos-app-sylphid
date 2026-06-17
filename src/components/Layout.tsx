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
import { supabase, db, handleSupabaseError } from '../lib/supabase';
import { doc, onSnapshot } from '../lib/firebaseAdapter';
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Toaster } from "react-hot-toast";
import { getIcon } from "../lib/icons";
import { defaultNavItems } from "../lib/navigation";
import { useAuth } from "../App";
import { useAutoCleanup } from "../lib/useAutoCleanup";

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
  
  // Realtime Badges & Settings
  const [badges, setBadges] = useState<{ orders: number; customers: number }>({ orders: 0, customers: 0 });
  const [systemSettings, setSystemSettings] = useState<any>(null);

  // Auto Cleanup background task
  useAutoCleanup(systemSettings);

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

    const unsubSettings = onSnapshot(doc(db, 'system_configs', 'global'), (docSnap) => {
       if (docSnap.exists()) {
          setSystemSettings(docSnap.data());
       }
    });

    return () => { 
      supabase.removeChannel(channel); 
      unsubSettings();
    };
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

  // Auto Theme Logic
  useEffect(() => {
    if (!systemSettings?.ui) return;
    
    const applyTheme = () => {
      const configTheme = systemSettings.ui.theme;
      if (configTheme === 'system') {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTime = currentHour * 60 + currentMin;

        const lightStart = systemSettings.ui.autoThemeTimes?.lightStart || '06:00';
        const darkStart = systemSettings.ui.autoThemeTimes?.darkStart || '18:00';

        const [lightH, lightM] = lightStart.split(':').map(Number);
        const [darkH, darkM] = darkStart.split(':').map(Number);
        
        const lightTime = lightH * 60 + lightM;
        const darkTime = darkH * 60 + darkM;

        let isDark = false;
        if (lightTime < darkTime) {
          // Normal case: light is 06:00, dark is 18:00
          // Dark if before lightTime OR after darkTime
          isDark = currentTime < lightTime || currentTime >= darkTime;
        } else {
          // Night shift case: light is 18:00, dark is 06:00
          // Dark if between darkTime and lightTime
          isDark = currentTime >= darkTime && currentTime < lightTime;
        }

        setTheme(isDark ? 'dark' : 'light');
      } else {
        setTheme(configTheme || 'light');
      }
    };

    applyTheme();
    // Re-check every minute if system theme is used
    const interval = setInterval(applyTheme, 60000);
    return () => clearInterval(interval);
  }, [systemSettings?.ui]);

  // RBAC Filtering Logic
  const role = profile?.role || 'admin';
  const hasPermission = (module: string) => {
    if (role === 'admin') return true;
    if (role === 'manager') return !['Hệ thống', 'Nhân sự'].includes(module);
    if (role === 'sale') return ['POS BÁN HÀNG', 'CRM KHÁCH HÀNG', 'LỊCH HẸN'].includes(module);
    if (role === 'kho') return ['KHO', 'SẢN PHẨM & DỊCH VỤ'].includes(module);
    return true; // Default fallback
  };
  const rawNavItems = systemSettings?.ui?.navigation?.length ? systemSettings.ui.navigation : defaultNavItems;
  const allNavItems = rawNavItems.map((item: any) => ({
    ...item,
    icon: getIcon(item.iconName)
  }));
  const filteredNavItems = allNavItems.filter((item: any) => hasPermission(item.module));

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
          "fixed md:relative z-[70] flex flex-col h-full border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out shadow-2xl md:shadow-none shrink-0",
          // Mobile Drawer
          isMobileMenuOpen ? "translate-x-0 w-[85%] max-w-[320px]" : "-translate-x-full md:translate-x-0",
          // Desktop & Tablet
          "md:translate-x-0",
          isSidebarOpen ? "md:w-[240px] xl:w-[280px]" : "md:w-[72px]"
        )}
        style={{
          backgroundColor: systemSettings?.ui?.sidebar?.backgroundColor || undefined
        }}
      >
        {/* Header / Logo */}
        <div className="h-[72px] flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {systemSettings?.business?.logo ? (
              <div className="w-10 h-10 rounded-xl shrink-0 overflow-hidden shadow-lg shadow-blue-500/30 bg-slate-50 flex items-center justify-center p-1">
                <img src={systemSettings.business.logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-blue-600 text-white font-black shadow-lg shadow-blue-500/30">
                 <span className="text-xl">S</span>
              </div>
            )}
            {(isSidebarOpen || isMobileMenuOpen) && (
              <div className="flex flex-col whitespace-nowrap min-w-0">
                 <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
                   {systemSettings?.business?.name || 'Sylphid'}
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
                          <span className={cn("font-bold text-sm tracking-tight truncate", isExpanded ? "text-blue-600" : "dark:text-slate-300")} style={{ color: isExpanded ? undefined : (systemSettings?.ui?.sidebar?.parentMenuColor || undefined) }}>{item.name}</span>
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
                                  <span className="relative z-10" style={{ color: isActive ? undefined : (systemSettings?.ui?.sidebar?.childMenuColor || undefined) }}>{subItem.name}</span>
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
              <div className="font-black text-lg text-slate-800 dark:text-white">
                {systemSettings?.business?.name || 'Sylphid'}
              </div>
           </div>
           {/* Add global search or notifications for mobile here if needed */}
        </header>

        {/* Desktop Header Top bar */}
        <div className="hidden md:flex h-[72px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 items-center justify-between px-6 shrink-0 z-10 shadow-sm gap-4">
           {/* Left: Module Title */}
           <div className="text-lg font-black text-slate-800 dark:text-slate-100 min-w-[200px] flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <LayoutDashboard size={18} />
              </div>
              {allNavItems.flatMap(i => i.subItems || [i]).find(i => i.path === location.pathname)?.name || 'Tổng quan'}
           </div>
           
           {/* Center: Search & Quick Actions */}
           <div className="flex-1 max-w-2xl flex items-center gap-4">
              {/* Search Box */}
              <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Tìm kiếm nhanh khách hàng, đơn hàng..." 
                   className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all dark:text-white outline-none shadow-inner"
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-700">Ctrl</span>
                    <span className="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-700">K</span>
                 </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                 <button onClick={() => navigate('/orders/create')} className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-xl font-bold text-sm transition-colors whitespace-nowrap">
                   <Plus size={16} /> <span className="hidden lg:inline">Tạo đơn</span>
                 </button>
                 <button onClick={() => navigate('/appointments/new')} className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-xl font-bold text-sm transition-colors whitespace-nowrap">
                   <Calendar size={16} /> <span className="hidden lg:inline">Đặt lịch</span>
                 </button>
              </div>
           </div>

           {/* Right: Notifications, Theme, User */}
           <div className="flex items-center gap-4 min-w-max">
              <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-700">
                 {/* Theme Toggle */}
                 <div className="hidden lg:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {['light', 'dark', 'auto'].map((t) => (
                       <button 
                          key={t}
                          onClick={() => setTheme(t as any)}
                          className={cn("p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors", theme === t && "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400")}
                          title={`Theme: ${t}`}
                       >
                          {t === 'light' ? <Sun size={14}/> : t === 'dark' ? <Moon size={14}/> : <Monitor size={14}/>}
                       </button>
                    ))}
                 </div>
                 
                 {/* Notifications */}
                 <button className="relative p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors ml-2">
                    <Bell size={20} />
                    {badges.orders > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
                 </button>
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-3">
                 <div className="flex flex-col text-right">
                   <span className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{profile?.name || 'Admin User'}</span>
                   <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{profile?.role || 'Admin'}</span>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white dark:ring-slate-800 shrink-0 shadow-sm cursor-pointer hover:ring-blue-500 transition-all">
                   <img src={`https://ui-avatars.com/api/?name=${profile?.name || user?.email}&background=0D8ABC&color=fff&bold=true`} alt="Avatar" className="w-full h-full object-cover" />
                 </div>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
           <Outlet />
        </div>
      </main>
      
      <Toaster position="top-right" toastOptions={{ className: 'text-sm font-medium' }} />
    </div>
  );
}
