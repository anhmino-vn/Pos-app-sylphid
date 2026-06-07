import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Save, Settings, Info, Plus, Trash2 } from 'lucide-react';
import { doc, getDoc, setDoc } from '../../lib/firebaseAdapter';
import { db, LoyaltySettings as ILoyaltySettings } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';

const DEFAULT_SETTINGS: ILoyaltySettings = {
  earnRate: 100000,
  earnPoints: 1,
  roundingMethod: 'down',
  redemptionRate: 1000,
  expirationMonths: null,
  earnOnProducts: true,
  earnOnServices: true,
  categoryMultipliers: {},
  tiers: [
    { name: 'Member', minSpend: 0, discountPercent: 0 },
    { name: 'Silver', minSpend: 10000000, discountPercent: 3 },
    { name: 'Gold', minSpend: 50000000, discountPercent: 5 },
    { name: 'Platinum', minSpend: 100000000, discountPercent: 7 },
    { name: 'Diamond', minSpend: 300000000, discountPercent: 10 },
  ],
  referralPointsEnabled: true,
  referralPointsReward: 100,
  referralRevenuePercent: 0,
};

export function LoyaltySettings() {
  const [settings, setSettings] = useState<ILoyaltySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // For managing dynamic categories
  const [newCatName, setNewCatName] = useState('');
  const [newCatMulti, setNewCatMulti] = useState(2);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'settings', 'loyalty');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() as ILoyaltySettings });
      }
    } catch (error: any) {
      toast.error('Lỗi tải cấu hình: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'loyalty'), {
        ...settings,
        updatedAt: new Date()
      });
      toast.success('Lưu cấu hình thành công!');
    } catch (error: any) {
      toast.error('Lỗi lưu cấu hình: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTierChange = (index: number, field: string, value: number) => {
    const newTiers = [...settings.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setSettings({ ...settings, tiers: newTiers });
  };

  const addCategoryMultiplier = () => {
    if (!newCatName.trim()) return;
    setSettings(prev => ({
      ...prev,
      categoryMultipliers: {
        ...prev.categoryMultipliers,
        [newCatName]: newCatMulti
      }
    }));
    setNewCatName('');
    setNewCatMulti(2);
  };

  const removeCategoryMultiplier = (cat: string) => {
    const newMultipliers = { ...settings.categoryMultipliers };
    delete newMultipliers[cat];
    setSettings({ ...settings, categoryMultipliers: newMultipliers });
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Đang tải cấu hình...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Cấu hình điểm thưởng</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý quy tắc tích lũy và sử dụng điểm thành viên</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Tích điểm */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Settings size={20} /></div>
            <h2 className="text-lg font-bold text-slate-800">1. Quy tắc tích điểm</h2>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Tỷ lệ quy đổi doanh thu</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={settings.earnRate}
                  onChange={e => setSettings({ ...settings, earnRate: Number(e.target.value) })}
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="font-bold text-slate-500">VNĐ</span>
                <span className="font-black text-slate-300">=</span>
                <input
                  type="number"
                  value={settings.earnPoints}
                  onChange={e => setSettings({ ...settings, earnPoints: Number(e.target.value) })}
                  className="w-24 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center"
                />
                <span className="font-bold text-slate-500">Điểm</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Quy tắc làm tròn</label>
              <select
                value={settings.roundingMethod}
                onChange={e => setSettings({ ...settings, roundingMethod: e.target.value as any })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="down">Làm tròn xuống (VD: 2.9 = 2 điểm)</option>
                <option value="up">Làm tròn lên (VD: 2.1 = 3 điểm)</option>
                <option value="decimal">Giữ số thập phân (VD: 2.9 điểm)</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700">Tích điểm áp dụng cho</label>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.earnOnProducts}
                  onChange={e => setSettings({ ...settings, earnOnProducts: e.target.checked })}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-700">Sản phẩm vật lý</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.earnOnServices}
                  onChange={e => setSettings({ ...settings, earnOnServices: e.target.checked })}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-700">Dịch vụ liệu trình</span>
              </label>
            </div>
          </div>
        </div>

        {/* 2. Sử dụng điểm & Thời hạn */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Settings size={20} /></div>
            <h2 className="text-lg font-bold text-slate-800">2. Sử dụng điểm & Hạn dùng</h2>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Giá trị quy đổi ra tiền</label>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-500">1 Điểm</span>
                <span className="font-black text-slate-300">=</span>
                <input
                  type="number"
                  value={settings.redemptionRate}
                  onChange={e => setSettings({ ...settings, redemptionRate: Number(e.target.value) })}
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="font-bold text-slate-500">VNĐ giảm giá</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Thời hạn sử dụng điểm</label>
              <select
                value={settings.expirationMonths === null ? 'none' : settings.expirationMonths}
                onChange={e => setSettings({ ...settings, expirationMonths: e.target.value === 'none' ? null : Number(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="none">Không giới hạn (Vĩnh viễn)</option>
                <option value="6">Hết hạn sau 6 tháng</option>
                <option value="12">Hết hạn sau 12 tháng</option>
                <option value="24">Hết hạn sau 24 tháng</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-2">Điểm thưởng giới thiệu (Referral)</label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.referralPointsEnabled}
                  onChange={e => setSettings({ ...settings, referralPointsEnabled: e.target.checked })}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-700">Bật thưởng điểm người giới thiệu</span>
              </label>
              
              {settings.referralPointsEnabled && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 font-bold">Thưởng điểm cố định</label>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        value={settings.referralPointsReward}
                        onChange={e => setSettings({ ...settings, referralPointsReward: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Điểm</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 font-bold">Hoặc thưởng % doanh thu</label>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        value={settings.referralRevenuePercent}
                        onChange={e => setSettings({ ...settings, referralRevenuePercent: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Phân hạng thành viên */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Settings size={20} /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">3. Phân hạng & Quyền lợi</h2>
              <p className="text-xs text-slate-500">Tự động nâng hạng dựa trên Tổng chi tiêu của khách hàng</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm font-bold text-slate-500 uppercase tracking-widest">
                  <th className="pb-3 w-1/4">Hạng thành viên</th>
                  <th className="pb-3 w-1/3">Ngưỡng chi tiêu tối thiểu</th>
                  <th className="pb-3 w-1/4">Quyền lợi (% Giảm giá)</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings.tiers.map((tier, idx) => (
                  <tr key={tier.name}>
                    <td className="py-4">
                      <span className={cn("px-3 py-1 text-xs font-black uppercase rounded-lg border", 
                        tier.name === 'Diamond' ? "bg-cyan-50 border-cyan-200 text-cyan-700" :
                        tier.name === 'Platinum' ? "bg-slate-800 border-slate-700 text-slate-200" :
                        tier.name === 'Gold' ? "bg-amber-50 border-amber-200 text-amber-700" :
                        tier.name === 'Silver' ? "bg-slate-100 border-slate-300 text-slate-600" :
                        "bg-white border-slate-200 text-slate-500"
                      )}>
                        {tier.name}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <input
                          type="number"
                          value={tier.minSpend}
                          onChange={e => handleTierChange(idx, 'minSpend', Number(e.target.value))}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400">VNĐ</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 w-24">
                        <input
                          type="number"
                          value={tier.discountPercent}
                          onChange={e => handleTierChange(idx, 'discountPercent', Number(e.target.value))}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none text-center"
                        />
                        <span className="text-xs font-bold text-slate-400">%</span>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      {idx > 0 && <span className="text-[10px] text-slate-400 font-medium">({formatCurrency(tier.minSpend)})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Tích điểm đặc biệt */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Settings size={20} /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">4. Hệ số tích điểm đặc biệt</h2>
              <p className="text-xs text-slate-500">Nhân hệ số điểm thưởng cho các danh mục sản phẩm/dịch vụ ưu tiên</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            {Object.entries(settings.categoryMultipliers).map(([cat, multi]) => (
              <div key={cat} className="flex items-center gap-3 bg-purple-50 border border-purple-100 pl-4 pr-2 py-2 rounded-xl">
                <div>
                  <span className="font-bold text-sm text-purple-900">{cat}</span>
                  <span className="mx-2 text-purple-300">|</span>
                  <span className="font-black text-purple-600">x{multi} điểm</span>
                </div>
                <button 
                  onClick={() => removeCategoryMultiplier(cat)}
                  className="p-1.5 hover:bg-purple-100 text-purple-400 hover:text-purple-600 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 max-w-lg">
            <input 
              type="text" 
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Tên danh mục (VD: NMN, Trị liệu)"
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
            />
            <div className="relative w-24">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black">x</span>
              <input 
                type="number" 
                value={newCatMulti}
                onChange={e => setNewCatMulti(Number(e.target.value))}
                min="1"
                step="0.5"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
              />
            </div>
            <button 
              onClick={addCategoryMultiplier}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
            >
              <Plus size={16} /> Thêm
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
