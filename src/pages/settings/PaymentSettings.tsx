import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, CheckCircle2, X, Building2, CreditCard, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface PaymentConfig {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string;
  is_default: boolean;
}

const COMMON_BANKS = [
  'Vietcombank', 'Techcombank', 'MB Bank', 'VIB', 'ACB', 'BIDV', 'VietinBank', 'Sacombank', 'VPBank', 'TPBank'
];

export function PaymentSettings() {
  const [configs, setConfigs] = useState<PaymentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [bankName, setBankName] = useState('Vietcombank');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branch, setBranch] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('payment_configs').select('*').order('created_at', { ascending: false });
      if (error) {
        // Fallback to local storage if table doesn't exist yet
        console.warn("Table payment_configs might not exist yet. Falling back to local storage.", error);
        const localData = localStorage.getItem('mock_payment_configs');
        if (localData) {
           setConfigs(JSON.parse(localData));
        } else {
           setConfigs([]);
        }
      } else {
        setConfigs(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountName || !accountNumber) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc');
      return;
    }

    const payload = {
      bank_name: bankName,
      account_name: accountName.toUpperCase(),
      account_number: accountNumber,
      branch: branch,
      is_default: isDefault || configs.length === 0 // Force default if it's the first one
    };

    try {
      // If this is set to default, we need to unset others first (handled in trigger/backend ideally, but we do it frontend for now)
      if (payload.is_default) {
        await supabase.from('payment_configs').update({ is_default: false }).neq('id', '0');
        // Local mock sync
        const updatedLocal = configs.map(c => ({ ...c, is_default: false }));
        localStorage.setItem('mock_payment_configs', JSON.stringify(updatedLocal));
      }

      if (editingId) {
        const { error } = await supabase.from('payment_configs').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Cập nhật tài khoản thành công');
      } else {
        const { error } = await supabase.from('payment_configs').insert(payload);
        if (error) {
           // Mock fallback
           const newMock = { id: Date.now().toString(), ...payload, created_at: new Date().toISOString() };
           const currentLocal = JSON.parse(localStorage.getItem('mock_payment_configs') || '[]');
           if (payload.is_default) currentLocal.forEach((c: any) => c.is_default = false);
           localStorage.setItem('mock_payment_configs', JSON.stringify([newMock, ...currentLocal]));
        }
        toast.success('Thêm tài khoản thành công');
      }
      
      closeModal();
      fetchConfigs();
    } catch (e: any) {
      toast.error('Có lỗi xảy ra: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá tài khoản này không?')) return;
    try {
      const { error } = await supabase.from('payment_configs').delete().eq('id', id);
      if (error) {
         // Mock fallback
         const currentLocal = JSON.parse(localStorage.getItem('mock_payment_configs') || '[]');
         localStorage.setItem('mock_payment_configs', JSON.stringify(currentLocal.filter((c: any) => c.id !== id)));
      }
      toast.success('Đã xoá tài khoản');
      fetchConfigs();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // Reset all
      await supabase.from('payment_configs').update({ is_default: false }).neq('id', '0');
      // Set target to true
      await supabase.from('payment_configs').update({ is_default: true }).eq('id', id);
      
      // Mock fallback
      const currentLocal = JSON.parse(localStorage.getItem('mock_payment_configs') || '[]');
      currentLocal.forEach((c: any) => c.is_default = (c.id === id));
      localStorage.setItem('mock_payment_configs', JSON.stringify(currentLocal));
      
      toast.success('Đã thay đổi tài khoản mặc định');
      fetchConfigs();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const openModalForEdit = (config: PaymentConfig) => {
    setEditingId(config.id);
    setBankName(config.bank_name);
    setAccountName(config.account_name);
    setAccountNumber(config.account_number);
    setBranch(config.branch || '');
    setIsDefault(config.is_default);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setBankName('Vietcombank');
    setAccountName('');
    setAccountNumber('');
    setBranch('');
    setIsDefault(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cấu hình thanh toán</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý các tài khoản ngân hàng nhận tiền chuyển khoản QR</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
        >
          <Plus size={18} />
          Thêm tài khoản
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Đang tải cấu hình...</div>
        ) : configs.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-[24px] border border-dashed border-slate-200">
             <CreditCard className="w-12 h-12 text-slate-300 mb-4" />
             <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có tài khoản nào</h3>
             <p className="text-sm text-slate-500 mb-4">Thêm tài khoản ngân hàng để hệ thống tự động sinh mã QR thanh toán</p>
             <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">Thêm ngay</button>
          </div>
        ) : (
          configs.map((config) => (
            <motion.div 
              key={config.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("bg-white rounded-[24px] border p-6 relative overflow-hidden transition-all shadow-sm hover:shadow-md", config.is_default ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200")}
            >
              {config.is_default && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-bl-xl">
                  Mặc định
                </div>
              )}
              
              <div className="flex items-start justify-between mb-6 mt-2">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg shadow-inner">
                       {config.bank_name.substring(0, 2)}
                    </div>
                    <div>
                       <h3 className="font-black text-slate-900 text-lg">{config.bank_name}</h3>
                       {config.branch && <p className="text-xs text-slate-500 font-medium">CN {config.branch}</p>}
                    </div>
                 </div>
              </div>

              <div className="space-y-4 mb-6">
                 <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Chủ tài khoản</p>
                    <p className="font-bold text-slate-700 uppercase">{config.account_name}</p>
                 </div>
                 <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Số tài khoản</p>
                    <p className="font-mono font-bold text-xl text-blue-600 tracking-wider">{config.account_number}</p>
                 </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                 {!config.is_default && (
                   <button onClick={() => handleSetDefault(config.id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Star size={14} /> Chọn mặc định
                   </button>
                 )}
                 <button onClick={() => openModalForEdit(config)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={16} />
                 </button>
                 <button onClick={() => handleDelete(config.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                 </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <div className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[24px] shadow-2xl z-50 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black text-lg text-slate-800">{editingId ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}</h3>
                <button onClick={closeModal} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Ngân hàng *</label>
                  <select 
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  >
                     {COMMON_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                     <option value="Khác">Ngân hàng khác...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Số tài khoản *</label>
                  <input 
                    type="text" 
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="VD: 943771531"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Chủ tài khoản *</label>
                  <input 
                    type="text" 
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="VD: NGUYEN VAN A"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Chi nhánh</label>
                  <input 
                    type="text" 
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="VD: Hội sở chính"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                       <span className="text-sm font-bold text-slate-700 block">Đặt làm mặc định</span>
                       <span className="text-xs text-slate-500 font-medium">Hệ thống sẽ lấy tài khoản này sinh mã QR chuyển khoản</span>
                    </div>
                  </label>
                </div>

                <div className="pt-6 flex gap-3">
                  <button type="button" onClick={closeModal} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Huỷ</button>
                  <button type="submit" className="flex-[2] px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                     {editingId ? 'Lưu thay đổi' : 'Thêm tài khoản'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
