import { collection, addDoc, serverTimestamp } from '../lib/firebaseAdapter';
import { db } from './supabase';

export async function logActivity(
  user: { uid?: string; id?: string; email: string; name?: string } | null,
  module: string,
  action: string,
  details: string,
  severity: 'info' | 'warning' | 'danger' = 'info',
  oldData?: any,
  newData?: any
) {
  if (!user) return;
  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId: user.uid || user.id || '',
      userEmail: user.email,
      userName: user.name || user.email,
      module,
      action,
      details,
      severity,
      oldData: oldData || null,
      newData: newData || null,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
