import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
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
  AlertCircle,
  GripVertical,
  Plus
} from 'lucide-react';
import { doc, getDoc, setDoc, onSnapshot } from '../lib/firebaseAdapter';
import { ref, uploadBytesResumable, getDownloadURL } from '../lib/firebaseAdapter';
import { db, storage } from '../lib/supabase';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { IconMap } from '../lib/icons';
import { defaultNavItems } from '../lib/navigation';
import { formatCurrency } from '../lib/utils';
import { ActivityLogs } from './ActivityLogs';
import { BackupRestoreTab } from './settings/BackupRestoreTab';
import { SystemTrashTab } from './settings/SystemTrashTab';

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
    autoThemeTimes?: { lightStart: string; darkStart: string };
    sidebar?: {
      backgroundColor: string;
      parentMenuColor: string;
      childMenuColor: string;
    };
    navigation?: any[];
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
    primaryColor: 'blue',
    autoThemeTimes: { lightStart: '06:00', darkStart: '18:00' },
    sidebar: {
      backgroundColor: '#ffffff',
      parentMenuColor: '#1e293b',
      childMenuColor: '#64748b'
    },
    navigation: defaultNavItems
  }
};

import { useParams, useNavigate } from 'react-router-dom';
import { InvoiceSettings } from './settings/InvoiceSettings';
import { PaymentSettings } from './settings/PaymentSettings';

// ... (interfaces and defaultSettings) ...

const tabs = [
  { id: 'store', label: 'Cài đặt chung', icon: Building2 },
  { id: 'payment', label: 'Cấu hình thanh toán', icon: CreditCard },
  { id: 'invoice', label: 'Cấu hình hóa đơn', icon: Receipt },
  { id: 'inventory', label: 'Cài đặt kho', icon: Box },
  { id: 'referral', label: 'Cài đặt Referral', icon: Users },
  { id: 'ui', label: 'Giao diện', icon: Palette },
  { id: 'trash', label: 'Thùng rác', icon: AlertCircle },
  { id: 'logs', label: 'Nhật ký hệ thống', icon: Activity },
  { id: 'backup', label: 'Sao lưu', icon: HardDrive },
  { id: 'restore', label: 'Khôi phục', icon: RefreshCw },
];

export function Settings() {
  const { profile } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'store';
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
      toast.success('Cập nhật thành công');
      // Optional: Add activity log
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể lưu: ' + (err.message || String(err)));
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
              {tabs.map((tabItem) => {
                const Icon = tabItem.icon;
                const isActive = activeTab === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    onClick={() => navigate(`/settings/${tabItem.id}`)}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all whitespace-nowrap",
                      isActive ? "bg-white text-blue-600 shadow-sm border border-slate-200/60" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 md:w-5 md:h-5", isActive ? "text-blue-600" : "text-slate-400")} />
                    {tabItem.label}
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
                
                {/* LOGS TAB */}
                 {activeTab === 'logs' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <ActivityLogs />
                  </motion.div>
                 )}

                {/* BUSINESS TAB */}
                {activeTab === 'store' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <div>
                           <h3 className="text-lg font-black text-slate-900 uppercase">Thông tin liên hệ</h3>
                           <p className="text-sm text-slate-500 font-medium">Will be displayed on invoices and receipts</p>
                        </div>
                        
                        <div className="flex items-start gap-8 border-b border-slate-100 pb-8">
                           <div className="relative flex flex-col items-center">
                              <div className={cn("w-32 h-32 rounded-3xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-slate-50 relative", !settings.business.logo ? "border-slate-300" : "border-emerald-500")}>
                                 {settings.business.logo ? (
                                    <img src={settings.business.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                                 ) : (
                                    <div className="text-center text-slate-400">
                                       <ImageIcon className="w-8 h-8 mx-auto opacity-50" />
                                       <p className="text-[10px] font-bold mt-2 uppercase tracking-tight">Upload Logo</p>
                                    </div>
                                 )}
                                 <input type="file" title="Upload Logo" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                              </div>
                              {settings.business.logo && (
                                 <button className="mt-3 px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 relative overflow-hidden">
                                   Thay đổi
                                   <input type="file" title="Upload Logo" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                 </button>
                              )}
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
                {activeTab === "invoice" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <InvoiceSettings />
                  </motion.div>
                )}

                {/* PAYMENT TAB */}
                {activeTab === "payment" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <PaymentSettings />
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
                                 <div 
                                    key={index} 
                                    draggable
                                    onDragStart={(e) => {
                                       e.dataTransfer.effectAllowed = 'move';
                                       e.dataTransfer.setData('text/plain', index.toString());
                                    }}
                                    onDragOver={(e) => {
                                       e.preventDefault();
                                       e.dataTransfer.dropEffect = 'move';
                                    }}
                                    onDrop={(e) => {
                                       e.preventDefault();
                                       const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                       const toIndex = index;
                                       if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                                          const ts = [...(settings.referral?.tiers || [])];
                                          const item = ts.splice(fromIndex, 1)[0];
                                          ts.splice(toIndex, 0, item);
                                          updateSetting('referral', 'tiers', ts);
                                       }
                                    }}
                                    className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100"
                                 >
                                   <div className="cursor-move hover:text-blue-600 text-slate-400 p-1 active:cursor-grabbing">
                                      <GripVertical className="w-5 h-5" />
                                   </div>
                                   <div className="flex-1">
                                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Từ (VNĐ)</label>
                                      <input 
                                         type="text" 
                                         value={new Intl.NumberFormat('en-US').format(tier.min)}
                                         onChange={(e) => {
                                           const ts = [...(settings.referral?.tiers || [])];
                                           const val = e.target.value.replace(/,/g, '');
                                           if (!isNaN(Number(val))) {
                                             ts[index].min = Number(val);
                                             updateSetting('referral', 'tiers', ts);
                                           }
                                         }}
                                         className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      />
                                   </div>
                                   <span className="text-slate-300 font-black mt-4">-</span>
                                   <div className="flex-1">
                                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Đến (VNĐ)</label>
                                      <input 
                                         type="text" 
                                         value={new Intl.NumberFormat('en-US').format(tier.max)}
                                         onChange={(e) => {
                                           const ts = [...(settings.referral?.tiers || [])];
                                           const val = e.target.value.replace(/,/g, '');
                                           if (!isNaN(Number(val))) {
                                             ts[index].max = Number(val);
                                             updateSetting('referral', 'tiers', ts);
                                           }
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
                           {settings.ui.theme === 'system' && (
                             <div className="mt-4 grid grid-cols-2 gap-4">
                               <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Giờ Sáng</label>
                                 <input 
                                    type="time" 
                                    value={settings.ui.autoThemeTimes?.lightStart || '06:00'} 
                                    onChange={(e) => updateSetting('ui', 'autoThemeTimes', { ...settings.ui.autoThemeTimes, lightStart: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                 />
                               </div>
                               <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Giờ Tối</label>
                                 <input 
                                    type="time" 
                                    value={settings.ui.autoThemeTimes?.darkStart || '18:00'} 
                                    onChange={(e) => updateSetting('ui', 'autoThemeTimes', { ...settings.ui.autoThemeTimes, darkStart: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                 />
                               </div>
                             </div>
                           )}
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4">Phối màu Sidebar</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Màu nền</label>
                               <div className="flex items-center gap-3">
                                 <input type="color" value={settings.ui.sidebar?.backgroundColor || '#ffffff'} onChange={(e) => updateSetting('ui', 'sidebar', { ...settings.ui.sidebar, backgroundColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer" />
                                 <span className="text-sm font-bold text-slate-700 uppercase">{settings.ui.sidebar?.backgroundColor || '#ffffff'}</span>
                               </div>
                             </div>
                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Chữ Menu Cha</label>
                               <div className="flex items-center gap-3">
                                 <input type="color" value={settings.ui.sidebar?.parentMenuColor || '#1e293b'} onChange={(e) => updateSetting('ui', 'sidebar', { ...settings.ui.sidebar, parentMenuColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer" />
                                 <span className="text-sm font-bold text-slate-700 uppercase">{settings.ui.sidebar?.parentMenuColor || '#1e293b'}</span>
                               </div>
                             </div>
                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Chữ Menu Con</label>
                               <div className="flex items-center gap-3">
                                 <input type="color" value={settings.ui.sidebar?.childMenuColor || '#64748b'} onChange={(e) => updateSetting('ui', 'sidebar', { ...settings.ui.sidebar, childMenuColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer" />
                                 <span className="text-sm font-bold text-slate-700 uppercase">{settings.ui.sidebar?.childMenuColor || '#64748b'}</span>
                               </div>
                             </div>
                           </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4">Quản lý Menu</h4>
                          <div className="space-y-4">
                             {(settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems).map((navItem, index) => (
                                <div key={index} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative group">
                                   <div className="flex items-center gap-4">
                                       <div className="flex flex-col gap-1">
                                          <button 
                                            onClick={() => {
                                              if (index === 0) return;
                                              const newNav = [...(settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems)];
                                              const temp = newNav[index];
                                              newNav[index] = newNav[index - 1];
                                              newNav[index - 1] = temp;
                                              updateSetting('ui', 'navigation', newNav);
                                            }}
                                            disabled={index === 0}
                                            className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:hover:text-slate-300"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                          </button>
                                          <button 
                                            onClick={() => {
                                              const navList = settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems;
                                              if (index === navList.length - 1) return;
                                              const newNav = [...navList];
                                              const temp = newNav[index];
                                              newNav[index] = newNav[index + 1];
                                              newNav[index + 1] = temp;
                                              updateSetting('ui', 'navigation', newNav);
                                            }}
                                            disabled={index === (settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems).length - 1}
                                            className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:hover:text-slate-300"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                          </button>
                                          <button 
                                            onClick={() => {
                                              const newNav = [...(settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems)];
                                              newNav.splice(index, 1);
                                              updateSetting('ui', 'navigation', newNav);
                                            }}
                                            className="text-rose-300 hover:text-rose-500 mt-2"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                          </button>
                                       </div>
                                       <div className="flex-1">
                                         <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Tên Menu Cha</label>
                                         <input type="text" value={navItem.name} onChange={(e) => {
                                            const newNav = [...(settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems)];
                                            newNav[index] = { ...newNav[index], name: e.target.value };
                                            updateSetting('ui', 'navigation', newNav);
                                         }} className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold outline-none" />
                                       </div>
                                       <div>
                                         <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Icon</label>
                                         <select value={navItem.iconName} onChange={(e) => {
                                            const newNav = [...(settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems)];
                                            newNav[index] = { ...newNav[index], iconName: e.target.value };
                                            updateSetting('ui', 'navigation', newNav);
                                         }} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold outline-none max-w-[150px]">
                                           {Object.keys(IconMap).map(iconName => (
                                             <option key={iconName} value={iconName}>{iconName}</option>
                                           ))}
                                         </select>
                                       </div>
                                   </div>
                                   {navItem.subItems && navItem.subItems.length > 0 && (
                                     <div className="mt-4 pl-10 space-y-2">
                                       {navItem.subItems.map((sub: any, sIdx: number) => (
                                         <div key={sIdx} className="flex items-center gap-4 relative">
                                           <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-px bg-slate-300"></div>
                                           <div className="absolute -left-6 -top-4 bottom-1/2 w-px bg-slate-300"></div>
                                           <div className="flex-1">
                                             <input type="text" value={sub.name} onChange={(e) => {
                                                const newNav = JSON.parse(JSON.stringify(settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems));
                                                newNav[index].subItems[sIdx].name = e.target.value;
                                                updateSetting('ui', 'navigation', newNav);
                                             }} className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm outline-none focus:border-blue-500" />
                                           </div>
                                         </div>
                                       ))}
                                     </div>
                                   )}
                                </div>
                             ))}
                             <button
                                onClick={() => {
                                  const newNav = [...(settings.ui.navigation?.length ? settings.ui.navigation : defaultNavItems)];
                                  newNav.push({
                                    name: "MENU MỚI",
                                    iconName: "LayoutDashboard",
                                    path: "/new-menu",
                                    module: "Hệ thống",
                                    subItems: []
                                  });
                                  updateSetting('ui', 'navigation', newNav);
                                }}
                                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                             >
                                <Plus size={16} /> Thêm Menu Cha
                             </button>
                          </div>
                        </div>
                     </div>
                  </motion.div>
                )}

                 {/* TRASH TAB */}
                 {activeTab === 'trash' && (
                    <SystemTrashTab settings={settings} updateSetting={updateSetting} />
                 )}

                 {/* BACKUP & RESTORE TABS */}
                 {activeTab === 'backup' && <BackupRestoreTab type="backup" />}
                 {activeTab === 'restore' && <BackupRestoreTab type="restore" />}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
