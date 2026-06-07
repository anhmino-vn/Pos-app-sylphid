import React, { useState, useEffect } from 'react';
import { Settings2, Barcode, QrCode, Tag, Heart, Save, Loader2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { collection, doc, getDoc, setDoc } from '../../lib/firebaseAdapter';
import { db } from '../../lib/supabase';
import toast from 'react-hot-toast';

export function ProductSettings() {
  const [activeTab, setActiveTab] = useState<'barcode' | 'qrcode' | 'price_rules' | 'commissions'>('price_rules');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    // Barcode settings
    barcode_width: 38,
    barcode_height: 25,
    barcode_cols: 2,
    // Price rules
    enable_wholesale: false,
    enable_happy_hour: false,
    // Commission & Points
    default_commission_rate: 5, // 5%
    default_referral_rate: 10,  // 10%
    points_earning_rate: 10000, // 10,000 VNĐ = 1 Point
    points_redemption_value: 1000 // 1 Point = 1,000 VNĐ
  });

  const tabs = [
    { id: 'price_rules', label: 'Quy tắc giá', icon: Tag },
    { id: 'commissions', label: 'Hoa hồng & Điểm', icon: Heart },
    { id: 'barcode', label: 'Barcode', icon: Barcode },
    { id: 'qrcode', label: 'QR Code', icon: QrCode },
  ] as const;

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'system_settings', 'products');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (error) {
        console.error('Lỗi lấy cấu hình:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'system_settings', 'products');
      await setDoc(docRef, settings, { merge: true });
      toast.success('Đã lưu cấu hình thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-30 bg-[#F8FAFC] pt-4 md:pt-6 pb-4 md:pb-6 -mt-4 md:-mt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">Cấu hình Hệ thống</h1>
           <p className="text-slate-500 text-xs md:text-sm mt-1">Cấu hình mặc định áp dụng trên toàn hệ thống, chỉ admin có quyền sửa đổi.</p>
        </div>
        <button 
           onClick={handleSave}
           disabled={saving}
           className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50"
        >
           {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
           Lưu cấu hình
        </button>
      </div>

      <div className="bg-white p-1.5 rounded-2xl md:rounded-[20px] shadow-sm border border-slate-100 flex overflow-x-auto hide-scrollbar mb-6 shrink-0">
        {tabs.map(tab => {
           const Icon = tab.icon;
           const isActive = activeTab === tab.id;
           return (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                 "flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl md:rounded-[14px] text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all",
                 isActive ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
               )}
             >
               <Icon className="w-4 h-4" />
               {tab.label}
             </button>
           );
        })}
      </div>

      <div className="flex-1 bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col">
        {/* PRICE RULES */}
        {activeTab === 'price_rules' && (
           <div className="space-y-8 max-w-2xl">
              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 mb-6">Quy tắc tính giá mặc định</h3>
                 <div className="space-y-6">
                    <label className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer">
                       <input 
                          type="checkbox" 
                          checked={settings.enable_wholesale}
                          onChange={(e) => setSettings({...settings, enable_wholesale: e.target.checked})}
                          className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                       />
                       <div>
                          <p className="text-sm font-bold text-slate-900">Bật tính năng giá sỉ (Bán buôn)</p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">Hệ thống sẽ tự động chuyển sang giá sỉ khi khách hàng mua số lượng đạt mốc cấu hình trong từng sản phẩm.</p>
                       </div>
                    </label>

                    <label className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer">
                       <input 
                          type="checkbox" 
                          checked={settings.enable_happy_hour}
                          onChange={(e) => setSettings({...settings, enable_happy_hour: e.target.checked})}
                          className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                       />
                       <div>
                          <p className="text-sm font-bold text-slate-900">Bật chiến dịch Happy Hour</p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">Tự động áp dụng giá ưu đãi cho các dịch vụ được đặt trong khung giờ vàng cấu hình trước.</p>
                       </div>
                    </label>
                 </div>
              </div>
           </div>
        )}

        {/* COMMISSIONS */}
        {activeTab === 'commissions' && (
           <div className="space-y-8 max-w-2xl">
              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 mb-6 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" />
                    Chính sách tích điểm
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỉ lệ quy đổi điểm (VNĐ = 1 Điểm)</label>
                       <input 
                          type="number"
                          value={settings.points_earning_rate}
                          onChange={(e) => setSettings({...settings, points_earning_rate: Number(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                       />
                       <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Info className="w-3 h-3"/> Ví dụ: 10,000đ = 1 điểm</p>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá trị 1 điểm (VNĐ)</label>
                       <input 
                          type="number"
                          value={settings.points_redemption_value}
                          onChange={(e) => setSettings({...settings, points_redemption_value: Number(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                       />
                       <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Info className="w-3 h-3"/> Dùng để giảm giá khi khách thanh toán</p>
                    </div>
                 </div>
              </div>

              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 mb-6 mt-8 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-500" />
                    Tỉ lệ hoa hồng mặc định
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hoa hồng nhân viên bán hàng (%)</label>
                       <input 
                          type="number"
                          value={settings.default_commission_rate}
                          onChange={(e) => setSettings({...settings, default_commission_rate: Number(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hoa hồng người giới thiệu (Referral) (%)</label>
                       <input 
                          type="number"
                          value={settings.default_referral_rate}
                          onChange={(e) => setSettings({...settings, default_referral_rate: Number(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                       />
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* BARCODE */}
        {activeTab === 'barcode' && (
           <div className="space-y-8 max-w-2xl">
              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 mb-6">Mẫu in mã vạch (Barcode)</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chiều ngang (mm)</label>
                       <input 
                          type="number"
                          value={settings.barcode_width}
                          onChange={(e) => setSettings({...settings, barcode_width: Number(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chiều cao (mm)</label>
                       <input 
                          type="number"
                          value={settings.barcode_height}
                          onChange={(e) => setSettings({...settings, barcode_height: Number(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số cột hiển thị</label>
                       <select 
                          value={settings.barcode_cols}
                          onChange={(e) => setSettings({...settings, barcode_cols: Number(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 appearance-none"
                       >
                          <option value={1}>1 cột</option>
                          <option value={2}>2 cột</option>
                          <option value={3}>3 cột</option>
                       </select>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* QRCODE */}
        {activeTab === 'qrcode' && (
           <div className="space-y-8 max-w-2xl">
              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 mb-6">Mẫu in mã QR</h3>
                 <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 border-dashed text-center">
                    <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-600">Cấu hình in QR Code tương tự Barcode nhưng được tối ưu cho chuẩn QR.</p>
                    <p className="text-xs text-slate-400 mt-2">Tính năng đang trong quá trình hoàn thiện.</p>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
