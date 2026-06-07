import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Loader2, Search, Upload, Camera, PenTool, Image as ImageIcon } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, getDocs } from '../../lib/firebaseAdapter';
import { db, TherapyLog, TreatmentPlan, handleFirestoreError, OperationType } from '../../lib/supabase';
import { useAuth } from '../../App';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { uploadHealthFiles } from '../../lib/healthStorage';
import SignatureCanvas from 'react-signature-canvas';

export function TherapyLogForm({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [planSearch, setPlanSearch] = useState('');
  
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  const [formData, setFormData] = useState<Partial<TherapyLog>>({
     date: new Date().toISOString().split('T')[0]
  });

  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  
  const customerSigRef = useRef<SignatureCanvas>(null);
  const staffSigRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    // Only load active plans
    getDocs(query(collection(db, 'treatmentPlans'))).then(snap => {
      const active = snap.docs.map(d => ({ id: d.id, ...d.data() } as TreatmentPlan)).filter(p => p.status === 'active');
      setPlans(active);
    });
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.treatmentPlanId) {
       setActiveStep(1);
       return toast.error('Vui lòng chọn liệu trình điều trị');
    }

    setLoading(true);
    try {
      // 1. Get Signature data if drawn
      const custSig = customerSigRef.current?.isEmpty() ? undefined : customerSigRef.current?.getTrimmedCanvas().toDataURL('image/png');
      const staffSig = staffSigRef.current?.isEmpty() ? undefined : staffSigRef.current?.getTrimmedCanvas().toDataURL('image/png');

      // 2. Upload images
      let beforeUrls: string[] = [];
      let afterUrls: string[] = [];
      
      if (beforeFiles.length > 0) {
         toast.loading('Đang tải ảnh Trước điều trị...', { id: 'upload-before' });
         beforeUrls = await uploadHealthFiles(beforeFiles, 'therapy-before');
         toast.dismiss('upload-before');
      }
      if (afterFiles.length > 0) {
         toast.loading('Đang tải ảnh Sau điều trị...', { id: 'upload-after' });
         afterUrls = await uploadHealthFiles(afterFiles, 'therapy-after');
         toast.dismiss('upload-after');
      }

      // 3. Save Log
      const dataToSave = {
        ...formData,
        imagesBefore: beforeUrls,
        imagesAfter: afterUrls,
        customerSignature: custSig,
        staffSignature: staffSig,
        technicianId: profile?.id || '',
        technicianName: profile?.name || 'System',
        status: 'completed' as const,
        createdBy: profile?.id || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'therapyLogs'), dataToSave);
      
      // 4. Update Treatment Plan completed sessions count
      const plan = plans.find(p => p.id === formData.treatmentPlanId);
      if (plan) {
         const newCompleted = (plan.completedSessions || 0) + 1;
         await updateDoc(doc(db, 'treatmentPlans', plan.id!), {
            completedSessions: newCompleted,
            updatedAt: serverTimestamp()
         });
      }

      toast.success('Lưu nhật ký trị liệu thành công');
      onClose();
    } catch (error: any) {
      toast.dismiss('upload-before');
      toast.dismiss('upload-after');
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, label: 'Thông tin chung' },
    { id: 2, label: 'Trước điều trị' },
    { id: 3, label: 'Thực hiện & Sau ĐT' },
    { id: 4, label: 'Xác nhận chữ ký' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-4xl max-h-[95vh] bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tạo Nhật Ký Trị Liệu</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ghi nhận thông tin từng buổi thực hiện</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Stepper */}
        <div className="flex px-8 py-4 border-b border-slate-100 bg-white shrink-0 items-center justify-between">
           {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                 <button onClick={() => setActiveStep(step.id as any)} className={cn("flex flex-col items-center gap-1.5 transition-all", activeStep === step.id ? 'opacity-100' : 'opacity-40 hover:opacity-70')}>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors", activeStep === step.id ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-slate-100 text-slate-500')}>
                       {step.id < activeStep ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                    </div>
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", activeStep === step.id ? 'text-amber-600' : 'text-slate-500')}>{step.label}</span>
                 </button>
                 {idx < steps.length - 1 && <div className={cn("w-12 h-0.5 mx-4", activeStep > step.id ? 'bg-amber-200' : 'bg-slate-100')} />}
              </div>
           ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
           
           {/* STEP 1: PLAN SELECTION */}
           <div className={cn("space-y-6", activeStep === 1 ? 'block' : 'hidden')}>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chọn Liệu Trình Đang Hoạt Động (*)</label>
                 {formData.customerName && formData.treatmentPlanId ? (
                    <div className="flex items-center justify-between p-5 bg-amber-50 rounded-2xl border border-amber-100">
                       <div>
                          <p className="font-bold text-sm text-amber-900">{formData.customerName}</p>
                          <div className="flex items-center gap-3 mt-1">
                             <span className="text-xs font-bold text-amber-700">{plans.find(p => p.id === formData.treatmentPlanId)?.serviceName}</span>
                             <span className="px-2 py-0.5 bg-white text-amber-600 rounded-md text-[10px] font-black">Buổi {formData.sessionNumber || 1}</span>
                          </div>
                       </div>
                       <button type="button" onClick={() => setFormData({ ...formData, treatmentPlanId: undefined, customerId: undefined, customerName: undefined })} className="p-2 bg-white rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                 ) : (
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" placeholder="Tìm tên khách hàng hoặc mã liệu trình..."
                          value={planSearch} onChange={e => setPlanSearch(e.target.value)}
                          className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-medium"
                       />
                       {planSearch && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto">
                             {plans.filter(p => p.customerName?.toLowerCase().includes(planSearch.toLowerCase()) || p.code?.toLowerCase().includes(planSearch.toLowerCase())).map(p => (
                                <button key={p.id} type="button" onClick={() => {
                                   setFormData({ 
                                      ...formData, 
                                      treatmentPlanId: p.id, 
                                      customerId: p.customerId, 
                                      customerName: p.customerName,
                                      sessionNumber: (p.completedSessions || 0) + 1,
                                      servicesPerformed: p.serviceName
                                   });
                                   setPlanSearch('');
                                }} className="w-full px-5 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center">
                                   <div>
                                      <p className="font-bold text-sm text-slate-900">{p.customerName} <span className="text-slate-400 font-normal">({p.code})</span></p>
                                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">{p.serviceName}</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-xs font-black text-blue-600">{p.completedSessions}/{p.totalSessions}</p>
                                   </div>
                                </button>
                             ))}
                          </div>
                       )}
                    </div>
                 )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ngày thực hiện</label>
                    <input type="date" value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Buổi số</label>
                    <input type="number" value={formData.sessionNumber || ''} onChange={e => setFormData({ ...formData, sessionNumber: Number(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none" />
                 </div>
              </div>
           </div>

           {/* STEP 2: BEFORE */}
           <div className={cn("space-y-6", activeStep === 2 ? 'block' : 'hidden')}>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Triệu chứng & Cảm nhận khách hàng</label>
                 <textarea rows={2} value={formData.symptomsBefore || ''} onChange={e => setFormData({ ...formData, symptomsBefore: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none resize-none" placeholder="Ví dụ: Đau mỏi cổ vai gáy nhiều, khó ngủ..." />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chỉ số hiện tại (Nếu cần đo)</label>
                 <input type="text" value={formData.vitalSignsBefore || ''} onChange={e => setFormData({ ...formData, vitalSignsBefore: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none" placeholder="Ví dụ: HA 130/85, Cân nặng 65kg" />
              </div>
              
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Hình ảnh Trước điều trị</label>
                 <div className="flex flex-wrap gap-4">
                    {beforeFiles.map((f, i) => (
                       <div key={i} className="relative w-24 h-24 rounded-2xl border border-slate-200 overflow-hidden group">
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setBeforeFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                       </div>
                    ))}
                    <label className="w-24 h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                       <Camera className="w-6 h-6" />
                       <span className="text-[10px] font-bold">Thêm ảnh</span>
                       <input type="file" multiple accept="image/*" className="hidden" onChange={e => { if(e.target.files) setBeforeFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
                    </label>
                 </div>
              </div>
           </div>

           {/* STEP 3: DURING & AFTER */}
           <div className={cn("space-y-6", activeStep === 3 ? 'block' : 'hidden')}>
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dịch vụ đã thực hiện</label>
                    <input type="text" value={formData.servicesPerformed || ''} onChange={e => setFormData({ ...formData, servicesPerformed: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Thời gian thực hiện (Phút)</label>
                    <input type="number" value={formData.duration || ''} onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none" />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ghi chú trong quá trình làm (Nếu có)</label>
                 <textarea rows={2} value={formData.notesDuring || ''} onChange={e => setFormData({ ...formData, notesDuring: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none resize-none" />
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2"><Sparkles className="w-3 h-3 text-emerald-500" /> Kết quả & Cảm nhận sau làm</label>
                 <textarea rows={2} value={formData.results || ''} onChange={e => setFormData({ ...formData, results: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 outline-none resize-none" placeholder="Ví dụ: Giảm đau rõ rệt, khách hàng thấy nhẹ nhõm..." />
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Hình ảnh Sau điều trị</label>
                 <div className="flex flex-wrap gap-4">
                    {afterFiles.map((f, i) => (
                       <div key={i} className="relative w-24 h-24 rounded-2xl border border-slate-200 overflow-hidden group">
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setAfterFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                       </div>
                    ))}
                    <label className="w-24 h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                       <ImageIcon className="w-6 h-6 text-emerald-400" />
                       <span className="text-[10px] font-bold">Thêm ảnh</span>
                       <input type="file" multiple accept="image/*" className="hidden" onChange={e => { if(e.target.files) setAfterFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
                    </label>
                 </div>
              </div>
           </div>

           {/* STEP 4: SIGNATURES */}
           <div className={cn("grid grid-cols-2 gap-8", activeStep === 4 ? 'grid' : 'hidden')}>
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2"><PenTool className="w-4 h-4 text-blue-500" /> Khách hàng ký nhận</label>
                    <button onClick={() => customerSigRef.current?.clear()} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase">Xóa vẽ lại</button>
                 </div>
                 <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden shadow-inner h-60 relative cursor-crosshair">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"><span className="text-4xl font-black text-slate-300 transform -rotate-12">Ký tại đây</span></div>
                    <SignatureCanvas 
                       ref={customerSigRef} 
                       penColor="black" 
                       canvasProps={{ className: 'w-full h-full relative z-10' }} 
                    />
                 </div>
                 <p className="text-center font-bold text-sm text-slate-700">{formData.customerName || 'Khách hàng'}</p>
              </div>
              
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2"><PenTool className="w-4 h-4 text-amber-500" /> Kỹ thuật viên ký</label>
                    <button onClick={() => staffSigRef.current?.clear()} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase">Xóa vẽ lại</button>
                 </div>
                 <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden shadow-inner h-60 relative cursor-crosshair">
                    <SignatureCanvas 
                       ref={staffSigRef} 
                       penColor="black" 
                       canvasProps={{ className: 'w-full h-full relative z-10' }} 
                    />
                 </div>
                 <p className="text-center font-bold text-sm text-slate-700">{profile?.name || 'KTV'}</p>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white shrink-0 flex justify-between items-center">
          {activeStep > 1 ? (
             <button type="button" onClick={() => setActiveStep((activeStep - 1) as any)} className="px-6 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Quay lại</button>
          ) : <div />}
          
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">Hủy</button>
            {activeStep < 4 ? (
               <button type="button" onClick={() => setActiveStep((activeStep + 1) as any)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all">Tiếp tục</button>
            ) : (
               <button onClick={() => handleSubmit()} disabled={loading} className="flex items-center gap-2 px-8 py-3 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Lưu Nhật Ký
               </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
