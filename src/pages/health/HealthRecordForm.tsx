import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Loader2, Search, User, Activity, AlertCircle, FileText, Upload } from 'lucide-react';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp, query, getDocs } from '../../lib/firebaseAdapter';
import { db, HealthRecord, Customer, handleFirestoreError, OperationType } from '../../lib/supabase';
import { useAuth } from '../../App';
import toast from 'react-hot-toast';
import { generateDocCode, cn } from '../../lib/utils';
import { uploadHealthFiles } from '../../lib/healthStorage';

interface Props {
  recordId?: string | null;
  onClose: () => void;
}

const CONDITIONS = [
  { id: 'diabetes', label: 'Tiểu đường' },
  { id: 'heart', label: 'Tim mạch' },
  { id: 'hypertension', label: 'Huyết áp cao' },
  { id: 'hypotension', label: 'Huyết áp thấp' },
  { id: 'gout', label: 'Gout' },
  { id: 'cancer', label: 'Ung thư' },
  { id: 'stomach', label: 'Dạ dày' },
  { id: 'asthma', label: 'Hen suyễn' },
];

export function HealthRecordForm({ recordId, onClose }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!recordId);
  const [activeTab, setActiveTab] = useState<'info' | 'metrics' | 'history' | 'files'>('info');

  const [formData, setFormData] = useState<Partial<HealthRecord>>({
    gender: 'female',
    conditions: [],
    status: 'active'
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const snap = await getDocs(query(collection(db, 'customers')));
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    };
    fetchCustomers();

    if (recordId) {
      getDoc(doc(db, 'healthRecords', recordId)).then(snap => {
        if (snap.exists()) {
          setFormData({ id: snap.id, ...snap.data() } as HealthRecord);
        }
        setFetching(false);
      });
    }
  }, [recordId]);

  const handleCustomerSelect = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerAddress: customer.address,
      dateOfBirth: customer.birthDate,
      gender: (customer.gender as any) || 'female'
    }));
    setCustomerSearch('');
  };

  const handleConditionToggle = (conditionId: string) => {
    setFormData(prev => {
      const conditions = prev.conditions || [];
      if (conditions.includes(conditionId)) {
        return { ...prev, conditions: conditions.filter(id => id !== conditionId) };
      }
      return { ...prev, conditions: [...conditions, conditionId] };
    });
  };

  // Auto-calculate BMI
  useEffect(() => {
    if (formData.weight && formData.height) {
      const heightInMeters = formData.height / 100;
      const bmi = formData.weight / (heightInMeters * heightInMeters);
      setFormData(prev => ({ ...prev, bmi: Math.round(bmi * 10) / 10 }));
    }
  }, [formData.weight, formData.height]);

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!formData.customerName?.trim()) {
      setActiveTab('info');
      return toast.error('Vui lòng chọn hoặc nhập tên khách hàng');
    }

    setLoading(true);
    try {
      let attachmentUrls = formData.attachments || [];
      
      // Handle file uploads
      if (filesToUpload.length > 0) {
         toast.loading('Đang tải file lên...', { id: 'upload' });
         const urls = await uploadHealthFiles(filesToUpload, 'attachments');
         const newAttachments = filesToUpload.map((f, i) => ({ name: f.name, type: f.type, url: urls[i] }));
         attachmentUrls = [...attachmentUrls, ...newAttachments];
         toast.dismiss('upload');
      }

      const dataToSave = {
        ...formData,
        attachments: attachmentUrls,
        status: isDraft ? 'draft' : 'active',
        inChargeStaff: profile?.id || '',
        inChargeStaffName: profile?.name || 'System',
        updatedAt: serverTimestamp()
      };

      if (recordId) {
        await updateDoc(doc(db, 'healthRecords', recordId), dataToSave);
        toast.success(isDraft ? 'Đã lưu nháp' : 'Cập nhật hồ sơ thành công');
      } else {
        const code = generateDocCode('HS');
        await addDoc(collection(db, 'healthRecords'), {
          ...dataToSave,
          code,
          createdBy: profile?.id || '',
          createdAt: serverTimestamp()
        });
        toast.success(isDraft ? 'Đã tạo bản nháp' : 'Tạo hồ sơ thành công');
      }
      onClose();
    } catch (error: any) {
      toast.dismiss('upload');
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'info', label: 'Thông tin chung', icon: User },
    { id: 'metrics', label: 'Chỉ số cơ thể', icon: Activity },
    { id: 'history', label: 'Bệnh lý & Tiền sử', icon: AlertCircle },
    { id: 'files', label: 'File đính kèm', icon: Upload },
  ];

  if (fetching) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{recordId ? 'Cập nhật hồ sơ sức khỏe' : 'Tạo hồ sơ sức khỏe'}</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Lưu trữ thông tin bệnh án khách hàng</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-8 gap-2 border-b border-slate-100 shrink-0 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                   'flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-xs transition-all whitespace-nowrap',
                   activeTab === tab.id ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                )}
             >
                <tab.icon className="w-4 h-4" />
                {tab.label}
             </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-8">
           {/* TAB 1: INFO */}
           <div className={cn("space-y-6", activeTab === 'info' ? 'block' : 'hidden')}>
              {!recordId && (
                 <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Chọn từ khách hàng có sẵn (Tùy chọn)</label>
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" placeholder="Tìm theo tên, SĐT..."
                          value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-medium"
                       />
                       {customerSearch && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                             {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).slice(0, 5).map(c => (
                                <button key={c.id} type="button" onClick={() => handleCustomerSelect(c)} className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50">
                                   <p className="font-bold text-sm">{c.name}</p>
                                   <p className="text-[10px] text-slate-500">{c.phone}</p>
                                </button>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Họ và tên (*)</label>
                    <input required type="text" value={formData.customerName || ''} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Số điện thoại (*)</label>
                    <input required type="tel" value={formData.customerPhone || ''} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ngày sinh</label>
                    <input type="date" value={formData.dateOfBirth || ''} onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Giới tính</label>
                    <select value={formData.gender || 'female'} onChange={e => setFormData({ ...formData, gender: e.target.value as any })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none">
                       <option value="female">Nữ</option>
                       <option value="male">Nam</option>
                       <option value="other">Khác</option>
                    </select>
                 </div>
                 <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Địa chỉ</label>
                    <input type="text" value={formData.customerAddress || ''} onChange={e => setFormData({ ...formData, customerAddress: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                 </div>
              </div>
           </div>

           {/* TAB 2: METRICS */}
           <div className={cn("grid grid-cols-2 gap-6", activeTab === 'metrics' ? 'grid' : 'hidden')}>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chiều cao (cm)</label>
                 <input type="number" value={formData.height || ''} onChange={e => setFormData({ ...formData, height: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Cân nặng (kg)</label>
                 <input type="number" value={formData.weight || ''} onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chỉ số BMI (Tự tính)</label>
                 <input type="number" readOnly value={formData.bmi || ''} className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-slate-500 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Huyết áp (mmHg)</label>
                 <input type="text" placeholder="120/80" value={formData.bloodPressure || ''} onChange={e => setFormData({ ...formData, bloodPressure: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nhịp tim (bpm)</label>
                 <input type="number" value={formData.heartRate || ''} onChange={e => setFormData({ ...formData, heartRate: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Đường huyết (mmol/L)</label>
                 <input type="number" step="0.1" value={formData.bloodSugar || ''} onChange={e => setFormData({ ...formData, bloodSugar: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
           </div>

           {/* TAB 3: HISTORY */}
           <div className={cn("space-y-6", activeTab === 'history' ? 'block' : 'hidden')}>
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Bệnh nền đang có</label>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CONDITIONS.map(c => {
                       const isSelected = (formData.conditions || []).includes(c.id);
                       return (
                          <button
                             key={c.id}
                             type="button"
                             onClick={() => handleConditionToggle(c.id)}
                             className={cn(
                                'px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left flex justify-between items-center',
                                isSelected ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                             )}
                          >
                             {c.label}
                             {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />}
                          </button>
                       );
                    })}
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dị ứng (Thức ăn, Thời tiết, Thuốc...)</label>
                 <textarea rows={2} value={formData.allergies || ''} onChange={e => setFormData({ ...formData, allergies: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Thuốc đang sử dụng</label>
                 <textarea rows={2} value={formData.currentMedications || ''} onChange={e => setFormData({ ...formData, currentMedications: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tiền sử phẫu thuật / Điều trị</label>
                 <textarea rows={3} value={formData.treatmentHistory || ''} onChange={e => setFormData({ ...formData, treatmentHistory: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tình trạng hiện tại (Mô tả)</label>
                 <textarea rows={3} value={formData.currentCondition || ''} onChange={e => setFormData({ ...formData, currentCondition: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" />
              </div>
           </div>

           {/* TAB 4: FILES */}
           <div className={cn("space-y-6", activeTab === 'files' ? 'block' : 'hidden')}>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                 <Upload className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                 <p className="font-bold text-sm text-slate-700">Tải lên kết quả xét nghiệm, siêu âm...</p>
                 <p className="text-xs text-slate-500 mt-1 mb-4">Hỗ trợ JPG, PNG, PDF (Tối đa 10MB/file)</p>
                 <label className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                    Chọn File
                    <input type="file" multiple className="hidden" accept="image/*,.pdf" onChange={e => {
                       if (e.target.files) setFilesToUpload(prev => [...prev, ...Array.from(e.target.files!)]);
                    }} />
                 </label>
              </div>

              {/* Display existing attachments */}
              {formData.attachments && formData.attachments.length > 0 && (
                 <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900">File đã lưu ({formData.attachments.length})</h4>
                    <div className="space-y-2">
                       {formData.attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                             <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-500" />
                                <a href={file.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-700 hover:text-blue-600 line-clamp-1">{file.name}</a>
                             </div>
                             <button type="button" onClick={() => setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter((_, i) => i !== idx) }))} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50">
                                <X className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
              )}

              {/* Display pending files */}
              {filesToUpload.length > 0 && (
                 <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900">File chờ tải lên ({filesToUpload.length})</h4>
                    <div className="space-y-2">
                       {filesToUpload.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm border-amber-200 bg-amber-50/30">
                             <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-amber-500" />
                                <span className="text-sm font-bold text-slate-700 line-clamp-1">{file.name}</span>
                                <span className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                             </div>
                             <button type="button" onClick={() => setFilesToUpload(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50">
                                <X className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
              )}
           </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
          <button type="button" onClick={() => handleSubmit({ preventDefault: () => {} } as any, true)} disabled={loading} className="px-5 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">
            Lưu nháp
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Hủy</button>
            <button type="button" onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-8 py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Lưu hồ sơ
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
