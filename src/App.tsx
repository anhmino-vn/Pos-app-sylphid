import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation 
} from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, UserProfile } from './lib/firebase';
import { motion } from 'motion/react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
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
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (authUser) {
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', authUser.uid), 
          async (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as UserProfile;
              let finalPermissions = userData.permissions;
              
              if (userData.roleId && !userData.permissions) { // Use role perms if custom user permissions not populated
                 try {
                    const { getDoc } = await import('firebase/firestore');
                    const roleRef = await getDoc(doc(db, 'roles', userData.roleId));
                    if (roleRef.exists()) {
                       finalPermissions = roleRef.data().permissions;
                    }
                 } catch (e) { console.error("Error fetching role:", e) }
              }
              
              setProfile({ ...userData, permissions: finalPermissions });
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Profile sync error:", error);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
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
        <Router>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route element={user ? <Layout /> : <Navigate to="/login" />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/services" element={<Services />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/orders" element={<Orders />} />
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
