import { useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { collection, query, where, getDocs, deleteDoc, doc } from './firebaseAdapter';
import { defaultSettings } from './settings';

export function useAutoCleanup(systemSettings: any) {
  const { profile } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    // Only run once per session, and only for admins
    if (hasRun.current || profile?.role !== 'admin') return;
    
    const autoDeleteDays = systemSettings?.trash?.autoDeleteDays ?? defaultSettings.trash?.autoDeleteDays ?? 30;
    
    // If set to 0, it means manual delete only (Không bao giờ)
    if (autoDeleteDays <= 0) return;

    const runCleanup = async () => {
      hasRun.current = true;
      console.log(`[Auto Cleanup] Bắt đầu dọn dẹp dữ liệu quá ${autoDeleteDays} ngày...`);
      
      const collections = ['customers', 'products', 'orders', 'transactions', 'debts', 'bookings'];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - autoDeleteDays);
      const cutoffTime = cutoffDate.getTime();

      let deletedCount = 0;

      for (const colName of collections) {
        try {
          const q = query(collection(colName), where('is_deleted', '==', true));
          const snapshot = await getDocs(q);
          
          for (const d of snapshot.docs) {
            const data = d.data() as any;
            if (data.deleted_at) {
              const deletedTime = new Date(data.deleted_at).getTime();
              if (deletedTime < cutoffTime) {
                await deleteDoc(doc(collection(colName), d.id));
                deletedCount++;
              }
            }
          }
        } catch (error) {
          console.error(`[Auto Cleanup] Lỗi dọn dẹp collection ${colName}:`, error);
        }
      }

      if (deletedCount > 0) {
        console.log(`[Auto Cleanup] Hoàn tất. Đã xóa vĩnh viễn ${deletedCount} mục rác.`);
      } else {
        console.log(`[Auto Cleanup] Không có mục rác nào cần dọn dẹp.`);
      }
    };

    // Delay the cleanup slightly so it doesn't block UI rendering on load
    const timer = setTimeout(runCleanup, 5000);
    return () => clearTimeout(timer);
  }, [profile?.role, systemSettings?.trash?.autoDeleteDays]);
}
