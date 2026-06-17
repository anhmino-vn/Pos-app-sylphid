import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation 
} from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from './lib/supabase';
import { motion } from 'motion/react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { CreateOrder } from './pages/CreateOrder';
import { Payment } from './pages/Payment';
import { CustomerDebts } from './pages/CustomerDebts';
import { Customers } from './pages/Customers';
import { Inventory } from './pages/Inventory';
import { Users } from './pages/Users';
import { Health } from './pages/Health';
import { ServicesMaster } from './pages/services/ServicesMaster';
import { Bookings } from './pages/Bookings';
import { Finances } from './pages/Finances';
import { Guides } from './pages/Guides';
import { ActivityLogs } from './pages/ActivityLogs';
import { Reports } from './pages/Reports';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';

import { CategoriesMaster } from './pages/products/CategoriesMaster';
import { ProductSettings } from './pages/products/ProductSettings';

import { Referrers } from './pages/customers/Referrers';
import { ReferredList } from './pages/customers/ReferredList';
import { CommissionHistory } from './pages/customers/CommissionHistory';
import { LoyaltySettings } from './pages/customers/LoyaltySettings';
import { LoyaltyDashboard } from './pages/customers/LoyaltyDashboard';
import { ReferralReport } from './pages/reports/ReferralReport';

import { Vouchers } from './pages/customers/Vouchers';
import { AppointmentList } from './pages/appointments/AppointmentList';
import { AppointmentCalendar } from './pages/appointments/AppointmentCalendar';
import { AppointmentForm } from './pages/appointments/AppointmentForm';
import { StaffScheduler } from './pages/appointments/StaffScheduler';
import { StaffManagement } from './pages/appointments/StaffManagement';
import { RoomManagement } from './pages/appointments/RoomManagement';
import { ServiceCombos } from './pages/services/ServiceCombos';
import { Incomes } from './pages/finances/Incomes';
import { Expenses } from './pages/finances/Expenses';
import { Debts } from './pages/finances/Debts';
import { Funds } from './pages/finances/Funds';
import { FinanceTrash } from './pages/finances/FinanceTrash';
import { Timesheets } from './pages/users/Timesheets';
import { Payroll } from './pages/users/Payroll';
import { StaffCommissions } from './pages/users/StaffCommissions';
import { Schedules } from './pages/users/Schedules';
import { Kpi } from './pages/users/Kpi';
import { Evaluations } from './pages/users/Evaluations';
import { Roles } from './pages/users/Roles';
import { StaffLayout } from './pages/staff/StaffLayout';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { ShiftRegistration } from './pages/staff/ShiftRegistration';
import { MyPayroll } from './pages/staff/MyPayroll';

import { SettingsProvider } from './lib/settings';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileSubscription: any = null;

    const fetchProfile = async (authUser: User) => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error && error.code !== 'PGRST116') { // Ignore row not found temporarily
          console.error("Profile fetch error:", error);
        }

        if (data) {
           let finalPermissions = data.custom_permissions || data.permissions;
           
           if (data.role_id && !finalPermissions) {
              const { data: roleData } = await supabase.from('roles').select('permissions').eq('id', data.role_id).single();
              if (roleData) {
                 finalPermissions = roleData.permissions;
              }
           }
           
           setProfile({ ...data, permissions: finalPermissions } as UserProfile);
        } else {
           // Auto-create profile if missing
           const isAdmin = authUser.email === 'anhmino.it@gmail.com' || authUser.email === 'ngocanhvux4@gmail.com';
           const adminPermissions = {
             products: { view: true, add: true, edit: true, delete: true },
             orders: { view: true, add: true, edit: true, delete: true },
             stock: { view: true, import: true, export: true },
             customers: { view: true, edit: true },
             reports: { view: true },
             services: { view: true, add: true, edit: true, delete: true },
             documents: { view: true, add: true, edit: true, delete: true, print: true },
             staff: { view: true, add: true, edit: true }
           };
           const defaultPermissions = {
             products: { view: true, add: isAdmin, edit: isAdmin, delete: isAdmin },
             orders: { view: true, add: true, edit: isAdmin, delete: isAdmin },
             stock: { view: true, import: isAdmin, export: isAdmin },
             customers: { view: true, edit: true },
             reports: { view: isAdmin }
           };
           
           const newProfile = {
             id: authUser.id,
             email: authUser.email!,
             role: isAdmin ? 'admin' : 'staff',
             shop_name: 'LuxeFlow Retail',
             custom_permissions: isAdmin ? adminPermissions : defaultPermissions,
             status: 'active'
           };
           
           await supabase.from('user_profiles').insert(newProfile);
           setProfile({ ...newProfile, permissions: newProfile.custom_permissions } as any as UserProfile);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const setupAuth = async () => {
       const { data: { session } } = await supabase.auth.getSession();
       if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user);
          
          // Setup real-time profile listener
          const channelId = `profile_${session.user.id}_${Date.now()}`;
          profileSubscription = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${session.user.id}` }, (payload) => {
               if (payload.new) {
                 setProfile(prev => ({ ...prev, ...(payload.new as any) }));
               }
            })
            .subscribe();
            
       } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
       }
    };
    
    setupAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user);
        
        if (!profileSubscription) {
            const channelId = `profile_${session.user.id}_${Date.now()}`;
            profileSubscription = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${session.user.id}` }, (payload) => {
               if (payload.new) {
                 setProfile(prev => ({ ...prev, ...(payload.new as any) }));
               }
            })
            .subscribe();
        }
      } else {
        setUser(null);
        setProfile(null);
        if (profileSubscription) {
           supabase.removeChannel(profileSubscription);
           profileSubscription = null;
        }
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (profileSubscription) {
        supabase.removeChannel(profileSubscription);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2045 50%, #0a1628 100%)' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="mb-8 relative"
          style={{ filter: 'drop-shadow(0 0 32px rgba(251,146,60,0.4)) drop-shadow(0 0 64px rgba(59,130,246,0.2))' }}
        >
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="AM Agency Logo"
            style={{ width: 140, height: 140, objectFit: 'contain', borderRadius: '50%' }}
          />
          <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%)', animationDuration: '2s' }}></div>
        </motion.div>
        <div className="flex flex-col items-center gap-3">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-black tracking-[0.25em] text-base uppercase"
            style={{ color: '#ffffff', letterSpacing: '0.25em' }}
          >
            <span style={{ color: '#ffffff' }}>AM</span>{' '}
            <span style={{ color: '#fb923c' }}>Agency</span>
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-2"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: '#fb923c' }}
                />
              ))}
            </div>
            <p className="font-semibold text-[10px] uppercase tracking-widest" style={{ color: '#64748b' }}>
              Đang khởi tạo hệ thống
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <AuthContext.Provider value={{ user, profile, loading }}>
        <Router basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={(!user || sessionStorage.getItem('isRecovering') === 'true') ? <Login /> : <Navigate to="/" />} />
            
            {/* STAFF MOBILE PORTAL */}
            <Route element={user ? <StaffLayout /> : <Navigate to="/login" />}>
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/shifts" element={<ShiftRegistration />} />
              <Route path="/staff/payroll" element={<MyPayroll />} />
            </Route>

            {/* ADMIN / MANAGER DASHBOARD */}
            <Route element={user ? <Layout /> : <Navigate to="/login" />}>
              <Route path="/" element={profile?.role === 'staff' ? <Navigate to="/staff" /> : <Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/categories" element={<CategoriesMaster />} />
              <Route path="/products/settings" element={<ProductSettings />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/services" element={<ServicesMaster />} />
              <Route path="/services/combos" element={<Navigate to="/services" />} />
              <Route path="/services/*" element={<ServicesMaster />} />
              <Route path="/bookings" element={<Navigate to="/appointments" />} />
              <Route path="/bookings/rooms" element={<Navigate to="/appointments/rooms" />} />
              <Route path="/bookings/history" element={<Navigate to="/appointments" />} />
              <Route path="/bookings/staff" element={<Navigate to="/appointments/staff" />} />
              {/* ── APPOINTMENTS MODULE ── */}
              <Route path="/appointments" element={<AppointmentList />} />
              <Route path="/appointments/calendar" element={<AppointmentCalendar />} />
              <Route path="/appointments/staff" element={<StaffScheduler />} />
              <Route path="/appointments/new" element={<AppointmentForm />} />
              <Route path="/appointments/:id/edit" element={<AppointmentForm />} />
              <Route path="/appointments/staff-config" element={<StaffManagement />} />
              <Route path="/appointments/rooms" element={<RoomManagement />} />
              <Route path="/finances" element={<Finances />} />
              <Route path="/finances/funds" element={<Funds />} />
              <Route path="/finances/incomes" element={<Incomes />} />
              <Route path="/finances/expenses" element={<Expenses />} />
              <Route path="/finances/debts" element={<Debts />} />
              <Route path="/finances/trash" element={<FinanceTrash />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/create" element={<CreateOrder />} />
              <Route path="/orders/payments" element={<Payment />} />
              <Route path="/orders/debts" element={<CustomerDebts />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/referrers" element={<Referrers />} />
              <Route path="/customers/referred" element={<ReferredList />} />
              <Route path="/customers/commissions" element={<CommissionHistory />} />
              <Route path="/customers/loyalty" element={<LoyaltyDashboard />} />
              <Route path="/customers/loyalty-settings" element={<LoyaltySettings />} />
              <Route path="/customers/vouchers" element={<Vouchers />} />
              
              {/* ── HEALTH & TREATMENT MODULE ── */}
              <Route path="/health/*" element={<Health />} />

              <Route path="/inventory" element={<Navigate to="/inventory/stock" />} />
              <Route path="/inventory/stock" element={<Inventory />} />
              <Route path="/inventory/transactions" element={<Inventory />} />
              <Route path="/inventory/transactions/:transTab" element={<Inventory />} />
              <Route path="/inventory/suppliers" element={<Inventory />} />
              <Route path="/inventory/suppliers/:id" element={<Inventory />} />
              {(profile?.role === 'admin' || profile?.permissions?.reports?.view) && (
                <>
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/:tab" element={<Reports />} />
                  <Route path="/reports/referrals" element={<ReferralReport />} />
                </>
              )}
              {(profile?.role === 'admin' || profile?.permissions?.staff?.view) && (
                <>
                  <Route path="/users" element={<Users />} />
                  <Route path="/users/timesheets" element={<Timesheets />} />
                  <Route path="/users/schedules" element={<Schedules />} />
                  <Route path="/users/kpi" element={<Kpi />} />
                  <Route path="/users/commissions" element={<StaffCommissions />} />
                  <Route path="/users/payroll" element={<Payroll />} />
                  <Route path="/users/roles" element={<Roles />} />
                  <Route path="/users/evaluations" element={<Evaluations />} />
                  <Route path="/activity-logs" element={<ActivityLogs />} />
                </>
              )}
              {(profile?.role === 'admin' || profile?.permissions?.settings?.view) && (
                 <>
                   <Route path="/settings" element={<Settings />} />
                   <Route path="/settings/:tab" element={<Settings />} />
                 </>
               )}
            </Route>
          </Routes>
        </Router>
      </AuthContext.Provider>
    </SettingsProvider>
  );
}
