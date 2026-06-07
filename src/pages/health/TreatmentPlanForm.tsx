import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Loader2, Search, Calendar, User, Info, DollarSign } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, getDocs } from '../../lib/firebaseAdapter';
import { db, TreatmentPlan, Customer, Service, handleFirestoreError, OperationType } from '../../lib/supabase';
import { useAuth } from '../../App';
import toast from 'react-hot-toast';
import { generateDocCode, cn } from '../../lib/utils';

export function TreatmentPlanForm({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  const [formData, setFormData] = useState<Partial<TreatmentPlan>>({
    totalSessions: 10,
    status: 'active'
  });

  useEffect(() => {
    getDocs(query(collection(db, 'customers'))).then(snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });
    getDocs(query(collection(db, 'services'))).then(snap => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.serviceId) {
      return toast.error('Vui lòng chọn khách hàng và dịch vụ');
    }

    setLoading(true);
    try {
      const code = generateDocCode('LT');
      
      // Auto-generate sessions
      const sessions = Array.from({ length: formData.totalSessions || 10 }).map((_, i) => ({
         sessionNumber: i + 1,
         status: 'pending' as const
      }));

      await addDoc(collection(db, 'treatmentPlans'), {
        ...formData,
        code,
        completedSessions: 0,
        sessions,
        createdBy: profile?.id || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast.success('Tạo liệu trình thành công');
      onClose();
    } catch (error: any) {
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden">
        
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tạo Liệu Trình Mới</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Lên kế hoạch điều trị cho khách hàng</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
           <div className="grid grid-cols-2 gap-6">
              {/* Customer */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Khách hàng (*)</label>
                 {formData.customerName ? (
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                       <div>
                          <p className="font-bold text-sm text-blue-900">{formData.customerName}</p>
                          <p className="text-[10px] text-blue-600">{formData.customerPhone}</p>
                       </div>
                       <button type="button" onClick={() => setFormData({ ...formData, customerId: undefined, customerName: undefined, customerPhone: undefined })} className="p-1.5 bg-white rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                    </div>
                 ) : (
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" placeholder="Tìm tên, SĐT khách hàng..."
                          value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                          className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                       />
                       {customerSearch && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto overflow-hidden">
                             {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).slice(0, 5).map(c => (
                                <button key={c.id} type="button" onClick={() => {
                                   setFormData({ ...formData, customerId: c.id, customerName: c.name, customerPhone: c.phone });
                                   setCustomerSearch('');
                                }} className="w-full px-5 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                   <p className="font-bold text-sm text-slate-900">{c.name}</p>
                                   <p className="text-[10px] text-slate-500">{c.phone}</p>
                                </button>
                             ))}
                          </div>
                       )}
                    </div>
                 )}
              </div>

              {/* Service */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dịch vụ điều trị (*)</label>
                 {formData.serviceName ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                       <div>
                          <p className="font-bold text-sm text-emerald-900">{formData.serviceName}</p>
                       </div>
                       <button type="button" onClick={() => setFormData({ ...formData, serviceId: undefined, serviceName: undefined, price: undefined })} className="p-1.5 bg-white rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                    </div>
                 ) : (
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" placeholder="Tìm dịch vụ..."
                          value={serviceSearch} onChange={e => setServiceSearch(e.target.value)}
                          className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                       />
                       {serviceSearch && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto overflow-hidden">
                             {services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).slice(0, 5).map(s => (
                                <button key={s.id} type="button" onClick={() => {
                                   setFormData({ ...formData, serviceId: s.id, serviceName: s.name, price: s.price });
                                   setServiceSearch('');
                                }} className="w-full px-5 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                   <p className="font-bold text-sm text-slate-900">{s.name}</p>
                                   <p className="text-[10px] text-slate-500">{s.code}</p>
                                </button>
                             ))}
                          </div>
                       )}
                    </div>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tổng số buổi (*)</label>
                 <input required type="number" min="1" value={formData.totalSessions || ''} onChange={e => setFormData({ ...formData, totalSessions: Number(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Giá liệu trình</label>
                 <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="number" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ngày bắt đầu</label>
                 <input type="date" value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ngày dự kiến kết thúc</label>
                 <input type="date" value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Mục tiêu điều trị</label>
              <textarea rows={3} value={formData.treatmentGoal || ''} onChange={e => setFormData({ ...formData, treatmentGoal: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" placeholder="Ví dụ: Giảm 5kg trong 2 tháng..." />
           </div>
           
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ghi chú thêm</label>
              <textarea rows={2} value={formData.note || ''} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" />
           </div>
        </form>

        <div className="px-8 py-5 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Hủy</button>
          <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Tạo liệu trình
          </button>
        </div>

      </motion.div>
    </div>
  );
}
