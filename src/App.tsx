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
import { Customers } from './pages/Customers';
import { Inventory } from './pages/Inventory';
import { Users } from './pages/Users';
import { Services } from './pages/Services';
import { Bookings } from './pages/Bookings';
import { Guides } from './pages/Guides';
import { ActivityLogs } from './pages/ActivityLogs';
import { Reports } from './pages/Reports';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';

import { Referrers } from './pages/customers/Referrers';
import { ReferredList } from './pages/customers/ReferredList';
import { CommissionHistory } from './pages/customers/CommissionHistory';
import { ReferralReport } from './pages/reports/ReferralReport';

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
          profileSubscription = supabase
            .channel('public:user_profiles')
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
            profileSubscription = supabase
            .channel('public:user_profiles')
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC]">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}
          className="w-20 h-20 bg-blue-600 rounded-[32px] flex items-center justify-center text-white text-4xl font-black shadow-2xl mb-8 relative"
        >
          <div className="absolute inset-0 bg-blue-500 rounded-[32px] animate-ping opacity-20"></div>
          L
        </motion.div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-slate-900 font-black tracking-[0.2em] text-sm uppercase">LuxeFlow</p>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Đang khởi tạo hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <AuthContext.Provider value={{ user, profile, loading }}>
        <Router basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route element={user ? <Layout /> : <Navigate to="/login" />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/services" element={<Services />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/create" element={<CreateOrder />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/referrers" element={<Referrers />} />
              <Route path="/customers/referred" element={<ReferredList />} />
              <Route path="/customers/commissions" element={<CommissionHistory />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/:tab" element={<Inventory />} />
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
                  <Route path="/activity-logs" element={<ActivityLogs />} />
                </>
              )}
              {(profile?.role === 'admin' || profile?.permissions?.settings?.view) && (
                 <Route path="/settings" element={<Settings />} />
              )}
            </Route>
          </Routes>
        </Router>
      </AuthContext.Provider>
    </SettingsProvider>
  );
}
