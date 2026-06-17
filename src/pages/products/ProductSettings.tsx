import React, { useState, useEffect, useRef } from 'react';
import { Settings2, Barcode, QrCode, Tag, Heart, Save, Loader2, Info, Plus, Trash2, Scale, Percent } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { collection, doc, getDoc, setDoc } from '../../lib/firebaseAdapter';
import { db } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { v4 as uuidv4 } from 'uuid';

export function ProductSettings() {
  const [activeTab, setActiveTab] = useState('price_rules');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<any>({
    enable_wholesale: false,
    wholesale_rules: [],
    enable_happy_hour: false,
    happy_hour_rules: [],
    
    default_commission_rate: 5,
    default_referral_rate: 10,
    points_earning_rate: 10000,
    points_redemption_value: 1000,
    points_expiry_months: 12,
    points_min_redemption: 100,

    barcode_width: 38,
    barcode_height: 25,
    barcode_format: 'CODE128',
    barcode_show_price: true,
    barcode_show_name: true,
    barcode_font_size: 12,
    
    qrcode_fgColor: '#000000',
    qrcode_bgColor: '#ffffff',
    qrcode_size: 128,
    qrcode_error_level: 'M',
    
    units: [
      { id: 'u1', name: 'Cái', ratio: 1, base: 'Cái' },
      { id: 'u2', name: 'Hộp', ratio: 12, base: 'Cái' }
    ],
    
    taxes: [
      { id: 't1', name: 'VAT 0%', rate: 0, isDefault: false },
      { id: 't2', name: 'VAT 8%', rate: 8, isDefault: true },
      { id: 't3', name: 'VAT 10%', rate: 10, isDefault: false }
    ],
    price_includes_tax: true
  });

  const [initialSettings, setInitialSettings] = useState<any>(null);

  const tabs = [
    { id: 'price_rules', label: 'Quy tắc giá', icon: Tag },
    { id: 'commissions', label: 'Hoa hồng & Điểm', icon: Heart },
    { id: 'barcode', label: 'Barcode', icon: Barcode },
    { id: 'qrcode', label: 'QR Code', icon: QrCode },
    { id: 'units', label: 'Đơn vị tính', icon: Scale },
    { id: 'taxes', label: 'Thuế / VAT', icon: Percent },
  ] as const;

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'system_settings', 'products');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setSettings((prev: any) => ({ ...prev, ...data }));
          setInitialSettings({ ...settings, ...data });
        } else {
          setInitialSettings(settings);
        }
      } catch (error) {
        console.error('Lỗi lấy cấu hình:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (initialSettings) {
      setHasChanges(JSON.stringify(settings) !== JSON.stringify(initialSettings));
    }
  }, [settings, initialSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'system_settings', 'products');
      await setDoc(docRef, settings, { merge: true });
      setInitialSettings(settings);
      setHasChanges(false);
      toast.success('Đã lưu cấu hình thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky Save Bar */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC] pt-4 md:pt-6 pb-4 -mt-4 md:-mt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">Cấu hình Danh mục & Sản phẩm</h1>
           <p className="text-slate-500 text-xs md:text-sm mt-1">Quản lý quy tắc giá, in tem nhãn, đơn vị và thuế suất</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              Có thay đổi chưa lưu
            </span>
          )}
          <button 
             onClick={handleSave}
             disabled={saving || !hasChanges}
             className={cn(
               "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95",
               hasChanges 
                 ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20" 
                 : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
             )}
          >
             {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
             Lưu cấu hình
          </button>
        </div>
      </div>

      <div className="bg-white p-1.5 rounded-2xl md:rounded-[20px] shadow-sm border border-slate-100 flex overflow-x-auto hide-scrollbar mb-6 shrink-0 gap-1">
        {tabs.map(tab => {
           const Icon = tab.icon;
           const isActive = activeTab === tab.id;
           return (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={cn(
                 "shrink-0 flex items-center justify-center gap-2 py-3 px-4 md:px-6 rounded-xl md:rounded-[14px] text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all",
                 isActive ? "bg-slate-900 text-white shadow-md shadow-slate-900/20" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
               )}
             >
               <Icon className="w-4 h-4" />
               <span className="hidden sm:inline">{tab.label}</span>
             </button>
           );
        })}
      </div>

      <div className="flex-1 bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col min-h-0">
        {activeTab === 'price_rules' && <PriceRules settings={settings} updateSetting={updateSetting} />}
        {activeTab === 'commissions' && <Commissions settings={settings} updateSetting={updateSetting} />}
        {activeTab === 'barcode' && <BarcodeTab settings={settings} updateSetting={updateSetting} />}
        {activeTab === 'qrcode' && <QRCodeTab settings={settings} updateSetting={updateSetting} />}
        {activeTab === 'units' && <UnitsTab settings={settings} updateSetting={updateSetting} />}
        {activeTab === 'taxes' && <TaxesTab settings={settings} updateSetting={updateSetting} />}
      </div>
    </div>
  );
}

// ==========================================
// TABS COMPONENTS
// ==========================================

function PriceRules({ settings, updateSetting }: any) {
  const addWholesale = () => updateSetting('wholesale_rules', [...(settings.wholesale_rules || []), { id: uuidv4(), minQty: 10, discountPercent: 5 }]);
  const removeWholesale = (id: string) => updateSetting('wholesale_rules', settings.wholesale_rules.filter((r: any) => r.id !== id));
  
  const addHappyHour = () => updateSetting('happy_hour_rules', [...(settings.happy_hour_rules || []), { id: uuidv4(), startTime: '09:00', endTime: '11:00', discountPercent: 10 }]);
  const removeHappyHour = (id: string) => updateSetting('happy_hour_rules', settings.happy_hour_rules.filter((r: any) => r.id !== id));

  return (
    <div className="space-y-10 max-w-3xl">
      {/* WHOLESALE */}
      <div className="space-y-4">
        <label className="flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-100 bg-slate-50 cursor-pointer transition-all hover:border-blue-400">
          <input type="checkbox" checked={settings.enable_wholesale} onChange={e => updateSetting('enable_wholesale', e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <div className="flex-1">
            <p className="text-base font-black text-slate-900">Tính năng giá sỉ (Wholesale)</p>
            <p className="text-sm text-slate-500 mt-1">Giảm giá theo % khi khách hàng mua số lượng đạt mốc.</p>
          </div>
        </label>
        
        {settings.enable_wholesale && (
          <div className="pl-12 space-y-3">
            {(settings.wholesale_rules || []).map((rule: any, i: number) => (
              <div key={rule.id} className="flex items-center gap-3 bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                <span className="text-sm font-bold text-slate-400 w-6">{i + 1}.</span>
                <span className="text-sm font-semibold text-slate-600">Mua từ</span>
                <input type="number" min="1" value={rule.minQty} onChange={e => {
                  const newRules = [...settings.wholesale_rules];
                  newRules[i].minQty = Number(e.target.value);
                  updateSetting('wholesale_rules', newRules);
                }} className="w-20 px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-center font-bold" />
                <span className="text-sm font-semibold text-slate-600">sản phẩm, giảm</span>
                <input type="number" min="0" max="100" value={rule.discountPercent} onChange={e => {
                  const newRules = [...settings.wholesale_rules];
                  newRules[i].discountPercent = Number(e.target.value);
                  updateSetting('wholesale_rules', newRules);
                }} className="w-20 px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-center font-bold text-emerald-600" />
                <span className="text-sm font-bold text-slate-400">%</span>
                <div className="flex-1"></div>
                <button onClick={() => removeWholesale(rule.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addWholesale} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Thêm mốc giá sỉ
            </button>
          </div>
        )}
      </div>

      {/* HAPPY HOUR */}
      <div className="space-y-4">
        <label className="flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-100 bg-slate-50 cursor-pointer transition-all hover:border-amber-400">
          <input type="checkbox" checked={settings.enable_happy_hour} onChange={e => updateSetting('enable_happy_hour', e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
          <div className="flex-1">
            <p className="text-base font-black text-slate-900">Chiến dịch Happy Hour (Khung giờ vàng)</p>
            <p className="text-sm text-slate-500 mt-1">Giảm giá dịch vụ theo % khi khách hàng sử dụng trong khung giờ cố định mỗi ngày.</p>
          </div>
        </label>
        
        {settings.enable_happy_hour && (
          <div className="pl-12 space-y-3">
            {(settings.happy_hour_rules || []).map((rule: any, i: number) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                <span className="text-sm font-bold text-slate-400 w-6">{i + 1}.</span>
                <span className="text-sm font-semibold text-slate-600">Từ</span>
                <input type="time" value={rule.startTime} onChange={e => {
                  const newRules = [...settings.happy_hour_rules];
                  newRules[i].startTime = e.target.value;
                  updateSetting('happy_hour_rules', newRules);
                }} className="px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/20 font-bold" />
                <span className="text-sm font-semibold text-slate-600">đến</span>
                <input type="time" value={rule.endTime} onChange={e => {
                  const newRules = [...settings.happy_hour_rules];
                  newRules[i].endTime = e.target.value;
                  updateSetting('happy_hour_rules', newRules);
                }} className="px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/20 font-bold" />
                <span className="text-sm font-semibold text-slate-600">, giảm</span>
                <input type="number" min="0" max="100" value={rule.discountPercent} onChange={e => {
                  const newRules = [...settings.happy_hour_rules];
                  newRules[i].discountPercent = Number(e.target.value);
                  updateSetting('happy_hour_rules', newRules);
                }} className="w-20 px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/20 text-center font-bold text-emerald-600" />
                <span className="text-sm font-bold text-slate-400">%</span>
                <div className="flex-1 min-w-[20px]"></div>
                <button onClick={() => removeHappyHour(rule.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addHappyHour} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Thêm khung giờ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Commissions({ settings, updateSetting }: any) {
  const [calcInput, setCalcInput] = useState(1000000);
  const earnedPoints = Math.floor(calcInput / (settings.points_earning_rate || 1));
  const redeemedValue = earnedPoints * (settings.points_redemption_value || 0);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-1 space-y-2 w-full">
          <h3 className="text-sm font-black uppercase text-rose-600 flex items-center gap-2"><Heart className="w-4 h-4"/> Live Preview: Tích & Tiêu điểm</h3>
          <p className="text-xs text-rose-500 font-medium">Nhập số tiền khách mua hàng để xem số điểm nhận được.</p>
          <input type="number" value={calcInput} onChange={e => setCalcInput(Number(e.target.value))} className="w-full px-4 py-3 bg-white border border-rose-200 rounded-xl outline-none font-black text-rose-700 text-lg" />
        </div>
        <div className="flex gap-4 md:gap-8 justify-center w-full md:w-auto">
          <div className="text-center">
            <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1">Điểm nhận được</p>
            <p className="text-3xl font-black text-rose-600">{earnedPoints.toLocaleString()}</p>
          </div>
          <div className="w-px bg-rose-200"></div>
          <div className="text-center">
            <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1">Giá trị đổi tương đương</p>
            <p className="text-3xl font-black text-emerald-600">{redeemedValue.toLocaleString()}đ</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỉ lệ quy đổi điểm (VNĐ = 1 Điểm)</label>
          <input type="number" value={settings.points_earning_rate} onChange={(e) => updateSetting('points_earning_rate', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá trị 1 điểm khi tiêu (VNĐ)</label>
          <input type="number" value={settings.points_redemption_value} onChange={(e) => updateSetting('points_redemption_value', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời hạn sử dụng điểm (Tháng)</label>
          <input type="number" value={settings.points_expiry_months} onChange={(e) => updateSetting('points_expiry_months', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số điểm tối thiểu để đổi</label>
          <input type="number" value={settings.points_min_redemption} onChange={(e) => updateSetting('points_min_redemption', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900" />
        </div>
      </div>
      
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 mb-6 mt-8 flex items-center gap-2">Tỉ lệ hoa hồng mặc định</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hoa hồng NV bán hàng (%)</label>
          <input type="number" value={settings.default_commission_rate} onChange={(e) => updateSetting('default_commission_rate', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hoa hồng Referral (%)</label>
          <input type="number" value={settings.default_referral_rate} onChange={(e) => updateSetting('default_referral_rate', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900" />
        </div>
      </div>
    </div>
  );
}

function BarcodeTab({ settings, updateSetting }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      try {
        JsBarcode(canvasRef.current, "8935217101683", {
          format: settings.barcode_format || "CODE128",
          width: 2,
          height: settings.barcode_height,
          displayValue: false,
          margin: 0
        });
      } catch (e) { console.error('Lỗi sinh barcode', e); }
    }
  }, [settings.barcode_format, settings.barcode_height]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Format</label>
            <select value={settings.barcode_format} onChange={e => updateSetting('barcode_format', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 appearance-none">
              <option value="CODE128">CODE128</option>
              <option value="EAN13">EAN-13</option>
              <option value="EAN8">EAN-8</option>
              <option value="UPC">UPC</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chiều cao (px)</label>
            <input type="number" value={settings.barcode_height} onChange={e => updateSetting('barcode_height', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chiều ngang nhãn (mm)</label>
            <input type="number" value={settings.barcode_width} onChange={e => updateSetting('barcode_width', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cỡ chữ (px)</label>
            <input type="number" value={settings.barcode_font_size} onChange={e => updateSetting('barcode_font_size', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900" />
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.barcode_show_name} onChange={e => updateSetting('barcode_show_name', e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
            <span className="text-sm font-bold text-slate-700">Hiển thị tên sản phẩm trên nhãn</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.barcode_show_price} onChange={e => updateSetting('barcode_show_price', e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
            <span className="text-sm font-bold text-slate-700">Hiển thị giá bán trên nhãn</span>
          </label>
        </div>
      </div>

      <div className="bg-slate-50 rounded-3xl p-8 flex flex-col items-center justify-center border border-slate-200">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Live Preview Nhãn in</h3>
        <div className="bg-white border border-slate-300 shadow-sm flex flex-col items-center justify-center" style={{ width: settings.barcode_width * 3.7795275591, padding: '8px' }}>
          {settings.barcode_show_name && <p className="font-bold text-center truncate w-full mb-1" style={{ fontSize: settings.barcode_font_size }}>Sữa rửa mặt Cetaphil</p>}
          <canvas ref={canvasRef}></canvas>
          <p className="font-mono mt-0.5" style={{ fontSize: settings.barcode_font_size - 2 }}>8935217101683</p>
          {settings.barcode_show_price && <p className="font-black mt-1" style={{ fontSize: settings.barcode_font_size + 2 }}>320.000đ</p>}
        </div>
      </div>
    </div>
  );
}

function QRCodeTab({ settings, updateSetting }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kích thước (px)</label>
            <input type="number" value={settings.qrcode_size} onChange={e => updateSetting('qrcode_size', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mức độ sửa lỗi</label>
            <select value={settings.qrcode_error_level} onChange={e => updateSetting('qrcode_error_level', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 appearance-none">
              <option value="L">Low (7%)</option>
              <option value="M">Medium (15%)</option>
              <option value="Q">Quartile (25%)</option>
              <option value="H">High (30%)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Màu nền (Background)</label>
            <div className="flex gap-2">
              <input type="color" value={settings.qrcode_bgColor} onChange={e => updateSetting('qrcode_bgColor', e.target.value)} className="w-12 h-11 rounded-lg cursor-pointer" />
              <input type="text" value={settings.qrcode_bgColor} onChange={e => updateSetting('qrcode_bgColor', e.target.value)} className="w-full px-3 bg-slate-50 rounded-xl outline-none font-mono text-sm uppercase" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Màu QR (Foreground)</label>
            <div className="flex gap-2">
              <input type="color" value={settings.qrcode_fgColor} onChange={e => updateSetting('qrcode_fgColor', e.target.value)} className="w-12 h-11 rounded-lg cursor-pointer" />
              <input type="text" value={settings.qrcode_fgColor} onChange={e => updateSetting('qrcode_fgColor', e.target.value)} className="w-full px-3 bg-slate-50 rounded-xl outline-none font-mono text-sm uppercase" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 rounded-3xl p-8 flex flex-col items-center justify-center border border-slate-200">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Live Preview QR Code</h3>
        <div className="bg-white p-4 shadow-sm border border-slate-200 rounded-xl">
           <QRCodeCanvas 
             value="https://example.com/product/123" 
             size={settings.qrcode_size} 
             bgColor={settings.qrcode_bgColor}
             fgColor={settings.qrcode_fgColor}
             level={settings.qrcode_error_level}
           />
        </div>
      </div>
    </div>
  );
}

function UnitsTab({ settings, updateSetting }: any) {
  const addUnit = () => updateSetting('units', [...(settings.units || []), { id: uuidv4(), name: '', ratio: 1, base: '' }]);
  const removeUnit = (id: string) => updateSetting('units', settings.units.filter((u: any) => u.id !== id));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
         <p className="text-sm text-slate-500">Khai báo danh sách các đơn vị tính và tỉ lệ quy đổi (VD: 1 Lốc = 6 Lon).</p>
         <button onClick={addUnit} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all"><Plus className="w-4 h-4"/> Thêm ĐVT</button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/80 text-xs text-slate-500 uppercase font-black">
            <tr>
              <th className="px-4 py-3">Tên đơn vị</th>
              <th className="px-4 py-3 text-center">Tỉ lệ</th>
              <th className="px-4 py-3">So với đơn vị gốc</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(settings.units || []).map((u: any, i: number) => (
              <tr key={u.id} className="bg-white">
                <td className="px-4 py-2">
                   <input type="text" placeholder="Thùng, Hộp..." value={u.name} onChange={e => {
                     const newU = [...settings.units]; newU[i].name = e.target.value; updateSetting('units', newU);
                   }} className="w-full px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 font-bold text-slate-800" />
                </td>
                <td className="px-4 py-2 w-28">
                   <input type="number" min="1" value={u.ratio} onChange={e => {
                     const newU = [...settings.units]; newU[i].ratio = Number(e.target.value); updateSetting('units', newU);
                   }} className="w-full px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 text-center font-bold text-emerald-600" />
                </td>
                <td className="px-4 py-2">
                   <input type="text" placeholder="Cái, Lon..." value={u.base} onChange={e => {
                     const newU = [...settings.units]; newU[i].base = e.target.value; updateSetting('units', newU);
                   }} className="w-full px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 font-bold text-slate-800" />
                </td>
                <td className="px-4 py-2 text-right">
                   <button onClick={() => removeUnit(u.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxesTab({ settings, updateSetting }: any) {
  const addTax = () => updateSetting('taxes', [...(settings.taxes || []), { id: uuidv4(), name: '', rate: 0, isDefault: false }]);
  const removeTax = (id: string) => updateSetting('taxes', settings.taxes.filter((t: any) => t.id !== id));
  
  const setAsDefault = (id: string) => {
    const newTaxes = settings.taxes.map((t: any) => ({ ...t, isDefault: t.id === id }));
    updateSetting('taxes', newTaxes);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
        <input type="checkbox" checked={settings.price_includes_tax} onChange={e => updateSetting('price_includes_tax', e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-slate-300" />
        <span className="font-bold text-slate-900">Giá bán đã bao gồm thuế (Price includes tax)</span>
      </label>

      <div className="flex items-center justify-between mt-6">
         <p className="text-sm font-bold text-slate-800">Các loại thuế / VAT</p>
         <button onClick={addTax} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"><Plus className="w-3.5 h-3.5"/> Thêm Thuế</button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/80 text-xs text-slate-500 uppercase font-black">
            <tr>
              <th className="px-4 py-3">Tên mức thuế</th>
              <th className="px-4 py-3 text-center">Tỉ lệ (%)</th>
              <th className="px-4 py-3 text-center">Mặc định</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(settings.taxes || []).map((t: any, i: number) => (
              <tr key={t.id} className={cn("bg-white", t.isDefault && "bg-blue-50/30")}>
                <td className="px-4 py-2">
                   <input type="text" placeholder="VAT 8%..." value={t.name} onChange={e => {
                     const newT = [...settings.taxes]; newT[i].name = e.target.value; updateSetting('taxes', newT);
                   }} className="w-full px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 font-bold text-slate-800" />
                </td>
                <td className="px-4 py-2 w-28">
                   <input type="number" min="0" max="100" value={t.rate} onChange={e => {
                     const newT = [...settings.taxes]; newT[i].rate = Number(e.target.value); updateSetting('taxes', newT);
                   }} className="w-full px-3 py-1.5 bg-slate-50 rounded-lg outline-none focus:ring-2 text-center font-bold text-blue-600" />
                </td>
                <td className="px-4 py-2 text-center">
                   <input type="radio" name="default_tax" checked={t.isDefault} onChange={() => setAsDefault(t.id)} className="w-4 h-4 text-blue-600 cursor-pointer" />
                </td>
                <td className="px-4 py-2 text-right">
                   <button onClick={() => removeTax(t.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
