import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Receipt, 
  CreditCard, 
  Save, 
  RefreshCw,
  Bell,
  Shield,
  Palette,
  HardDrive,
  Activity,
  Users,
  Box,
  Clock,
  Smartphone,
  Globe,
  Mail,
  Phone,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/utils';

interface SystemSettings {
  business: {
    name: string;
    logo: string;
    hotline: string;
    email: string;
    website: string;
    address: string;
    taxId: string;
  };
  invoice: {
    paperSize: 'A4' | '80mm' | '58mm';
    showLogo: boolean;
    footerText: string;
    returnPolicy: string;
  };
  payment: {
    allowCash: boolean;
    allowTransfer: boolean;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    defaultTransferContent: string;
  };
  inventory: {
    lowStockThreshold: number;
    autoDeductOnPaid: boolean;
    autoRestockOnCancel: boolean;
  };
  referral: {
    commissionMethod: 'PER_ORDER' | 'TOTAL_REVENUE';
    tiers: { min: number; max: number; percent: number }[];
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    primaryColor: string;
  };
}

const defaultSettings: SystemSettings = {
  business: {
    name: 'SYLPHID',
    logo: '',
    hotline: '',
    email: '',
    website: '',
    address: '',
    taxId: ''
  },
  invoice: {
    paperSize: '80mm',
    showLogo: true,
    footerText: 'Cảm ơn quý khách đã mua hàng!',
    returnPolicy: 'Đổi trả miễn phí trong 7 ngày'
  },
  payment: {
    allowCash: true,
    allowTransfer: true,
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    defaultTransferContent: 'Thanh toan don hang'
  },
  inventory: {
    lowStockThreshold: 10,
    autoDeductOnPaid: true,
    autoRestockOnCancel: true
  },
  referral: {
    commissionMethod: 'PER_ORDER',
    tiers: [
      { min: 0, max: 50000000, percent: 3 },
      { min: 50000000, max: 100000000, percent: 5 },
      { min: 100000000, max: 300000000, percent: 7 },
      { min: 300000000, max: 9999999999, percent: 10 }
    ]
  },
  ui: {
    theme: 'light',
    primaryColor: 'blue'
  }
};

const tabs = [
  { id: 'business', label: 'Thông tin doanh nghiệp', icon: Building2 },
  { id: 'invoice', label: 'Cài đặt hóa đơn', icon: Receipt },
  { id: 'payment', label: 'Cài đặt thanh toán', icon: CreditCard },
  { id: 'inventory', label: 'Cài đặt kho', icon: Box },
  { id: 'referral', label: 'Cài đặt Referral (Hoa hồng)', icon: Users },
  { id: 'ui', label: 'Giao diện', icon: Palette },
  { id: 'logs', label: 'Nhật ký hệ thống', icon: Activity },
];

export function Settings() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('business');
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'admin' && !profile?.permissions?.settings?.view) return;
    
    // Listen to real-time config updates if requested
    const unsub = onSnapshot(doc(db, 'system_configs', 'global'), (docSnap) => {
       if (docSnap.exists()) {
          setSettings(docSnap.data() as SystemSettings);
       }
       setLoading(false);
       setIsDirty(false);
    }, (err) => {
       console.error("Error loading settings:", err);
       setLoading(false);
    });
    
    return () => unsub();
  }, [profile]);

  if (profile?.role !== 'admin' && !profile?.permissions?.settings?.view) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
        <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-[28px] flex items-center justify-center mb-6">
          <Shield className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase">Quyền truy cập bị từ chối</h2>
        <p className="text-slate-500 font-medium">Bạn cần quyền quản trị viên hoặc phân quyền tương ứng để truy cập cài đặt.</p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'system_configs', 'global'), settings);
      setIsDirty(false);
      // Optional: Add activity log
    } catch (err) {
      console.error(err);
      alert('Không thể lưu cài đặt. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category: keyof SystemSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setIsDirty(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 400;
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          updateSetting('business', 'logo', canvas.toDataURL('image/png', 0.8));
          setUploadingLogo(false);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        alert('Lỗi khi tải ảnh lên.');
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      setUploadingLogo(false);
    }
  };

  // UI Components
  const renderToggle = (label: string, checked: boolean, onChange: (val: boolean) => void) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <span className="font-bold text-slate-700">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none",
          checked ? 'bg-blue-600' : 'bg-slate-200'
        )}
      >
        <span
          className={cn(
            "inline-block h-6 w-6 transform rounded-full bg-white transition-transform",
            checked ? 'translate-x-7' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  const renderInput = (label: string, icon: any, value: string, onChange: (val: string) => void, type = 'text') => {
    const IconComponent = icon;
    return (
      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">{label}</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <IconComponent className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full pl-12 pr-4 bg-slate-50 border border-slate-200 py-3 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md z-10 sticky top-0 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Cài đặt hệ thống</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Tùy chỉnh và cấu hình toàn bộ hệ thống SYLPHID</p>
        </div>
        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
          {isDirty && <span className="text-[10px] md:text-xs font-bold text-amber-500 bg-amber-50 px-2 md:px-3 py-1 md:py-1.5 rounded-full">Chưa lưu thay đổi</span>}
          <button 
            disabled={saving || (!isDirty && !saving)}
            onClick={handleSave}
            className={cn(
               "px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-[12px] flex items-center gap-2 uppercase tracking-widest transition-all whitespace-nowrap",
               (!isDirty && !saving) ? "bg-slate-100 text-slate-400" :
               "bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-[0.98]"
            )}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu cài đặt
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-72 shrink-0 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-100 p-4 md:p-6 overflow-x-auto md:overflow-y-auto scrollbar-none">
            <h2 className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-4">Danh mục cài đặt</h2>
            <nav className="flex md:flex-col gap-2 md:gap-0 space-y-0 md:space-y-1 w-max md:w-auto pb-1 md:pb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all whitespace-nowrap",
                      isActive ? "bg-white text-blue-600 shadow-sm border border-slate-200/60" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 md:w-5 md:h-5", isActive ? "text-blue-600" : "text-slate-400")} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            {/* System Info Box */}
            <div className="hidden md:block mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <Shield className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Version Info</span>
              </div>
              <p className="text-xs text-blue-600/80 font-bold">SYLPHID ERP v1.0.0</p>
              <p className="text-[10px] text-blue-600/60 mt-1">Super Admin Access</p>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 bg-slate-50/30">
             <div className="max-w-4xl mx-auto space-y-8">
                
                {/* BUSINESS TAB */}
                {activeTab === 'business' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <div>
                           <h3 className="text-lg font-black text-slate-900 uppercase">Thông tin liên hệ</h3>
                           <p className="text-sm text-slate-500 font-medium">Will be displayed on invoices and receipts</p>
                        </div>
                        
                        <div className="flex items-start gap-8 border-b border-slate-100 pb-8">
                           <div className="relative">
                              <div className={cn("w-32 h-32 rounded-3xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-slate-50", !settings.business.logo ? "border-slate-300" : "border-emerald-500")}>
                                 {settings.business.logo ? (
                                    <img src={settings.business.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                                 ) : (
                                    <div className="text-center text-slate-400">
                                       <ImageIcon className="w-8 h-8 mx-auto opacity-50" />
                                       <p className="text-[10px] font-bold mt-2 uppercase tracking-tight">Upload Logo</p>
                                    </div>
                                 )}
                              </div>
                              <input type="file" title="Upload Logo" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                              {uploadingLogo && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-3xl">
                                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                              )}
                           </div>
                           <div className="flex-1 space-y-4">
                              {renderInput("Tên doanh nghiệp", Building2, settings.business.name, (val) => updateSetting('business', 'name', val))}
                              {renderInput("Mã số thuế", Receipt, settings.business.taxId, (val) => updateSetting('business', 'taxId', val))}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           {renderInput("Hotline", Phone, settings.business.hotline, (val) => updateSetting('business', 'hotline', val))}
                           {renderInput("Email", Mail, settings.business.email, (val) => updateSetting('business', 'email', val))}
                           {renderInput("Website", Globe, settings.business.website, (val) => updateSetting('business', 'website', val))}
                        </div>
                        
                        {renderInput("Địa chỉ cửa hàng", Box, settings.business.address, (val) => updateSetting('business', 'address', val))}
                     </div>
                  </motion.div>
                )}

                {/* INVOICE TAB */}
                {activeTab === 'invoice' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <div>
                           <h3 className="text-lg font-black text-slate-900 uppercase">Định dạng hóa đơn</h3>
                           <p className="text-sm text-slate-500 font-medium">Cấu hình mẫu in và nội dung mặc định</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                           {['A4', '80mm', '58mm'].map(size => (
                              <button
                                 key={size}
                                 onClick={() => updateSetting('invoice', 'paperSize', size)}
                                 className={cn(
                                    "p-6 rounded-3xl border-2 text-center transition-all",
                                    settings.invoice.paperSize === size ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-100 bg-white hover:border-slate-200"
                                 )}
                              >
                                 <Receipt className={cn("w-8 h-8 mx-auto mb-2 opacity-80", settings.invoice.paperSize === size ? "text-blue-600" : "text-slate-400")} />
                                 <span className="font-black text-sm block">GIẤY {size}</span>
                              </button>
                           ))}
                        </div>

                        <div className="space-y-4">
                           {renderToggle("Hiển thị Logo trên hóa đơn", settings.invoice.showLogo, (val) => updateSetting('invoice', 'showLogo', val))}
                        </div>
                        
                        <div className="space-y-4 border-t border-slate-100 pt-6">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Chính sách đổi trả (In dưới hóa đơn)</label>
                              <textarea
                                 className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px]"
                                 placeholder="Ví dụ: Hóa đơn đỏ xuất trong ngày. Đổi trả trong 7 ngày..."
                                 value={settings.invoice.returnPolicy}
                                 onChange={(e) => updateSetting('invoice', 'returnPolicy', e.target.value)}
                              />
                           </div>
                           {renderInput("Nội dung Footer (Lời cảm ơn)", Mail, settings.invoice.footerText, (val) => updateSetting('invoice', 'footerText', val))}
                        </div>
                     </div>
                  </motion.div>
                )}

                {/* PAYMENT TAB */}
                {activeTab === 'payment' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <div>
                           <h3 className="text-lg font-black text-slate-900 uppercase">Tùy chọn thanh toán</h3>
                           <p className="text-sm text-slate-500 font-medium">Cấu hình các hình thức thu tiền hiển thị tại POS</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <div className="space-y-4 bg-slate-50 p-6 rounded-[28px] border border-slate-100">
                              <div className="flex items-center gap-3 text-slate-900 mb-4">
                                 <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                    <CreditCard className="w-5 h-5" />
                                 </div>
                                 <span className="font-black">TIỀN MẶT</span>
                              </div>
                              {renderToggle("Cho phép thu tiền mặt", settings.payment.allowCash, (val) => updateSetting('payment', 'allowCash', val))}
                           </div>
                           
                           <div className="space-y-4 bg-slate-50 p-6 rounded-[28px] border border-slate-100">
                              <div className="flex items-center gap-3 text-slate-900 mb-4">
                                 <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                    <Smartphone className="w-5 h-5" />
                                 </div>
                                 <span className="font-black">CHUYỂN KHOẢN & QR</span>
                              </div>
                              {renderToggle("Cho phép chuyển khoản", settings.payment.allowTransfer, (val) => updateSetting('payment', 'allowTransfer', val))}
                           </div>
                        </div>

                        {settings.payment.allowTransfer && (
                           <div className="bg-blue-50/50 p-8 rounded-[32px] border border-blue-100 space-y-6">
                              <h4 className="font-black text-slate-900 uppercase flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" />Thông tin Ngân hàng (Dùng để tạo QR Code)</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                 {renderInput("Tên ngân hàng (VD: Vietcombank, MB)", Building2, settings.payment.bankName, (val) => updateSetting('payment', 'bankName', val))}
                                 {renderInput("Số tài khoản", CreditCard, settings.payment.bankAccountNumber, (val) => updateSetting('payment', 'bankAccountNumber', val))}
                              </div>
                              {renderInput("Tên chủ tài khoản", Users, settings.payment.bankAccountName, (val) => updateSetting('payment', 'bankAccountName', val))}
                              {renderInput("Cú pháp chuyển khoản (Tự chèn mã ĐH)", Receipt, settings.payment.defaultTransferContent, (val) => updateSetting('payment', 'defaultTransferContent', val))}
                           </div>
                        )}
                     </div>
                  </motion.div>
                )}

                {/* INVENTORY TAB */}
                {activeTab === 'inventory' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <div>
                           <h3 className="text-lg font-black text-slate-900 uppercase">Cài đặt vận hành Kho</h3>
                           <p className="text-sm text-slate-500 font-medium">Cấu hình đồng bộ theo đơn hàng tự động</p>
                        </div>
                        
                        <div className="space-y-4">
                           {renderToggle("Tự động TRỪ KHO khi trạng thái đơn là ĐÃ THANH TOÁN", settings.inventory.autoDeductOnPaid, (val) => updateSetting('inventory', 'autoDeductOnPaid', val))}
                           {renderToggle("Tự động HOÀN KHO khi trạng thái đơn là ĐÃ HỦY", settings.inventory.autoRestockOnCancel, (val) => updateSetting('inventory', 'autoRestockOnCancel', val))}
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Mức cảnh báo sắp hết hàng</label>
                           <div className="flex items-center gap-4">
                              <input
                                 type="number"
                                 value={settings.inventory.lowStockThreshold}
                                 onChange={e => updateSetting('inventory', 'lowStockThreshold', Number(e.target.value))}
                                 className="w-32 bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-center"
                              />
                              <span className="font-bold text-slate-500">sản phẩm trong kho</span>
                           </div>
                           <p className="text-[10px] text-slate-400 mt-2">Dashboard sẽ hiển thị danh sách cảnh báo những mặt hàng dưới mốc này.</p>
                        </div>
                     </div>
                  </motion.div>
                )}

                {/* REFERRAL TAB */}
                {activeTab === 'referral' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <div>
                           <h3 className="text-lg font-black text-slate-900 uppercase flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Cài đặt Referral</h3>
                           <p className="text-sm text-slate-500 font-medium">Cấu hình phương pháp tính hoa hồng giới thiệu khách hàng.</p>
                        </div>
                        
                        <div className="space-y-6">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phương thức tính hoa hồng</h4>
                           <div className="flex bg-slate-100 p-1 rounded-[20px] overflow-hidden max-w-xl">
                               <button
                                 onClick={() => updateSetting('referral', 'commissionMethod', 'PER_ORDER')}
                                 className={cn(
                                    "flex-1 py-4 text-xs font-black uppercase rounded-[16px] transition-all",
                                    settings.referral?.commissionMethod === 'PER_ORDER' ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:bg-slate-200/50"
                                 )}
                               >
                                 Tính theo từng hóa đơn
                               </button>
                               <button
                                 onClick={() => updateSetting('referral', 'commissionMethod', 'TOTAL_REVENUE')}
                                 className={cn(
                                    "flex-1 py-4 text-xs font-black uppercase rounded-[16px] transition-all",
                                    settings.referral?.commissionMethod === 'TOTAL_REVENUE' ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:bg-slate-200/50"
                                 )}
                               >
                                 Tính theo tổng doanh số
                               </button>
                           </div>
                           <p className="text-[11px] text-slate-500 font-medium px-2">
                             {settings.referral?.commissionMethod === 'PER_ORDER' 
                                ? "Hoa hồng sẽ được tính riêng theo từng đơn hàng thanh toán thành công của khách được giới thiệu."
                                : "Hoa hồng sẽ được tính dựa trên tổng doanh số lũy kế của tất cả khách hàng được giới thiệu."}
                           </p>
                        </div>

                        <div className="pt-8 border-t border-slate-100">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4 flex items-center justify-between">
                             <span>Hoa hồng theo bậc doanh số</span>
                             <button
                               onClick={() => {
                                 const currentTiers = settings.referral?.tiers || [];
                                 updateSetting('referral', 'tiers', [...currentTiers, { min: 0, max: 0, percent: 0 }]);
                               }}
                               className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                             >
                               + Thêm bậc
                             </button>
                           </h4>
                           <div className="space-y-3">
                              {(settings.referral?.tiers || []).map((tier, index) => (
                                 <div key={index} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                   <div className="flex-1">
                                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Từ (VNĐ)</label>
                                      <input 
                                         type="number" 
                                         value={tier.min}
                                         onChange={(e) => {
                                           const ts = [...(settings.referral?.tiers || [])];
                                           ts[index].min = Number(e.target.value);
                                           updateSetting('referral', 'tiers', ts);
                                         }}
                                         className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      />
                                   </div>
                                   <span className="text-slate-300 font-black mt-4">-</span>
                                   <div className="flex-1">
                                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Đến (VNĐ)</label>
                                      <input 
                                         type="number" 
                                         value={tier.max}
                                         onChange={(e) => {
                                           const ts = [...(settings.referral?.tiers || [])];
                                           ts[index].max = Number(e.target.value);
                                           updateSetting('referral', 'tiers', ts);
                                         }}
                                         className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      />
                                   </div>
                                   <div className="w-24">
                                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Hoa hồng %</label>
                                      <div className="relative">
                                        <input 
                                           type="number" 
                                           step="0.1"
                                           value={tier.percent}
                                           onChange={(e) => {
                                             const ts = [...(settings.referral?.tiers || [])];
                                             ts[index].percent = Number(e.target.value);
                                             updateSetting('referral', 'tiers', ts);
                                           }}
                                           className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none pr-8"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                      </div>
                                   </div>
                                   <button 
                                      onClick={() => {
                                        const ts = settings.referral?.tiers.filter((_, i) => i !== index) || [];
                                        updateSetting('referral', 'tiers', ts);
                                      }}
                                      className="w-10 h-10 mt-4 rounded-xl flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
                                   >
                                     <AlertCircle className="w-5 h-5" />
                                   </button>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </motion.div>
                )}

                {/* UI TAB */}
                {activeTab === 'ui' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <div>
                           <h3 className="text-lg font-black text-slate-900 uppercase">Tùy biến hiển thị</h3>
                           <p className="text-sm text-slate-500 font-medium">Giao diện sẽ áp dụng cho tất cả nhân viên</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4">Chế độ tối (Dark Mode)</h4>
                              <div className="flex bg-slate-100 p-1 rounded-[20px] overflow-hidden">
                                 {['light', 'dark', 'system'].map((t) => (
                                    <button
                                       key={t}
                                       onClick={() => updateSetting('ui', 'theme', t)}
                                       className={cn(
                                          "flex-1 py-3 text-xs font-black uppercase rounded-[16px] transition-all",
                                          settings.ui.theme === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-200/50"
                                       )}
                                    >
                                       {t}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  </motion.div>
                )}

                 {/* LOGS TAB */}
                 {activeTab === 'logs' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center py-20 text-slate-500">
                        <Activity className="w-16 h-16 text-slate-300 mb-4" />
                        <h3 className="text-lg font-black text-slate-900 uppercase">Nhật ký hoạt động hệ thống</h3>
                        <p className="max-w-md mx-auto mt-2">Logs are securely stored via Firebase Audit Logging and can be exported for forensic analysis by Server Admins.</p>
                        <button className="mt-6 px-6 py-3 bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200">Export CSV</button>
                     </div>
                  </motion.div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
