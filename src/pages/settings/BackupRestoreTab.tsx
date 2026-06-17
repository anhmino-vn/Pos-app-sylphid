import React, { useState } from 'react';
import { Download, Upload, AlertTriangle, Shield, CheckCircle2, HardDrive, RefreshCw, Loader2 } from 'lucide-react';
import { collection, getDocs, setDoc, doc } from '../../lib/firebaseAdapter';
import { db } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

const IMPORTANT_COLLECTIONS = [
  'products',
  'services',
  'customers',
  'orders',
  'transactions',
  'bookings',
  'inventoryTransactions',
  'debts',
  'suppliers'
];

interface BackupRestoreTabProps {
  type: 'backup' | 'restore';
}

export function BackupRestoreTab({ type }: BackupRestoreTabProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBackup = async () => {
    setLoading(true);
    setProgress(0);
    const backupData: Record<string, any[]> = {};
    
    try {
      for (let i = 0; i < IMPORTANT_COLLECTIONS.length; i++) {
        const colName = IMPORTANT_COLLECTIONS[i];
        const snapshot = await getDocs(collection(db, colName));
        backupData[colName] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setProgress(Math.round(((i + 1) / IMPORTANT_COLLECTIONS.length) * 100));
      }
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sylphid-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Sao lưu dữ liệu thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi sao lưu dữ liệu!');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('CẢNH BÁO: Phục hồi dữ liệu sẽ ghi đè lên dữ liệu hiện tại (nếu trùng ID) hoặc thêm mới. Bạn có chắc chắn muốn tiếp tục?')) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    setProgress(0);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, any[]>;
      
      const collections = Object.keys(data);
      for (let i = 0; i < collections.length; i++) {
        const colName = collections[i];
        const records = data[colName];
        if (Array.isArray(records)) {
          for (const record of records) {
             if (record.id) {
               await setDoc(doc(collection(db, colName), record.id), record);
             }
          }
        }
        setProgress(Math.round(((i + 1) / collections.length) * 100));
      }

      toast.success('Phục hồi dữ liệu thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi phục hồi dữ liệu hoặc file không đúng định dạng!');
    } finally {
      setLoading(false);
      setProgress(0);
      e.target.value = '';
    }
  };

  if (type === 'backup') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center py-20 text-slate-500">
           <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
             <HardDrive className="w-10 h-10" />
           </div>
           <h3 className="text-xl font-black text-slate-900 uppercase">Sao lưu dữ liệu (Backup)</h3>
           <p className="max-w-md mx-auto mt-2 text-slate-500 font-medium">Xuất toàn bộ dữ liệu quan trọng của hệ thống ra file JSON để lưu trữ dự phòng.</p>
           
           <div className="mt-8 flex flex-col items-center">
             <button
               onClick={handleBackup}
               disabled={loading}
               className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/30"
             >
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
               {loading ? `Đang sao lưu... ${progress}%` : 'Tạo bản sao lưu ngay'}
             </button>
             <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-4">Có thể mất vài phút tùy vào dung lượng dữ liệu</p>
           </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center py-20 text-slate-500 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500"></div>
         <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-6">
           <RefreshCw className="w-10 h-10" />
         </div>
         <h3 className="text-xl font-black text-slate-900 uppercase">Khôi phục dữ liệu (Restore)</h3>
         <p className="max-w-md mx-auto mt-2 text-slate-500 font-medium">Khôi phục dữ liệu từ file JSON đã sao lưu trước đó.</p>
         
         <div className="mt-8 bg-amber-50 border border-amber-200 p-4 rounded-2xl max-w-md w-full text-left flex items-start gap-3">
           <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
           <div>
             <p className="text-xs font-black uppercase tracking-widest text-amber-800 mb-1">Cảnh báo ghi đè</p>
             <p className="text-xs text-amber-700">Dữ liệu hiện tại có thể bị ghi đè nếu trùng lặp ID. Vui lòng đảm bảo bạn đang dùng đúng file backup của hệ thống.</p>
           </div>
         </div>

         <div className="mt-8 flex flex-col items-center">
           <input type="file" accept=".json" id="restore-file" className="hidden" onChange={handleRestore} disabled={loading} />
           <label
             htmlFor="restore-file"
             className="flex items-center gap-2 px-8 py-4 bg-rose-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-lg shadow-rose-600/30 cursor-pointer"
           >
             {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
             {loading ? `Đang khôi phục... ${progress}%` : 'Chọn file JSON khôi phục'}
           </label>
         </div>
      </div>
    </motion.div>
  );
}
