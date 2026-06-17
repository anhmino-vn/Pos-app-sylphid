import React, { useState, useEffect } from 'react';
import { supabase, UserPermissions } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Lock, Eye, EyeOff, TrendingUp, Users, Package, BarChart3, X, Mail, KeyRound, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

const AnimatedChart = () => {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCycle(c => c + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div key={cycle} className="absolute inset-0 pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute bottom-0 left-[5%] right-[5%] flex items-end justify-between h-[90%] px-2 gap-2 xl:gap-3 opacity-20">
        {[15, 25, 20, 45, 35, 60, 50, 80].map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: `${h}%`, opacity: 1 }}
            transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
            className="w-full bg-gradient-to-t from-[#2563eb] to-blue-300 rounded-t-md"
          />
        ))}
      </div>
      <svg className="absolute bottom-0 left-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
        <motion.path
          d="M -5 90 Q 20 85, 35 70 T 65 45 T 95 15"
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut", delay: 1 }}
        />
        <motion.path
          d="M 93 10 L 100 15 L 92 22 Z"
          fill="#2563eb"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 2.5 }}
          style={{ transformOrigin: '95px 15px' }}
        />
      </svg>
      {[
        { x: 15, y: 87, label: "+12.5%", delay: 1.5 },
        { x: 45, y: 60, label: "+35.6%", delay: 1.8 },
        { x: 75, y: 35, label: "+68.3%", delay: 2.1 },
      ].map((node, i) => (
        <div 
          key={i} 
          className="absolute flex flex-col items-center justify-center"
          style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          <motion.div
            className="text-[#2563eb] font-bold text-[12px] bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-md mb-2 shadow-sm border border-blue-50 whitespace-nowrap"
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: node.delay + 0.2 }}
          >
            {node.label}
          </motion.div>
          <motion.div
            className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#2563eb] shadow-sm relative z-10"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: node.delay }}
          />
        </div>
      ))}
    </div>
  );
};

const TypewriterText = () => {
  const [text, setText] = useState("");
  const fullText = "Nền tảng quản lý\nbán hàng toàn diện";
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleType = () => {
      if (isDeleting) {
        setText(fullText.substring(0, text.length - 1));
      } else {
        setText(fullText.substring(0, text.length + 1));
      }

      if (!isDeleting && text === fullText) {
        timer = setTimeout(() => setIsDeleting(true), 4000);
      } else if (isDeleting && text === "") {
        setIsDeleting(false);
        timer = setTimeout(handleType, 500);
      } else {
        timer = setTimeout(handleType, isDeleting ? 20 : 70);
      }
    };
    timer = setTimeout(handleType, isDeleting ? 20 : 70);
    return () => clearTimeout(timer);
  }, [text, isDeleting]);

  const parts = text.split('\n');
  return (
    <>
      <span className="text-[#1e293b]">{parts[0]}</span>
      {parts.length > 1 && (
        <>
          <br />
          <span className="text-[#2563eb]">{parts[1]}</span>
        </>
      )}
      <span className="text-[#2563eb] font-light animate-pulse ml-[2px]">|</span>
    </>
  );
};

const Feature = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="flex flex-col items-start gap-[6px]">
    <div className="w-[36px] h-[36px] rounded-xl bg-blue-50/80 text-blue-600 flex items-center justify-center border border-blue-100/50 shadow-sm">
      {React.cloneElement(icon as React.ReactElement, { className: 'w-[18px] h-[18px]' })}
    </div>
    <div>
      <h3 className="text-[12px] font-bold text-[#1e293b] leading-tight mb-0.5">{title}</h3>
      <p className="text-[10px] text-slate-500 leading-tight">{desc}</p>
    </div>
  </div>
);

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const loginEmail = email.includes('@') ? email : `${email}@amagency.local`;
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      if (data.user) {
        await setupUserDoc(data.user);
      }
    } catch (err: any) {
      const loginEmail = email.includes('@') ? email : `${email}@amagency.local`;
      const { data: profile } = await supabase.from('user_profiles').select('last_password_change').eq('email', loginEmail).maybeSingle();
      
      if (profile?.last_password_change) {
        const diffTime = Math.abs(new Date().getTime() - new Date(profile.last_password_change).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setError(`Sai mật khẩu. Bạn đã thay đổi mật khẩu ${diffDays} ngày gần đây.`);
      } else {
        setError('Tài khoản hoặc mật khẩu không chính xác.');
      }
      console.error(err);
      setLoading(false);
    }
  };

  const setupUserDoc = async (user: User) => {
    try {
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      const isAdmin = user.email === 'anhmino.it@gmail.com' || user.email === 'ngocanhvux4@gmail.com';
      
      const adminPermissions: UserPermissions = {
        products: { view: true, add: true, edit: true, delete: true },
        orders: { view: true, add: true, edit: true, delete: true },
        stock: { view: true, import: true, export: true },
        customers: { view: true, edit: true },
        reports: { view: true },
        services: { view: true, add: true, edit: true, delete: true },
        documents: { view: true, add: true, edit: true, delete: true, print: true },
        staff: { view: true, add: true, edit: true }
      };

      const defaultPermissions: UserPermissions = {
        products: { view: true, add: isAdmin, edit: isAdmin, delete: isAdmin },
        orders: { view: true, add: true, edit: isAdmin, delete: isAdmin },
        stock: { view: true, import: isAdmin, export: isAdmin },
        customers: { view: true, edit: true },
        reports: { view: isAdmin }
      };

      if (!profile) {
        await supabase.from('user_profiles').insert({
          id: user.id,
          email: user.email!,
          role: isAdmin ? 'admin' : 'staff',
          shop_name: 'AM Agency',
          custom_permissions: isAdmin ? adminPermissions : defaultPermissions,
          status: 'active'
        });
      } else {
        if (isAdmin && (profile.role !== 'admin' || !profile.custom_permissions?.reports?.view)) {
          await supabase.from('user_profiles').update({
            role: 'admin',
            custom_permissions: adminPermissions
          }).eq('id', user.id);
        } else if (profile.status === 'locked') {
           await supabase.auth.signOut();
           setError('Tài khoản của bạn đã bị khóa.');
           setLoading(false);
           return;
        }
      }
      
      const { logActivity } = await import('../lib/activityUtils');
      await logActivity(user as any, 'Hệ thống', 'Đăng nhập', `Đăng nhập thành công`);
      navigate('/');
    } catch (err: any) {
       console.error("Setup user doc error:", err);
       setError("Lỗi khi thiết lập tài khoản");
       setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    
    try {
      const emailToUse = recoverEmail.includes('@') ? recoverEmail : `${recoverEmail}@amagency.local`;
      
      // Kiểm tra xem email/phone đã tồn tại trong hệ thống chưa
      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', emailToUse)
        .maybeSingle();

      if (profileErr) {
        throw new Error('Lỗi kiểm tra thông tin tài khoản');
      }

      if (!profile) {
        setForgotError('Email hoặc SĐT chưa đăng ký tài khoản!');
        setForgotLoading(false);
        return;
      }

      sessionStorage.setItem('isRecovering', 'true');
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse);
      if (error) throw error;
      
      setForgotStep(2);
      setForgotSuccess('Mã xác nhận đã được gửi tới Email/SĐT của bạn!');
    } catch (err: any) {
      console.error("Lỗi gửi OTP:", err);
      if (err?.message?.toLowerCase().includes('rate limit') || err?.message?.toLowerCase().includes('seconds') || err?.status === 429) {
        const match = err.message.match(/\d+/);
        const seconds = match ? match[0] : '60';
        setForgotError(`Bạn vui lòng gửi mã xác nhận sau ${seconds} giây. Xin cảm ơn!`);
      } else {
        setForgotError('Không thể gửi mã xác nhận. Vui lòng kiểm tra lại thông tin.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    
    try {
      const emailToUse = recoverEmail.includes('@') ? recoverEmail : `${recoverEmail}@amagency.local`;
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse);
      if (error) throw error;
      
      setForgotSuccess('Mã xác nhận mới đã được gửi tới Email/SĐT của bạn!');
    } catch (err: any) {
      console.error("Lỗi gửi lại OTP:", err);
      if (err?.message?.toLowerCase().includes('rate limit') || err?.message?.toLowerCase().includes('seconds') || err?.status === 429) {
        const match = err.message.match(/\d+/);
        const seconds = match ? match[0] : '60';
        setForgotError(`Bạn vui lòng chờ ${seconds} giây để gửi lại mã.`);
      } else {
        setForgotError('Không thể gửi lại mã. Vui lòng thử lại sau.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    
    try {
      const emailToUse = recoverEmail.includes('@') ? recoverEmail : `${recoverEmail}@amagency.local`;
      const { error } = await supabase.auth.verifyOtp({ email: emailToUse, token: otp, type: 'recovery' });
      if (error) throw error;
      
      setForgotStep(3);
      setForgotSuccess('Xác thực thành công. Vui lòng tạo mật khẩu mới.');
    } catch (err: any) {
      setForgotError(`Mã xác nhận không chính xác hoặc đã hết hạn. Lỗi: ${err?.message}`);
      console.error("OTP Error:", err);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setForgotError('Mật khẩu nhập lại không trùng khớp.');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>\-_+=\[\]\/\\]/.test(newPassword);
    
    if (!hasLetter || !hasNumber || !hasSpecial) {
      setForgotError('Mật khẩu phải chứa chữ cái, số và ký tự đặc biệt.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    // Không xóa forgotSuccess cũ ngay để giữ nguyên giao diện báo thành công của OTP, chỉ ghi đè khi đổi pass xong.
    
    try {
      // Thử đăng nhập bằng mật khẩu mới. Nếu thành công -> Mật khẩu mới chính là mật khẩu cũ
      const emailToUse = recoverEmail.includes('@') ? recoverEmail : `${recoverEmail}@amagency.local`;
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ 
         email: emailToUse, 
         password: newPassword 
      });
      
      if (!signInError && signInData.user) {
         setForgotError('Mật khẩu mới phải khác với mật khẩu cũ của bạn.');
         setForgotLoading(false);
         return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         await supabase.from('user_profiles').update({ last_password_change: new Date().toISOString() }).eq('id', user.id);
      }
      
      setForgotSuccess('Đổi mật khẩu thành công! Tự động chuyển hướng...');
      setTimeout(() => {
        setIsForgotModalOpen(false);
        setForgotStep(1);
        setRecoverEmail('');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotSuccess('');
        sessionStorage.removeItem('isRecovering');
        window.location.href = '/';
      }, 3000);
    } catch (err: any) {
      setForgotError('Lỗi khi cập nhật mật khẩu. Vui lòng thử lại sau.');
      console.error(err);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeModal = async () => {
    setIsForgotModalOpen(false);
    setForgotStep(1);
    setRecoverEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    
    if (sessionStorage.getItem('isRecovering')) {
       sessionStorage.removeItem('isRecovering');
       await supabase.auth.signOut();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-8 font-sans text-slate-900 w-full overflow-x-hidden relative">
      
      {/* Centered Floating Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[1100px] min-h-[640px] xl:min-h-[700px] bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col lg:flex-row overflow-hidden relative z-10"
      >
        {/* Left Section - Presentation */}
        <div className="flex-1 flex flex-col pt-10 px-8 xl:pt-14 xl:px-12 relative bg-white z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-[60px] h-[60px] rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 overflow-hidden p-0.5">
               <img src="/logo.png" alt="AM Agency Logo" className="w-full h-full rounded-full object-cover" />
            </div>
            <span className="text-[28px] font-bold text-[#1e293b] tracking-tight">AM Agency</span>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8 relative z-20"
          >
            <h1 className="text-[32px] xl:text-[38px] font-bold text-[#1e293b] leading-[1.25] mb-4 min-h-[80px] xl:min-h-[96px]">
              <TypewriterText />
            </h1>
            <p className="text-slate-500 text-[13px] xl:text-[14px] max-w-[380px] leading-relaxed">
              Giải pháp giúp doanh nghiệp quản lý đơn hàng, khách hàng, sản phẩm, doanh thu và tăng trưởng bền vững.
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-20 mb-4 max-w-[500px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Feature icon={<TrendingUp />} title="Quản lý đơn hàng" desc="Tối ưu quy trình" />
            <Feature icon={<Users />} title="Quản lý khách hàng" desc="Chăm sóc hiệu quả" />
            <Feature icon={<Package />} title="Quản lý sản phẩm" desc="Khoa học, chi tiết" />
            <Feature icon={<BarChart3 />} title="Báo cáo doanh số" desc="Theo dõi tức thì" />
          </motion.div>

          <div className="relative flex-1 min-h-[220px] xl:min-h-[280px] w-full mt-4 z-0">
            <AnimatedChart />
          </div>
        </div>

        <div className="hidden lg:block w-px bg-slate-100/80 my-8" />

        {/* Right Section - Form Card */}
        <div className="w-full lg:w-[440px] flex flex-col p-8 xl:p-12 bg-white relative z-20">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col h-full justify-center w-full max-w-[360px] mx-auto"
          >
            <div className="mb-8 text-left">
              <h2 className="text-[28px] font-bold text-[#1e293b] mb-2 tracking-tight">Đăng nhập</h2>
              <p className="text-slate-500 text-[14px]">Chào mừng bạn trở lại! Vui lòng đăng nhập để tiếp tục.</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-50 text-red-600 text-[14px] font-medium border border-red-100 rounded-xl"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#1e293b]">Email hoặc số điện thoại</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Nhập email hoặc số điện thoại" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] rounded-xl outline-none transition-all text-[14px] placeholder:text-slate-400 font-medium" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-semibold text-[#1e293b]">Mật khẩu</label>
                  <button 
                    type="button" 
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-[12px] font-semibold text-[#2563eb] hover:text-blue-700 transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Nhập mật khẩu" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    className="w-full h-12 pl-11 pr-11 bg-white border border-slate-200 focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] rounded-xl outline-none transition-all text-[14px] placeholder:text-slate-400 font-medium" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full h-12 bg-[#0055ff] hover:bg-[#0044cc] text-white font-semibold rounded-xl transition-colors active:scale-[0.99] flex items-center justify-center text-[14px] disabled:opacity-50 mt-6 shadow-sm"
              >
                Đăng nhập
              </button>
            </form>
          </motion.div>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" /> Khôi phục mật khẩu
                </h3>
                <button 
                  onClick={closeModal}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Progress Indicator */}
                <div className="flex items-center justify-between mb-8 relative">
                   <div className="absolute left-0 right-0 h-1 bg-slate-100 top-1/2 -translate-y-1/2 z-0 rounded-full" />
                   <div 
                     className="absolute left-0 h-1 bg-blue-500 top-1/2 -translate-y-1/2 z-0 rounded-full transition-all duration-300"
                     style={{ width: forgotStep === 1 ? '0%' : forgotStep === 2 ? '50%' : '100%' }}
                   />
                   
                   {[1, 2, 3].map((stepNumber) => (
                     <div 
                       key={stepNumber}
                       className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold relative z-10 transition-colors duration-300 ${
                         stepNumber <= forgotStep 
                           ? 'bg-blue-600 text-white ring-4 ring-white' 
                           : 'bg-slate-200 text-slate-500 ring-4 ring-white'
                       }`}
                     >
                       {stepNumber < forgotStep ? <CheckCircle2 className="w-4 h-4" /> : stepNumber}
                     </div>
                   ))}
                </div>

                {forgotError && (
                  <div className="mb-5 p-3.5 bg-red-50 text-red-600 text-[13px] font-medium border border-red-100 rounded-xl">
                    {forgotError}
                  </div>
                )}
                
                {forgotSuccess && (
                  <div className="mb-5 p-3.5 bg-emerald-50 text-emerald-600 text-[13px] font-medium border border-emerald-100 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {forgotSuccess}
                  </div>
                )}

                {/* Step 1: Request OTP */}
                {forgotStep === 1 && (
                  <motion.form 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    onSubmit={handleSendOtp} 
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Email hoặc số điện thoại của bạn</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <UserIcon className="h-4.5 w-4.5 text-slate-400" />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Nhập email / SĐT đã đăng ký" 
                          value={recoverEmail} 
                          onChange={e => setRecoverEmail(e.target.value)} 
                          required 
                          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl outline-none transition-all text-[14px]" 
                        />
                      </div>
                      <p className="text-[12px] text-slate-500 mt-2">
                        Mã xác nhận sẽ được gửi đến email/SĐT này để xác minh danh tính.
                      </p>
                    </div>
                    <button 
                      type="submit" 
                      disabled={forgotLoading || !recoverEmail} 
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 text-[14px]"
                    >
                      {forgotLoading ? 'Đang gửi...' : 'Gửi mã xác nhận'} <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.form>
                )}

                {/* Step 2: Verify OTP */}
                {forgotStep === 2 && (
                  <motion.form 
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    onSubmit={handleVerifyOtp} 
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Mã xác nhận OTP (Thường 6-8 số)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <KeyRound className="h-4.5 w-4.5 text-slate-400" />
                        </div>
                        <input 
                          type="text" 
                          maxLength={8}
                          placeholder="Nhập mã xác nhận (Ví dụ: 12345678)" 
                          value={otp} 
                          onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))} 
                          required 
                          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl outline-none transition-all text-[15px] font-medium tracking-widest" 
                        />
                      </div>
                    </div>
                    
                    <div className="text-center mt-1">
                      <button 
                        type="button" 
                        onClick={handleResendOtp}
                        disabled={forgotLoading}
                        className="text-[13px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors disabled:opacity-50"
                      >
                        Chưa nhận được mã? Gửi lại mã
                      </button>
                    </div>

                    <div className="flex gap-3 mt-2">
                      <button 
                        type="button"
                        onClick={() => setForgotStep(1)}
                        className="w-1/3 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-xl transition-all text-[14px]"
                      >
                        Quay lại
                      </button>
                      <button 
                        type="submit" 
                        disabled={forgotLoading || otp.length < 6} 
                        className="w-2/3 h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center text-[14px]"
                      >
                        {forgotLoading ? 'Đang kiểm tra...' : 'Xác thực mã'}
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* Step 3: New Password */}
                {forgotStep === 3 && (
                  <motion.form 
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    onSubmit={handleUpdatePassword} 
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Mật khẩu mới</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Lock className="h-4.5 w-4.5 text-slate-400" />
                        </div>
                        <input 
                          type={showNewPassword ? "text" : "password"} 
                          placeholder="Tối thiểu 6 ký tự" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          required 
                          className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl outline-none transition-all text-[14px]" 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Nhập lại mật khẩu mới</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Lock className="h-4.5 w-4.5 text-slate-400" />
                        </div>
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          placeholder="Nhập lại chính xác mật khẩu" 
                          value={confirmPassword} 
                          onChange={e => setConfirmPassword(e.target.value)} 
                          required 
                          className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl outline-none transition-all text-[14px]" 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={forgotLoading || !newPassword || !confirmPassword || forgotSuccess.includes('Tự động chuyển hướng')} 
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 mt-2 flex items-center justify-center text-[14px]"
                    >
                      {forgotLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                    </button>
                  </motion.form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-6 left-0 right-0 text-center text-[12px] font-medium text-slate-400 z-30">
        © 2026 AM Agency. All rights reserved.
      </div>
    </div>
  );
}
