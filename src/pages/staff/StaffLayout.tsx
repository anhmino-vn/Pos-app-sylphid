import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, CalendarClock, DollarSign, User, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const StaffLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { icon: Home, label: 'Trang chủ', path: '/staff' },
    { icon: CalendarClock, label: 'Ca làm', path: '/staff/shifts' },
    { icon: DollarSign, label: 'Lương', path: '/staff/payroll' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            S
          </div>
          <span className="font-bold text-slate-800">Nhân Viên</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-500 rounded-full bg-slate-50">
          <LogOut size={18} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 px-6 py-2 flex justify-between items-center z-10 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/staff' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
